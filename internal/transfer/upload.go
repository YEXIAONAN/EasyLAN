package transfer

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"localchat/internal/chat"
	"localchat/internal/network"
)

func (m *Manager) Init(w http.ResponseWriter, r *http.Request) {
	if !m.begin(w) {
		return
	}
	defer m.life.RUnlock()
	var request struct {
		Name      string `json:"name"`
		Size      *int64 `json:"size"`
		ChunkSize *int64 `json:"chunkSize"`
		Chunks    *int   `json:"chunks"`
		Username  string `json:"username"`
		ClientID  string `json:"clientId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		fail(w, 400, err.Error())
		return
	}
	if request.Size == nil || request.ChunkSize == nil || request.Chunks == nil {
		fail(w, 400, "Provide size, chunkSize and chunks.")
		return
	}
	size, chunks := *request.Size, *request.Chunks
	if size < 0 || size > MaxFileSize {
		fail(w, 400, "Files must be at most 1 GB.")
		return
	}
	if *request.ChunkSize != ChunkSize || chunks != int((size+ChunkSize-1)/ChunkSize) {
		fail(w, 400, "Use 16 MB chunks and the correct chunk count.")
		return
	}
	request.Username = strings.TrimSpace(request.Username)
	if !chat.ValidUsername(request.Username) || request.Name == "" || !utf8.ValidString(request.Name) {
		fail(w, 400, "Provide a valid filename and username.")
		return
	}
	id := chat.NewID()
	if id == "" {
		fail(w, 500, "Could not generate a file ID.")
		return
	}
	dir := filepath.Join(m.root, id)
	if err := os.Mkdir(dir, 0700); err != nil {
		fail(w, 500, "Could not create temporary upload.")
		return
	}
	s := &session{file: chat.File{ID: id, Name: cleanName(request.Name), Size: size}, dir: dir, chunks: chunks, username: request.Username, ip: network.ClientIP(r.RemoteAddr), clientID: request.ClientID, received: make(map[int]bool), writing: make(map[int]bool)}
	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()
	respond(w, http.StatusCreated, map[string]string{"fileId": id})
}

func (m *Manager) Chunk(w http.ResponseWriter, r *http.Request) {
	if !m.begin(w) {
		return
	}
	defer m.life.RUnlock()
	s := m.get(r.PathValue("id"))
	if s == nil {
		fail(w, 404, "Upload session not found. The server may have restarted.")
		return
	}
	s.gate.RLock()
	defer s.gate.RUnlock()
	if s.cancelled || s.complete {
		fail(w, 409, "Upload is no longer active.")
		return
	}
	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil || index < 0 || index >= s.chunks {
		fail(w, 400, "Invalid chunk index.")
		return
	}
	expected := ChunkSize
	if index == s.chunks-1 {
		expected = s.file.Size - int64(index)*ChunkSize
	}
	if r.Header.Get("Content-Type") != "application/octet-stream" {
		fail(w, 415, "Send binary chunks as application/octet-stream.")
		return
	}
	if r.ContentLength >= 0 && r.ContentLength != expected {
		fail(w, 400, "Chunk length does not match the declared file size.")
		return
	}
	s.mu.Lock()
	if s.received[index] {
		s.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if s.writing[index] {
		s.mu.Unlock()
		fail(w, 409, "This chunk is already being uploaded.")
		return
	}
	s.writing[index] = true
	s.mu.Unlock()
	defer func() { s.mu.Lock(); delete(s.writing, index); s.mu.Unlock() }()
	temporary, err := os.CreateTemp(s.dir, ".incoming-*")
	if err != nil {
		fail(w, 500, "Could not create chunk.")
		return
	}
	defer os.Remove(temporary.Name())
	r.Body = http.MaxBytesReader(w, r.Body, expected+1)
	defer r.Body.Close()
	written, copyErr := io.Copy(temporary, r.Body)
	closeErr := temporary.Close()
	if copyErr != nil || written != expected {
		fail(w, 400, "Chunk is incomplete or too large. Retry this chunk.")
		return
	}
	if closeErr != nil {
		fail(w, 500, "Could not save chunk.")
		return
	}
	if err := os.Rename(temporary.Name(), filepath.Join(s.dir, fmt.Sprintf("%d.part", index))); err != nil {
		fail(w, 500, "Could not save chunk.")
		return
	}
	s.mu.Lock()
	s.received[index] = true
	s.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

func (m *Manager) Complete(w http.ResponseWriter, r *http.Request) {
	if !m.begin(w) {
		return
	}
	defer m.life.RUnlock()
	s := m.get(r.PathValue("id"))
	if s == nil {
		fail(w, 404, "Upload session not found. The server may have restarted.")
		return
	}
	s.gate.Lock()
	defer s.gate.Unlock()
	if s.cancelled {
		fail(w, 410, "Upload was cancelled.")
		return
	}
	if s.complete {
		respond(w, 200, s.file)
		return
	}
	if len(s.received) != s.chunks {
		fail(w, 409, "Some chunks are missing. Upload them before completing.")
		return
	}
	merged := filepath.Join(s.dir, ".merge")
	out, err := os.OpenFile(merged, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		fail(w, 500, "Could not create merged file.")
		return
	}
	defer os.Remove(merged)
	var total int64
	for i := 0; i < s.chunks; i++ {
		part, err := os.Open(filepath.Join(s.dir, fmt.Sprintf("%d.part", i)))
		if err != nil {
			out.Close()
			fail(w, 409, "A chunk is missing. Retry the upload.")
			return
		}
		expected := ChunkSize
		if i == s.chunks-1 {
			expected = s.file.Size - int64(i)*ChunkSize
		}
		size, copyErr := io.Copy(out, io.LimitReader(part, expected+1))
		closeErr := part.Close()
		if copyErr != nil || closeErr != nil || size != expected {
			out.Close()
			fail(w, 500, "Could not merge a complete chunk.")
			return
		}
		total += size
	}
	closeErr := out.Close()
	if total != s.file.Size || closeErr != nil {
		fail(w, 500, "Merged file size verification failed.")
		return
	}
	if err := os.Rename(merged, filepath.Join(s.dir, "file")); err != nil {
		fail(w, 500, "Could not finish upload.")
		return
	}
	s.complete = true
	for i := 0; i < s.chunks; i++ {
		os.Remove(filepath.Join(s.dir, fmt.Sprintf("%d.part", i)))
	}
	m.broadcast(chat.Message{Type: "file", ID: chat.NewID(), ClientID: s.clientID, Username: s.username, IP: s.ip, Timestamp: time.Now().Unix(), File: &s.file})
	respond(w, 200, s.file)
}

func (m *Manager) Cancel(w http.ResponseWriter, r *http.Request) {
	if !m.begin(w) {
		return
	}
	defer m.life.RUnlock()
	s := m.get(r.PathValue("id"))
	if s == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	s.gate.Lock()
	defer s.gate.Unlock()
	if s.complete {
		fail(w, 409, "This file is already shared.")
		return
	}
	s.cancelled = true
	if err := os.RemoveAll(s.dir); err != nil {
		fail(w, 500, "Could not remove temporary chunks. Retry cancellation.")
		return
	}
	m.mu.Lock()
	delete(m.sessions, s.file.ID)
	m.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}
