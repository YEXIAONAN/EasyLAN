package chat

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func readType(t *testing.T, conn *websocket.Conn, kind string) Message {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			t.Fatal(err)
		}
		if msg.Type == kind {
			return msg
		}
	}
}

func TestChatBroadcastAndIdentity(t *testing.T) {
	hub := NewHub()
	defer hub.Close()
	srv := httptest.NewServer(http.HandlerFunc(hub.ServeWS))
	defer srv.Close()
	dial := func(name string) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"?username="+name, nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { conn.Close() })
		return conn
	}
	a, b := dial("Waiting"), dial("Server-01")
	welcome := readType(t, a, "welcome")
	if welcome.IP != "127.0.0.1" || welcome.ClientID == "" {
		t.Fatalf("bad identity: %+v", welcome)
	}
	for readType(t, a, "presence").Online != 2 {
	}
	content := "{\n  \"config\": true\n}\n<script>alert(1)</script>"
	if err := a.WriteJSON(map[string]any{"type": "text", "username": "forged", "ip": "1.2.3.4", "content": content}); err != nil {
		t.Fatal(err)
	}
	for _, conn := range []*websocket.Conn{a, b} {
		msg := readType(t, conn, "text")
		if msg.Content != content || msg.Username != "Waiting" || msg.IP != "127.0.0.1" || msg.Timestamp == 0 {
			t.Fatalf("bad message: %+v", msg)
		}
	}
	a.WriteJSON(map[string]string{"type": "hello", "username": "NewName"})
	readType(t, a, "presence")
	a.WriteJSON(map[string]string{"type": "text", "content": "renamed"})
	if msg := readType(t, b, "text"); msg.Username != "NewName" {
		t.Fatalf("rename failed: %+v", msg)
	}
	a.WriteMessage(websocket.TextMessage, []byte("{invalid"))
	readType(t, a, "error")
	boundary := strings.Repeat("中", MaxMessageBytes/3) + strings.Repeat("a", MaxMessageBytes%3)
	if err := a.WriteJSON(map[string]string{"type": "text", "content": boundary}); err != nil {
		t.Fatal(err)
	}
	for _, conn := range []*websocket.Conn{a, b} {
		if readType(t, conn, "text").Content != boundary {
			t.Fatal("UTF-8 message at 128 KiB boundary was lost")
		}
	}
	// JSON escapes can expand to six wire bytes per content byte. The bounded
	// envelope must still accept a valid message at the exact content limit.
	if err := a.WriteJSON(map[string]string{"type": "text", "content": strings.Repeat("\x00", MaxMessageBytes)}); err != nil {
		t.Fatal(err)
	}
	for _, conn := range []*websocket.Conn{a, b} {
		readType(t, conn, "text")
	}
	a.WriteJSON(map[string]string{"type": "text", "content": strings.Repeat("a", MaxMessageBytes+1)})
	readType(t, a, "error")
	// A newly joined browser must never receive earlier messages.
	c := dial("NewBrowser")
	readType(t, c, "welcome")
	readType(t, c, "system")
	readType(t, c, "presence")
	b.Close()
	for readType(t, a, "presence").Online != 2 {
	}
}
