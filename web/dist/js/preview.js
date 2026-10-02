import { t, notice } from './i18n.js';
import { formatBytes } from './format.js';
import { el, button, modal, copyText } from './ui.js';
export const canPreview = file => ['text', 'image', 'pdf'].includes(file.previewType);
export const fileUrl = file => `/api/files/${encodeURIComponent(file.id)}`;
export async function downloadFile(file, report = () => {}) {
  try {
    const response = await fetch(fileUrl(file), { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 404 ? 'This file expired when the server stopped.' : 'This file is unavailable. Please try again.');
    const link = el('a', { href: fileUrl(file), download: file.name }); document.body.append(link); link.click(); link.remove();
  } catch (e) { report(e.message || 'Download unavailable.'); }
}
export function showPreview(file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const dialog = modal({ title: file.name, className: 'preview-dialog', onClose: () => { controller.abort(); clearTimeout(timer); } });
  const url = `${fileUrl(file)}/preview`;
  const status = el('p', { class: 'preview-status', role: 'status', i18n: 'Loading preview…' });
  dialog.body.append(status); dialog.panel.setAttribute('aria-busy', 'true');
  const download = el('a', { href: fileUrl(file), download: file.name, i18n: 'Download', onclick: e => {
    e.preventDefault(); void downloadFile(file, error => { status.textContent = notice(error); status.hidden = false; });
  } });
  dialog.panel.append(el('footer', { class: 'modal-footer' }, el('span', { text: formatBytes(file.size) }), download));
  void (async () => {
    try {
      const response = await fetch(url, { method: file.previewType === 'text' ? 'GET' : 'HEAD', signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 404 ? 'File is no longer available.' : 'Preview unavailable. You can still download this file.');
      if (response.headers.get('X-Preview-Type') !== file.previewType) throw new Error('Preview unavailable. You can still download this file.');
      if (dialog.closed) return;
      status.hidden = true;
      if (file.previewType === 'text') {
        const text = await response.text();
        if (dialog.closed) return;
        if (response.headers.get('X-Preview-Truncated') === 'true') {
          dialog.body.append(el('p', { class: 'preview-status', i18n: 'Previewing first 512 KiB.' }));
          download.dataset.i18n = 'Download full file'; download.textContent = t('Download full file');
        }
        dialog.body.append(el('pre', { class: 'preview-text', text }));
        const copy = button('Copy', async () => {
          try { await copyText(text); status.dataset.i18n = 'Copied.'; status.textContent = t('Copied.'); }
          catch { status.dataset.i18n = 'Copy unavailable. Select the text to copy it.'; status.textContent = t(status.dataset.i18n); }
          status.hidden = false;
        });
        dialog.header.insertBefore(copy, dialog.header.lastChild);
      } else if (file.previewType === 'image') {
        dialog.body.append(el('img', { class: 'preview-image', src: url, alt: file.name, onerror: () => { status.textContent = t('Preview unavailable. You can still download this file.'); status.hidden = false; } }));
      } else if (file.previewType === 'pdf') {
        dialog.body.append(el('p', { class: 'preview-status', i18n: 'Use your browser’s native viewer to preview this PDF.' }),
          el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', i18n: 'Open PDF preview' }),
          el('p', { class: 'settings-hint', i18n: 'If preview is unavailable in this browser, download the file to open it locally.' }));
      }
    } catch (e) { if (!dialog.closed) { status.textContent = notice(e.name === 'AbortError' ? 'Preview unavailable. You can still download this file.' : e.message); status.hidden = false; } }
    finally { clearTimeout(timer); if (!dialog.closed) dialog.panel.setAttribute('aria-busy', 'false'); }
  })();
  return dialog;
}
