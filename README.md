# EasyLAN

[![CI](https://github.com/YEXIAONAN/EasyLAN/actions/workflows/ci.yml/badge.svg)](https://github.com/YEXIAONAN/EasyLAN/actions/workflows/ci.yml)

**Same network. Chat and share.**

EasyLAN（原 LocalChat）是一个极简局域网聊天与临时文件传输工具。运行一个程序，同一局域网的设备用浏览器访问，就可以聊天、传图片与文件。无需账号、数据库、互联网或客户端安装。

Go + WebSocket + 原生 HTML/CSS/JavaScript。所有资源嵌入单个二进制，无 CDN、网络字体、前端框架或生产运行时依赖。

## 使用

从 [EasyLAN v1.2.1 Release](https://github.com/YEXIAONAN/EasyLAN/releases/tag/v1.2.1) 下载对应系统与 CPU 的压缩包，解压后启动 `easylan`（Windows 为 `easylan.exe`），默认监听 `0.0.0.0:8787`。其他设备访问终端显示的 LAN 地址。输入设备名称后即可使用。

```sh
./easylan
./easylan -no-open
./easylan -addr 0.0.0.0:9000
./easylan -addr 127.0.0.1:8787 -no-open
```

- 主界面只显示顶栏、消息和输入框。点击在线数量打开右侧设备抽屉。
- 桌面 `Enter` 发送，`Shift + Enter` 换行；触屏设备 Enter 换行，点击箭头发送。
- `+` 选择文件，直接拖入文件，或在输入框用 Ctrl/Cmd + V 粘贴截图。**所有附件先预览，确认发送后才上传**；发送前可以逐个移除。
- 图片发送完成后直接显示缩略图，点击查看大图。普通文件显示名称、类型、大小、状态和下载入口。
- 同一连接两分钟内的相邻消息合并显示；身份、内容与顺序保持原样。
- 顶栏 Settings 包含设备名称、语言、发送/接收声音、服务器信息、版本、GitHub 与 About。
- 支持 English / 简体中文，默认英文；支持系统深色偏好。

**临时性**：聊天只在页面内存，刷新清空；文件只保存在服务器本次会话的系统临时目录。Ctrl+C 正常退出会删除文件。服务器不回放历史，刷新不恢复上传。

[GitHub Releases](https://github.com/YEXIAONAN/EasyLAN/releases) 中的 v1.2.0 开始使用 EasyLAN 程序与压缩包名称；v1.1.1 及此前版本仍名为 LocalChat。GitHub 仓库现为 `YEXIAONAN/EasyLAN`。

## 文件与消息

单文件上限 **1 GiB**，分片 **16 MiB**，最多 **4 个并发分片**。多个文件依次排队，支持 Pause / Resume / Cancel / Retry。失败重试保留已完成分片；会话因服务器重启丢失时从头开始。

进度按服务器确认的分片计算。速度是有效上传时段的平均值；暂停等待时间不计入。ETA 由剩余大小和该速度估算，尚无已确认分片时显示 Estimating，合并时显示 Finishing，不伪造细粒度网络进度。完成广播幂等，下载流式读取并支持 HEAD / Range。

原文件使用 `File.slice()` 分片，不使用整个大文件的 `arrayBuffer()`。待发送队列最多 32 个附件；20 MiB 以上图片不解码本地缩略图，仍可作为附件发送。Object URL 在移除、入上传队列或页面退出时释放；完成/取消后释放原始 File 引用。**20 GB 文件目前不支持**，会在发送前拒绝；没有为 UI 擅自提高后端上限。

普通文字按 UTF-8 字节计算：≤64 KiB 直接发送，64–128 KiB 可选 Message / TXT，超过128 KiB 自动转 TXT。成功创建 TXT 上传会话才清空原文，失败保留草稿。TXT 复用同一上传管线。

预览遵循服务端扩展名和签名 allowlist：

- 文本、配置与源代码（包括 HTML 源码）：最多读取512 KiB，通过 `textContent` 显示，始终不执行内容。
- PNG / JPEG / WebP / GIF：浏览器原生显示，消息内懒加载；预览与放大走同一个已完成文件接口。
- PDF：新标签页浏览器原生查看器。
- SVG、Office、压缩包及未支持类型：仅下载。

上传文件保存在服务器生成的目录名下，原文件名只作 metadata。合并时磁盘峰值约为文件大小的两倍，流式操作不将完整文件放入服务端内存。

## 提醒与本地偏好

标签隐藏或窗口失去焦点后，对方的文字和完成文件增加未读，标题为 `(1) EasyLAN`（99+封顶），EL favicon 显示红点。返回可见且有焦点的页面后清零。自己的发送、在线状态、系统事件和分片进度不会增加未读。

发送音与接收音独立开关，默认开启。两路分别可选 Chime / Pulse / Bell / Drop / Wood 并试听，发送上行双音、接收下行双音。本地 Web Audio 生成，不下载音频；发送音以服务器回显为确认，接收音仅用于后台消息。浏览器需先有点击/键盘交互才能解锁音频，不使用系统通知权限或 Push API。

保留 `localchat.username`、`localchat.language` 和 `localchat.notification.*` 存储键，以兼容原版设备名称、语言和静音偏好。未读、聊天、草稿、上传和附件不持久化。

## 一键启动与配置

`start/` 包含 Windows `windows.cmd`、macOS `macos.command`、Linux `linux.sh`。脚本优先查找 EasyLAN 二进制，也兼容旧 LocalChat 名称，不要求终端用户安装 Go/Node。

```sh
cp .env.example .env
./start/macos.command
```

为兼容现有配置，端口键继续使用 `LOCALCHAT_PORT=8787`。合法范围1–65535；优先级：显式 `-addr` > 环境变量 > `.env` > 默认8787。`.env` 只作为数据解析，不执行；直接运行二进制使用 CLI 参数。

## Development

开发需 Go 1.23+（`go.mod`），自动测试及可选静态资源打包脚本需 Node 20+，CI 固定使用 `.node-version` 的 Node 24 LTS。浏览器直接运行 ES modules，无 bundler / transpiler / 前端依赖。

```sh
cd web
npm ci       # 零依赖，校验 lockfile
npm test
npm run dev  # 校验/复制静态资源，然后启动 Go，访问 localhost:8787
```

修改前端后重新启动 dev；无 HMR。`npm run build` 只检查 JS 语法/本地导入，再复制 HTML、JS、CSS、SVG 到 `web/dist`。

推荐流程：feature branch → push → PR → CI → Review → merge main。

## Build

```sh
cd web
npm test
npm run build
cd ..
go test ./...
go vet ./...
./scripts/build-local.sh
./easylan
```

也可执行 `make build`，完成前端构建并注入本地 Git 版本。Windows 在 Git Bash 中运行 `sh scripts/build-local.sh`，输出 `easylan.exe`。仓库保留生产 `web/dist`，因此仅用 Go 就能编译已提交界面；Node 不进入产品依赖。更新前端时需同步 dist。

### 唯一版本来源

`internal/buildinfo.Name = "EasyLAN"`，`internal/buildinfo.Version` 默认 `dev`。Go ldflags 注入版本，CLI、`GET /api/info`、Settings 显示同一个版本。npm 包版本只作私有工具元数据。

正式 Release 的版本来自触发构建的 GitHub Tag。本地 `make build` / `scripts/build-local.sh` 自动读取当前 checkout 的 Git Tag：干净的 Tag 提交显示 `v1.2.0`；有未提交修改显示 `v1.2.0-dirty`；Tag 后有新提交显示 `v1.2.0-N-g<commit>`。没有可用 Tag、没有 Git，或直接执行未注入版本的 `go build` / `go run`，才显示 `dev`。程序运行时不会联网查询最新 Tag，避免把旧程序误标成新版本，也保证离线可用。浅克隆缺少 Tag 时，可执行 `git fetch --tags`。

```sh
CGO_ENABLED=0 go build -trimpath \
  -ldflags "-X localchat/internal/buildinfo.Version=v1.2.0" \
  -o easylan ./cmd/localchat
```

为兼容性保留 Go module `localchat`、`cmd/localchat`、API 路径和协议。GitHub 展示链接在 `web/js/config.js`，来源为 `git remote get-url origin`。

## CI

[ci.yml](.github/workflows/ci.yml) 只监听 main push / PR，权限 `contents: read`。前端 `npm ci` → `npm test` → `npm run build`；后端 `go test` → `go vet` → `go build`。普通 push 不创建 Tag / Release。

建议在 GitHub Repository Settings 保护 main，要求 `frontend`、`backend` 状态检查通过后才 Merge。

## Release

[release.yml](.github/workflows/release.yml) 只监听 `v*.*.*` Tag，并校验 `vX.Y.Z`。独立重新验证前端与后端，通过后再跨平台编译、压缩、生成 SHA256SUMS、创建草稿、上传完全部资产后发布。无需 Docker、GoReleaser 或手工上传。

```sh
git checkout main
git pull --ff-only
# 下一个补丁版本示例
git tag v1.2.2
git push origin v1.2.2
```

Tag 自动决定 Release 版本；当前 `EasyLAN v1.2.1` 支持六个平台：

| 平台 | 压缩包 |
| --- | --- |
| Windows AMD64 / ARM64 | `easylan-v1.2.1-windows-{amd64,arm64}.zip` |
| Linux AMD64 / ARM64 | `easylan-v1.2.1-linux-{amd64,arm64}.tar.gz` |
| macOS Intel / Apple Silicon | `easylan-v1.2.1-darwin-{amd64,arm64}.tar.gz` |

ZIP 包含 `easylan.exe`，tar.gz 包含可执行的 `easylan`，另上传 `SHA256SUMS.txt`。Tag 自动注入版本，所有目标 `CGO_ENABLED=0`。

```sh
./scripts/build-release.sh               # 本地检查并生成 dev 六平台包，不发布
VERSION=v1.2.1 ./scripts/build-release.sh # 本地验证指定版本，不创建 Tag
(cd release && sha256sum -c SHA256SUMS.txt) # Linux；macOS 用 shasum -a 256 -c
```

## 网络

同一可互通的网络，允许服务器监听端口即可使用；程序不自动修改防火墙。HTTP 无账号与加密，适合可信临时 LAN，不应映射公网。来源校验限制浏览器跨来源请求，不能当作身份认证。在线数量按 WebSocket 连接计算，同一设备多页面分别计数。

启动脚本监听 `0.0.0.0:<端口>`。另一台设备必须使用终端 LAN 列表中的真实 Wi-Fi / 网线地址，例如 `http://10.13.96.216:2778/`；`127.0.0.1` / `localhost` 只用于服务器本机。LAN 列表不显示 point-to-point VPN / 代理隧道地址。

如果另一台设备显示 **502**，先关闭它的 VPN / 浏览器或系统代理重试，或将局域网地址设为直连；EasyLAN 自身不生成 502。可在另一台设备执行 `curl --noproxy '*' http://<服务器LAN-IP>:<端口>/api/info` 检查直连（Windows 用 `curl.exe`）。如果直连仍超时或拒绝连接，检查是否处于访客 Wi-Fi、路由器客户端隔离，以及服务器防火墙是否允许该 TCP 端口。

正常退出清理文件；强制终止、断电或系统崩溃无法保证清理。下载中的文件和未完成分片都随本次服务会话结束。

## 结构与协议

```text
cmd/localchat/      Go 启动与信号退出（保留内部路径）
internal/          chat / transfer / server / network / buildinfo
web/index.html     原生页面
web/js/            transport、files、composer、message-view、settings、preview、notifications
web/css/           tokens / base / layout / components / responsive
web/public/        EL logo.svg / favicon.svg
web/dist/          提交并 Go embed 的静态资源
web/tests/         Node 内置测试，无第三方测试框架
start/             一键启动及兼容端口配置
scripts/           六平台编译与压缩
.github/workflows/ 普通 CI 与 Tag Release
```

协议保持兼容：`/ws?username=` 发送 hello/text，接收 welcome/presence/text/file/system/error。`POST /api/files` 创建会话、`PUT /api/files/{id}/chunks/{index}` 传二进制分片、`POST .../complete` 合并广播、`DELETE /api/files/{id}` 取消、`GET /api/files/{id}` 下载、`GET .../preview` 预览、`GET /api/info` 产品及限制信息。

本次重构与验收记录见 [docs/EASYLAN-REFACTOR.md](docs/EASYLAN-REFACTOR.md)。历史 LocalChat 验收资料保留在 Git 和 docs 中。
