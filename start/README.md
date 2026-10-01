# 一键启动 LocalChat

- **Windows**：双击 `windows.cmd`（调用系统自带的 Windows PowerShell）。
- **macOS**：双击 `macos.command`。
- **Linux**：执行 `./start/linux.sh`，或在支持脚本运行的文件管理器中双击。

脚本会自动寻找当前系统/CPU 的二进制，先检查项目根目录的 `release/`，然后检查根目录中的同名程序，最后检查开发构建的 `localchat` / `localchat.exe`。缺少程序时会提示构建方式，不会自动安装 Go、Node 或其他依赖。

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
