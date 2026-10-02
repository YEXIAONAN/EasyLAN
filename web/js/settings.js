import { LANGUAGES, locale, setLocale, t } from './i18n.js';
import { SOUND_PRESETS } from './notifications.js';
import { REPOSITORY_URL } from './config.js';
import { el, icon, button, modal } from './ui.js';

export function validName(name) {
  return name.trim().length > 0 && [...name].length <= 32 && !/[\u0000-\u001f\u007f-\u009f]/.test(name);
}
export function showNameDialog(username, save) {
  const dialog = modal({ title: t('Welcome to EasyLAN'), className: 'name-dialog', required: true });
  const input = el('input', { id: 'device-name', class: 'input', autocomplete: 'nickname', 'aria-describedby': 'name-hint' });
  input.value = username.value;
  const hint = el('p', { id: 'name-hint', class: 'input-hint', i18n: 'Saved in this browser. No account required.' });
  const form = el('form', { onsubmit: e => {
    e.preventDefault();
    if (!validName(input.value.trim())) { hint.textContent = t('Use 1–32 characters, without control characters.'); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    save(input.value.trim()); dialog.close(); document.querySelector('#draft').focus();
  } }, el('label', { for: 'device-name', i18n: 'Device name' }), input, hint,
  el('button', { class: 'button primary', type: 'submit', i18n: 'Enter EasyLAN' }));
  dialog.body.append(el('div', { class: 'brand' }, el('img', { src: '/logo.svg', width: '40', height: '40', alt: '' })), el('p', { i18n: 'Choose a name to identify this browser on your local network.' }), form);
  return dialog;
}
export function showSettings({ username, saveName, client, info }) {
  const dialog = modal({ title: t('Settings'), className: 'settings-dialog' });
  const nameInput = el('input', { class: 'input', label: 'Device name', value: username.value });
  const nameStatus = el('p', { class: 'settings-hint', role: 'status', hidden: true });
  const save = button('Save', () => {
    const name = nameInput.value.trim(); nameStatus.hidden = false;
    if (!validName(name)) { nameStatus.textContent = t('Use 1–32 characters, without control characters.'); nameInput.setAttribute('aria-invalid', 'true'); return; }
    saveName(name); nameInput.setAttribute('aria-invalid', 'false'); nameStatus.textContent = t('Saved');
  });
  const language = el('select', { id: 'language-select', onchange: e => setLocale(e.target.value) },
    ...LANGUAGES.map(l => el('option', { value: l.id, text: l.label })));
  language.value = locale.value;
  const section = (title, ...content) => el('section', { class: 'settings-section' }, el('h3', { i18n: title }), ...content);
  const row = (key, value) => el('div', { class: 'settings-row' }, el('span', { i18n: key }), value);
  const version = el('span', { class: 'settings-value' });
  const connection = el('span', { class: 'settings-value' });
  const channels = [];
  for (const kind of ['receive', 'send']) {
    const label = kind === 'receive' ? 'Receive sound' : 'Send sound';
    const toggleState = el('span', { class: 'toggle-state' });
    const enabled = () => kind === 'receive' ? client.soundEnabled.value : client.sentSoundEnabled.value;
    const tone = () => kind === 'receive' ? client.receivedTone.value : client.sentTone.value;
    const toggle = el('button', { class: 'settings-toggle', label, onclick: () => {
      if (kind === 'receive') client.setSoundEnabled(!enabled()); else client.setSentSoundEnabled(!enabled());
      update();
    } }, el('span', { i18n: label }), toggleState);
    const tones = el('select', { label: `${label} tone`, onchange: e => client.setTone(kind, e.target.value) },
      ...SOUND_PRESETS.map(p => el('option', { value: p.id, i18n: p.label })));
    tones.value = tone();
    const preview = el('button', { class: 'icon-button', label: `Preview ${label.toLowerCase()}`, onclick: () => client.previewSound(kind) }, icon('play'));
    channels.push({ enabled, toggleState, toggle, preview });
    channels.at(-1).row = el('div', { class: 'settings-row' }, toggle, el('div', { class: 'settings-tone' }, tones, preview));
  }
  dialog.body.append(
    section('Settings', row('Device name', el('div', { class: 'settings-name' }, nameInput, save)), nameStatus,
      el('div', { class: 'settings-row' }, el('label', { for: 'language-select', i18n: 'Language' }), language)),
    section('Sounds', ...channels.map(c => c.row)),
    section('Server information', row('Server', el('span', { class: 'settings-value', text: location.host })),
      row('Current address', el('span', { class: 'settings-value', text: location.origin })), row('Connection', connection)),
    section('About EasyLAN', el('p', { class: 'about-title', text: 'EasyLAN' }),
      el('p', { class: 'about-description', i18n: 'Simple local chat. No accounts. No cloud.' }), row('Version', version),
      row('GitHub', el('a', { href: REPOSITORY_URL, target: '_blank', rel: 'noopener noreferrer', text: 'EasyLAN ↗' }))),
    el('p', { class: 'settings-hint', i18n: 'Changes are saved in this browser.' }));
  function update() {
    if (dialog.closed) return;
    dialog.heading.textContent = t('Settings');
    connection.textContent = t({ connected: 'Connected', connecting: 'Connecting', disconnected: 'Disconnected' }[client.state.value]);
    version.textContent = info.version || t('Version unavailable');
    for (const channel of channels) {
      const on = channel.enabled(); channel.toggle.setAttribute('aria-pressed', String(on));
      channel.toggleState.textContent = t(on ? 'On' : 'Off'); channel.toggleState.classList.toggle('enabled', on); channel.preview.disabled = !on;
    }
  }
  update(); return Object.assign(dialog, { update });
}
export function showDevices(client, onClose) {
  const dialog = modal({ title: t('Online devices'), className: 'device-drawer', drawer: true, onClose });
  dialog.panel.id = 'devices-drawer'; dialog.body.className = 'device-list';
  function update() {
    if (dialog.closed) return;
    dialog.heading.textContent = t('Online devices'); dialog.body.replaceChildren();
    for (const device of client.devices.value) {
      const own = device.id === client.clientId.value;
      dialog.body.append(el('div', { class: 'device-row' }, el('div', { class: 'message-avatar', 'aria-hidden': 'true', text: [...device.username][0]?.toUpperCase() || '?' }),
        el('div', { class: 'device-identity' }, el('strong', { text: device.username }), el('small', { text: `${own ? t('You') + ' · ' : ''}${device.ip}` })),
        el('span', { class: 'device-online connected' }, el('i', { class: 'status-dot', 'aria-hidden': 'true' }), el('span', { i18n: 'Online' }))));
    }
    if (!client.devices.value.length) dialog.body.append(el('p', { i18n: 'No connected devices' }));
  }
  update(); return Object.assign(dialog, { update });
}
