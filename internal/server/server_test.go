package server

import (
	"encoding/json"

	"io"
	"localchat/internal/buildinfo"
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

func TestInfoReportsBinaryVersion(t *testing.T) {
	app, err := New()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	original := buildinfo.Version
	defer func() { buildinfo.Version = original }()
	for _, version := range []string{"dev", "v0.2.0"} {
		t.Run(version, func(t *testing.T) {
			buildinfo.Version = version
			response := httptest.NewRecorder()
			app.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/info", nil))
			if response.Code != http.StatusOK || response.Header().Get("Content-Type") != "application/json" {
				t.Fatalf("unexpected info response: %d %v", response.Code, response.Header())
			}
			var info struct {
				Name      string `json:"name"`
				Version   string `json:"version"`
				ChunkSize int64  `json:"chunkSize"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &info); err != nil {
				t.Fatal(err)
			}
			if info.Name != "LocalChat" || info.Version != version || info.ChunkSize != 16*1024*1024 {
				t.Fatalf("wrong binary identity or missing existing limits: %+v", info)
			}
		})
	}
}
