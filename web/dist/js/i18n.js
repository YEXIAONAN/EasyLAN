import { ref } from "./state.js";
const LANGUAGE_KEY = "localchat.language";
export const locale = ref("en");
export const LANGUAGES = [
    { id: "en", label: "English" },
    { id: "zh-CN", label: "简体中文" },
];
// English is the source language. Add another dictionary here to extend locales.
const zh = {
    "Settings": "设置",
    "Close settings": "关闭设置",
    "Language": "语言",
    "Sounds": "声音",
    "Changes are saved in this browser.": "设置自动保存在此浏览器。",
    "Receive sound": "接收提示音",
    "Send sound": "发送提示音",
    "Receive sound tone": "接收音色",
    "Send sound tone": "发送音色",
    "Preview receive sound": "试听接收提示音",
    "Preview send sound": "试听发送提示音",
    "On": "开启",
    "Off": "关闭",
    "Chime": "清脆",
    "Pulse": "脉冲",
    "Bell": "铃声",
    "Drop": "水滴",
    "Wood": "木音",
    "Chats": "聊天",
    "Local Network": "局域网",
    "Messages & files": "消息与文件",
    "Devices": "设备",
    "{count} device": "{count} 台设备",
    "{count} devices": "{count} 台设备",
    "You": "你",
    "Online": "在线",
    "Connected": "已连接",
    "Connecting": "连接中",
    "Disconnected": "未连接",
    "Connecting to the server…": "正在连接服务器…",
    "No connected devices": "暂无已连接设备",
    "Close sidebar": "关闭侧栏",
    "Open sidebar": "打开侧栏",
    "View connected devices": "查看已连接设备",
    "Server": "服务器",
    "EasyLAN Repository": "EasyLAN 代码仓库",
    "Application version": "应用版本",
    "Version unavailable": "无法获取版本",
    "Chat messages": "聊天消息",
    "No messages yet": "暂无消息",
    "Send a message or drop a file to share with this network.": "发送消息或拖入文件，与局域网中的设备分享。",
    "Messages clear on refresh. Files expire when the server stops.": "刷新后消息清空，服务器停止后文件失效。",
    "Your messages": "你的消息",
    "Messages from {name}": "来自 {name} 的消息",
    "{count} new message": "{count} 条新消息",
    "{count} new messages": "{count} 条新消息",
    "{name} joined EasyLAN": "{name} 加入了 EasyLAN",
    "{name} left EasyLAN": "{name} 离开了 EasyLAN",
    "Message": "消息",
    "Message…": "输入消息…",
    "Send": "发送",
    "Send message": "发送消息",
    "Attach files": "添加文件",
    "Long message detected. Send as:": "检测到长文本，发送为：",
    "Send as Message": "发送为消息",
    "Send as TXT": "发送为 TXT",
    "Queuing TXT file…": "正在加入 TXT 上传队列…",
    "Long message converted to TXT.": "长消息已转换为 TXT。",
    "Could not start TXT upload. Your text is still here; retry the file transfer or send again.": "无法开始 TXT 上传，原文已保留；请重试文件传输或重新发送。",
    "Change your name": "修改名称",
    "Welcome to EasyLAN": "欢迎使用 EasyLAN",
    "Choose a name to identify this browser on your local network.": "选择一个名称，在局域网中标识此浏览器。",
    "Your name": "你的名称",
    "e.g. Waiting or Server-01": "例如 Waiting 或 Server-01",
    "Use 1–32 characters, without control characters.": "请输入 1–32 个字符，不包含控制字符。",
    "Saved in this browser. No account required.": "保存在此浏览器，无需注册账号。",
    "Save name": "保存名称",
    "Enter EasyLAN": "进入 EasyLAN",
    "Cancel": "取消",
    "Copy": "复制",
    "Copied": "已复制",
    "Copied.": "已复制。",
    "Copy message": "复制消息",
    "Select text to copy": "选择文字进行复制",
    "Collapse": "收起",
    "Show more": "展开",
    "Preview": "预览",
    "Close preview": "关闭预览",
    "Loading preview…": "正在加载预览…",
    "Checking…": "检查中…",
    "Download": "下载",
    "Download full file": "下载完整文件",
    "Previewing first 512 KiB.": "仅预览前 512 KiB。",
    "Preview truncated. Download full file below.": "预览已截断，可在下方下载完整文件。",
    "Use your browser’s native viewer to preview this PDF.": "使用浏览器自带的查看器预览此 PDF。",
    "Open PDF preview": "打开 PDF 预览",
    "If preview is unavailable in this browser, download the file to open it locally.": "若此浏览器无法预览，请下载文件后在本地打开。",
    "Copy unavailable. Select the text to copy it.": "无法自动复制，请选择文字进行复制。",
    "File is no longer available.": "文件已失效。",
    "Preview unavailable. You can still download this file.": "无法预览，你仍可下载此文件。",
    "This file expired when the server stopped.": "服务器停止后，此文件已失效。",
    "This file is unavailable. Please try again.": "此文件暂不可用，请重试。",
    "Download unavailable.": "无法下载。",
    "File transfers": "文件传输",
    "In queue": "排队中",
    "Uploading": "上传中",
    "Paused": "已暂停",
    "Preparing download": "正在准备下载",
    "Uploaded": "已上传",
    "Upload failed": "上传失败",
    "Cancelling": "取消中",
    "Cancelled": "已取消",
    "Ready": "已就绪",
    "Dismiss transfer": "关闭传输记录",
    "Upload {name}": "上传 {name}",
    "{done} / {total} chunks": "{done} / {total} 个分片",
    "Pause": "暂停",
    "Resume": "继续",
    "Retry": "重试",
    "Dismiss error": "关闭错误提示",
    "Drop files to send": "拖入文件即可发送",
    "Up to 1 GB per file": "每个文件最大 1 GB",
    "Connect to EasyLAN before sending files.": "请连接 EasyLAN 后再发送文件。",
    "Choose your name before sending a file.": "请设置名称后再发送文件。",
    "{name} exceeds the 1 GB file limit.": "{name} 超过 1 GB 文件大小限制。",
    "Message is too large. Consider sending it as a file.": "消息过大，请考虑作为文件发送。",
    "Waiting for a connection. Your message is still here.": "正在等待连接，原消息已保留。",
    "Previous message is still sending. Try again in a moment.": "上一条消息仍在发送，请稍后重试。",
    "The server sent an invalid message.": "服务器发送了无效消息。",
    "Unable to send message.": "无法发送消息。",
    "Could not create upload session. Retry to send this file.": "无法创建上传会话，请重试发送文件。",
    "The request timed out. Retry to continue from completed chunks.": "请求超时，重试后将从已完成分片继续。",
    "Upload failed. Retry to continue.": "上传失败，请重试继续。",
    "Upload cancelled.": "上传已取消。",
    "Cancellation failed: {error} Click Retry to delete temporary chunks.": "取消失败：{error} 点击重试以删除临时分片。",
    "Request failed ({status}).": "请求失败（{status}）。",
    "Failed to fetch": "网络请求失败",
    "Provide size, chunkSize and chunks.": "请提供文件大小、分片大小与分片数量。",
    "Files must be at most 1 GB.": "文件大小不能超过 1 GB。",
    "Use 16 MB chunks and the correct chunk count.": "请使用 16 MB 分片及正确的分片数量。",
    "Provide a valid filename and username.": "请提供有效的文件名与用户名称。",
    "Upload session not found. The server may have restarted.": "上传会话不存在，服务器可能已重启。",
    "Upload is no longer active.": "上传会话已结束。",
    "Upload was cancelled.": "上传已取消。",
    "Some chunks are missing. Upload them before completing.": "缺少部分分片，请上传完整后再完成。",
    "A chunk is missing. Retry the upload.": "缺少分片，请重试上传。",
    "This file is already shared.": "此文件已分享。",
    "Could not remove temporary chunks. Retry cancellation.": "无法删除临时分片，请重试取消。",
    "Your name must be 1–32 characters.": "名称必须为 1–32 个字符。",
    "Message is too large.": "消息过大。",
    "Invalid username.": "无效的用户名称。",
};
Object.assign(zh, {
    "{count} online": "{count} 在线", "Online devices": "在线设备", "Close": "关闭",
    "Same network. Chat and share.": "同一局域网，直接聊天与传文件",
    "Drop a file or send your first message.": "拖入文件或发送第一条消息",
    "Message, paste an image, or drop a file…": "输入消息 / 粘贴图片 / 拖入文件…",
    "Drop files to attach": "释放以添加文件", "Attachments": "待发送附件",
    "Remove attachment {name}": "移除附件 {name}", "View image {name}": "查看图片 {name}",
    "Device name": "设备名称", "Server information": "服务器信息", "Current address": "当前地址",
    "Connection": "连接状态", "Version": "版本", "About EasyLAN": "关于 EasyLAN",
    "Simple local chat. No accounts. No cloud.": "极简局域网聊天，无账号，无云服务。",
    "Waiting": "等待", "Transferring": "传输中", "Completed": "完成", "Failed": "失败",
    "Finishing": "正在合并文件", "{seconds}s left": "剩余 {seconds} 秒", "{minutes}m left": "剩余 {minutes} 分钟",
    "Estimating…": "正在估算…", "File": "文件", "Save": "保存", "Saved": "已保存",
    "Too many attachments. Send or remove some first.": "待发送附件过多，请先发送或移除部分附件。",
    "Image preview unavailable. The file can still be sent.": "无法显示图片预览，仍可发送原文件。",
});

function applyDocumentLanguage() {
    if (typeof document !== "undefined")
        document.documentElement?.setAttribute("lang", locale.value);
}
export function initializeLocale() {
    locale.value = "en";
    try {
        if (localStorage.getItem(LANGUAGE_KEY) === "zh-CN")
            locale.value = "zh-CN";
    }
    catch { /* Default English also works without storage. */ }
    applyDocumentLanguage();
}
export function setLocale(value) {
    if (value !== "en" && value !== "zh-CN")
        return;
    locale.value = value;
    try {
        localStorage.setItem(LANGUAGE_KEY, value);
    }
    catch { /* Page-only preference. */ }
    applyDocumentLanguage();
}
export function t(key, values = {}) {
    const text = locale.value === "zh-CN" ? zh[key] || key : key;
    return text.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? String(values[name]) : token);
}
// Translate only known system/error notices, never message bodies or filenames.
export function systemMessage(content = "") {
    const match = content.match(/^([\s\S]+) (joined|left) (?:EasyLAN|LocalChat)$/);
    return match ? t(`{name} ${match[2]} EasyLAN`, { name: match[1] }) : content;
}
export function notice(content) {
    const size = content.match(/^([\s\S]+) exceeds the 1 GB file limit\.$/);
    if (size)
        return t("{name} exceeds the 1 GB file limit.", { name: size[1] });
    const status = content.match(/^Request failed \((\d+)\)\.$/);
    if (status)
        return t("Request failed ({status}).", { status: status[1] });
    const cancellation = content.match(/^Cancellation failed: ([\s\S]+) Click Retry to delete temporary chunks\.$/);
    if (cancellation)
        return t("Cancellation failed: {error} Click Retry to delete temporary chunks.", { error: notice(cancellation[1]) });
    return t(content);
}
