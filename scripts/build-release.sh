#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
(cd web && npm ci && npm test && npm run build)
go test ./...
go vet ./...
mkdir -p release
for target in windows/amd64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
    target_os=${target%/*}
    target_arch=${target#*/}
    filename="localchat-${target_os}-${target_arch}"
    if [ "$target_os" = windows ]; then filename="${filename}.exe"; fi
    printf 'Building %s\n' "$filename"
    CGO_ENABLED=0 GOOS="$target_os" GOARCH="$target_arch" go build -trimpath -ldflags='-s -w' -o "release/$filename" ./cmd/localchat
done
(cd release && if command -v shasum >/dev/null 2>&1; then shasum -a 256 localchat-* > SHA256SUMS; else sha256sum localchat-* > SHA256SUMS; fi)
printf '\nRelease binaries and SHA256SUMS are in release/\n'
