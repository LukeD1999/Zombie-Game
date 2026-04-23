/**
 * Procedural SFX via Web Audio API — no external files, works offline.
 * Call `resumeAudio()` on first user gesture to unlock the AudioContext.
 */

let ctx;
let master;
let masterNoiseBuffer;
let ambientNodes = null;
let ambientStarted = false;

const MASTER_LEVEL = 0.32;

export function getAudioContext() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.setValueAtTime(MASTER_LEVEL, ctx.currentTime);
    master.connect(ctx.destination);
    masterNoiseBuffer = makeNoiseBuffer(0.3);
  }
  return ctx;
}

export function resumeAudio() {
  getAudioContext();
  if (ctx.state === "suspended") {
    return ctx.resume();
  }
  return Promise.resolve();
}

function makeNoiseBuffer(durationSec) {
  const c = getAudioContext();
  const n = c.sampleRate * durationSec;
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}

function outGain(value, when = ctx.currentTime) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, when);
  g.connect(master);
  return g;
}

/** Short band-limited noise burst (gunshot body). */
function noiseBlast({ duration = 0.08, hpf = 400, lpf = 8000, gain = 0.45 } = {}) {
  const c = getAudioContext();
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = masterNoiseBuffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(hpf, t0);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(lpf, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.001);
  g.gain.exponentialRampToValueAtTime(0.01, t0 + duration);
  src.connect(hp);
  hp.connect(lp);
  lp.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

/** Sharp attack tone (transient) */
function popTone(freq, duration, gain) {
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(freq * 0.2, t0 + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.0005);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + duration + 0.01);
}

export function playWeaponShot(weaponId) {
  getAudioContext();
  if (weaponId === "shotgun") {
    noiseBlast({ duration: 0.16, hpf: 200, lpf: 5000, gain: 0.65 });
    popTone(180, 0.1, 0.25);
    popTone(90, 0.18, 0.2);
  } else if (weaponId === "smg") {
    noiseBlast({ duration: 0.045, hpf: 500, lpf: 10000, gain: 0.28 });
    popTone(800, 0.03, 0.08);
  } else {
    noiseBlast({ duration: 0.1, hpf: 350, lpf: 7000, gain: 0.42 });
    popTone(500, 0.06, 0.12);
  }
}

export function playEmptyClick() {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(180, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.05);
}

export function playReloadStart(weaponId) {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  popTone(weaponId === "shotgun" ? 220 : 400, 0.05, 0.06);
  setTimeout(() => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(200, t);
    o.frequency.linearRampToValueAtTime(120, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.16);
  }, 20);
}

export function playReloadDone() {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(300, t0);
  o.frequency.exponentialRampToValueAtTime(500, t0 + 0.04);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.1, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.12);
  noiseBlast({ duration: 0.04, hpf: 2000, lpf: 10000, gain: 0.08 });
}

export function playEnemyHit() {
  getAudioContext();
  noiseBlast({ duration: 0.07, hpf: 200, lpf: 3000, gain: 0.22 });
  popTone(150, 0.05, 0.12);
}

export function playEnemyDeath() {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(200, t0);
  o.frequency.exponentialRampToValueAtTime(60, t0 + 0.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.1, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.3);
  noiseBlast({ duration: 0.1, hpf: 100, lpf: 2000, gain: 0.15 });
}

export function playPickup() {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  for (let i = 0; i < 3; i += 1) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(300 + i * 120, t0 + i * 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0 + i * 0.05);
    g.gain.linearRampToValueAtTime(0.08, t0 + i * 0.05 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.05 + 0.08);
    o.connect(g);
    g.connect(master);
    o.start(t0 + i * 0.05);
    o.stop(t0 + i * 0.05 + 0.1);
  }
}

export function playHurt() {
  getAudioContext();
  noiseBlast({ duration: 0.1, hpf: 100, lpf: 2000, gain: 0.35 });
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(100, t0);
  o.frequency.exponentialRampToValueAtTime(40, t0 + 0.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.15, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.22);
}

export function playGameOver() {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(200, t0);
  o.frequency.exponentialRampToValueAtTime(50, t0 + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.12, t0 + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.7);
}

export function playWeaponSwitch() {
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(500, t0);
  o.frequency.exponentialRampToValueAtTime(200, t0 + 0.04);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.06, t0 + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.06);
}

let lastFoot = 0;
export function playFootstep(nowSec, moving, onGround) {
  if (!moving || !onGround) return;
  if (nowSec - lastFoot < 0.32) return;
  lastFoot = nowSec;
  getAudioContext();
  const c = getAudioContext();
  const t0 = c.currentTime;
  noiseBlast({ duration: 0.04, hpf: 200, lpf: 2000, gain: 0.06 });
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(60, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.04, t0 + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.05);
}

/** Quiet gloomy air tone — only after resumeAudio, low volume. */
export function startAmbient() {
  getAudioContext();
  if (ambientStarted) return;
  ambientStarted = true;
  const c = ctx;
  const t0 = c.currentTime;
  const noise = c.createBufferSource();
  noise.buffer = masterNoiseBuffer;
  noise.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, t0);
  bp.Q.setValueAtTime(0.5, t0);
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, t0);
  ng.gain.linearRampToValueAtTime(0.02, t0 + 0.4);
  noise.connect(bp);
  bp.connect(ng);
  const drone = c.createOscillator();
  drone.type = "sine";
  drone.frequency.setValueAtTime(45, t0);
  const dg = c.createGain();
  dg.gain.setValueAtTime(0.04, t0);
  drone.connect(dg);
  const mix = c.createGain();
  mix.gain.setValueAtTime(1, t0);
  ng.connect(mix);
  dg.connect(mix);
  mix.connect(master);
  noise.start(t0);
  drone.start(t0);
  ambientNodes = { noise, drone, mix };
}

export function stopAmbient() {
  if (!ambientNodes) return;
  const t0 = ctx.currentTime;
  try {
    ambientNodes.noise.stop(t0 + 0.05);
    ambientNodes.drone.stop(t0 + 0.05);
  } catch (e) {
    /* already stopped */
  }
  ambientNodes = null;
  ambientStarted = false;
}
