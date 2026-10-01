package chat

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"localchat/internal/network"
)

var upgrader = websocket.Upgrader{ReadBufferSize: 4096, WriteBufferSize: 4096}

type client struct {
	conn *websocket.Conn
	send chan []byte
}

func (c *client) error(content string) {
	data, _ := json.Marshal(Message{Type: "error", Content: content})
	select {
	case c.send <- data:
	default:
		c.conn.Close()
	}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(r.URL.Query().Get("username"))
	if !ValidUsername(username) {
		http.Error(w, "Your name must be 1–32 characters.", http.StatusBadRequest)
		return
	}
	id := NewID()
	if id == "" {
		http.Error(w, "Could not generate a connection ID.", 500)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &client{conn: conn, send: make(chan []byte, 16)}
	if !h.register(c, Device{ID: id, Username: username, IP: network.ClientIP(r.RemoteAddr)}) {
		conn.Close()
		return
	}
	go c.writeLoop()
	defer h.unregister(c)
	defer conn.Close()
	// A content byte may occupy six bytes when JSON escaped (e.g. \u0000).
	conn.SetReadLimit(MaxMessageBytes*6 + 4096)
	conn.SetReadDeadline(time.Now().Add(75 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(75 * time.Second)) })
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if kind != websocket.TextMessage {
			c.error("Send JSON text frames only.")
			continue
		}
		var incoming struct {
			Type     string `json:"type"`
			Username string `json:"username"`
			Content  string `json:"content"`
		}
		if err := json.Unmarshal(data, &incoming); err != nil {
			c.error("Invalid JSON message.")
			continue
		}
		h.receive(c, Message{Type: incoming.Type, Username: strings.TrimSpace(incoming.Username), Content: incoming.Content})
	}
}

func (c *client) writeLoop() {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	defer c.conn.Close()
	for {
		select {
		case data, ok := <-c.send:
			if !ok {
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				return
			}
		}
	}
}
