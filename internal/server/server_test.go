package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func TestEmbeddedFrontendAndOriginChecks(t *testing.T) {
	app, err := New()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	srv := httptest.NewServer(app)
	defer srv.Close()
	resp, err := http.Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil || resp.StatusCode != 200 || !strings.Contains(string(body), "<div id=\"app\"></div>") {
		t.Fatal("embedded frontend missing")
	}
	if resp.Header.Get("Content-Security-Policy") == "" {
		t.Fatal("missing CSP")
	}
	req, _ := http.NewRequest("POST", srv.URL+"/api/files", strings.NewReader("{}"))
	req.Header.Set("Origin", "http://untrusted.example")
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 403 {
		t.Fatal("foreign upload origin was allowed")
	}
	_, resp, err = websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?username=Test", http.Header{"Origin": []string{"http://untrusted.example"}})
	if err == nil || resp == nil || resp.StatusCode != 403 {
		t.Fatal("foreign websocket origin was allowed")
	}
	resp.Body.Close()
	resp, err = http.Get(srv.URL + "/api/info")
	if err != nil {
		t.Fatal(err)
	}
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	if !strings.Contains(string(body), `"chunkSize":16777216`) {
		t.Fatal("wrong limits")
	}
}
