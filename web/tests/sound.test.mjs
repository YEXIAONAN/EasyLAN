import { test } from "node:test";
import assert from "node:assert/strict";
const {
  DEFAULT_SOUND_ID,
  SOUND_ENABLED_KEY,
  SOUND_SELECTION_KEY,
  SEND_TONE,
  RECEIVE_TONE,
  RECEIVE_HARMONIC,
  SOUND_PRESETS,
  resolveSoundId,
} = await import(process.env.LOCALCHAT_SOUND_MODULE);

test("sound storage keys and default id stay stable", () => {
  assert.equal(DEFAULT_SOUND_ID, "default");
  assert.equal(SOUND_ENABLED_KEY, "localchat.sound.enabled");
  assert.equal(SOUND_SELECTION_KEY, "localchat.sound.selection");
});

test("send tone is an 800 Hz sine with 0.05 s fades near 0.3 s", () => {
  assert.equal(SEND_TONE.frequency, 800);
  assert.equal(SEND_TONE.fade, 0.05);
  assert.ok(Math.abs(SEND_TONE.duration - 0.3) <= 0.05);
});

test("receive tone is a 1200 Hz sine with 0.05 s fades near 0.3 s", () => {
  assert.equal(RECEIVE_TONE.frequency, 1200);
  assert.equal(RECEIVE_TONE.fade, 0.05);
  assert.ok(Math.abs(RECEIVE_TONE.duration - 0.3) <= 0.05);
});

test("send and receive tones differ clearly in pitch, timbre and duration", () => {
  // 音高：相差一个纯五度以上，听觉可立即区分。
  assert.ok(RECEIVE_TONE.frequency - SEND_TONE.frequency >= 300);
  // 时长：接收音明显更短。
  assert.ok(SEND_TONE.duration - RECEIVE_TONE.duration >= 0.05);
  // 音色：接收音叠加二次谐波（亮度更高），发送音为纯净正弦。
  assert.equal(RECEIVE_HARMONIC.frequency, RECEIVE_TONE.frequency * 2);
  assert.ok(RECEIVE_HARMONIC.peak > 0 && RECEIVE_HARMONIC.peak < RECEIVE_TONE.peak);
});

test("offers at least three built-in presets with unique ids and names", () => {
  assert.ok(SOUND_PRESETS.length >= 3);
  const ids = SOUND_PRESETS.map((preset) => preset.id);
  const names = SOUND_PRESETS.map((preset) => preset.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  assert.ok(ids.every((id) => id && id !== DEFAULT_SOUND_ID));
  assert.ok(names.every((name) => name.trim().length > 0));
});

test("built-in presets have clearly distinct pitch, duration and timbre", () => {
  // 基频与总时长两两不同。
  assert.equal(
    new Set(SOUND_PRESETS.map((preset) => preset.frequency)).size,
    SOUND_PRESETS.length,
  );
  assert.equal(
    new Set(SOUND_PRESETS.map((preset) => preset.duration)).size,
    SOUND_PRESETS.length,
  );
  // 主音波形至少有 3 种，覆盖正弦/三角/方波，音色差异明显。
  assert.ok(
    new Set(SOUND_PRESETS.map((preset) => preset.partials[0].type)).size >= 3,
  );
});

test("built-in presets keep clean sound quality (no clipping, no clicks)", () => {
  for (const preset of SOUND_PRESETS) {
    assert.ok(preset.partials.length >= 1, `${preset.id} needs partials`);
    assert.ok(preset.attack > 0, `${preset.id} needs an attack`);
    assert.ok(preset.attack < preset.duration, `${preset.id} attack too long`);
    assert.ok(
      preset.partials.every((partial) => partial.ratio > 0 && partial.gain > 0),
      `${preset.id} partials must be positive`,
    );
    const peak = preset.partials.reduce((sum, partial) => sum + partial.gain, 0);
    assert.ok(peak <= 0.24, `${preset.id} peak ${peak} would clip`);
  }
});

test("built-in presets resolve as valid selections and are kept across reload", () => {
  const available = [...SOUND_PRESETS.map((preset) => preset.id), "custom-1"];
  for (const preset of SOUND_PRESETS) {
    assert.equal(resolveSoundId(preset.id, available), preset.id);
  }
});

test("unset or unknown selections fall back to the system default", () => {
  assert.equal(resolveSoundId("", ["custom-1"]), DEFAULT_SOUND_ID);
  assert.equal(resolveSoundId(DEFAULT_SOUND_ID, []), DEFAULT_SOUND_ID);
  assert.equal(resolveSoundId("custom-2", ["custom-1"]), DEFAULT_SOUND_ID);
});

test("a stored selection is kept only while its custom sound exists", () => {
  assert.equal(resolveSoundId("custom-1", ["custom-1", "custom-2"]), "custom-1");
  assert.equal(
    resolveSoundId("custom-1", ["custom-2"]),
    DEFAULT_SOUND_ID,
  );
});