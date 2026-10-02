# EasyLAN 产品重构

日期：2026-10-02。初次重构完成两个本地提交；随后按用户要求将本轮变更提交推送，并使用标准格式 `v1.2.0` Tag 触发自动 Release。

## 初始检查

- 真实 origin：`git@github.com:YEXIAONAN/LocalChat.git`，分支 main，起点 v1.1.1 / f29732b；仓库 URL 保持真实。
- 原前端 Vue 3 + TypeScript / Vite，web/dist Go embed，230px 常驻 Sidebar，设置在底部，选择/拖拽直接上传，没有截图暂存队列或图片内联消息。
- 原功能包含 WebSocket 聊天/在线列表、HTTP 分片/暂停/重试/取消/下载、allowlist 预览、长文本 TXT、双路音效、标题/favicon 未读与语言。
- 协议：文字/身份/在线/完成文件广播走 WebSocket；实际文件走 HTTP 分片。不改 Go module、cmd 路径、HTTP 路由或消息字段。
- 复用：原上传 worker、重试与会话状态机、消息分组/代码识别、TXT 字节阈值、通知音调度及已有测试。
- 风险：移除 Vue 后显式刷新 UI、重连身份保留、暂存/上传对象生命周期、失败草稿保留、预览 CSP。

## 分阶段结果

1. 品牌：EasyLAN / EL SVG、favicon、wordmark、CSS tokens，API/CLI 同名。
2. 布局：无常驻 Sidebar，TopBar + Message Area + Composer；右侧 Device Drawer，Settings 收纳设备名/版本/Server/GitHub/语言/声音。
3. 消息：轻量气泡、相邻两分钟合组、末尾时间、File Card，后台确认支持的图片内联预览及放大。
4. Composer：所有选择/拖拽/粘贴进入暂存队列，不自动发送；确认后同一 addFiles 入口；可删除/多附件/自动高度/IME 与触屏 Enter 分行。
5. 上传：原 16 MiB / 4 并发状态机、速度与 ETA，显式 waiting/transferring/completed/failed/cancelled/paused/finishing 状态及取消重试。1 GiB 上限不变；20 GB 不支持，拒绝时不读取内容。
6. 响应式与可访问性：100dvh、安全区、移动 Drawer 86vw、图片/卡片尺寸限制、Tab trap、inert、Esc/backdrop/focus return、prefers-reduced-motion、系统深色。
7. 清理：删除旧 Vue/TS/Vite 文件及依赖，ES modules，无打包器；可选 Node 脚本仅语法检查/复制静态资源，Go 可直接编译提交的 dist。
8. 工程：下一次发布包前缀 easylan；内部 Go/存储键/端口键/仓库地址兼容。普通 CI 与 Tag Release 的触发条件保持分离。

## 生命周期与性能

附件最多32个。只有20 MiB以下且 PNG/JPEG/GIF/WebP 类型创建 thumbnail Object URL；移除/提交上传/退出立即 revoke；完成/取消释放 File 引用。上传只 slice，不完整 arrayBuffer；失败保留 File 供 Retry。预览请求关闭即 abort，图片用 HTTP URL，文本由服务端上限512 KiB限制。

消息增量 append，不每次重建历史；相邻分组只检查上一条，CSS content-visibility 优化离屏渲染。传输变更合并到 requestAnimationFrame；Drawer/Settings 只在打开时更新。通知一次实例、每路400ms节流、关闭时清理节点和监听。连接退出停止重连并取消身份订阅；BFCache 返回重载以保持临时会话语义。

## 验证状态

- Frontend：npm ci（零依赖）、47项 Node 测试、静态 JS 语法/导入检查与 dist 复制全部通过。
- Backend：go test -race ./...、go vet ./...、CGO_ENABLED=0 go build 全部通过。
- Embed：Go 测试检查原生 app.js / composer.js / CSS / EL SVG 正常服务；验证缩略图需要的 img-src blob CSP。
- Release：六平台本地 dev 交叉编译与打包通过；六个 SHA256、ZIP/tar 内容、Unix执行位、GOOS/GOARCH/CGO 元数据均通过。
- CI：push main / PR；Release：仅 v*.*.* Tag，版本注入来自该 Tag。发布是否成功以 GitHub Actions / Release 结果为准。

浏览器工具保存的访问拒绝设置仍阻止 http://127.0.0.1:8794/；用户已文字授权并表示解除设置，工具重试仍明确返回拒绝。未通过其他地址、浏览器或 CDP 绕过。桌面/平板/手机视觉验收及真实剪贴板手势待该权限恢复，不能宣称已通过。用户随后明确确认先发布 v1.2.0，README 界面截图延后补充。仓库改名同样受 GitHub 浏览器访问权限阻止，本次保留真实 origin 和现有链接。
