import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createComposer } from '../js/composer.js';

// Controlled DOM boundary for the actual Composer, not a duplicate send policy.
class Node extends EventTarget {
  children = []; dataset = {}; style = {}; value = ''; hidden = false; disabled = false; scrollHeight = 38; textContent = '';
  setAttribute(key, value) { this[key] = value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  focus() { document.activeElement = this; }
}
function environment({ touch = false, textAccepted = true, fileAccepted = true, sessionReady = true } = {}) {
  const ids = ['draft', 'file-picker', 'attach-button', 'send-button', 'attachments', 'long-text-choice', 'composer-notice', 'send-message', 'send-txt'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Node()]));
  globalThis.document = { querySelector: selector => nodes[selector.slice(1)], createElement: () => new Node(), createElementNS: () => new Node(), createTextNode: text => text };
  globalThis.window = { matchMedia: () => ({ matches: touch }) };
  const text = [], files = [], reports = [];
  const composer = createComposer({ connected: () => true, sendText: value => { text.push(value); return textAccepted; }, uploadFiles: list => { files.push(...list); return fileAccepted ? list.map(file => ({ file })) : []; }, waitForSession: () => Promise.resolve(sessionReady), report: value => reports.push(value) });
  const click = id => nodes[id].dispatchEvent(new Event('click'));
  const input = value => { nodes.draft.value = value; nodes.draft.dispatchEvent(new Event('input')); };
  return { composer, nodes, text, files, reports, click, input };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function key(node, options = {}) {
  const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key: 'Enter', shiftKey: false, isComposing: false, ...options }); node.dispatchEvent(event); return event;
}
test('image paste stages preview without upload; explicit send uses the same pipeline and releases the preview', async () => {
  const env = environment(), image = new File(['image'], 'screenshot.png', { type: 'image/png' });
  const event = new Event('paste', { cancelable: true });
  event.clipboardData = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }] };
  env.nodes.draft.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true); assert.equal(env.files.length, 0); assert.equal(env.nodes.attachments.hidden, false); assert.equal(env.nodes['send-button'].disabled, false);
  env.click('send-button'); await settle(); assert.equal(env.files[0], image); assert.equal(env.nodes.attachments.hidden, true); env.composer.dispose();
});
test('file selection and drop entry are also staged, and rejected sends retain attachments', async () => {
  const env = environment({ fileAccepted: false });
  env.nodes['file-picker'].files = [new File(['file'], 'one.txt')];
  env.nodes['file-picker'].dispatchEvent(new Event('change'));
  env.composer.enqueueFiles([new File(['file'], 'two.txt')]);
  assert.equal(env.nodes.attachments.children.length, 2); assert.equal(env.files.length, 0);
  env.click('send-button'); await settle(); assert.equal(env.nodes.attachments.children.length, 2); env.composer.dispose();
});
test('desktop Enter sends, while Shift+Enter, IME composition and touch Enter do not intercept typing', async () => {
  const env = environment(); env.input('line one');
  assert.equal(key(env.nodes.draft, { shiftKey: true }).defaultPrevented, false);
  assert.equal(key(env.nodes.draft, { isComposing: true }).defaultPrevented, false);
  assert.equal(env.text.length, 0); assert.equal(key(env.nodes.draft).defaultPrevented, true);
  await settle(); assert.deepEqual(env.text, ['line one']); assert.equal(env.nodes.draft.value, ''); env.composer.dispose();
  const touch = environment({ touch: true }); touch.input('mobile'); assert.equal(key(touch.nodes.draft).defaultPrevented, false); assert.equal(touch.text.length, 0); touch.composer.dispose();
});
test('failed text send keeps draft and staged attachments; long TXT failure also keeps the original text', async () => {
  const env = environment({ textAccepted: false }); env.input('preserve me'); env.composer.enqueueFiles([new File(['x'], 'keep.txt')]);
  env.click('send-button'); await settle(); assert.equal(env.nodes.draft.value, 'preserve me'); assert.equal(env.nodes.attachments.children.length, 1); assert.equal(env.files.length, 0); env.composer.dispose();
  const long = environment({ sessionReady: false }); const original = '中文'.repeat(30000); long.input(original); long.click('send-button'); await settle();
  assert.equal(long.nodes.draft.value, original); assert.equal(long.files.length, 1); assert.match(long.nodes['composer-notice'].textContent, /text is still here/); long.composer.dispose();
});
test('successful TXT session preserves a new draft typed while waiting and forwards staged files once', async () => {
  const env = environment(); env.input('x'.repeat(140 * 1024)); env.composer.enqueueFiles([new File(['x'], 'attached.txt')]);
  env.click('send-button'); env.input('new draft'); await settle(); assert.equal(env.nodes.draft.value, 'new draft');
  assert.equal(env.files.length, 2); assert.match(env.files[0].name, /^message-/); assert.equal(env.files[1].name, 'attached.txt'); assert.equal(env.nodes.attachments.hidden, true); env.composer.dispose();
});
