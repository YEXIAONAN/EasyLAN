#!/bin/sh
# Package only the six binaries above. No installation/runtime dependencies.
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
localchat_output=$(CDPATH= cd -- "$localchat_output" && pwd)
if [ ! -f "$localchat_output/.build-version" ] || [ "$(cat "$localchat_output/.build-version")" != "$localchat_version" ]; then
    printf 'Binary version does not match VERSION. Run build-binaries.sh with the same VERSION first.\n' >&2
    exit 1
fi
localchat_staging=$(mktemp -d "$localchat_output/.package.XXXXXX")
trap 'rm -rf "$localchat_staging"' 0
trap 'exit 1' 1 2 15
for localchat_target in windows/amd64 windows/arm64 linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
    localchat_os=${localchat_target%/*}
    localchat_arch=${localchat_target#*/}
    localchat_filename="localchat-${localchat_os}-${localchat_arch}"
    localchat_program=localchat
    localchat_extension=tar.gz
    if [ "$localchat_os" = windows ]; then
        localchat_filename="${localchat_filename}.exe"
        localchat_program=localchat.exe
        localchat_extension=zip
    fi
    localchat_package="localchat-${localchat_version}-${localchat_os}-${localchat_arch}.${localchat_extension}"
    localchat_directory="$localchat_staging/$localchat_os-$localchat_arch"
    mkdir -p "$localchat_directory"
    cp "$localchat_output/$localchat_filename" "$localchat_directory/$localchat_program"
    chmod 755 "$localchat_directory/$localchat_program"
    if [ "$localchat_os" = windows ]; then
        (cd "$localchat_directory" && zip -q "$localchat_staging/$localchat_package" "$localchat_program")
    else
        # macOS tar otherwise adds AppleDouble metadata files to the archive.
        COPYFILE_DISABLE=1 tar -czf "$localchat_staging/$localchat_package" -C "$localchat_directory" "$localchat_program"
    fi
    mv "$localchat_staging/$localchat_package" "$localchat_output/$localchat_package"
    printf '%s\n' "$localchat_package" >> "$localchat_staging/packages.txt"
    printf 'Packaged %s\n' "$localchat_package"
done
# Hash only this version's six archives, not binaries or unrelated old files.
(cd "$localchat_output" && while IFS= read -r localchat_package; do
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$localchat_package"
    else
        shasum -a 256 "$localchat_package"
    fi
done < "$localchat_staging/packages.txt") > "$localchat_output/SHA256SUMS.txt"
printf 'Packages and SHA256SUMS.txt are in %s\n' "$localchat_output"
