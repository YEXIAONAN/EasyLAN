package network

import (
	"net"
	"testing"
)

func TestClientIP(t *testing.T) {
	for remote, want := range map[string]string{"192.168.1.52:52130": "192.168.1.52", "[2001:db8::1]:8787": "2001:db8::1", "[fe80::1%en0]:123": "fe80::1%en0", "::1": "::1", "invalid": "unknown"} {
		if got := ClientIP(remote); got != want {
			t.Errorf("ClientIP(%q) = %q, want %q", remote, got, want)
		}
	}
}

func TestLANInterfaceFlags(t *testing.T) {
	for _, test := range []struct {
		name  string
		flags net.Flags
		want  bool
	}{
		{"wifi", net.FlagUp | net.FlagBroadcast | net.FlagMulticast, true},
		{"ethernet", net.FlagUp | net.FlagBroadcast, true},
		{"down", net.FlagBroadcast, false},
		{"loopback", net.FlagUp | net.FlagLoopback, false},
		{"proxy tunnel", net.FlagUp | net.FlagPointToPoint | net.FlagMulticast, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := isLANInterface(test.flags); got != test.want {
				t.Fatalf("isLANInterface(%v) = %v, want %v", test.flags, got, test.want)
			}
		})
	}
}
