package transfer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"localchat/internal/chat"
)

type harness struct {
	m      *Manager
	srv    *httptest.Server
	t      *testing.T
	mu     sync.Mutex
	shared []chat.Message
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	h := &harness{t: t}
	m, err := New(func(msg chat.Message) { h.mu.Lock(); defer h.mu.Unlock(); h.shared = append(h.shared, msg) })
	if err != nil {
		t.Fatal(err)
	}
	h.m = m
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/files", m.Init)
	mux.HandleFunc("PUT /api/files/{id}/chunks/{index}", m.Chunk)
	mux.HandleFunc("POST /api/files/{id}/complete", m.Complete)
	mux.HandleFunc("DELETE /api/files/{id}", m.Cancel)
	mux.HandleFunc("GET /api/files/{id}", m.Download)
	mux.HandleFunc("GET /api/files/{id}/preview", m.Preview)
	h.srv = httptest.NewServer(mux)
	t.Cleanup(func() {
		h.srv.Close()
		if err := m.Close(); err != nil {
			t.Error(err)
		}
	})
	return h
}

func (h *harness) request(method, path, contentType string, body io.Reader, want int) *http.Response {
	h.t.Helper()
	req, err := http.NewRequest(method, h.srv.URL+path, body)
	if err != nil {
		h.t.Fatal(err)
	}
	req.Header.Set("Content-Type", contentType)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	if resp.StatusCode != want {
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		h.t.Fatalf("%s %s = %d, want %d: %s", method, path, resp.StatusCode, want, data)
	}
	h.t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func (h *harness) init(name string, size int64) string {
	h.t.Helper()
	body, _ := json.Marshal(map[string]any{"name": name, "size": size, "chunkSize": ChunkSize, "chunks": (size + ChunkSize - 1) / ChunkSize, "username": "Waiting"})
	resp := h.request("POST", "/api/files", "application/json", bytes.NewReader(body), 201)
	defer resp.Body.Close()
	var data struct {
		FileID string `json:"fileId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		h.t.Fatal(err)
	}
	return data.FileID
}

func TestConcurrentUploadDownloadAndCleanup(t *testing.T) {
	h := newHarness(t)
	suffix := []byte("\nend of file\n")
	first := bytes.Repeat([]byte{0x61}, int(ChunkSize))
	id := h.init(`..\..\配置.json`, ChunkSize+int64(len(suffix)))
	base := "/api/files/" + id
	h.request("POST", base+"/complete", "", nil, 409).Body.Close()
	var wg sync.WaitGroup
	for i, data := range [][]byte{first, suffix} {
		wg.Add(1)
		go func(i int, data []byte) {
			defer wg.Done()
			h.request("PUT", fmt.Sprintf("%s/chunks/%d", base, i), "application/octet-stream", bytes.NewReader(data), 204).Body.Close()
		}(i, data)
	}
	wg.Wait()
	// A lost response can safely be retried without duplicating a part.
	h.request("PUT", base+"/chunks/1", "application/octet-stream", bytes.NewReader(suffix), 204).Body.Close()
	h.request("POST", base+"/complete", "", nil, 200).Body.Close()
	h.request("POST", base+"/complete", "", nil, 200).Body.Close()
	if len(h.shared) != 1 || h.shared[0].IP != "127.0.0.1" || h.shared[0].File.Name != "配置.json" {
		t.Fatalf("bad broadcast: %+v", h.shared)
	}
	parts, _ := filepath.Glob(filepath.Join(h.m.root, id, "*.part"))
	if len(parts) != 0 {
		t.Fatal("part files remain")
	}
	resp := h.request("GET", base, "", nil, 200)
	if resp.ContentLength != ChunkSize+int64(len(suffix)) {
		t.Fatal("wrong length")
	}
	_, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
	if err != nil || params["filename"] != "配置.json" {
		t.Fatal("filename lost")
	}
	data, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil || !bytes.Equal(data, append(first, suffix...)) {
		t.Fatal("download differs")
	}
	req, _ := http.NewRequest("GET", h.srv.URL+base, nil)
	req.Header.Set("Range", fmt.Sprintf("bytes=%d-", ChunkSize))
	rangeResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer rangeResp.Body.Close()
	rangeData, _ := io.ReadAll(rangeResp.Body)
	if rangeResp.StatusCode != 206 || !bytes.Equal(rangeData, suffix) {
		t.Fatal("range failed")
	}
	h.request("DELETE", base, "", nil, 409).Body.Close()
	root := h.m.root
	if err := h.m.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Fatal("session temp directory remains")
	}
}

func TestUploadValidationCancelAndEmptyFile(t *testing.T) {
	h := newHarness(t)
	for _, body := range []string{
		`{"name":"x","size":1073741825,"chunkSize":16777216,"chunks":65,"username":"a"}`,
		`{"name":"x","size":1,"chunkSize":1,"chunks":1,"username":"a"}`,
		`{"name":"x","size":1,"chunkSize":16777216,"chunks":2,"username":"a"}`,
		`{"name":"x","size":-1,"chunkSize":16777216,"chunks":0,"username":"a"}`,
		`{"name":"x","size":1,"chunkSize":16777216,"chunks":1,"username":"a","extra":true}`,
		`{"name":"x","size":1,"chunkSize":16777216,"chunks":1,"username":"a"} {}`,
		`null`,
		`{"name":"x","chunkSize":16777216,"chunks":0,"username":"a"}`,
	} {
		h.request("POST", "/api/files", "application/json", strings.NewReader(body), 400).Body.Close()
	}
	id := h.init("../../safe.txt", 5)
	base := "/api/files/" + id
	h.request("PUT", base+"/chunks/-1", "application/octet-stream", strings.NewReader("hello"), 400).Body.Close()
	h.request("PUT", base+"/chunks/1", "application/octet-stream", strings.NewReader("hello"), 400).Body.Close()
	h.request("PUT", base+"/chunks/0", "application/octet-stream", strings.NewReader("toolong"), 400).Body.Close()
	h.request("PUT", base+"/chunks/0", "application/octet-stream", strings.NewReader("tiny"), 400).Body.Close()
	h.request("POST", base+"/complete", "", nil, 409).Body.Close()
	h.request("PUT", base+"/chunks/0", "application/octet-stream", strings.NewReader("hello"), 204).Body.Close()
	h.request("DELETE", base, "", nil, 204).Body.Close()
	if _, err := os.Stat(filepath.Join(h.m.root, id)); !os.IsNotExist(err) {
		t.Fatal("cancel did not delete chunks")
	}
	h.request("DELETE", base, "", nil, 204).Body.Close()
	h.request("PUT", base+"/chunks/0", "application/octet-stream", strings.NewReader("hello"), 404).Body.Close()
	empty := h.init("empty", 0)
	h.request("POST", "/api/files/"+empty+"/complete", "", nil, 200).Body.Close()
	resp := h.request("GET", "/api/files/"+empty, "", nil, 200)
	data, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if len(data) != 0 {
		t.Fatal("empty file is non-empty")
	}
}
