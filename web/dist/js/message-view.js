import { groupMessages, presentText, messageTime } from './messages.js';
import { t, systemMessage, notice } from './i18n.js';
import { formatBytes } from './format.js';
import { el, icon, button, copyText } from './ui.js';
import { canPreview, fileUrl, showPreview, downloadFile } from './preview.js';

export function createMessageView(ownIds) {
  const container = document.querySelector('#messages'), stream = document.querySelector('#message-stream');
  const empty = document.querySelector('#empty-state'), newButton = document.querySelector('#new-messages');
  let last, unread = 0, following = true;
  const controller = new AbortController(), timers = new Set(), systemNodes = [];
  function nearBottom() { return container.scrollHeight - container.scrollTop - container.clientHeight < 120; }
  function bottom() { container.scrollTop = container.scrollHeight; unread = 0; following = true; newButton.hidden = true; }
  function updateUnread() { newButton.hidden = !unread; newButton.textContent = t(unread === 1 ? '{count} new message' : '{count} new messages', { count: unread }) + ' ↓'; }
  container.addEventListener('scroll', () => { following = nearBottom(); if (following) { unread = 0; updateUnread(); } }, { signal: controller.signal });
  newButton.addEventListener('click', bottom, { signal: controller.signal });
  function fileMessage(file) {
    const error = el('p', { class: 'transfer-error', role: 'alert', hidden: true });
    const download = el('a', { href: fileUrl(file), download: file.name, i18n: 'Download', onclick: e => {
      e.preventDefault(); void downloadFile(file, message => { error.textContent = notice(message); error.hidden = false; });
    } });
    if (file.previewType === 'image') {
      const image = el('img', { src: `${fileUrl(file)}/preview`, alt: file.name, loading: 'lazy', decoding: 'async' });
      const open = el('button', { class: 'image-open', 'aria-label': t('View image {name}', { name: file.name }), onclick: () => showPreview(file) }, image);
      image.addEventListener('load', () => { if (following) bottom(); }, { signal: controller.signal });
      image.addEventListener('error', () => { open.hidden = true; error.hidden = false; error.textContent = t('Preview unavailable. You can still download this file.'); }, { signal: controller.signal });
      return el('div', { class: 'image-message' }, open,
        el('div', { class: 'image-caption' }, el('span', { text: file.name, title: file.name }), download), error);
    }
    const actions = el('div', { class: 'file-actions' }, canPreview(file) && button('Preview', () => showPreview(file)), download);
    return el('div', { class: 'file-message' },
      el('div', { class: 'file-heading' }, el('div', { class: 'file-icon', 'aria-hidden': 'true' }, icon('file')),
        el('div', { class: 'file-details' }, el('strong', { text: file.name }), el('small', { text: `${formatBytes(file.size)} · ${file.name.includes('.') ? file.name.split('.').at(-1).toUpperCase().slice(0, 12) : t('File')}` }))),
      el('div', { class: 'file-footer' }, el('span', { class: 'file-state', i18n: 'Completed' }), actions), error);
  }
  function textMessage(message) {
    const p = presentText(message.content || '');
    const long = message.content.length > 1000 || message.content.split('\n').length > 12;
    const content = el(p.code ? 'pre' : 'div', { class: `message-content${p.code ? ' code-content' : ''}${long ? ' collapsed' : ''}`, text: p.text });
    const bubble = el('div', { class: `text-message${p.code ? ' code-message' : ''}` }, p.code && el('div', { class: 'code-toolbar', text: p.language }), content);
    if (long) {
      const expand = button('Show more', () => {
        const collapsed = content.classList.toggle('collapsed'); expand.dataset.i18n = collapsed ? 'Show more' : 'Collapse'; expand.textContent = t(expand.dataset.i18n); expand.setAttribute('aria-expanded', String(!collapsed));
      });
      expand.setAttribute('aria-expanded', 'false'); bubble.append(expand);
    }
    const copy = el('button', { class: 'icon-button copy-button', label: 'Copy message', onclick: async () => {
      try {
        await copyText(message.content); copy.replaceChildren(document.createTextNode('✓')); copy.setAttribute('aria-label', t('Copied'));
        const timer = setTimeout(() => { timers.delete(timer); copy.replaceChildren(icon('copy')); copy.setAttribute('aria-label', t('Copy message')); }, 2000); timers.add(timer);
      } catch { copy.replaceChildren(document.createTextNode('!')); copy.title = t('Select text to copy'); }
    } }, icon('copy'));
    bubble.append(copy); return bubble;
  }
  function append(message) {
    const follow = following;
    if (message.type === 'system') {
      const node = el('div', { class: 'system-message', text: systemMessage(message.content) }); stream.append(node); systemNodes.push({ node, content: message.content }); last = undefined;
    } else {
      empty.hidden = true;
      const own = ownIds.value.has(message.clientId || '');
      const same = last && groupMessages([last.message, message], ownIds.value).length === 1;
      if (!same) {
        const bubbles = el('div', { class: 'message-bubbles' }), time = el('time', { class: 'group-time', text: messageTime(message) });
        const body = el('div', { class: 'message-group-body' }, el('div', { class: 'group-meta', text: message.username || '?' }), bubbles, time);
        const group = el('article', { class: `message-group${own ? ' own' : ''}` }, !own && el('div', { class: 'message-avatar', 'aria-hidden': 'true', text: [...(message.username || '?')][0]?.toUpperCase() }), body);
        stream.append(group); last = { message, bubbles, time };
      }
      last.bubbles.append(el('div', { class: 'message-item' }, message.type === 'text' ? textMessage(message) : message.file && fileMessage(message.file)));
      last.message = message; last.time.textContent = messageTime(message);
    }
    if (follow) requestAnimationFrame(() => { if (following) bottom(); }); else { unread++; updateUnread(); }
  }
  function refresh() {
    for (const { node, content } of systemNodes) node.textContent = systemMessage(content);
    updateUnread();
  }
  return { append, refresh, bottom, dispose() { controller.abort(); for (const timer of timers) clearTimeout(timer); } };
}
export function renderTransfers(container, uploads, controls, sharedIds = new Set()) {
  const visible = uploads.filter(u => !(u.status === 'completed' && sharedIds.has(u.fileId)));
  container.hidden = !visible.length;
  // Only update changed cards. Preserve focus when progress arrives mid-click.
  const existing = new Map([...container.children].map(n => [n.dataset.key, n]));
  const labels = { queued: 'Waiting', uploading: 'Transferring', paused: 'Paused', completing: 'Finishing', completed: 'Completed', failed: 'Failed', cancelling: 'Cancelling', cancelled: 'Cancelled' };
  const symbols = { queued: '◷', uploading: '↑', paused: 'Ⅱ', completing: '◷', completed: '✓', failed: '!', cancelling: '◷', cancelled: '×' };
  for (const u of visible) {
    let card = existing.get(u.key);
    const fingerprint = JSON.stringify([u.status, u.uploadedBytes, u.speed, u.error, t(labels[u.status])]);
    if (card?.dataset.fingerprint === fingerprint) { existing.delete(u.key); continue; }
    const focusedAction = card?.contains(document.activeElement) ? document.activeElement.dataset.action : '';
    if (!card) { card = el('article', { 'data-key': u.key }); container.append(card); }
    existing.delete(u.key); card.dataset.fingerprint = fingerprint; card.className = `transfer-card ${u.status}`;
    const progress = u.file.size ? Math.floor(u.uploadedBytes / u.file.size * 100) : u.status === 'completed' ? 100 : 0;
    const actions = [];
    function action(key, method) { const b = button(key, () => controls[method](u)); b.dataset.action = key; actions.push(b); }
    if (['queued', 'uploading'].includes(u.status)) action('Pause', 'pause');
    if (['paused', 'failed'].includes(u.status)) action(u.status === 'paused' ? 'Resume' : 'Retry', 'resume');
    if (['queued', 'uploading', 'paused', 'failed'].includes(u.status)) action('Cancel', 'cancel');
    if (['completed', 'cancelled'].includes(u.status)) action('Dismiss transfer', 'dismiss');
    const working = !['completed', 'cancelled'].includes(u.status);
    const seconds = u.speed > 0 ? Math.ceil((u.file.size - u.uploadedBytes) / u.speed) : 0;
    const eta = u.status === 'uploading' ? (seconds > 60 ? t('{minutes}m left', { minutes: Math.ceil(seconds / 60) }) : seconds > 0 ? t('{seconds}s left', { seconds }) : t('Estimating…')) : '';
    card.replaceChildren(
      el('div', { class: 'file-heading' }, el('div', { class: 'file-icon', 'aria-hidden': 'true' }, icon('file')), el('div', { class: 'file-details' }, el('strong', { text: u.file.name }), el('small', { text: `${formatBytes(u.uploadedBytes)} / ${formatBytes(u.file.size)}` }))),
      working && el('div', { class: 'transfer-progress', role: 'progressbar', 'aria-label': t('Upload {name}', { name: u.file.name }), 'aria-valuenow': progress, 'aria-valuemin': '0', 'aria-valuemax': '100' }, el('div', { style: `width:${progress}%` })),
      working && el('div', { class: 'transfer-info' }, el('span', { text: u.status === 'uploading' && u.speed > 0 ? `${formatBytes(u.speed)}/s` : '—' }), el('span', { text: eta }), el('strong', { text: `${progress}%` })),
      el('div', { class: 'file-footer' }, el('span', { class: 'file-state', text: `${symbols[u.status]} ${t(labels[u.status])}` }), el('div', { class: 'file-actions' }, ...actions)),
      u.error && el('p', { class: 'transfer-error', role: 'alert', text: notice(u.error) }));
    if (focusedAction) (card.querySelector(`[data-action="${focusedAction}"]`) || card.querySelector('[data-action]'))?.focus();
  }
  for (const node of existing.values()) node.remove();
}
