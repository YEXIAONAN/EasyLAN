package transfer

import (
	"bytes"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const TextPreviewMaxBytes int64 = 512 * 1024

// The allowlist and file signatures belong to the server, not the client MIME.
func previewType(path, name string) string {
	f, err := os.Open(path)
	if err != nil {
		return "none"
	}
	defer f.Close()
	return inspectPreview(f, name)
}

func inspectPreview(f *os.File, name string) string {
	var sample [512]byte
	n, err := f.ReadAt(sample[:], 0)
	if err != nil && err != io.EOF {
		return "none"
	}
	data := sample[:n]
	ext := strings.ToLower(filepath.Ext(name))
	media := http.DetectContentType(data)
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif":
		want := map[string]string{".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}[ext]
		if media == want {
			return "image"
		}
		return "none"
	case ".pdf":
		if media == "application/pdf" && bytes.HasPrefix(data, []byte("%PDF-")) {
			return "pdf"
		}
		return "none"
	}
	textName := strings.ToLower(name)
	allowed := textName == "dockerfile" || textName == "makefile"
	switch ext {
	case ".txt", ".log", ".md", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg", ".env",
		".go", ".java", ".py", ".js", ".ts", ".vue", ".c", ".h", ".cpp", ".hpp", ".cs", ".sh", ".bash", ".zsh", ".sql", ".html", ".htm", ".css":
		allowed = true
	}
	// Plain text can legitimately sniff as HTML/XML/JSON. It is always served as
	// text/plain. Reject binary signatures/NUL, but allow invalid UTF-8 so the
	// browser's UTF-8 decoder can replace malformed sequences safely.
	if allowed && !bytes.ContainsRune(data, 0) && (n == 0 || strings.HasPrefix(media, "text/") || media == "application/octet-stream") {
		return "text"
	}
	return "none" // SVG and every unlisted extension are download-only.
}

func (m *Manager) Preview(w http.ResponseWriter, r *http.Request) {
	if !m.begin(w) {
		return
	}
	defer m.life.RUnlock()
	s := m.get(r.PathValue("id"))
	if s == nil {
		fail(w, 404, "File is no longer available.")
		return
	}
	s.gate.RLock()
	defer s.gate.RUnlock()
	if !s.complete {
		fail(w, 409, "File is not ready yet.")
		return
	}
	// Only the server-generated session directory determines the disk path.
	f, err := os.Open(filepath.Join(s.dir, "file"))
	if err != nil {
		fail(w, 404, "File is no longer available.")
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		fail(w, 500, "Preview unavailable.")
		return
	}
	kind := inspectPreview(f, s.file.Name)
	if kind == "none" {
		fail(w, 415, "Preview unavailable. You can still download this file.")
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Preview-Type", kind)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": s.file.Name}))
	// Permit embedding by this application only. Uploaded content has no web
	// scripts, styles, network access or navigation privileges.
	w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'")
	if kind == "text" {
		length := min(info.Size(), TextPreviewMaxBytes)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Length", strconv.FormatInt(length, 10))
		w.Header().Set("X-Preview-Max-Bytes", strconv.FormatInt(TextPreviewMaxBytes, 10))
		w.Header().Set("X-Preview-Truncated", strconv.FormatBool(info.Size() > TextPreviewMaxBytes))
		if r.Method != http.MethodHead {
			io.Copy(w, io.LimitReader(f, TextPreviewMaxBytes))
		}
		return
	}
	if kind == "pdf" {
		// The browser's built-in PDF viewer needs its own privileged resources;
		// applying default-src 'none' to PDF responses can blank that viewer.
		// HTML/SVG are never served here: PDF extension + signature + nosniff
		// enforce the media boundary. Keep the chat/text policies unchanged.
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'self'; base-uri 'none'; form-action 'none'")
		w.Header().Set("Content-Type", "application/pdf")
	} else {
		var sample [512]byte
		n, _ := f.ReadAt(sample[:], 0)
		w.Header().Set("Content-Type", http.DetectContentType(sample[:n]))
	}
	// Browser-native image/PDF display, streamed from disk with HEAD/Range.
	http.ServeContent(w, r, s.file.Name, info.ModTime(), f)
}
