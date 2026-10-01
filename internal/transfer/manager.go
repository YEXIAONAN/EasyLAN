package transfer

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"localchat/internal/chat"
)

const (
	MaxFileSize int64 = 1024 * 1024 * 1024
	ChunkSize   int64 = 16 * 1024 * 1024
)

type session struct {
	gate      sync.RWMutex // completion/cancellation wait for active chunk streams
	mu        sync.Mutex
	file      chat.File
	dir       string
	chunks    int
	username  string
	ip        string
	clientID  string
	received  map[int]bool
	writing   map[int]bool
	complete  bool
	cancelled bool
}

type Manager struct {
	life      sync.RWMutex // shutdown waits for handlers before removing the directory
	mu        sync.Mutex
	root      string
	sessions  map[string]*session
	closed    bool
	broadcast func(chat.Message)
}

func New(broadcast func(chat.Message)) (*Manager, error) {
	root, err := os.MkdirTemp("", "localchat-")
	if err != nil {
		return nil, err
	}
	return &Manager{root: root, sessions: make(map[string]*session), broadcast: broadcast}, nil
}

func (m *Manager) Close() error {
	m.life.Lock()
	defer m.life.Unlock()
	m.closed = true
	m.sessions = nil
	return os.RemoveAll(m.root)
}

func (m *Manager) get(id string) *session {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sessions[id]
}

func (m *Manager) begin(w http.ResponseWriter) bool {
	m.life.RLock()
	if m.closed {
		m.life.RUnlock()
		fail(w, http.StatusServiceUnavailable, "Server is stopping.")
		return false
	}
	return true
}

func cleanName(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || strings.ContainsRune("<>:\"|?*", r) {
			return '_'
		}
		return r
	}, name)
	// Preserve leading dots (.env); only trailing dots/spaces are problematic
	// download filenames. Disk paths still use a generated session ID.
	name = strings.TrimRight(strings.Trim(name, " "), " .")
	for len(name) > 240 {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	if name == "" || name == "/" {
		return "file"
	}
	return name
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	if media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type")); err != nil || media != "application/json" {
		return errors.New("Use Content-Type: application/json.")
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return errors.New("Invalid upload JSON.")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return errors.New("Expected one JSON object.")
	}
	return nil
}

func respond(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, code int, message string) {
	respond(w, code, map[string]string{"error": message})
}
