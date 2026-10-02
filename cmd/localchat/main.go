package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"localchat/internal/buildinfo"
	"localchat/internal/network"
	"localchat/internal/server"
)

func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func run() error {
	addr := flag.String("addr", "0.0.0.0:8787", "HTTP listen address")
	noOpen := flag.Bool("no-open", false, "Do not automatically open a browser")
	flag.Parse()
	listener, err := net.Listen("tcp", *addr)
	if err != nil {
		return fmt.Errorf("cannot listen on %s: %w", *addr, err)
	}
	defer listener.Close()
	app, err := server.New()
	if err != nil {
		return fmt.Errorf("cannot create session temp directory: %w", err)
	}
	defer func() {
		if err := app.Close(); err != nil {
			log.Printf("Temporary file cleanup failed: %v", err)
		}
	}()
	srv := &http.Server{Handler: app, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 5 * time.Minute, IdleTimeout: 90 * time.Second, MaxHeaderBytes: 16 * 1024}
	_, port, _ := net.SplitHostPort(listener.Addr().String())
	url := "http://127.0.0.1:" + port
	fmt.Printf("\n%s %s\n\n✓ Server started\n\nLocal\n  %s\n\nLAN\n", buildinfo.Name, buildinfo.Version, url)
	for _, ip := range network.LANAddresses() {
		fmt.Printf("  http://%s:%s\n", ip, port)
	}
	fmt.Println("\nOpen a LAN URL above from another device on the same network (not 127.0.0.1).\nIf you see 502, bypass your browser/system proxy or VPN for LAN addresses.\nIf the connection times out, check the firewall and Wi-Fi client isolation.\n\nPress Ctrl+C to stop.")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	result := make(chan error, 1)
	go func() { result <- srv.Serve(listener) }()
	if !*noOpen {
		go openBrowser(url)
	}
	select {
	case <-ctx.Done():
		fmt.Println("\nStopping EasyLAN…")
		app.Hub.Close()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdown); err != nil {
			srv.Close()
		}
		return nil
	case err := <-result:
		if err != http.ErrServerClosed {
			return err
		}
		return nil
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Run(); err != nil {
		log.Printf("Open your browser at %s", url)
	}
}
