#!/bin/sh
# Build the current platform with a truthful version; do not publish or fetch tags.
set -eu
easylan_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$easylan_root"
easylan_version=$(sh ./scripts/version.sh)
easylan_filename=easylan
if [ "$(go env GOOS)" = windows ]; then easylan_filename=easylan.exe; fi
easylan_output=${OUTPUT_FILE:-"$easylan_root/$easylan_filename"}
mkdir -p "$(dirname -- "$easylan_output")"
easylan_temporary=$(mktemp "$easylan_output.tmp.XXXXXX")
trap 'rm -f "$easylan_temporary"' 0
trap 'exit 1' 1 2 15
printf 'Building EasyLAN %s → %s\n' "$easylan_version" "$easylan_output"
CGO_ENABLED=0 go build -trimpath \
    -ldflags="-X localchat/internal/buildinfo.Version=$easylan_version" \
    -o "$easylan_temporary" ./cmd/localchat
chmod 755 "$easylan_temporary"
mv -f "$easylan_temporary" "$easylan_output"
