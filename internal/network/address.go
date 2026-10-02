package network

import (
	"net"
	"sort"
)

func ClientIP(remote string) string {
	host, _, err := net.SplitHostPort(remote)
	if err == nil {
		return host
	}
	if ip := net.ParseIP(remote); ip != nil {
		return ip.String()
	}
	return "unknown"
}

func LANAddresses() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	seen := make(map[string]bool)
	for _, iface := range interfaces {
		if !isLANInterface(iface.Flags) {
			continue
		}
		addresses, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addresses {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && ip.To4() != nil && ip.IsGlobalUnicast() {
				seen[ip.String()] = true
			}
		}
	}
	result := make([]string, 0, len(seen))
	for ip := range seen {
		result = append(result, ip)
	}
	sort.Strings(result)
	return result
}

// Point-to-point VPN/proxy tunnels are not addresses to share with LAN peers.
func isLANInterface(flags net.Flags) bool {
	return flags&net.FlagUp != 0 && flags&(net.FlagLoopback|net.FlagPointToPoint) == 0
}
