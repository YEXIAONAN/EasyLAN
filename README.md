# LocalChat v0.1.0

A lightweight local network chat and temporary file transfer tool.

在开发、运维、跨系统调试时，运行一个程序，复制局域网地址给另一台设备，就能传递文字、配置、日志与文件。服务器和客户端均不需要账号、数据库或云服务；发布程序不需要安装 Go、Node.js 或其他运行环境。

## 使用

从 `release/` 选择当前服务器设备对应的可执行文件：

| 平台 | 程序 |
| --- | --- |
| Windows x64 | `localchat-windows-amd64.exe` |
| Linux x64 | `localchat-linux-amd64` |
| Linux ARM64 | `localchat-linux-arm64` |
| macOS Intel | `localchat-darwin-amd64` |
| macOS Apple Silicon | `localchat-darwin-arm64` |

Windows 双击 `.exe`，或在终端运行。Linux/macOS：

```sh
chmod +x localchat-darwin-arm64
./localchat-darwin-arm64
```

程序默认监听 `0.0.0.0:8787`，启动后显示本机可用 IPv4 地址，并尝试打开 `http://127.0.0.1:8787`。另一台设备在同一个局域网内，用浏览器打开终端显示的 LAN 地址。输入名字后即可聊天；名字可以点击侧栏底部的当前用户修改；手机上先打开左上角菜单。

```text
LocalChat v0.1.0

✓ Server started

Local
  http://127.0.0.1:8787

LAN
  http://192.168.1.23:8787
```

`Enter` 发送，`Shift + Enter` 换行。点击 `+` 选择文件，也可以直接拖入文件。上传支持 Pause / Resume / Cancel，失败后点击 Retry。上传完成后所有当前在线页面会收到下载卡片。

按 `Ctrl+C` 正常退出：当前会话的所有上传分片和文件会被删除。聊天记录仅存在于页面内存，刷新即清空；只有用户名保存到 `localStorage`。刷新不会恢复上传，也不会获取之前的文件消息。

可选命令行参数：

```sh
./localchat -no-open                 # 不自动打开浏览器
./localchat -addr 0.0.0.0:9000        # 更换监听地址/端口
./localchat -addr 127.0.0.1:8787      # 仅本机访问
./localchat -h
```

## 一键启动与端口配置

项目根目录的 `start/` 提供以下入口，脚本会自动定位项目目录和对应系统/CPU 的二进制，无需在特定目录打开终端：

| 平台 | 启动入口 |
| --- | --- |
| Windows | 双击 `start/windows.cmd` |
| macOS | 双击 `start/macos.command` |
| Linux | 执行 `./start/linux.sh`，文件管理器支持时也可双击选择运行 |

首次使用源码仓库，先按下文构建对应二进制；发布程序应放在 `release/` 或项目根目录。脚本不会要求最终用户安装 Go 或 Node，也不会在启动时自动安装依赖。macOS/Linux 若下载后执行权限丢失，运行 `chmod +x start/*.sh start/macos.command`。

在根目录 `.env` 中设置端口：

```dotenv
LOCALCHAT_PORT=8787
```

仓库中提供 `.env.example`，克隆后可复制为 `.env`。当前工作目录已经创建默认 `.env`；个人 `.env` 不提交到 Git。

```sh
cp .env.example .env
# 将 LOCALCHAT_PORT 改成需要的端口，例如 9000，然后启动
./start/macos.command
```

合法端口范围为 **1–65535**，省略配置时默认 **8787**。启动脚本读取 `.env`，修改后重新启动生效。端口优先级：显式 `-addr` 参数 > 环境变量 `LOCALCHAT_PORT` > `.env` > 默认值。

```sh
LOCALCHAT_PORT=9000 ./start/linux.sh
./start/macos.command -no-open
./start/linux.sh -addr 127.0.0.1:9000 -no-open
```

直接运行二进制仍使用现有 CLI 参数和默认端口；`.env` 由启动脚本处理，Go 后端和通信/上传协议保持原样。启动脚本仅把有效端口传给已有 `-addr` 参数，不会执行 `.env` 中的内容。

## 特性与边界

- Go HTTP + WebSocket；Vue 3 + TypeScript；前端静态资源直接嵌入二进制。
- 多浏览器实时广播，服务器提供 IP 和时间戳，显示在线连接列表。
- 单条文字内容最大 **2 MiB**（按 UTF-8 字节），支持长文本、换行、折叠与复制。JSON 转义后的 WebSocket 帧另设有限上限。
- 单文件最大 **1 GiB**（界面标为 1 GB），固定 **16 MiB** 分片，全页面最多 **4** 个同时传输的分片。多个文件依次排队；暂停当前文件后，队列可继续处理其他文件。
- 进度按成功分片计算；速度为当前有效上传时段的平均值，不包含暂停等待时间。每片最多自动重试 3 次；手动重试保留成功分片。
- Pause 停止提交新分片，正在上传的分片会自然结束；Resume 继续剩余分片。Cancel 中止传输并删除对应临时上传。
- 完成接口可安全重试，不会重复广播文件。下载为流式 HTTP，支持 Range、HEAD、原始文件名和 MIME。
- 文件存储在系统临时目录的 `localchat-*` 会话目录下，使用服务器生成的保存名称。文件名只作为清理后的下载 metadata。
- 文件合并过程会暂时同时存在分片与成品，磁盘峰值约为文件大小的两倍；下载/上传不将整个文件读入内存。
- 页面刷新后上传状态丢失，未完成分片保留到服务器退出。若服务器重启导致上传会话丢失，手动 Retry 会创建新上传并从头开始。
- `Ctrl+C` / SIGTERM 会清理文件；强制结束进程、断电或系统崩溃无法保证清理，可由系统临时目录清理机制处理。

无登录、无私聊、无历史同步、无永久文件管理。在线数量按浏览器 WebSocket 连接计算，同一设备的多个页面分别计数。

## 网络与防火墙

其他设备需要能访问服务器的 TCP 8787 端口（使用 `-addr` 时以指定端口为准）。检查是否在同一个可互通的网络、是否启用访客 Wi-Fi/AP 隔离，以及服务器防火墙是否允许该端口。Windows 首次运行可能出现系统防火墙授权提示；程序不会自动修改防火墙。

V1 使用 HTTP，没有加密或身份认证，适用于可信的临时局域网。不要将端口映射到公网。跨来源浏览器的 WebSocket/上传请求会被拒绝，但这不是访问控制；能直接连接的设备均能使用当前服务。

## 开发

仅开发机器需要 Go **1.23+**、Node.js **20.19+** 和 npm。生产用户只需要对应平台的程序与浏览器。

```sh
cd web
npm ci
npm run dev
```

另一个终端在项目根目录运行：

```sh
go run ./cmd/localchat -no-open
```

访问 Vite 显示的开发地址（默认 `http://localhost:5173`）。Vite 将 `/api` 和 `/ws` 代理到 Go 服务的 8787 端口。所有字体、图标和资源均在本地，没有 CDN 请求。

## 生产构建

```sh
cd web
npm ci
npm run build
cd ..
CGO_ENABLED=0 go build -trimpath -o localchat ./cmd/localchat
./localchat
```

Windows PowerShell 后端构建：

```powershell
$env:CGO_ENABLED = "0"
go build -trimpath -o localchat.exe ./cmd/localchat
.\localchat.exe
```

`web/embed.go` 通过 `//go:embed dist` 嵌入 `web/dist/`。本项目**保留生成的 dist 作为交付文件**，因此拿到源码后可直接执行 `go test` 或 `go build`；修改前端后必须重新 `npm run build`，再编译 Go。`web/dist` 不在 `.gitignore` 中，`node_modules` 和 release 二进制在忽略列表中。

## 测试与跨平台发布

```sh
go test -race ./...
go vet ./...
cd web
npm test
npm run build
cd ..
./scripts/build-release.sh
```

发布脚本先运行检查并重建前端，再生成五个平台的无 CGO 单二进制，以及 `release/SHA256SUMS`。运行该脚本需 POSIX shell（macOS/Linux，或 Windows 的 Git Bash）。单独交叉编译示例：

```sh
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o release/localchat-windows-amd64.exe ./cmd/localchat
```

也可使用 `make build` / `make test` / `make release`。测试说明和本机验收记录见 [docs/TESTING.md](docs/TESTING.md)。交叉编译成功不代表在另一种操作系统上完成了实机测试。

## 结构

```text
cmd/localchat/       启动、监听、浏览器打开与信号退出
internal/chat/      WebSocket 连接、广播、身份与在线状态（不保存历史）
internal/network/   RemoteAddr 解析与本机 LAN IPv4 探测
internal/transfer/  临时会话、分片写入、流式合并、取消和下载
internal/server/    HTTP 路由、来源校验与嵌入资源服务
web/src/            Vue 组件、WebSocket / 上传 / 拖拽 composables
web/dist/           生产静态资源，嵌入 Go
start/              Windows / macOS / Linux 一键启动与 .env 读取
scripts/            发布构建
```

## 协议

- `GET /ws?username=Waiting`：建立连接。服务器先发送 `welcome`（clientId、IP）、`system` 与 `presence`（设备列表）事件。
- 发送 `{ "type": "text", "username": "Waiting", "content": "hello" }`；展示用户名来自连接状态，IP、时间和消息 ID 由服务器补充。`hello` 事件可修改当前连接的用户名。
- `POST /api/files`：JSON 字段 `name`、`size`、`chunkSize`、`chunks`、`username`，以及可选 `clientId`，返回 `fileId`。
- `PUT /api/files/{id}/chunks/{index}`：从 0 开始的索引，直接发送 `application/octet-stream` 二进制。
- `POST /api/files/{id}/complete`：校验、合并并广播 `file` 消息。
- `DELETE /api/files/{id}`：取消未完成的上传。
- `GET /api/files/{id}`：下载当前会话中已完成的文件。
- `GET /api/info`：版本、局域网地址和大小限制。

所有文件和聊天操作均无需登录。HTTP 文件接口的 username/clientId 仅作为展示 metadata，不能作为身份认证；客户端提交的 IP 不被信任。
