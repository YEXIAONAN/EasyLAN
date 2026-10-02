.PHONY: build web test release clean

build: web
	./scripts/build-local.sh

web:
	cd web && npm ci && npm run build

test:
	go test -race ./...
	go vet ./...
	cd web && npm ci && npm test && npm run build

release:
	./scripts/build-release.sh

clean:
	rm -rf release easylan localchat
