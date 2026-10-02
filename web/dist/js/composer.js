import { MAX_FILE_SIZE } from './files.js';
import { createTextFile, textSendMode } from './longText.js';
import { t, notice, locale } from './i18n.js';
import { formatBytes } from './format.js';
import { el, icon, isModalOpen } from './ui.js';

const THUMBNAIL_LIMIT = 20 * 1024 * 1024;
const THUMBNAIL_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export function createAttachmentQueue(changed = () => {}, report = () => {}) {
  let sequence = 0;
  const items = [];
  function remove(key) {
    const index = items.findIndex(item => item.key === key);
    if (index < 0) return;
    const [item] = items.splice(index, 1);
    if (item.url) URL.revokeObjectURL(item.url);
    changed();
  }
  function enqueue(files) {
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) { report(`${file.name} exceeds the 1 GB file limit.`); continue; }
      if (items.length >= 32) { report('Too many attachments. Send or remove some first.'); break; }
      let url = '';
      if (THUMBNAIL_TYPES.has(file.type) && file.size <= THUMBNAIL_LIMIT) {
        try { url = URL.createObjectURL(file); } catch { /* Preserve the original attachment. */ }
      }
      items.push({ key: String(++sequence), file, url });
    }
    changed();
  }
  function dispose() {
    for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
    items.length = 0;
  }
  return { items, enqueue, remove, dispose };
}
export function clipboardImages(data) {
  return [...(data?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean).map((file, index) => {
    if (file.name && file.name.includes('.')) return file;
    const extension = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type] || 'png';
    return new File([file], `screenshot-${Date.now()}-${index + 1}.${extension}`, { type: file.type });
  });
}
export function createComposer({ connected, sendText, uploadFiles, waitForSession, report }) {
  const input = document.querySelector('#draft'), picker = document.querySelector('#file-picker');
  const attach = document.querySelector('#attach-button'), sendButton = document.querySelector('#send-button');
  const previews = document.querySelector('#attachments'), choice = document.querySelector('#long-text-choice');
  const status = document.querySelector('#composer-notice');
  const listeners = new AbortController();
  let pending = false, statusText = '';
  const queue = createAttachmentQueue(renderAttachments, report);
  attach.append(icon('plus')); sendButton.append(icon('send'));
  function resize() {
    input.style.height = 'auto'; input.style.height = `${Math.min(140, Math.max(36, input.scrollHeight))}px`;
  }
  function update() {
    sendButton.disabled = !connected() || pending || (!input.value.trim() && !queue.items.length);
    attach.disabled = pending;
    status.textContent = notice(statusText); status.hidden = !statusText;
  }
  function renderAttachments() {
    previews.replaceChildren(); previews.hidden = !queue.items.length;
    for (const item of queue.items) {
      const thumbnail = item.url ? el('img', { src: item.url, alt: '', onerror: e => { e.target.hidden = true; } }) : el('span', { class: 'file-icon' }, icon('file'));
      previews.append(el('div', { class: 'attachment' }, thumbnail,
        el('div', { class: 'attachment-info' }, el('strong', { text: item.file.name }), el('small', { text: formatBytes(item.file.size) })),
        el('button', { class: 'icon-button', 'aria-label': t('Remove attachment {name}', { name: item.file.name }), text: '×', onclick: () => queue.remove(item.key) })));
    }
    update();
  }
  function sendAttachments() {
    const snapshot = [...queue.items];
    const accepted = uploadFiles(snapshot.map(item => item.file));
    for (const item of snapshot) if (accepted.some(upload => upload.file === item.file)) queue.remove(item.key);
  }
  async function send(mode) {
    if (!connected() || pending || isModalOpen()) return;
    if (!input.value.trim()) { if (queue.items.length) sendAttachments(); update(); return; }
    const original = input.value, type = textSendMode(original);
    if (!mode && type === 'choice') { choice.hidden = false; return; }
    if (mode === 'txt' || type === 'txt') {
      pending = true; choice.hidden = true; statusText = 'Queuing TXT file…'; update();
      try {
        const [upload] = uploadFiles([createTextFile(original)]);
        if (!upload || !(await waitForSession(upload))) throw new Error('Upload session unavailable');
        if (input.value === original) input.value = '';
        statusText = 'Long message converted to TXT.';
        sendAttachments();
      } catch { statusText = 'Could not start TXT upload. Your text is still here; retry the file transfer or send again.'; }
      finally { pending = false; resize(); update(); }
    } else if (sendText(original)) {
      input.value = ''; choice.hidden = true; statusText = ''; sendAttachments(); resize(); update();
    }
  }
  const listen = (node, type, handler) => node.addEventListener(type, handler, { signal: listeners.signal });
  listen(attach, 'click', () => picker.click());
  listen(picker, 'change', () => { queue.enqueue([...picker.files]); picker.value = ''; input.focus(); });
  listen(input, 'input', () => { choice.hidden = true; statusText = ''; resize(); update(); });
  listen(input, 'keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !window.matchMedia('(pointer: coarse)').matches) {
      e.preventDefault(); void send();
    }
  });
  listen(input, 'paste', e => {
    const files = clipboardImages(e.clipboardData);
    if (!files.length) return;
    e.preventDefault(); queue.enqueue(files);
  });
  listen(sendButton, 'click', () => { void send(); });
  listen(document.querySelector('#send-message'), 'click', () => { void send('message'); });
  listen(document.querySelector('#send-txt'), 'click', () => { void send('txt'); });
  const unsubscribe = locale.subscribe(() => { renderAttachments(); update(); });
  update();
  return { enqueueFiles: queue.enqueue, update, dispose() { listeners.abort(); unsubscribe(); queue.dispose(); } };
}
export function installFileDrop(enqueue) {
  const overlay = document.querySelector('#drop-overlay'), controller = new AbortController();
  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const listen = (type, handler) => window.addEventListener(type, handler, { signal: controller.signal });
  listen('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; if (!isModalOpen()) overlay.hidden = false; });
  listen('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = isModalOpen() ? 'none' : 'copy'; });
  listen('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) overlay.hidden = true; });
  listen('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; overlay.hidden = true; if (!isModalOpen()) enqueue([...e.dataTransfer.files]); });
  listen('blur', () => { depth = 0; overlay.hidden = true; });
  listen('dragend', () => { depth = 0; overlay.hidden = true; });
  return () => controller.abort();
}
