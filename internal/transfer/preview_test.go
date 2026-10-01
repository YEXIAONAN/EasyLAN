package transfer

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"localchat/internal/chat"
)

func (h *harness) share(name string, data []byte) chat.File {
	h.t.Helper()
	id := h.init(name, int64(len(data)))
	if len(data) > 0 {
		h.request("PUT", "/api/files/"+id+"/chunks/0", "application/octet-stream", bytes.NewReader(data), 204).Body.Close()
	}
	resp := h.request("POST", "/api/files/"+id+"/complete", "", nil, 200)
	defer resp.Body.Close()
	var file chat.File
	if err := json.NewDecoder(resp.Body).Decode(&file); err != nil {
		h.t.Fatal(err)
	}
	return file
}

func TestPreviewTypesSafetyAndDownloadRegression(t *testing.T) {
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK9sAAAAASUVORK5CYII=")
	pdf := []byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n")
	for _, tc := range []struct {
		name        string
		data        []byte
		kind, media string
	}{
		{"hello.txt", []byte("hello\n世界\n"), "text", "text/plain; charset=utf-8"},
		{"server.log", []byte("2026 info: ready\n"), "text", "text/plain; charset=utf-8"},
		{"config.json", []byte("{\"ok\":true}"), "text", "text/plain; charset=utf-8"},
		{"main.go", []byte("package main\nfunc main() {}"), "text", "text/plain; charset=utf-8"},
		{"test.html", []byte("<html><script>alert('unsafe')</script></html>"), "text", "text/plain; charset=utf-8"},
		{"test.htm", []byte("<img src=x onerror=alert(1)>"), "text", "text/plain; charset=utf-8"},
		{".env", []byte("PORT=8787"), "text", "text/plain; charset=utf-8"},
		{"Dockerfile", []byte("FROM scratch"), "text", "text/plain; charset=utf-8"},
		{"Makefile", []byte("all:\n\techo hi"), "text", "text/plain; charset=utf-8"},
		{"empty.txt", nil, "text", "text/plain; charset=utf-8"},
		{"invalid-utf8.txt", []byte{0xff, 0xfe, 'a'}, "text", "text/plain; charset=utf-8"},
		{"photo.png", png, "image", "image/png"},
		{"manual.pdf", pdf, "pdf", "application/pdf"},
		{"fake.png", []byte("<html><script>alert(1)</script></html>"), "none", ""},
		{"fake.pdf", []byte("<html>not PDF</html>"), "none", ""},
		{"binary.txt", []byte{'a', 0, 'b'}, "none", ""},
		{"image.txt", png, "none", ""},
		{"script.svg", []byte("<svg onload=alert(1)></svg>"), "none", ""},
		{"archive.zip", []byte("PK\x03\x04"), "none", ""},
		{"program.exe", []byte("MZ executable"), "none", ""},
		{"document.docx", []byte("PK\x03\x04"), "none", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newHarness(t)
			file := h.share(tc.name, tc.data)
			if file.PreviewType != tc.kind {
				t.Fatalf("metadata = %q, want %q", file.PreviewType, tc.kind)
			}
			base := "/api/files/" + file.ID
			status := 200
			if tc.kind == "none" {
				status = 415
			}
			resp := h.request("GET", base+"/preview", "", nil, status)
			data, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if tc.kind != "none" {
				if !bytes.Equal(data, tc.data) || resp.Header.Get("Content-Type") != tc.media || resp.Header.Get("X-Content-Type-Options") != "nosniff" {
					t.Fatal("unsafe MIME or modified preview")
				}
				if !strings.HasPrefix(resp.Header.Get("Content-Disposition"), "inline") || !strings.Contains(resp.Header.Get("Content-Security-Policy"), "frame-ancestors 'self'") {
					t.Fatal("missing preview isolation headers")
				}
				if tc.kind != "pdf" && !strings.Contains(resp.Header.Get("Content-Security-Policy"), "default-src 'none'") {
					t.Fatal("text/image policy was weakened")
				}
				if resp.Header.Get("X-Preview-Type") != tc.kind {
					t.Fatal("missing preview type")
				}
			}
			// Preview must never change download bytes or attachment semantics.
			download := h.request("GET", base, "", nil, 200)
			downloaded, _ := io.ReadAll(download.Body)
			download.Body.Close()
			if !bytes.Equal(downloaded, tc.data) || !strings.HasPrefix(download.Header.Get("Content-Disposition"), "attachment") {
				t.Fatal("download regression")
			}
			if tc.kind == "image" || tc.kind == "pdf" {
				req, _ := http.NewRequest("GET", h.srv.URL+base+"/preview", nil)
				req.Header.Set("Range", "bytes=0-3")
				rangeResp, err := http.DefaultClient.Do(req)
				if err != nil {
					t.Fatal(err)
				}
				rangeData, _ := io.ReadAll(rangeResp.Body)
				rangeResp.Body.Close()
				if rangeResp.StatusCode != 206 || !bytes.Equal(rangeData, tc.data[:4]) {
					t.Fatal("native preview Range regression")
				}
			}
		})
	}
}

func TestLargeTextPreviewIsBounded(t *testing.T) {
	h := newHarness(t)
	const size = 780 * 1024 * 1024
	id := h.init("server.log", size)
	s := h.m.get(id)
	f, err := os.Create(filepath.Join(s.dir, "file"))
	if err != nil {
		t.Fatal(err)
	}
	// A sparse 780 MiB fixture exercises the real large-file path without
	// allocating or copying the full file into the test process.
	prefix := bytes.Repeat([]byte("log\n"), int(TextPreviewMaxBytes/4)+1)
	if _, err = f.Write(prefix); err != nil {
		t.Fatal(err)
	}
	if err = f.Truncate(size); err != nil {
		t.Fatal(err)
	}
	f.Close()
	s.file.PreviewType = previewType(filepath.Join(s.dir, "file"), s.file.Name)
	s.complete = true
	base := "/api/files/" + id
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	req, _ := http.NewRequest("GET", h.srv.URL+base+"/preview", nil)
	req.Header.Set("Range", "bytes=524288-") // Range cannot bypass the text cap.
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	runtime.ReadMemStats(&after)
	if allocated := after.TotalAlloc - before.TotalAlloc; allocated > 32*1024*1024 {
		t.Fatalf("large preview allocated %d bytes; must not load the full 780 MiB file", allocated)
	}
	if err != nil || resp.StatusCode != 200 || int64(len(data)) != TextPreviewMaxBytes || !bytes.Equal(data, prefix[:TextPreviewMaxBytes]) {
		t.Fatal("text preview exceeded cap or returned wrong prefix")
	}
	if resp.Header.Get("X-Preview-Truncated") != "true" || resp.Header.Get("X-Preview-Max-Bytes") != "524288" {
		t.Fatal("missing truncation metadata")
	}
	head := h.request("HEAD", base+"/preview", "", nil, 200)
	if head.ContentLength != TextPreviewMaxBytes {
		t.Fatal("HEAD must report capped preview size")
	}
	head.Body.Close()
	download := h.request("HEAD", base, "", nil, 200)
	if download.Header.Get("Content-Length") != strconv.Itoa(size) {
		t.Fatal("full download size changed")
	}
	download.Body.Close()
}

func TestPreviewMissingUnfinishedAndExpiredFiles(t *testing.T) {
	h := newHarness(t)
	h.request("GET", "/api/files/not-a-session/preview", "", nil, 404).Body.Close()
	id := h.init("hello.txt", 5)
	h.request("GET", "/api/files/"+id+"/preview", "", nil, 409).Body.Close()
	file := h.share("hello.txt", []byte("hello"))
	os.Remove(filepath.Join(h.m.root, file.ID, "file"))
	h.request("GET", "/api/files/"+file.ID+"/preview", "", nil, 404).Body.Close()
	// No supplied filename or unknown ID can select an external disk path.
	h.request("GET", "/api/files/%2e%2e%2foutside/preview", "", nil, 404).Body.Close()
}
