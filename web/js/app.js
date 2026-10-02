import { ref } from './state.js';
import { initializeLocale, locale, t, notice } from './i18n.js';
import { useWebSocket } from './websocket.js';
import { useUpload } from './files.js';
import { createComposer, installFileDrop } from './composer.js';
import { createMessageView, renderTransfers } from './message-view.js';
import { validName, showNameDialog, showSettings, showDevices } from './settings.js';
import { icon, translate, closeModal } from './ui.js';

initializeLocale(); translate();
let saved = '';
try { saved = localStorage.getItem('localchat.username') || ''; } catch { /* Page-only identity. */ }
const username = ref(validName(saved) ? saved : '');
const info = { version: '' }, sharedIds = new Set();
let client, uploads, composer, messages, drawer, settings;
let frame;
function schedule() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); }
function saveName(name) {
  username.value = name;
  try { localStorage.setItem('localchat.username', name); } catch { /* Keep old keys so existing preferences survive the rename. */ }
}
client = useWebSocket(username, { changed: schedule, messageReceived(message) {
  if (message.file) sharedIds.add(message.file.id);
  messages?.append(message);
} });
messages = createMessageView(client.ownIds);
uploads = useUpload(username, client.clientId, schedule);
function report(error) { uploads.error.value = error; schedule(); }
function uploadFiles(files) {
  if (!username.value || client.state.value !== 'connected') { report('Connect to EasyLAN before sending files.'); return []; }
  return uploads.addFiles(files);
}
composer = createComposer({ connected: () => client.state.value === 'connected', sendText: client.sendText, uploadFiles, waitForSession: uploads.waitForSession, report });
const disposeDrop = installFileDrop(composer.enqueueFiles);
const devicesButton = document.querySelector('#devices-button'), settingsButton = document.querySelector('#settings-button');
settingsButton.append(icon('settings'));
const events = new AbortController();
devicesButton.addEventListener('click', () => {
  devicesButton.setAttribute('aria-expanded', 'true');
  drawer = showDevices(client, () => { devicesButton.setAttribute('aria-expanded', 'false'); });
}, { signal: events.signal });
settingsButton.addEventListener('click', () => { settings = showSettings({ username, saveName, client, info }); }, { signal: events.signal });
document.querySelector('#error-banner button').addEventListener('click', () => { client.error.value = ''; uploads.error.value = ''; schedule(); }, { signal: events.signal });
function update() {
  const state = client.state.value;
  const status = document.querySelector('#connection-status'); status.className = `connection-status ${state}`;
  const label = t({ connected: 'Connected', connecting: 'Connecting', disconnected: 'Disconnected' }[state]);
  status.lastElementChild.textContent = label; status.setAttribute('aria-label', label); status.title = label;
  document.querySelector('#device-count').textContent = t('{count} online', { count: client.devices.value.length });
  const error = client.error.value || uploads.error.value;
  const banner = document.querySelector('#error-banner'); banner.hidden = !error; banner.firstElementChild.textContent = notice(error);
  composer.update();
  for (const upload of [...uploads.uploads.value]) {
    if (upload.status === 'completed' && sharedIds.has(upload.fileId)) uploads.dismiss(upload);
  }
  renderTransfers(document.querySelector('#transfer-tray'), uploads.uploads.value, uploads, sharedIds);
  if (drawer?.panel.isConnected) drawer.update();
  if (settings?.panel.isConnected) settings.update();
}
const unsubscribe = locale.subscribe(() => { translate(); messages.refresh(); update(); });
const infoController = new AbortController();
void fetch('/api/info', { signal: infoController.signal }).then(async response => {
  if (!response.ok) return;
  const result = await response.json();
  if (['EasyLAN', 'LocalChat'].includes(result.name) && typeof result.version === 'string') info.version = result.version;
  schedule();
}).catch(() => { /* Chat stays usable without About metadata. */ });
if (!username.value) showNameDialog(username, saveName);
update();
function dispose() {
  cancelAnimationFrame(frame); events.abort(); infoController.abort(); unsubscribe(); disposeDrop(); closeModal(); composer.dispose(); uploads.dispose(); messages.dispose(); client.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
// A BFCache restore must establish a fresh temporary session, just like refresh.
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
