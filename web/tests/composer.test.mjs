import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAttachmentQueue, clipboardImages } from '../js/composer.js';
import { MAX_FILE_SIZE } from '../js/files.js';

test('all attachment sources stage files without reading or sending bytes; removing and disposing revokes exactly their URLs', () => {
  const created = [], revoked = [];
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = file => { const url = `blob:test-${created.length}`; created.push({ file, url }); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  try {
    const errors = [], queue = createAttachmentQueue(() => {}, error => errors.push(error));
    const image = new File(['png'], 'screenshot.png', { type: 'image/png' });
    const document = new File(['note'], 'note.txt', { type: 'text/plain' });
    let reads = 0; image.arrayBuffer = () => { reads++; throw new Error('Do not read the whole image'); };
    queue.enqueue([image]); queue.enqueue([document]); // paste/drop/selection share this entry point
    assert.equal(queue.items.length, 2); assert.equal(reads, 0); assert.equal(errors.length, 0);
    assert.equal(created.length, 1); assert.equal(queue.items[0].file, image);
    queue.remove(queue.items[0].key); assert.deepEqual(revoked, ['blob:test-0']);
    queue.enqueue([image]); queue.dispose(); queue.dispose();
    assert.deepEqual(revoked, ['blob:test-0', 'blob:test-1']); assert.equal(queue.items.length, 0);
  } finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});

test('20 GB files are rejected as metadata without allocation; large valid images skip decoding and queue is bounded', () => {
  const errors = [], queue = createAttachmentQueue(() => {}, error => errors.push(error));
  const oversized = { name: '20gb.zip', size: 20 * 1024 ** 3, type: 'application/zip', arrayBuffer() { throw new Error('Must not read'); } };
  const largeImage = { name: 'large.png', size: 21 * 1024 ** 2, type: 'image/png' };
  queue.enqueue([oversized, largeImage, { name: 'limit.zip', size: MAX_FILE_SIZE, type: '' }]);
  assert.equal(queue.items.length, 2); assert.equal(queue.items[0].url, ''); assert.match(errors[0], /1 GB/);
  queue.enqueue(Array.from({ length: 40 }, () => ({ name: 'zero.txt', size: 0 })));
  assert.equal(queue.items.length, 32); assert.match(errors.at(-1), /Too many/); queue.dispose();
});

test('clipboard images preserve real files, ignore ordinary text and create usable filenames for unnamed screenshots', () => {
  const screenshot = new File(['image'], '', { type: 'image/png' });
  const named = new File(['image'], 'my.jpg', { type: 'image/jpeg' });
  const data = { items: [
    { kind: 'string', type: 'text/plain', getAsFile() { throw new Error('Not a file'); } },
    { kind: 'file', type: 'application/pdf', getAsFile() { throw new Error('Not an image'); } },
    { kind: 'file', type: 'image/png', getAsFile: () => screenshot },
    { kind: 'file', type: 'image/jpeg', getAsFile: () => named },
    { kind: 'file', type: 'image/png', getAsFile: () => null },
  ] };
  const files = clipboardImages(data); assert.equal(files.length, 2); assert.match(files[0].name, /^screenshot-\d+-1\.png$/);
  assert.equal(files[0].size, screenshot.size); assert.equal(files[1], named); assert.deepEqual(clipboardImages(undefined), []);
});
