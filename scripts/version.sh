#!/bin/sh
# Local build identity comes from checked-out Git tags, never the latest remote release.
set -eu
easylan_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$easylan_root"
easylan_version=${VERSION:-}
if [ -z "$easylan_version" ]; then
    easylan_version=$(git describe --tags --match 'v[0-9]*.[0-9]*.[0-9]*' --dirty 2>/dev/null || printf 'dev')
fi
if ! printf '%s\n' "$easylan_version" | LC_ALL=C grep -Eq '^(dev|v[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+-g[0-9a-f]+)?(-dirty)?)$'; then
    printf 'Invalid build version: expected dev or a vX.Y.Z Git description.\n' >&2
    exit 1
fi
printf '%s\n' "$easylan_version"
