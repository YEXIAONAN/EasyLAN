// Package web bundles the production frontend into the executable.
package web

import (
	"embed"
	"io/fs"
)

//go:embed dist
var assets embed.FS

func Assets() fs.FS {
	sub, err := fs.Sub(assets, "dist")
	if err != nil {
		panic(err) // dist is validated at compile time by go:embed.
	}
	return sub
}
