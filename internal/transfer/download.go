package transfer

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
)

func (m *Manager) Download(w http.ResponseWriter, r *http.Request) {
	if !m.begin(w) {
		return
	}
	defer m.life.RUnlock()
	s := m.get(r.PathValue("id"))
	if s == nil {
		fail(w, 404, "File not found. Files expire when the server stops.")
		return
	}
	s.gate.RLock()
	defer s.gate.RUnlock()
	if !s.complete {
		fail(w, 409, "File is not ready yet.")
		return
	}
	file, err := os.Open(filepath.Join(s.dir, "file"))
	if err != nil {
		fail(w, 404, "Temporary file is no longer available.")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		fail(w, 500, "Could not read file metadata.")
		return
	}
	contentType := mime.TypeByExtension(filepath.Ext(s.file.Name))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": s.file.Name}))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// ServeContent streams from disk and handles Content-Length, HEAD and Range.
	http.ServeContent(w, r, s.file.Name, info.ModTime(), file)
}
