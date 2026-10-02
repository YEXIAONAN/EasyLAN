# 一键启动 EasyLAN

- **Windows**：双击 `windows.cmd`（调用系统自带的 Windows PowerShell）。
- **macOS**：双击 `macos.command`。
- **Linux**：执行 `./start/linux.sh`，或在支持脚本运行的文件管理器中双击。

脚本会自动寻找当前系统/CPU 的二进制（Windows、Linux、macOS 均支持 AMD64 / ARM64）：先检查根目录的 `easylan` / `easylan.exe`，然后检查根目录及 `release/` 中的平台名称程序，并兼容旧 `localchat` 名称。启动时打印实际选中的程序路径，避免误用旧的 `release/` 构建。缺少程序时会提示构建方式，不会自动安装 Go、Node 或其他依赖。

源码开发执行 `make build` 后再启动；本地版本自动来自 Git Tag（修改过的源码带 `-dirty`）。正式发布程序携带 Release Tag，无需联网读取 GitHub。脚本只启动已有程序，不自动重新编译；重新构建后需停止旧进程，再启动才能使用新程序。

## 设置端口

根目录 `.env`：

```dotenv
LOCALCHAT_PORT=8787
```

修改后重启生效，支持 1–65535。不配置时使用 8787。克隆仓库后可以把根目录 `.env.example` 复制为 `.env`；个人 `.env` 已被 Git 忽略。

优先级：命令行 `-addr` > 环境变量 `LOCALCHAT_PORT` > `.env` > 默认值。

```sh
./start/macos.command -no-open
LOCALCHAT_PORT=9000 ./start/linux.sh
./start/linux.sh -addr 127.0.0.1:9000 -no-open
```

Windows 终端也可以运行 `start\windows.cmd -no-open`。所有入口均可从任意工作目录调用。macOS/Linux 如果下载后丢失执行权限，可执行：

```sh
chmod +x start/*.sh start/macos.command
```

直接运行 Go 二进制时，仍使用原有默认端口/CLI 参数；`.env` 是由启动脚本读取并转换成 `-addr` 参数的。业务后端保持不变。

## 其他设备访问

使用终端 LAN 列表中的真实网卡地址与配置端口，不能使用 `127.0.0.1`。默认监听所有网卡；显式 `-addr 127.0.0.1:...` 会限制为本机访问。

如果返回 502，临时关闭访问设备的 VPN / 代理，或将局域网地址配置为直连。若直连仍无法连接，再检查服务器防火墙和 Wi-Fi 访客网络 / 客户端隔离。
