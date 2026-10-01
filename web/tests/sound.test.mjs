import { test } from "node:test";
import assert from "node:assert/strict";
const {
  DEFAULT_SOUND_ID,
  SOUND_ENABLED_KEY,
  SOUND_SELECTION_KEY,
  SEND_TONE,
  RECEIVE_TONE,
  RECEIVE_HARMONIC,
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