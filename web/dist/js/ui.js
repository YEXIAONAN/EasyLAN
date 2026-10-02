import { t } from './i18n.js';

// All user-controlled strings go through textContent, never HTML interpolation.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (name === 'class') node.className = value;
    else if (name === 'text') node.textContent = value;
    else if (name === 'i18n') { node.dataset.i18n = value; node.textContent = t(value); }
    else if (name === 'label') { node.dataset.label = value; node.setAttribute('aria-label', t(value)); }
    else if (name.startsWith('on')) node.addEventListener(name.slice(2).toLowerCase(), value);
    else node.setAttribute(name, String(value));
  }
  node.append(...children.filter(Boolean));
  return node;
}
const paths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  settings: '<path d="m9.5 3-.8 2.3-2.3 1.3-2.4-.4-2 3.6 1.5 1.9v2.6L2 16.2l2 3.6 2.4-.4 2.3 1.3.8 2.3h5l.8-2.3 2.3-1.3 2.4.4 2-3.6-1.5-1.9v-2.6l1.5-1.9-2-3.6-2.4.4-2.3-1.3L14.5 3h-5Z" transform="translate(0 -1) scale(1 .9)"/><circle cx="12" cy="11.7" r="3.1"/>',
  file: '<path d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M9 12h6M9 16h4"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M15 4H6a2 2 0 0 0-2 2v9"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  external: '<path d="M14 4h6v6M20 4 10 14M11 4H4v16h16v-7"/>',
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true'); svg.innerHTML = paths[name] || paths.file;
  return svg;
}
export function translate(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  root.querySelectorAll('[data-label]').forEach(n => { n.setAttribute('aria-label', t(n.dataset.label)); });
  root.querySelectorAll('[data-placeholder]').forEach(n => { n.placeholder = t(n.dataset.placeholder); });
}
export function button(key, action, className = 'text-button') {
  return el('button', { class: className, type: 'button', i18n: key, onclick: action });
}
let activeModal;
export function modal({ title, className = '', drawer = false, required = false, onClose = () => {} }) {
  activeModal?.close();
  const previous = document.activeElement;
  const closeButton = el('button', { class: 'icon-button', label: 'Close', text: '×', onclick: () => close() });
  const heading = el('h2', { id: 'modal-title', text: title });
  const header = el('header', { class: 'modal-header' }, heading, !required && closeButton);
  const body = el('div', { class: 'modal-body' });
  const panel = el('section', { class: `modal-panel ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title', tabindex: '-1' }, header, body);
  const backdrop = el('div', { class: `modal-backdrop${drawer ? ' drawer-backdrop' : ''}` }, panel);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    activeModal = undefined;
    backdrop.remove();
    document.querySelector('#app').inert = false;
    onClose();
    if (previous?.isConnected) previous.focus();
  }
  backdrop.addEventListener('click', e => { if (!required && e.target === backdrop) close(); });
  backdrop.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !required) { e.preventDefault(); e.stopPropagation(); close(); }
    if (e.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter(n => !n.hidden && n.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel)) { e.preventDefault(); first?.focus(); }
  });
  document.querySelector('#app').inert = true;
  document.querySelector('#modal-root').append(backdrop);
  activeModal = { close };
  queueMicrotask(() => { if (!closed) (panel.querySelector('input, button, select') || panel).focus(); });
  return { panel, header, heading, body, close, get closed() { return closed; } };
}
export const isModalOpen = () => Boolean(activeModal);
export const closeModal = () => activeModal?.close();
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const previous = document.activeElement;
  const input = el('textarea', { 'aria-hidden': 'true' });
  input.value = text; input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(input); input.select();
  const success = document.execCommand('copy'); input.remove(); previous?.focus();
  if (!success) throw new Error('Copy unavailable. Select the text to copy it.');
}
