# LocalChat

[![CI](https://github.com/YEXIAONAN/LocalChat/actions/workflows/ci.yml/badge.svg)](https://github.com/YEXIAONAN/LocalChat/actions/workflows/ci.yml)

A lightweight local network chat and temporary file transfer tool.

在开发、运维、跨系统调试时，运行一个程序，复制局域网地址给另一台设备，就能传递文字、配置、日志与文件。服务器和客户端均不需要账号、数据库或云服务；发布程序不需要安装 Go、Node.js 或其他运行环境。

## 使用

从 [GitHub Releases](https://github.com/YEXIAONAN/LocalChat/releases) 下载当前服务器设备对应的压缩包。下列名称以 `v1.1.0` 为例，实际版本取决于发布 Tag：

| 平台 | Release 压缩包 | 解压后的程序 |
| --- | --- | --- |
| Windows x64 | `localchat-v1.1.0-windows-amd64.zip` | `localchat.exe` |
| Windows ARM64 | `localchat-v1.1.0-windows-arm64.zip` | `localchat.exe` |
| Linux x64 | `localchat-v1.1.0-linux-amd64.tar.gz` | `localchat` |
| Linux ARM64 | `localchat-v1.1.0-linux-arm64.tar.gz` | `localchat` |
| macOS Intel | `localchat-v1.1.0-darwin-amd64.tar.gz` | `localchat` |
| macOS Apple Silicon | `localchat-v1.1.0-darwin-arm64.tar.gz` | `localchat` |

Windows 双击解压后的 `.exe`，或在终端运行。Linux/macOS 的压缩包保留执行权限：

```sh
./localchat
# 文件系统未保留执行权限时：chmod +x localchat
```

程序默认监听 `0.0.0.0:8787`，启动后显示本机可用 IPv4 地址，并尝试打开 `http://127.0.0.1:8787`。另一台设备在同一个局域网内，用浏览器打开终端显示的 LAN 地址。输入名字后即可聊天；名字可以点击 Devices 列表中标有 You 的自己那一行修改；手机上先打开左上角菜单。

```text
LocalChat dev

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

## 消息提醒

页面仍打开且 `document.visibilityState` 不为 `visible` 时，其他连接发送的文字或完成上传的文件会增加未读数：标题显示 `(1) LocalChat`，超过 99 显示 `(99+) LocalChat`，原 favicon 右上角显示红点。重新可见立即清零，不弹 Toast。前台消息、自己的回显、系统/连接/在线设备事件以及上传分片和进度均不提醒。

Sidebar Footer 的 **Message sound · On / Off** 只控制声音，默认开启；仅该偏好保存到 `localStorage` 的 `localchat.notification.sound`。未读数属于本页生命周期，刷新清零。声音由 Web Audio 生成约 280ms 的轻量双音，400ms 内的密集消息合并声音，未读数仍逐条累计。首次点击或键盘交互尝试解锁音频；浏览器不支持或阻止音频时，聊天及标题/favicon 提醒继续正常。

以 Page Visibility 为准：有些浏览器在切到 IDE 后仍将露出的页面视为可见，此时保持静默。后台标签被浏览器冻结、休眠或丢弃时，消息处理可能延迟；关闭页面后不再接收。此功能不使用系统通知权限、Service Worker、Push API、HTTPS 或外部服务。

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

仓库中提供 `.env.example`，克隆后可复制为 `.env`。个人 `.env` 不提交到 Git。

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
- 桌面采用浅色 230px 侧栏，消息流最大 960px；手机使用抽屉侧栏和全屏布局。
- 连续消息按连接身份及两分钟内的相邻时间分组。他人的头像/姓名/IP/时间每组显示一次；自己的消息右对齐，不显示头像与身份信息。
- 普通多行文字使用系统 UI 字体。Markdown 围栏代码、JSON 和可识别源码/配置使用独立代码区；无法自动识别的代码可加三个反引号围栏。
- 普通文字按 UTF-8 字节计算：≤ **64 KiB** 直接发送，64–128 KiB 提供 Message / TXT 选择，> **128 KiB** 自动转成 TXT。短代码不受类型识别影响；普通 WebSocket 内容上限为 128 KiB，转义后的帧上限为该值 × 6 + 4 KiB。
- 单文件最大 **1 GiB**（界面标为 1 GB），固定 **16 MiB** 分片，全页面最多 **4** 个同时传输的分片。多个文件依次排队；暂停当前文件后，队列可继续处理其他文件。
- 进度按成功分片计算；速度为当前有效上传时段的平均值，不包含暂停等待时间。每片最多自动重试 3 次；手动重试保留成功分片。
- Pause 停止提交新分片，正在上传的分片会自然结束；Resume 继续剩余分片。Cancel 中止传输并删除对应临时上传。
- 完成接口可安全重试，不会重复广播文件。下载为流式 HTTP，支持 Range、HEAD、原始文件名和 MIME。
- 文件存储在系统临时目录的 `localchat-*` 会话目录下，使用服务器生成的保存名称。文件名只作为清理后的下载 metadata。
- 文件合并过程会暂时同时存在分片与成品，磁盘峰值约为文件大小的两倍；下载/上传不将整个文件读入内存。
- 页面刷新后上传状态丢失，未完成分片保留到服务器退出。若服务器重启导致上传会话丢失，手动 Retry 会创建新上传并从头开始。
- `Ctrl+C` / SIGTERM 会清理文件；强制结束进程、断电或系统崩溃无法保证清理，可由系统临时目录清理机制处理。

无登录、无私聊、无历史同步、无永久文件管理。在线数量按浏览器 WebSocket 连接计算，同一设备的多个页面分别计数。

## 离线文件预览与长文本

文件卡片在后端确认支持时显示 **Preview**，Download 保持独立。所有内容来自当前 LocalChat Server，没有云端服务、CDN 或解析器依赖。

- **文本**：TXT / LOG / MD、JSON / XML / YAML / YML / TOML / INI / CONF / CFG / ENV，以及 Go / Java / Python / JS / TS / Vue / C / H / C++ / HPP / C# / SH / Bash / Zsh / SQL / CSS、Dockerfile、Makefile。
- **HTML / HTM**：只显示源码文字，始终返回 `text/plain; charset=utf-8`，通过 Vue 文本插值放入 `<pre>`，不执行 HTML、脚本或事件属性。
- **图片**：PNG / JPG / JPEG / WebP / GIF，扩展名须与服务端探测到的文件签名相符；从 HTTP 流式加载，由浏览器原生显示。
- **PDF**：扩展名和 PDF 签名通过检查后，以 `application/pdf`、`inline` 返回。Dialog 提供 **Open PDF preview**，在新标签页使用浏览器原生查看器；不支持 PDF 的浏览器可下载后本地打开。
- **仅下载**：SVG、压缩包、磁盘镜像、安装包、Office 文件及所有未列入 allowlist 的类型。伪装成图片/PDF 的 HTML 或明显二进制文本也不开放预览。

文本只流式读取前 **512 KiB**，不加载完整文件；较大的日志会显示截断提示及 Download full file。默认 UTF-8，浏览器对无效序列使用 replacement character。Copy 不可用时给出提示，仍可手工选中文本；预览失败或文件过期时保留清晰错误与下载入口。文件仍随当前服务会话退出而清理。

长文本只根据字节大小处理，不依据代码/JSON 检测。TXT 名称为 `message-YYYYMMDD-HHmmss.txt`，使用 Blob → File，然后复用现有 16 MiB 分片上传、队列、Retry / Pause / Resume / Cancel、文件消息、预览和下载。成功创建上传会话后才清空原始输入；创建文件或会话失败会保留输入，失败的上传仍保留 File 供 Retry。没有新增长消息 API、WebSocket 文件协议或永久存储。

## 网络与防火墙

其他设备需要能访问服务器的 TCP 8787 端口（使用 `-addr` 时以指定端口为准）。检查是否在同一个可互通的网络、是否启用访客 Wi-Fi/AP 隔离，以及服务器防火墙是否允许该端口。Windows 首次运行可能出现系统防火墙授权提示；程序不会自动修改防火墙。

V1 使用 HTTP，没有加密或身份认证，适用于可信的临时局域网。不要将端口映射到公网。跨来源浏览器的 WebSocket/上传请求会被拒绝，但这不是访问控制；能直接连接的设备均能使用当前服务。

## Development / 开发

开发机器需要 Go **1.23+**（最低版本由 `go.mod` 定义）和 Node.js **24 LTS**（由根目录 `.node-version` 定义）。GitHub Actions 使用 `setup-go` 的 `go-version-file: go.mod` 与 `setup-node` 的 `node-version-file: .node-version`，不依赖开发者本机的默认版本。生产用户只需要程序与浏览器。

```sh
cd web
npm ci
npm run dev
```

另一个终端在项目根目录运行：

```sh
go run ./cmd/localchat -no-open
```

访问 Vite 显示的开发地址（默认 `http://localhost:5173`）。Vite 将 `/api` 和 `/ws` 代理到 Go 服务的 8787 端口；输出目录为 `web/dist/`。所有字体、图标和界面资源均在本地，没有 CDN 请求。

推荐日常流程：feature branch → push → Pull Request → CI → Review → Merge main。源代码修改前端后，需要同步提交重新构建的 `web/dist`。

## Build / 构建

```sh
cd web
npm ci
npm test
npm run build
cd ..
go test ./...
go vet ./...
CGO_ENABLED=0 go build -trimpath -o localchat ./cmd/localchat
./localchat
```

Windows PowerShell 后端构建：

```powershell
$env:CGO_ENABLED = "0"
go build -trimpath -o localchat.exe ./cmd/localchat
.\localchat.exe
```

`web/embed.go` 通过 `//go:embed dist` 嵌入 `web/dist/`。本项目保留生成的 dist，因此仅检查后端时可直接执行 `go test` / `go build`。完整产品构建必须按照 **前端构建 → Go 编译** 的顺序，以嵌入最新界面。`node_modules`、个人 `.env` 和 `release/` 二进制不提交。

### 版本来源

`internal/buildinfo.Version` 是 CLI 和 `/api/info` 的唯一版本来源，默认 `dev`。侧栏版本从 API 读取；前端没有独立的产品版本字符串。`web/package.json` 的私有 npm 包版本仅是依赖元数据，不用于应用展示，也不需要随 Tag 修改。

```sh
CGO_ENABLED=0 go build -trimpath \
  -ldflags "-X localchat/internal/buildinfo.Version=v1.1.0" \
  -o localchat ./cmd/localchat
```

启动横幅会显示 `LocalChat v1.1.0`。`GET /api/info` 返回 `name: "LocalChat"` 与同一个 `version: "v1.1.0"`，并保留局域网地址、文件/消息限制等现有字段。开发构建则显示 `dev`。

GitHub 链接已根据当前 `origin` 配置在 [web/src/config.ts](web/src/config.ts)。迁移或 fork 项目时，可修改该文件中的 `REPOSITORY_URL`，并更新本 README 的 CI Badge 地址。

## CI / 自动检查

[ci.yml](.github/workflows/ci.yml) 只监听 **push 到 main** 和 **Pull Request**，仅有 `contents: read` 权限。两个独立 job 并行运行，失败时可定位到具体 step：

- `frontend`：`npm ci` → `npm test` → `npm run build`（包含 TypeScript 检查）。
- `backend`：`go test ./...` → `go vet ./...` → `go build ./cmd/localchat`。

普通 CI 中，后端 job 使用已提交的 dist，前端 job 独立验证新构建。普通 `git push origin main` **只检查**，不创建 Tag、Release，也不上传二进制。CI Badge 显示真实工作流状态。

建议在 Repository Settings → Branches / Rulesets 中保护 `main`，启用 Require status checks before merging，并选择 CI 产生的 `frontend`、`backend` 检查（GitHub 界面可能显示为 `CI / frontend`、`CI / backend`）。这是推荐设置，不由项目代码自动修改仓库权限。

## Release / 发布

[release.yml](.github/workflows/release.yml) 仅监听 **push Tag `v*.*.*`**，并要求正式版本格式 `vX.Y.Z`。使用 `contents: write` 权限创建 Release，无其他写权限，也没有分支 push 或手动 dispatch 触发器。

发布下一个版本，例如 `v1.2.0`：

```sh
git checkout main
git pull --ff-only
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions 自动重新运行前端安装、测试与构建，然后配置 Go、运行 Go test / vet，再使用 `CGO_ENABLED=0` 编译六个平台。`github.ref_name` 自动传给 `VERSION`，通过 ldflags 注入所有二进制，不需要手动改版本文件。

编译后打包：Windows 使用 ZIP，内含 `localchat.exe`；Linux/macOS 使用 tar.gz，内含可执行的 `localchat`。生成包含六个压缩包 SHA-256 的 `SHA256SUMS.txt`，共上传 **7 个资产**。

全部检查、编译和打包成功后，工作流创建名为 `LocalChat vX.Y.Z` 的 Release，自动生成 Release Notes，上传资产完成后才将草稿发布。检查失败不会创建 Release；上传失败不会把不完整草稿发布。无需手工编译平台或上传文件，也无需手工创建 Release。

下载相应压缩包和 `SHA256SUMS.txt` 后可验证：

```sh
# 在包含六个压缩包的目录运行；只下载一个时可验证清单中对应条目。
sha256sum -c SHA256SUMS.txt       # Linux
shasum -a 256 -c SHA256SUMS.txt  # macOS
```

### 本地验证发布产物

macOS/Linux 的本地发布脚本使用 Go、Node/npm 和系统 `zip`、`tar`、SHA-256 工具，不依赖 Docker 或 GoReleaser，也不会发布到 GitHub：

```sh
./scripts/build-release.sh                 # 默认 dev，完整检查 + 六平台编译/打包
VERSION=v1.2.0 ./scripts/build-release.sh   # 仅本地生成带版本的产物
```

输出位于忽略的 `release/` 中。已有平台名称的裸二进制继续供 `start/` 使用；发布压缩包采用上述版本化名称。`build-binaries.sh` 与 `package-release.sh` 是工作流内部步骤，本地通常使用完整的 `build-release.sh`。后者要求二进制构建版本与打包版本相同，防止把 dev 程序标为正式版本。

也可使用 `make build` / `make test` / `make release`。测试与本机验收记录见 [docs/TESTING.md](docs/TESTING.md)。交叉编译通过不代表完成异系统实机验证。

## 结构

```text
cmd/localchat/       启动、监听、浏览器打开与信号退出
internal/buildinfo/ 唯一产品版本，供 CLI/API 使用
internal/chat/      WebSocket 连接、广播、身份与在线状态（不保存历史）
internal/network/   RemoteAddr 解析与本机 LAN IPv4 探测
internal/transfer/  临时会话、分片写入、流式合并、取消和下载
internal/server/    HTTP 路由、来源校验与嵌入资源服务
web/src/            Vue 组件、WebSocket / 上传 / 拖拽 composables
web/dist/           生产静态资源，嵌入 Go
start/              Windows / macOS / Linux 一键启动与 .env 读取
scripts/            校验、六平台编译与打包（本地不发布）
.github/workflows/  普通 CI 与 Tag Release 两个独立工作流
```

## 协议

- `GET /ws?username=Waiting`：建立连接。服务器先发送 `welcome`（clientId、IP）、`system` 与 `presence`（设备列表）事件。
- 发送 `{ "type": "text", "username": "Waiting", "content": "hello" }`；展示用户名来自连接状态，IP、时间和消息 ID 由服务器补充。`hello` 事件可修改当前连接的用户名。
- `POST /api/files`：JSON 字段 `name`、`size`、`chunkSize`、`chunks`、`username`，以及可选 `clientId`，返回 `fileId`。
- `PUT /api/files/{id}/chunks/{index}`：从 0 开始的索引，直接发送 `application/octet-stream` 二进制。
- `POST /api/files/{id}/complete`：校验、合并并广播 `file` 消息。
- `DELETE /api/files/{id}`：取消未完成的上传。
- `GET /api/files/{id}`：下载当前会话中已完成的文件（attachment、HEAD、Range 保持原样）。
- `GET /api/files/{id}/preview`：根据服务器 allowlist / 签名提供 text、image、pdf 预览；文本最多 512 KiB，包含 `X-Preview-Type`、`X-Preview-Truncated` 和 `X-Preview-Max-Bytes`。不支持返回 415，过期返回 404。
- 完成上传的 File metadata 增加 `previewType: "text" | "image" | "pdf" | "none"`，前端统一依据该值决定 Preview 支持。
- `GET /api/info`：产品名称、Go 二进制版本、局域网地址和大小限制。

所有文件和聊天操作均无需登录。HTTP 文件接口的 username/clientId 仅作为展示 metadata，不能作为身份认证；客户端提交的 IP 不被信任。
