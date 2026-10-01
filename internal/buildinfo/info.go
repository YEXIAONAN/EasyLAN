// Package buildinfo is the single source of binary identity for the CLI and API.
package buildinfo

const Name = "LocalChat"

// Version is set by -ldflags "-X localchat/internal/buildinfo.Version=vX.Y.Z".
// Unversioned development builds always report dev.
var Version = "dev"
