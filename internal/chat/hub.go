package chat

import (
	"encoding/json"

	"localchat/internal/buildinfo"
	"sort"
	"sync"
	"time"
)

type Hub struct {
	mu      sync.Mutex
	clients map[*client]Device
	closed  bool
}

func NewHub() *Hub { return &Hub{clients: make(map[*client]Device)} }

func (h *Hub) enqueueLocked(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	for c := range h.clients {
		select {
		case c.send <- data:
		default:
			// A stalled browser must never hold up other clients.
			c.conn.Close()
		}
	}
}

func (h *Hub) presenceLocked() {
	devices := make([]Device, 0, len(h.clients))
	for _, device := range h.clients {
		devices = append(devices, device)
	}
	sort.Slice(devices, func(i, j int) bool { return devices[i].ID < devices[j].ID })
	h.enqueueLocked(Message{Type: "presence", Devices: devices, Online: len(devices)})
}

func (h *Hub) register(c *client, d Device) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return false
	}
	h.clients[c] = d
	data, _ := json.Marshal(Message{Type: "welcome", ClientID: d.ID, IP: d.IP})
	c.send <- data
	h.enqueueLocked(Message{Type: "system", Content: d.Username + " joined " + buildinfo.Name, Timestamp: time.Now().Unix()})
	h.presenceLocked()
	return true
}

func (h *Hub) unregister(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d, exists := h.clients[c]
	if !exists {
		return
	}
	delete(h.clients, c)
	close(c.send)
	h.enqueueLocked(Message{Type: "system", Content: d.Username + " left " + buildinfo.Name, Timestamp: time.Now().Unix()})
	h.presenceLocked()
}

func (h *Hub) receive(c *client, msg Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	d, ok := h.clients[c]
	if !ok {
		return
	}
	if msg.Type == "hello" {
		if !ValidUsername(msg.Username) {
			c.error("Your name must be 1–32 characters.")
			return
		}
		d.Username = msg.Username
		h.clients[c] = d
		h.presenceLocked()
		return
	}
	if msg.Type != "text" {
		c.error("Unsupported message type.")
		return
	}
	if len(msg.Content) > MaxMessageBytes {
		c.error("Message is too large. Consider sending it as a file.")
		return
	}
	if len(msg.Content) == 0 {
		return
	}
	id := NewID()
	if id == "" {
		c.error("Could not generate a message ID. Try again.")
		return
	}
	h.enqueueLocked(Message{Type: "text", ID: id, ClientID: d.ID, Username: d.Username, IP: d.IP, Content: msg.Content, Timestamp: time.Now().Unix()})
}

func (h *Hub) Broadcast(msg Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.enqueueLocked(msg)
}

func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.closed = true
	for c := range h.clients {
		c.conn.Close()
	}
}
