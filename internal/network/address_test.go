package network

import "testing"

func TestClientIP(t *testing.T) {
	for remote, want := range map[string]string{"192.168.1.52:52130": "192.168.1.52", "[2001:db8::1]:8787": "2001:db8::1", "[fe80::1%en0]:123": "fe80::1%en0", "::1": "::1", "invalid": "unknown"} {
		if got := ClientIP(remote); got != want {
			t.Errorf("ClientIP(%q) = %q, want %q", remote, got, want)
		}
	}
}
