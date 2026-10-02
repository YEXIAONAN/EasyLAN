#!/bin/sh
# Compile only. Call after frontend build and validation (release workflow/wrapper).
set -eu
localchat_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$localchat_root"
localchat_version=${VERSION:-dev}
case "$localchat_version" in
    dev) ;;
    *[!v0-9.]*) printf 'VERSION must be dev or vX.Y.Z.\n' >&2; exit 1 ;;
esac
if [ "$localchat_version" != dev ] && ! printf '%s\n' "$localchat_version" | LC_ALL=C grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
    printf 'VERSION must be dev or vX.Y.Z.\n' >&2
    exit 1
fi
localchat_output=${OUTPUT_DIR:-"$localchat_root/release"}
mkdir -p "$localchat_output"
rm -f "$localchat_output/.build-version"
for localchat_target in windows/amd64 windows/arm64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
    localchat_os=${localchat_target%/*}
    localchat_arch=${localchat_target#*/}
    localchat_filename="easylan-${localchat_os}-${localchat_arch}"
    if [ "$localchat_os" = windows ]; then localchat_filename="${localchat_filename}.exe"; fi
    printf 'Building %s (%s)\n' "$localchat_filename" "$localchat_version"
    CGO_ENABLED=0 GOOS="$localchat_os" GOARCH="$localchat_arch" go build -trimpath \
        -ldflags="-s -w -X localchat/internal/buildinfo.Version=$localchat_version" \
        -o "$localchat_output/$localchat_filename" ./cmd/localchat
done
printf '%s\n' "$localchat_version" > "$localchat_output/.build-version"
