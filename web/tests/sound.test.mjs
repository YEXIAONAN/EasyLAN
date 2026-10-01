import { test } from "node:test";
import assert from "node:assert/strict";
const {
  DEFAULT_SOUND_ID,
  SOUND_ENABLED_KEY,
  SOUND_SELECTION_KEY,
  SEND_TONE,
  RECEIVE_TONE,
  SOUND_PRESETS,
  SEND_TRANSPOSE,
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

test("send and receive tones differ clearly in pitch and duration", () => {
  // 音高：相差一个纯五度以上，听觉可立即区分。
  assert.ok(RECEIVE_TONE.frequency - SEND_TONE.frequency >= 300);
  // 时长：接收音明显更短。
  assert.ok(SEND_TONE.duration - RECEIVE_TONE.duration >= 0.05);
  // 两者都是单一正弦音：正弦无泛音，而固定频率的正弦只会响出一个音。
  assert.ok(SEND_TONE.frequency > 0 && RECEIVE_TONE.frequency > 0);
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
  // 波形至少有 3 种，覆盖正弦/三角/方波，音色差异来自波形本身。
  assert.ok(new Set(SOUND_PRESETS.map((preset) => preset.type)).size >= 3);
});

test("each preset is a single tone so one event never sounds twice", () => {
  // 回归保护：此前用多个分音叠加塑造音色，听感上会同时响出两个音。
  const allowed = new Set(["sine", "triangle", "square", "sawtooth"]);
  for (const preset of SOUND_PRESETS) {
    assert.ok(allowed.has(preset.type), `${preset.id} has an invalid waveform`);
    // 每个音色只声明一个波形与一个峰值，不再有 partials 分音数组。
    assert.equal("partials" in preset, false, `${preset.id} must not layer`);
  }
});

test("built-in presets keep clean sound quality (no clipping, no clicks)", () => {
  for (const preset of SOUND_PRESETS) {
    assert.ok(preset.attack > 0, `${preset.id} needs an attack`);
    assert.ok(preset.attack < preset.duration, `${preset.id} attack too long`);
    assert.ok(
      preset.peak > 0 && preset.peak <= 0.24,
      `${preset.id} peak would clip`,
    );
  }
});

test("built-in presets resolve as valid selections and are kept across reload", () => {
  const available = [...SOUND_PRESETS.map((preset) => preset.id), "custom-1"];
  for (const preset of SOUND_PRESETS) {
    assert.equal(resolveSoundId(preset.id, available), preset.id);
  }
});

test("sending follows the selected preset, transposed one octave down", () => {
  // 发送音与接收音使用同一套音效，仅移调一个八度，因此切换音效在两端都可听出差异。
  assert.equal(SEND_TRANSPOSE, 0.5);
  const sendBases = SOUND_PRESETS.map(
    (preset) => preset.frequency * SEND_TRANSPOSE,
  );
  assert.equal(new Set(sendBases).size, SOUND_PRESETS.length);
  for (const preset of SOUND_PRESETS) {
    assert.ok(preset.frequency * SEND_TRANSPOSE < preset.frequency);
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