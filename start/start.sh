#!/bin/sh
# Shared macOS/Linux launcher. Reads .env as data; never evaluates it as shell code.
set -eu
localchat_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
localchat_port=${LOCALCHAT_PORT:-}

fail() {
    printf 'EasyLAN: %s\n' "$1" >&2
    exit 1
}

if [ -z "$localchat_port" ] && [ -f "$localchat_root/.env" ]; then
    localchat_port=$(awk '
        {
            sub(/\r$/, "")
            if ($0 ~ /^[ \t]*(export[ \t]+)?LOCALCHAT_PORT[ \t]*=/) {
                sub(/^[ \t]*(export[ \t]+)?LOCALCHAT_PORT[ \t]*=[ \t]*/, "")
                sub(/[ \t]*#.*/, "")
                gsub(/^[ \t]+|[ \t]+$/, "")
                value = $0
            }
        }
        END { print value }
    ' "$localchat_root/.env")
    case "$localchat_port" in
        \"*\") localchat_port=${localchat_port#\"}; localchat_port=${localchat_port%\"} ;;
        \'*\') localchat_port=${localchat_port#\'}; localchat_port=${localchat_port%\'} ;;
    esac
fi
localchat_port=${localchat_port:-8787}
case "$localchat_port" in *[!0-9]*) fail 'LOCALCHAT_PORT must be a number from 1 to 65535.' ;; esac
if [ "${#localchat_port}" -gt 5 ] || [ "$localchat_port" -lt 1 ] || [ "$localchat_port" -gt 65535 ]; then
    fail 'LOCALCHAT_PORT must be a number from 1 to 65535.'
fi

case "$(uname -s)" in
    Darwin) localchat_os=darwin ;;
    Linux) localchat_os=linux ;;
    *) fail 'This launcher supports macOS and Linux. Use windows.cmd on Windows.' ;;
esac
case "$(uname -m)" in
    x86_64|amd64) localchat_arch=amd64 ;;
    arm64|aarch64) localchat_arch=arm64 ;;
    *) fail 'Supported CPU architectures: amd64 and arm64.' ;;
esac
localchat_filename="easylan-${localchat_os}-${localchat_arch}"
localchat_binary=''
for localchat_candidate in "$localchat_root/easylan" "$localchat_root/$localchat_filename" "$localchat_root/release/$localchat_filename" "$localchat_root/localchat" "$localchat_root/localchat-${localchat_os}-${localchat_arch}" "$localchat_root/release/localchat-${localchat_os}-${localchat_arch}"; do
    if [ -f "$localchat_candidate" ]; then
        localchat_binary=$localchat_candidate
        break
    fi
done
[ -n "$localchat_binary" ] || fail "Missing $localchat_filename. Put it in the project root or release/, or build the project first (see README.md)."
[ -x "$localchat_binary" ] || chmod +x "$localchat_binary"
printf 'Starting EasyLAN on port %s…\n' "$localchat_port"
printf 'Binary: %s\n' "$localchat_binary"
cd "$localchat_root"
# Explicit arguments follow the configured address, so -addr can override .env.
exec "$localchat_binary" -addr "0.0.0.0:$localchat_port" "$@"
