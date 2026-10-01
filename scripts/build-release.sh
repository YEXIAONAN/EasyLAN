#!/bin/sh
# Local equivalent of release validation/build/packaging; never publishes to GitHub.
set -eu
cd "$(dirname "$0")/.."
(cd web && npm ci && npm test && npm run build)
go test ./...
go vet ./...
./scripts/build-binaries.sh
./scripts/package-release.sh
