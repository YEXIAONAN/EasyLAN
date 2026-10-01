package chat

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"unicode"
	"unicode/utf8"
)

const MaxMessageBytes = 2 * 1024 * 1024

type File struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type Device struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	IP       string `json:"ip"`
}

type Message struct {
	Type      string   `json:"type"`
	ID        string   `json:"id,omitempty"`
	ClientID  string   `json:"clientId,omitempty"`
	Username  string   `json:"username,omitempty"`
	IP        string   `json:"ip,omitempty"`
	Content   string   `json:"content,omitempty"`
	Timestamp int64    `json:"timestamp,omitempty"`
	File      *File    `json:"file,omitempty"`
	Devices   []Device `json:"devices,omitempty"`
	Online    int      `json:"online,omitempty"`
}

func NewID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return ""
	}
	return hex.EncodeToString(bytes[:])
}

func ValidUsername(name string) bool {
	name = strings.TrimSpace(name)
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) == 0 || utf8.RuneCountInString(name) > 32 {
		return false
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}
