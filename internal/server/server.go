package server

import (
	"encoding/json"
	"net/http"
	"net/url"

	"localchat/internal/buildinfo"
	"localchat/internal/chat"
	"localchat/internal/network"
	"localchat/internal/transfer"
	"localchat/web"
)

type Server struct {
	Hub   *chat.Hub
	Files *transfer.Manager
	mux   *http.ServeMux
}

func New() (*Server, error) {
	s := &Server{Hub: chat.NewHub()}
	files, err := transfer.New(s.Hub.Broadcast)
	if err != nil {
		return nil, err
	}
	s.Files = files
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", s.Hub.ServeWS)
	mux.HandleFunc("POST /api/files", s.Files.Init)
	mux.HandleFunc("PUT /api/files/{id}/chunks/{index}", s.Files.Chunk)
	mux.HandleFunc("POST /api/files/{id}/complete", s.Files.Complete)
	mux.HandleFunc("DELETE /api/files/{id}", s.Files.Cancel)
	mux.HandleFunc("GET /api/files/{id}", s.Files.Download)
	mux.HandleFunc("GET /api/files/{id}/preview", s.Files.Preview)
	mux.HandleFunc("GET /api/info", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"name": buildinfo.Name, "version": buildinfo.Version, "lanAddresses": network.LANAddresses(), "maxMessageSize": chat.MaxMessageBytes, "maxFileSize": transfer.MaxFileSize, "chunkSize": transfer.ChunkSize})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { http.Error(w, "API not found.", 404) })
	mux.Handle("/", http.FileServerFS(web.Assets()))
	s.mux = mux
	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		if origin := r.Header.Get("Origin"); origin != "" {
			parsed, err := url.Parse(origin)
			if err != nil || parsed.Host != r.Host {
				http.Error(w, "Cross-origin requests are not allowed.", 403)
				return
			}
		}
	}
	s.mux.ServeHTTP(w, r)
}
func (s *Server) Close() error { s.Hub.Close(); return s.Files.Close() }
