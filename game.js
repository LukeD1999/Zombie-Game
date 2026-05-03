import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
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

function getAudioContext() {
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

function resumeAudio() {
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

function playWeaponShot(weaponId) {
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

function playEmptyClick() {
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

function playReloadStart(weaponId) {
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

function playReloadDone() {
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

function playEnemyHit() {
  getAudioContext();
  noiseBlast({ duration: 0.07, hpf: 200, lpf: 3000, gain: 0.22 });
  popTone(150, 0.05, 0.12);
}

function playEnemyDeath() {
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

function playPickup() {
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

function playHurt() {
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

function playGameOver() {
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

function playWeaponSwitch() {
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
function playFootstep(nowSec, moving, onGround) {
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
function startAmbient() {
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

function stopAmbient() {
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


/**
 * Map size (world width/depth in Three.js units).
 * - Edit `arenaSize` here for a bigger or smaller default map.
 * - Or override at runtime: `?arena=900` or `?map=900` (200–2400 clamped).
 */
const USER_MAP_SETTINGS = {
  arenaSize: 560,
};

function resolveMapConfig() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("arena") ?? params.get("map");
  let arena =
    fromQuery != null && fromQuery !== ""
      ? Number(fromQuery)
      : USER_MAP_SETTINGS.arenaSize;
  if (!Number.isFinite(arena)) arena = USER_MAP_SETTINGS.arenaSize;
  arena = Math.round(arena);
  const minA = 200;
  const maxA = 2400;
  const a = Math.min(maxA, Math.max(minA, arena));
  const ref = 520;
  const areaFactor = (a * a) / (ref * ref);

  return {
    arenaSize: a,
    halfSize: a / 2,
    obstacleCount: Math.max(36, Math.round(48 * areaFactor)),
    houseCount: Math.max(12, Math.round(14 * Math.sqrt(areaFactor))),
    treeCount: Math.max(32, Math.round(44 * Math.sqrt(areaFactor))),
    weaponPickups: Math.max(14, Math.round(16 * Math.sqrt(areaFactor))),
    enemySpawnMinDistance: Math.min(90, Math.max(32, a * 0.11)),
    obstacleSpawnRange: a - 52,
    enemySpawnRange: a - 28,
    pickupMinDist: Math.max(20, Math.round(a * 0.04)),
    pickupSpread: a / 2 - 16,
    houseMinDist: Math.max(18, Math.round(a * 0.05)),
    treeMinDist: Math.max(14, Math.round(a * 0.035)),
    floorSegments: Math.max(40, Math.floor(a / 7.5)),
    fogNear: Math.max(14, a * 0.035),
    fogFar: Math.max(95, a * 0.22),
    cameraFar: Math.max(900, a * 3.2),
  };
}

const mapConfig = resolveMapConfig();
const arenaSize = mapConfig.arenaSize;
if (typeof window !== "undefined") {
  window.GAME_MAP_CONFIG = mapConfig;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050a);
scene.fog = new THREE.Fog(0x05060d, mapConfig.fogNear, mapConfig.fogFar);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  mapConfig.cameraFar
);
camera.position.set(0, 2.1, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0x304060, 0.2);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0x9ab3ff, 0.65);
directional.position.set(-16, 26, -10);
directional.castShadow = true;
scene.add(directional);

const hemi = new THREE.HemisphereLight(0x3d4f7d, 0x07080e, 0.25);
scene.add(hemi);

const floorGeo = new THREE.PlaneGeometry(
  arenaSize,
  arenaSize,
  mapConfig.floorSegments,
  mapConfig.floorSegments
);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x12182a,
  roughness: 0.85,
  metalness: 0.1,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x25395f });
const wallSize = arenaSize;
const wallHeight = 15;
const terrainColliders = [];
function addWall(x, z, w, d) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(w, wallHeight, d),
    wallMat
  );
  wall.position.set(x, wallHeight / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  terrainColliders.push({
    x,
    z,
    halfW: w / 2,
    halfD: d / 2,
    yMin: 0,
    yMax: wallHeight,
  });
}
addWall(0, -wallSize / 2, wallSize, 2);
addWall(0, wallSize / 2, wallSize, 2);
addWall(-wallSize / 2, 0, 2, wallSize);
addWall(wallSize / 2, 0, 2, wallSize);

const obstacles = [];
for (let i = 0; i < mapConfig.obstacleCount; i += 1) {
  const w = 4 + Math.random() * 6;
  const h = 3 + Math.random() * 7;
  const d = 4 + Math.random() * 6;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.6 + Math.random() * 0.15, 0.4, 0.25),
      roughness: 0.65,
      metalness: 0.2,
    })
  );
  box.position.set(
    (Math.random() - 0.5) * mapConfig.obstacleSpawnRange,
    h / 2,
    (Math.random() - 0.5) * mapConfig.obstacleSpawnRange
  );
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
  obstacles.push(box);
  terrainColliders.push({
    x: box.position.x,
    z: box.position.z,
    halfW: w / 2,
    halfD: d / 2,
    yMin: 0,
    yMax: h,
  });
}

function randomGroundPosition(
  minDistanceFromCenter = 0,
  spread = mapConfig.halfSize - 22
) {
  let x = 0;
  let z = 0;
  let dist = 0;
  while (dist < minDistanceFromCenter) {
    x = (Math.random() - 0.5) * spread * 2;
    z = (Math.random() - 0.5) * spread * 2;
    dist = Math.hypot(x, z);
  }
  return { x, z };
}

function addHouse(x, z, scale = 1) {
  const house = new THREE.Group();
  house.position.set(x, 0, z);

  const bodyW = (6 + Math.random() * 2) * scale;
  const bodyD = (5 + Math.random() * 2) * scale;
  const bodyH = (3.2 + Math.random() * 1.4) * scale;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW, bodyH, bodyD),
    new THREE.MeshStandardMaterial({
      color: 0x1f2538,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  body.position.y = bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(bodyW, bodyD) * 0.68, 2.1 * scale, 4),
    new THREE.MeshStandardMaterial({
      color: 0x2f1f2c,
      roughness: 0.9,
      metalness: 0.03,
    })
  );
  roof.position.y = bodyH + 1 * scale;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(roof);

  scene.add(house);
  terrainColliders.push({
    x,
    z,
    halfW: bodyW / 2,
    halfD: bodyD / 2,
    yMin: 0,
    yMax: bodyH,
  });
}

function addTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);

  const trunkH = (3 + Math.random() * 2.5) * scale;
  const trunkR = (0.35 + Math.random() * 0.25) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR, trunkR * 1.25, trunkH, 8),
    new THREE.MeshStandardMaterial({
      color: 0x2a211d,
      roughness: 0.95,
      metalness: 0.02,
    })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry((1.6 + Math.random() * 1) * scale, (4 + Math.random() * 1.8) * scale, 9),
    new THREE.MeshStandardMaterial({
      color: 0x1f3528,
      roughness: 0.9,
      metalness: 0.01,
    })
  );
  crown.position.y = trunkH + 1.4 * scale;
  crown.castShadow = true;
  tree.add(crown);

  scene.add(tree);
  terrainColliders.push({
    x,
    z,
    halfW: trunkR + 0.15,
    halfD: trunkR + 0.15,
    yMin: 0,
    yMax: trunkH + 0.4,
  });
}

for (let i = 0; i < mapConfig.houseCount; i += 1) {
  const { x, z } = randomGroundPosition(mapConfig.houseMinDist);
  addHouse(x, z, 0.9 + Math.random() * 0.35);
}
for (let i = 0; i < mapConfig.treeCount; i += 1) {
  const { x, z } = randomGroundPosition(mapConfig.treeMinDist);
  addTree(x, z, 0.8 + Math.random() * 0.5);
}

const player = {
  pos: new THREE.Vector3(0, 1.8, 8),
  velY: 0,
  speed: 12,
  sprint: 17,
  onGround: false,
  health: 100,
  ammo: 30,
  maxAmmo: 30,
  score: 0,
  reloadTime: 0,
  shootCooldown: 0,
  shootKick: 0,
  reloadAnim: 0,
  velXZ: new THREE.Vector2(0, 0),
  radius: 0.55,
  weaponId: "rifle",
};
const weaponCatalog = {
  rifle: {
    name: "Rifle",
    damage: 1,
    cooldown: 0.12,
    mag: 30,
    reload: 1.35,
    kick: 1,
    color: 0x515a66,
    scale: 1,
  },
  smg: {
    name: "SMG",
    damage: 0.75,
    cooldown: 0.07,
    mag: 42,
    reload: 1.1,
    kick: 0.65,
    color: 0x5e6a77,
    scale: 0.88,
    automatic: true,
  },
  shotgun: {
    name: "Shotgun",
    damage: 10,
    cooldown: 0.42,
    mag: 6,
    reload: 1.8,
    kick: 1.4,
    color: 0x6f5d4a,
    scale: 1.15,
  },
};
const movementTuning = {
  groundAccel: 78,
  groundFriction: 11,
  airAccel: 24,
  airFriction: 1.2,
  jumpVelocity: 8,
};

const keys = new Set();
let yaw = 0;
let pitch = 0;
let locked = false;
let fireHeld = false;

const healthEl = document.getElementById("health");
const scoreEl = document.getElementById("score");
const ammoEl = document.getElementById("ammo");
const msgEl = document.getElementById("message");

const enemies = [];
/** Passive spawn pacing: base zombies/min multiplies by 1.1 each full in-game minute. */
const zombieSpawning = {
  gameTimeSec: 0,
  acc: 0,
  basePerMinute: 10,
  scalePerMinute: 1.1,
};

function getZombieSpawnRateMultiplier() {
  return zombieSpawning.scalePerMinute ** Math.floor(zombieSpawning.gameTimeSec / 60);
}

function getZombieCountCap() {
  return Math.min(200, 18 + Math.floor(mapConfig.arenaSize / 9));
}

function updateZombieSpawning(dt) {
  if (!locked || player.health <= 0) return;
  zombieSpawning.gameTimeSec += dt;
  const perSec = (zombieSpawning.basePerMinute / 60) * getZombieSpawnRateMultiplier();
  zombieSpawning.acc += perSec * dt;
  const cap = getZombieCountCap();
  while (zombieSpawning.acc >= 1 && enemies.length < cap) {
    spawnEnemy();
    zombieSpawning.acc -= 1;
  }
}
const bloodParticles = [];
const weaponPickups = [];
const weaponOrder = Object.keys(weaponCatalog);
const ownedWeapons = new Set(["rifle"]);
const weaponAmmoById = {};
for (const weaponId of weaponOrder) {
  weaponAmmoById[weaponId] = weaponCatalog[weaponId].mag;
}

function makeZombie() {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x4f7a54,
    roughness: 0.7,
    metalness: 0.08,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0x3f4963,
    roughness: 0.8,
    metalness: 0.05,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x7ea17a,
    roughness: 0.9,
    metalness: 0.02,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff6161,
    emissive: 0x330000,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.9), shirtMat);
  torso.position.y = 2.2;
  torso.castShadow = true;
  root.add(torso);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.75), bodyMat);
  hips.position.y = 1.1;
  hips.castShadow = true;
  root.add(hips);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), headMat);
  head.position.y = 3.45;
  head.castShadow = true;
  root.add(head);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
  eyeL.position.set(-0.2, 3.5, 0.48);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.2;
  root.add(eyeL, eyeR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.4, 0.38), bodyMat);
  armL.position.set(-1.02, 2.25, 0);
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 1.02;
  root.add(armL, armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.45, 0.45), bodyMat);
  legL.position.set(-0.35, 0.25, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.35;
  root.add(legL, legR);

  return { root, limbs: { armL, armR, legL, legR } };
}

function makeZombieDog() {
  const root = new THREE.Group();

  const furMat = new THREE.MeshStandardMaterial({
    color: 0x5f6b4e,
    roughness: 0.85,
    metalness: 0.04,
  });
  const scarMat = new THREE.MeshStandardMaterial({
    color: 0x7a2f2f,
    roughness: 0.9,
    metalness: 0.02,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff6969,
    emissive: 0x2b0000,
  });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 2), furMat);
  torso.position.set(0, 0.95, 0);
  torso.castShadow = true;
  root.add(torso);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.55), furMat);
  neck.position.set(0, 1.05, -1.05);
  neck.rotation.x = -0.35;
  neck.castShadow = true;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.8), furMat);
  head.position.set(0, 1.03, -1.45);
  head.castShadow = true;
  root.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.24, 0.42), scarMat);
  snout.position.set(0, 0.95, -1.9);
  snout.castShadow = true;
  root.add(snout);

  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.26, 0.12), furMat);
  earL.position.set(-0.24, 1.35, -1.5);
  earL.rotation.z = -0.2;
  const earR = earL.clone();
  earR.position.x = 0.24;
  earR.rotation.z = 0.2;
  root.add(earL, earR);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
  eyeL.position.set(-0.18, 1.07, -1.83);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;
  root.add(eyeL, eyeR);

  const legTemplate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.72, 0.25), furMat);
  legTemplate.castShadow = true;
  const frontL = legTemplate.clone();
  frontL.position.set(-0.4, 0.34, -0.65);
  const frontR = legTemplate.clone();
  frontR.position.set(0.4, 0.34, -0.65);
  const rearL = legTemplate.clone();
  rearL.position.set(-0.4, 0.34, 0.67);
  const rearR = legTemplate.clone();
  rearR.position.set(0.4, 0.34, 0.67);
  root.add(frontL, frontR, rearL, rearR);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.58), furMat);
  tail.position.set(0, 1.05, 1.25);
  tail.rotation.x = 0.55;
  tail.castShadow = true;
  root.add(tail);

  return {
    root,
    limbs: { frontL, frontR, rearL, rearR, tail, head },
  };
}

/**
 * Procedural first-person models — one distinct silhouette per weapon.
 * Returns a root group, the moving "slide" (bolt or pump) for recoil, and muzzle flash mesh.
 */
function buildWeaponModel(weaponId) {
  const root = new THREE.Group();
  const metal = (hex, m = 0.72) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.38, metalness: m });
  const dark = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.88, metalness: 0.08 });
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffbb66, transparent: true, opacity: 0 });

  let slide;
  let muzzleFlash;
  const cfg = weaponCatalog[weaponId];

  if (weaponId === "rifle") {
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.18, 0.32),
      dark(0x2c2418)
    );
    stock.position.set(0, -0.02, 0.32);
    stock.castShadow = true;
    root.add(stock);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.5), dark(0x1e252f));
    lower.position.set(0, -0.05, 0.02);
    lower.castShadow = true;
    root.add(lower);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.12), dark(0x1a1d24));
    mag.position.set(0, -0.2, 0.08);
    root.add(mag);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.3), dark(0x2a2f3a));
    handguard.position.set(0, -0.02, -0.32);
    handguard.castShadow = true;
    root.add(handguard);

    slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.1, 0.38),
      metal(cfg?.color ?? 0x515a66, 0.75)
    );
    slide.position.set(0, 0.08, -0.12);
    slide.castShadow = true;
    root.add(slide);

    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.04, 0.3),
      metal(0x3a3f4a, 0.65)
    );
    topRail.position.set(0, 0.15, -0.08);
    root.add(topRail);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.023, 0.4, 10),
      metal(0x0f1114, 0.85)
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.56);
    root.add(barrel);

    muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), muzzleMat);
    muzzleFlash.position.set(0, 0.01, -0.78);
    root.add(muzzleFlash);
  } else if (weaponId === "smg") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.36), dark(0x1c222c));
    body.position.set(0, 0, 0.02);
    body.castShadow = true;
    root.add(body);

    const vertMag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.12), dark(0x151820));
    vertMag.position.set(0, -0.3, 0.06);
    root.add(vertMag);

    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), dark(0x2a2f3a));
    foregrip.position.set(0, -0.18, -0.18);
    foregrip.rotation.x = 0.2;
    root.add(foregrip);

    slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.2),
      metal(cfg?.color ?? 0x5e6a77, 0.78)
    );
    slide.position.set(0, 0.09, 0.02);
    slide.castShadow = true;
    root.add(slide);

    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.04, 0.22, 10),
      metal(0x2d343d, 0.55)
    );
    can.rotation.x = Math.PI / 2;
    can.position.set(0, 0.01, -0.28);
    root.add(can);

    const shortBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.12, 8),
      metal(0x101214, 0.9)
    );
    shortBarrel.rotation.x = Math.PI / 2;
    shortBarrel.position.set(0, 0.01, -0.42);
    root.add(shortBarrel);

    muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), muzzleMat);
    muzzleFlash.position.set(0, 0.01, -0.5);
    root.add(muzzleFlash);
  } else {
    // shotgun: wide receiver, double barrels, wood stock, moving pump
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.2, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x3b2e22, roughness: 0.9, metalness: 0.04 })
    );
    stock.position.set(0, -0.01, 0.34);
    stock.castShadow = true;
    root.add(stock);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.4), dark(0x2d2724));
    receiver.position.set(0, 0, 0.02);
    receiver.castShadow = true;
    root.add(receiver);

    const barrelA = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.3, 8),
      metal(0x0c0e12, 0.9)
    );
    barrelA.rotation.x = Math.PI / 2;
    barrelA.position.set(-0.03, 0.05, -0.35);
    root.add(barrelA);

    const barrelB = barrelA.clone();
    barrelB.position.set(0.03, 0.05, -0.35);
    root.add(barrelB);

    slide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.062, 0.14, 10),
      metal(cfg?.color ?? 0x6f5d4a, 0.55)
    );
    slide.rotation.x = Math.PI / 2;
    slide.position.set(0, 0, -0.1);
    slide.castShadow = true;
    root.add(slide);

    const forend = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.1), dark(0x2a1f1a));
    forend.position.set(0, -0.04, -0.1);
    root.add(forend);

    muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), muzzleMat);
    muzzleFlash.position.set(0, 0.05, -0.55);
    root.add(muzzleFlash);
  }

  const slideBaseZ = slide.position.z;
  return { root, slide, muzzleFlash, slideBaseZ };
}

function spawnBlood(position) {
  for (let i = 0; i < 9; i += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.045 + Math.random() * 0.03, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x9c0000,
        emissive: 0x200000,
        roughness: 0.9,
      })
    );
    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 0.3;
    particle.position.y += (Math.random() - 0.4) * 0.25;
    particle.position.z += (Math.random() - 0.5) * 0.3;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      1.6 + Math.random() * 1.7,
      (Math.random() - 0.5) * 2.2
    );
    scene.add(particle);
    bloodParticles.push({
      mesh: particle,
      velocity,
      life: 0.55 + Math.random() * 0.25,
      maxLife: 0.8,
    });
  }
}
function spawnEnemy() {
  const isDog = Math.random() < 0.33;
  const enemyRig = isDog ? makeZombieDog() : makeZombie();
  let px = 0;
  let pz = 0;
  let distance = 0;
  while (distance < mapConfig.enemySpawnMinDistance) {
    px = (Math.random() - 0.5) * mapConfig.enemySpawnRange;
    pz = (Math.random() - 0.5) * mapConfig.enemySpawnRange;
    distance = Math.hypot(px - player.pos.x, pz - player.pos.z);
  }
  if (isDog) enemyRig.root.scale.setScalar(0.8);
  enemyRig.root.position.set(px, 0, pz);
  scene.add(enemyRig.root);
  const hitMeshes = [];
  enemyRig.root.traverse((obj) => {
    if (obj.isMesh) hitMeshes.push(obj);
  });
  enemies.push({
    mesh: enemyRig.root,
    hitMeshes,
    limbs: enemyRig.limbs,
    type: isDog ? "dog" : "zombie",
    health: isDog ? 2 : 3,
    speed: isDog ? 6 + Math.random() * 1.7 : 4.2 + Math.random() * 1.8,
    damageCooldown: 0,
    walkTime: Math.random() * 10,
  });
}

for (let i = 0; i < 8; i += 1) spawnEnemy();

const raycaster = new THREE.Raycaster();
const gunRig = {
  holder: new THREE.Group(),
  slide: null,
  muzzleFlash: null,
  slideBaseZ: 0,
  mountedId: null,
};
gunRig.holder.position.set(0.45, -0.42, -0.8);
gunRig.holder.rotation.set(0.03, -0.07, 0);
camera.add(gunRig.holder);
scene.add(camera);

function mountWeaponModel(weaponId) {
  if (gunRig.mountedId === weaponId && gunRig.holder.children.length > 0) return;
  while (gunRig.holder.children.length > 0) {
    gunRig.holder.remove(gunRig.holder.children[0]);
  }
  const w = weaponCatalog[weaponId];
  const built = buildWeaponModel(weaponId);
  built.root.scale.setScalar(w.scale);
  gunRig.holder.add(built.root);
  gunRig.slide = built.slide;
  gunRig.muzzleFlash = built.muzzleFlash;
  gunRig.slideBaseZ = built.slideBaseZ;
  gunRig.mountedId = weaponId;
}

function applyWeaponStats(weaponId, refill = false) {
  const weapon = weaponCatalog[weaponId];
  if (!weapon) return;

  ownedWeapons.add(weaponId);
  player.weaponId = weaponId;
  player.maxAmmo = weapon.mag;
  if (refill) weaponAmmoById[weaponId] = weapon.mag;
  player.ammo = Math.min(weaponAmmoById[weaponId] ?? weapon.mag, weapon.mag);

  mountWeaponModel(weaponId);
}

function switchWeaponByScroll(deltaY) {
  const unlocked = weaponOrder.filter((weaponId) => ownedWeapons.has(weaponId));
  if (unlocked.length <= 1 || !deltaY || player.health <= 0) return;

  const currentIndex = unlocked.indexOf(player.weaponId);
  const direction = deltaY > 0 ? 1 : -1;
  const nextIndex = (currentIndex + direction + unlocked.length) % unlocked.length;
  const nextWeaponId = unlocked[nextIndex];
  if (!nextWeaponId || nextWeaponId === player.weaponId) return;

  player.reloadTime = 0;
  player.reloadAnim = 0;
  player.shootCooldown = Math.max(player.shootCooldown, 0.08);
  applyWeaponStats(nextWeaponId, false);
  playWeaponSwitch();
  setMessage(`${weaponCatalog[nextWeaponId].name} equipped`);
  updateHUD();
}

function makeWeaponPickup(weaponId, x, z) {
  const weapon = weaponCatalog[weaponId];
  const pickup = new THREE.Group();
  pickup.position.set(x, 0.7, z);

  const built = buildWeaponModel(weaponId);
  const preview = built.root.clone(true);
  preview.scale.setScalar(0.32 * weapon.scale);
  preview.rotation.x = -0.12;
  preview.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  pickup.add(preview);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.1, 24),
    new THREE.MeshBasicMaterial({
      color: weapon.color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.58;
  pickup.add(glow);

  scene.add(pickup);
  weaponPickups.push({
    weaponId,
    mesh: pickup,
    glow,
    spin: Math.random() * Math.PI * 2,
  });
}

function spawnInitialWeaponPickups() {
  const ids = Object.keys(weaponCatalog);
  for (let i = 0; i < mapConfig.weaponPickups; i += 1) {
    const { x, z } = randomGroundPosition(mapConfig.pickupMinDist, mapConfig.pickupSpread);
    const weaponId = ids[Math.floor(Math.random() * ids.length)];
    makeWeaponPickup(weaponId, x, z);
  }
}

spawnInitialWeaponPickups();
applyWeaponStats(player.weaponId, true);

function updateHUD() {
  const weaponName = weaponCatalog[player.weaponId].name;
  healthEl.textContent = Math.max(0, Math.floor(player.health)).toString();
  scoreEl.textContent = player.score.toString();
  ammoEl.textContent = player.reloadTime > 0 ? `${weaponName} ...` : `${weaponName} ${player.ammo}`;
}
updateHUD();

function setMessage(text) {
  msgEl.textContent = text;
}

function resetGame() {
  player.health = 100;
  player.ammo = player.maxAmmo;
  player.score = 0;
  player.pos.set(0, 1.8, 8);
  player.velXZ.set(0, 0);
  player.velY = 0;
  ownedWeapons.clear();
  ownedWeapons.add("rifle");
  for (const weaponId of weaponOrder) {
    weaponAmmoById[weaponId] = weaponCatalog[weaponId].mag;
  }
  applyWeaponStats("rifle", true);
  zombieSpawning.gameTimeSec = 0;
  zombieSpawning.acc = 0;
  for (const enemy of enemies) {
    scene.remove(enemy.mesh);
  }
  enemies.length = 0;
  for (let i = 0; i < 8; i += 1) spawnEnemy();
  setMessage("Get ready");
  setTimeout(() => {
    if (player.health > 0) setMessage("");
  }, 1200);
  updateHUD();
}

document.body.addEventListener("click", () => {
  if (!locked) renderer.domElement.requestPointerLock();
  resumeAudio().then(() => startAmbient());
});

document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked) setMessage("Paused - click to resume");
  else setMessage("");
});

document.addEventListener("mousemove", (e) => {
  if (!locked) return;
  yaw -= e.movementX * 0.0026;
  pitch -= e.movementY * 0.0026;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") e.preventDefault();
  if (e.code === "KeyR" && player.reloadTime <= 0 && player.ammo < player.maxAmmo) {
    player.reloadTime = weaponCatalog[player.weaponId].reload;
    player.reloadAnim = 1;
    playReloadStart(player.weaponId);
    setMessage("Reloading...");
  }
  keys.add(e.code);
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
document.addEventListener(
  "wheel",
  (e) => {
    if (!locked) return;
    e.preventDefault();
    switchWeaponByScroll(e.deltaY);
  },
  { passive: false }
);

function fire() {
  if (!locked || player.health <= 0 || player.reloadTime > 0 || player.shootCooldown > 0) return;
  if (player.ammo <= 0) {
    playEmptyClick();
    setMessage("Out of ammo (R to reload)");
    return;
  }

  player.ammo -= 1;
  weaponAmmoById[player.weaponId] = player.ammo;
  const weapon = weaponCatalog[player.weaponId];
  player.shootCooldown = weapon.cooldown;
  player.shootKick = weapon.kick;
  gunRig.muzzleFlash.material.opacity = 1;
  playWeaponShot(player.weaponId);
  if (player.ammo <= 0) setMessage("Out of ammo (R to reload)");

  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  raycaster.set(camera.position, dir.normalize());

  const enemyMeshes = enemies.flatMap((e) => e.hitMeshes);
  const hits = raycaster.intersectObjects(enemyMeshes, false);
  if (hits.length > 0) {
    const hitMesh = hits[0].object;
    const enemy = enemies.find((e) => e.hitMeshes.includes(hitMesh));
    if (enemy) {
      enemy.health -= weapon.damage;
      spawnBlood(hits[0].point);
      if (enemy.health <= 0) {
        scene.remove(enemy.mesh);
        enemies.splice(enemies.indexOf(enemy), 1);
        player.score += 10;
        playEnemyDeath();
        spawnEnemy();
      } else {
        playEnemyHit();
      }
    }
  }
  updateHUD();
}

document.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    fireHeld = true;
    if (!weaponCatalog[player.weaponId]?.automatic) fire();
  }
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) fireHeld = false;
});
window.addEventListener("blur", () => {
  fireHeld = false;
});

function movePlayer(dt) {
  const move = new THREE.Vector2(0, 0);
  // FPS-relative movement basis from player yaw (not world position).
  const forward = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
  const right = new THREE.Vector2(Math.cos(yaw), -Math.sin(yaw));

  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);

  let wishDir = null;
  if (move.lengthSq() > 0) {
    move.normalize();
    wishDir = move.clone();
  }

  const maxSpeed = keys.has("ShiftLeft") ? player.sprint : player.speed;
  const moving = move.lengthSq() > 0;
  playFootstep(performance.now() / 1000, moving, player.onGround);
  if (player.onGround) {
    const frictionFactor = Math.max(0, 1 - movementTuning.groundFriction * dt);
    player.velXZ.multiplyScalar(frictionFactor);
  } else {
    const airFrictionFactor = Math.max(0, 1 - movementTuning.airFriction * dt);
    player.velXZ.multiplyScalar(airFrictionFactor);
  }

  if (wishDir) {
    const currentSpeedAlongWish = player.velXZ.dot(wishDir);
    const addSpeed = maxSpeed - currentSpeedAlongWish;
    if (addSpeed > 0) {
      const accelRate = player.onGround ? movementTuning.groundAccel : movementTuning.airAccel;
      const accelAmount = Math.min(addSpeed, accelRate * dt * maxSpeed);
      player.velXZ.addScaledVector(wishDir, accelAmount);
    }
  }

  const maxAllowed = player.onGround ? maxSpeed : maxSpeed * 0.95;
  if (player.velXZ.length() > maxAllowed) {
    player.velXZ.setLength(maxAllowed);
  }

  const moveDelta = new THREE.Vector2(player.velXZ.x * dt, player.velXZ.y * dt);
  resolvePlayerTerrainCollisions(moveDelta);

  if (keys.has("Space") && player.onGround) {
    player.velY = movementTuning.jumpVelocity;
    player.onGround = false;
  }
  player.velY -= 19 * dt;
  player.pos.y += player.velY * dt;
  if (player.pos.y <= 1.8) {
    player.pos.y = 1.8;
    player.velY = 0;
    player.onGround = true;
  }
}

function resolvePlayerTerrainCollisions(moveDelta) {
  player.pos.x += moveDelta.x;
  player.pos.z += moveDelta.y;

  // Keep player inside arena bounds.
  const maxPos = arenaSize / 2 - player.radius;
  player.pos.x = Math.max(-maxPos, Math.min(maxPos, player.pos.x));
  player.pos.z = Math.max(-maxPos, Math.min(maxPos, player.pos.z));

  for (let iter = 0; iter < 4; iter += 1) {
    let hadCollision = false;
    for (const collider of terrainColliders) {
      if (player.pos.y > collider.yMax + 0.05) continue;

      const minX = collider.x - collider.halfW;
      const maxX = collider.x + collider.halfW;
      const minZ = collider.z - collider.halfD;
      const maxZ = collider.z + collider.halfD;
      const nearestX = Math.max(minX, Math.min(player.pos.x, maxX));
      const nearestZ = Math.max(minZ, Math.min(player.pos.z, maxZ));
      let dx = player.pos.x - nearestX;
      let dz = player.pos.z - nearestZ;
      let distSq = dx * dx + dz * dz;

      if (distSq >= player.radius * player.radius) continue;
      hadCollision = true;

      if (distSq < 1e-8) {
        const penX = Math.min(Math.abs(player.pos.x - minX), Math.abs(maxX - player.pos.x));
        const penZ = Math.min(Math.abs(player.pos.z - minZ), Math.abs(maxZ - player.pos.z));
        if (penX < penZ) {
          dx = player.pos.x > collider.x ? 1 : -1;
          dz = 0;
        } else {
          dx = 0;
          dz = player.pos.z > collider.z ? 1 : -1;
        }
        distSq = 1;
      }

      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const pushOut = player.radius - dist + 0.0005;
      player.pos.x += nx * pushOut;
      player.pos.z += nz * pushOut;

      const vn = player.velXZ.x * nx + player.velXZ.y * nz;
      if (vn < 0) {
        player.velXZ.x -= nx * vn;
        player.velXZ.y -= nz * vn;
      }
    }
    if (!hadCollision) break;
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    const toPlayer = new THREE.Vector3().subVectors(player.pos, enemy.mesh.position);
    const dist = toPlayer.length();
    if (dist > 0.001) {
      toPlayer.normalize();
      enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * dt);
    }
    enemy.mesh.lookAt(player.pos.x, enemy.mesh.position.y, player.pos.z);
    if (enemy.type === "dog") enemy.mesh.rotateY(Math.PI);
    if (enemy.type === "dog") {
      enemy.walkTime += dt * 10;
      enemy.limbs.frontL.rotation.x = Math.sin(enemy.walkTime) * 0.75;
      enemy.limbs.frontR.rotation.x = Math.sin(enemy.walkTime + Math.PI) * 0.75;
      enemy.limbs.rearL.rotation.x = Math.sin(enemy.walkTime + Math.PI) * 0.75;
      enemy.limbs.rearR.rotation.x = Math.sin(enemy.walkTime) * 0.75;
      enemy.limbs.tail.rotation.y = Math.sin(enemy.walkTime * 1.25) * 0.32;
      enemy.limbs.head.rotation.x = Math.sin(enemy.walkTime * 0.5) * 0.08;
      enemy.mesh.position.y = Math.sin(enemy.walkTime * 0.75) * 0.05;
    } else {
      enemy.walkTime += dt * 6.5;
      enemy.limbs.armL.rotation.x = Math.sin(enemy.walkTime) * 0.45;
      enemy.limbs.armR.rotation.x = Math.sin(enemy.walkTime + Math.PI) * 0.45;
      enemy.limbs.legL.rotation.x = Math.sin(enemy.walkTime + Math.PI) * 0.55;
      enemy.limbs.legR.rotation.x = Math.sin(enemy.walkTime) * 0.55;
      enemy.mesh.position.y = Math.sin(enemy.walkTime * 0.5) * 0.07;
    }

    enemy.damageCooldown -= dt;
    if (dist < 1.8 && enemy.damageCooldown <= 0 && player.health > 0) {
      player.health -= 8;
      enemy.damageCooldown = 0.6;
      if (player.health <= 0) {
        player.health = 0;
        playGameOver();
        setMessage("You are down. Press Enter to restart");
      } else {
        playHurt();
      }
      updateHUD();
    }
  }
}

function updateBlood(dt) {
  for (let i = bloodParticles.length - 1; i >= 0; i -= 1) {
    const particle = bloodParticles[i];
    particle.life -= dt;
    particle.velocity.y -= 8.5 * dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    if (particle.mesh.position.y < 0.05) {
      particle.mesh.position.y = 0.05;
      particle.velocity.multiplyScalar(0.35);
    }
    const alpha = Math.max(0, particle.life / particle.maxLife);
    particle.mesh.material.opacity = alpha;
    particle.mesh.material.transparent = true;
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      bloodParticles.splice(i, 1);
    }
  }
}

function updateWeaponPickups(dt) {
  const ids = Object.keys(weaponCatalog);
  for (let i = weaponPickups.length - 1; i >= 0; i -= 1) {
    const pickup = weaponPickups[i];
    pickup.spin += dt;
    pickup.mesh.rotation.y = pickup.spin;
    pickup.mesh.position.y = 0.7 + Math.sin(performance.now() * 0.003 + pickup.spin) * 0.08;
    pickup.glow.material.opacity = 0.3 + Math.sin(performance.now() * 0.005 + pickup.spin) * 0.15;

    const distance = Math.hypot(
      pickup.mesh.position.x - player.pos.x,
      pickup.mesh.position.z - player.pos.z
    );
    if (distance < 1.8 && locked && player.health > 0) {
      applyWeaponStats(pickup.weaponId, true);
      playPickup();
      setMessage(`Picked up ${weaponCatalog[pickup.weaponId].name}`);
      scene.remove(pickup.mesh);
      weaponPickups.splice(i, 1);
      updateHUD();

      const { x, z } = randomGroundPosition(mapConfig.pickupMinDist, mapConfig.pickupSpread);
      const newWeaponId = ids[Math.floor(Math.random() * ids.length)];
      makeWeaponPickup(newWeaponId, x, z);
    }
  }
}

function updateGun(dt) {
  const kick = player.shootKick;
  player.shootKick = Math.max(0, player.shootKick - dt * 8);
  const recoil = kick * kick;

  if (player.reloadAnim > 0) {
    player.reloadAnim = Math.max(0, player.reloadAnim - dt / 1.4);
  }

  const reloadCurve = 1 - Math.abs(player.reloadAnim * 2 - 1);
  gunRig.holder.position.set(
    0.45 + Math.sin(performance.now() * 0.008) * 0.003,
    -0.42 - recoil * 0.08 - reloadCurve * 0.15,
    -0.8 + recoil * 0.12
  );
  gunRig.holder.rotation.set(
    0.03 - recoil * 0.12 - reloadCurve * 0.5,
    -0.07 + reloadCurve * 0.25,
    reloadCurve * -0.55
  );
  if (gunRig.slide) {
    gunRig.slide.position.z = gunRig.slideBaseZ + recoil * 0.06;
  }
  if (gunRig.muzzleFlash) {
    gunRig.muzzleFlash.material.opacity = Math.max(0, gunRig.muzzleFlash.material.opacity - dt * 13);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Enter" && player.health <= 0) resetGame();
});

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (locked && player.health > 0) {
    if (player.reloadTime > 0) {
      player.reloadTime -= dt;
      if (player.reloadTime <= 0) {
        player.reloadTime = 0;
        player.ammo = player.maxAmmo;
        weaponAmmoById[player.weaponId] = player.ammo;
        playReloadDone();
        setMessage("");
        updateHUD();
      }
    }
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    if (fireHeld && weaponCatalog[player.weaponId]?.automatic) fire();
    movePlayer(dt);
    updateZombieSpawning(dt);
    updateEnemies(dt);
    updateBlood(dt);
    updateWeaponPickups(dt);
    updateGun(dt);
  } else {
    updateBlood(dt);
    updateWeaponPickups(dt);
    updateGun(dt);
  }

  camera.position.copy(player.pos);
  camera.rotation.set(pitch, yaw, 0, "YXZ");

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setMessage("Click to lock cursor and start");
requestAnimationFrame(loop);
