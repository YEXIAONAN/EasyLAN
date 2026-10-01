# AGENTS.md

本文件供 AI 编码代理在本仓库工作时参考。内容来自对源码、文档、CI 与脚本的实际审查；修改项目时请同步更新本文件。

## 项目概览

LocalChat 是一个局域网即时聊天与临时文件传输工具：运行单个二进制，其他设备用浏览器访问局域网地址即可传文字、配置、日志和文件。

- 无账号、无数据库、无云服务；最终用户不需要安装 Go/Node。
- 后端：Go（HTTP + WebSocket，依赖 `github.com/gorilla/websocket`）。
- 前端：Vue 3 + TypeScript + Vite，生产资源经 `//go:embed` 嵌入二进制。
- V1 使用明文 HTTP，无加密与身份认证，仅适用于可信临时局域网。

## 目录结构

```text
cmd/localchat/       程序入口：监听、打印 LAN 地址、打开浏览器、信号退出
internal/buildinfo/  唯一版本来源（Name / Version，默认 dev）
internal/chat/       WebSocket Hub、广播、身份与在线状态（不保存任何历史）
internal/network/    RemoteAddr 解析与 LAN IPv4 探测
internal/transfer/   临时会话、16 MiB 分片写入、流式合并、取消与下载
internal/server/     HTTP 路由、来源校验、安全响应头、嵌入资源服务
web/src/             Vue 组件、composables、presentation（消息分组/代码识别）、types
web/dist/            生产静态资源，被 Go 嵌入（已提交，改动前端后需重新生成并提交）
web/tests/           前端测试（node:test，实际运行 useUpload.ts / messages.ts）
web/scripts/         test-upload.mjs：把 TS 转译为临时 mjs 后调用 node --test
start/               Windows / macOS / Linux 一键启动脚本，读取根目录 .env
scripts/             六平台编译与打包（本地不发布到 GitHub）
.github/workflows/   ci.yml（普通检查）与 release.yml（Tag 发布）
docs/TESTING.md      验证记录（含真实浏览器验收与未验证项）
```

## 环境要求

- Go **1.23+**（以 `go.mod` 为准）。
- Node.js **24 LTS**（以根目录 `.node-version` 为准）。
- GitHub Actions 通过 `go-version-file: go.mod` 与 `node-version-file: .node-version` 固定版本，不依赖本机默认版本。

## 常用命令

前端（在 `web/` 下）：

```sh
npm ci
npm run dev      # Vite 开发服务器，/api 与 /ws 代理到 127.0.0.1:8787
npm test         # node scripts/test-upload.mjs（含 TypeScript 转译）
npm run build    # vue-tsc --noEmit && vite build，输出 web/dist/
```

后端（项目根目录）：

```sh
go test ./...
go vet ./...
CGO_ENABLED=0 go build -trimpath -o localchat ./cmd/localchat
go run ./cmd/localchat -no-open
```

完整流程与本地发布：

```sh
make build       # web 构建 + Go 编译
make test        # go test -race + go vet + 前端测试与构建
make release     # 等同 ./scripts/build-release.sh（本地六平台编译打包，不发布）
```

CLI 参数：`-addr`（默认 `0.0.0.0:8787`）、`-no-open`、`-h`。

### 构建顺序（关键）

`web/embed.go` 用 `//go:embed dist` 嵌入 `web/dist/`。完整产品构建必须是**先前端构建、后 Go 编译**，否则会嵌入旧界面。

- 仅改后端：可直接 `go test` / `go build`，因为 `web/dist` 已提交。
- 改前端：必须 `npm run build` 并提交更新后的 `web/dist`，再编译 Go。
- `node_modules/`、个人 `.env`、`release/` 二进制不提交。

## 架构与协议约定

HTTP 路由（`internal/server/server.go`）：`GET /ws`、`POST /api/files`、`PUT /api/files/{id}/chunks/{index}`、`POST /api/files/{id}/complete`、`DELETE /api/files/{id}`、`GET /api/files/{id}`、`GET /api/info`。

WebSocket 事件类型：服务端发 `welcome` / `system` / `presence` / `text` / `file` / `error`；客户端发 `text` 与 `hello`（改名）。

固定限制（前后端需保持一致）：

- 单条文字 **2 MiB**（UTF-8 字节），前端 `MAX_MESSAGE_SIZE` 与后端 `chat.MaxMessageBytes` 对应。
- 单文件 **1 GiB**，分片固定 **16 MiB**，全页面最多 **4** 个并发分片；每片最多自动重试 3 次。
- 限制值经 `GET /api/info` 暴露，前端不复制版本号或限制常量以外的产品版本。

核心不变量：

- **服务器权威**：消息的 IP、时间戳、ID 由服务器提供；客户端提交的 `username`/`clientId` 仅作展示 metadata，提交的 IP 一律不信任（用 `RemoteAddr`）。
- **无历史**：聊天记录仅存于页面内存，刷新即清空；只有用户名存入 `localStorage`。新加入的页面不接收历史消息。
- **临时文件**：存储在系统临时目录的 `localchat-*` 会话目录，`Ctrl+C`/SIGTERM 时清理；强制杀进程/断电不保证清理。
- **安全响应头**：所有响应带 CSP、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`Cache-Control: no-store`；非 GET/HEAD 请求校验 `Origin` 与 Host 一致，否则 403。

前端组织：`App.vue` 组装；`composables/` 负责 WebSocket、上传、拖拽、用户名、应用信息；`presentation/messages.ts` 负责消息分组（同一连接身份 + 相邻 2 分钟内合并）与代码/JSON/配置识别；`components/` 为纯展示与交互。

## 版本与仓库信息

- `internal/buildinfo.Version` 是 CLI 与 `/api/info` 的**唯一**版本来源，开发构建为 `dev`。
- 注入方式：`-ldflags "-X localchat/internal/buildinfo.Version=vX.Y.Z"`。
- 前端版本通过 `/api/info` 读取，**不要**在前端另建产品版本字符串；`web/package.json` 的版本仅为依赖元数据。
- 仓库链接在 `web/src/config.ts` 的 `REPOSITORY_URL`；迁移/fork 时同步修改它与 README 中的 CI Badge。
- 端口优先级：显式 `-addr` > 环境变量 `LOCALCHAT_PORT` > 根目录 `.env` > 默认 8787。`.env` 仅由 `start/` 脚本读取，Go 后端不读取 `.env`，脚本按数据处理（不执行其内容）。

## 代码与文档规范

- 注释、面向用户的界面文案与文档以中文为主；标识符、命令与路径用英文。
- 提交前端改动时使用 `vue-tsc --noEmit`（`npm run build` 已包含）保证类型通过。
- Go 代码保持 `go vet` 无告警；新增并发逻辑需通过 `go test -race`。
- 测试风格：后端用 `httptest` 起真实 HTTP/WebSocket 连接并覆盖边界（非法 JSON、超长内容、缺片、越界索引、幂等重试、Range/HEAD、中文文件名、清理）；前端通过转译真实 TS 模块并用假 `fetch` 驱动 `useUpload`、直接测试 `presentation/messages.ts`。
- `.gitattributes` 强制行尾：`*.sh` / `*.command` / `*.ts` / `*.vue` / `*.css` / `*.go` / `.env.example` 为 LF，`*.cmd` / `*.ps1` 为 CRLF。

## CI 与发布

- `ci.yml`：仅在 push 到 `main` 与 Pull Request 时运行，`contents: read`，两个并行 job——`frontend`（`npm ci` → `npm test` → `npm run build`）与 `backend`（`go test ./...` → `go vet ./...` → `go build ./cmd/localchat`，使用已提交的 dist）。普通 push 不创建 Tag/Release。
- `release.yml`：仅在 push 形如 `vX.Y.Z` 的 Tag 时运行，`contents: write`；重新跑前端与后端检查后，编译六个平台（windows/linux/darwin × amd64/arm64，`CGO_ENABLED=0`），打包（Windows 用 zip，其余 tar.gz）并生成 `SHA256SUMS.txt`，最后创建并发布 Release。
- `build-binaries.sh` 与 `package-release.sh` 会校验版本为 `dev` 或 `vX.Y.Z`，且打包版本必须与编译版本一致。
- 发布产物共 7 个资产；本地验证用 `./scripts/build-release.sh`（输出到被忽略的 `release/`）。

## 易错点提醒

- 改前端却忘记重新构建并提交 `web/dist`，会导致二进制内嵌旧界面。
- 前端测试不是标准 `npm run test` 之外的框架，而是转译 TS 后运行 `node --test`；新增前端测试文件需在 `web/scripts/test-upload.mjs` 中登记。
- 上传接口对 JSON 严格解析：`Content-Type` 必须为 `application/json`，拒绝未知字段与多余对象；分片必须 `application/octet-stream` 且长度精确。
- 所有 HTTP 文件接口的鉴权仅用于展示，不要把它当作访问控制；不要将端口映射到公网。
- 交叉编译通过不等于异系统实机验证；Windows/Linux/Apple Silicon 仍需各自设备验证（见 `docs/TESTING.md`）。