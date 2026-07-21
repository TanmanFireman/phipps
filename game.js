"use strict";

// PHIPPS: HARVEST OF THE DAMNED
// A dependency-free canvas raycaster built for static hosting.

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $("#game");
const ctx = canvas.getContext("2d", { alpha: false });
const W = canvas.width;
const H = canvas.height;
const FOV = Math.PI / 3;
const RAYS = 480;
const RAY_WIDTH = W / RAYS;
const TWO_PI = Math.PI * 2;

const ui = {
  title: $("#title-screen"),
  game: $("#game-screen"),
  end: $("#end-screen"),
  briefing: $("#briefing"),
  pause: $("#pause-overlay"),
  health: $("#health"),
  ammo: $("#ammo"),
  cows: $("#cows"),
  kills: $("#kills"),
  objective: $("#objective"),
  dialogue: $("#dialogue"),
  dialogueText: $("#dialogue-text"),
  bossBar: $("#boss-bar"),
  bossHealth: $("#boss-health"),
  damage: $("#damage-flash"),
  sound: $("#sound-toggle"),
  endEyebrow: $("#end-eyebrow"),
  endTitle: $("#end-title"),
  endText: $("#end-text"),
  endStats: $("#end-stats")
};

const images = {};
function loadImage(name, src) {
  const image = new Image();
  image.src = src;
  images[name] = image;
}
loadImage("scarecrow", "assets/scarecrow-demon.webp");
loadImage("weapon", "assets/phipps-shotgun.webp");

const keys = Object.create(null);
let mode = "title";
let muted = false;
let lastFrame = performance.now();
let dialogueTimer = 0;
let weaponKick = 0;
let muzzleFlash = 0;
let screenShake = 0;
let audioContext = null;
let music = null;
let musicPart = 0;

const player = {
  x: 2.5,
  y: 2.5,
  dir: 0.16,
  health: 100,
  ammo: 12,
  fireCooldown: 0,
  hurtCooldown: 0,
  bob: 0
};

let enemies = [];
let cows = [];
let pickups = [];
let boss = null;
let gate = null;
let stats = {};

const enemySeeds = [
  [6.5, 2.5, "gourd"], [10.5, 3.5, "scarecrow"], [16.5, 4.5, "gourd"],
  [3.5, 8.5, "heifer"], [8.5, 11.5, "scarecrow"], [15.5, 9.5, "gourd"],
  [4.5, 15.5, "scarecrow"], [11.5, 16.5, "heifer"], [16.5, 15.5, "scarecrow"],
  [13.5, 6.5, "gourd"]
];

const enemyData = {
  gourd: { hp: 72, speed: 0.78, damage: 9, scale: 0.82, name: "HELLGOURD" },
  scarecrow: { hp: 106, speed: 0.59, damage: 14, scale: 1.15, name: "ASH SCARECROW" },
  heifer: { hp: 145, speed: 0.52, damage: 18, scale: 1.05, name: "BLOOD HEIFER" }
};

function wallAt(x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 1 || y < 1 || x >= 19 || y >= 19) return 1;
  if ((y === 5 || y === 9) && x >= 4 && x <= 9 && x !== 7) return 2;
  if ((x === 4 || x === 9) && y >= 5 && y <= 9 && y !== 7) return 2;
  if (x === 12 && y >= 2 && y <= 12 && y !== 6 && y !== 10) return 3;
  if (y === 13 && x >= 6 && x <= 17 && x !== 10 && x !== 15) return 3;
  if ((x === 2 || x === 17) && y >= 3 && y <= 6 && y !== 5) return 2;
  if (y === 16 && x >= 2 && x <= 8 && x !== 5) return 3;
  return 0;
}

function makeCanvas(width, height, draw) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  draw(c.getContext("2d"), width, height);
  return c;
}

images.gourd = makeCanvas(280, 340, (g, w, h) => {
  g.translate(w / 2, h * 0.57);
  g.strokeStyle = "#2e160a";
  g.lineWidth = 15;
  g.lineCap = "round";
  g.beginPath(); g.moveTo(-78, 42); g.lineTo(-117, 110); g.moveTo(78, 42); g.lineTo(116, 110); g.stroke();
  g.strokeStyle = "#512b0d"; g.lineWidth = 12;
  g.beginPath(); g.moveTo(-55, 83); g.lineTo(-68, 142); g.moveTo(55, 83); g.lineTo(68, 142); g.stroke();
  const glow = g.createRadialGradient(0, 0, 10, 0, 5, 114);
  glow.addColorStop(0, "#ffb13c"); glow.addColorStop(.45, "#d84b0e"); glow.addColorStop(1, "#5a1308");
  g.fillStyle = glow; g.beginPath(); g.ellipse(0, 10, 105, 92, 0, 0, TWO_PI); g.fill();
  g.strokeStyle = "#792311"; g.lineWidth = 8;
  [-58, -28, 28, 58].forEach(x => { g.beginPath(); g.moveTo(x, -68); g.quadraticCurveTo(x * .42, 12, x, 86); g.stroke(); });
  g.fillStyle = "#1b0703";
  g.beginPath(); g.moveTo(-63, -10); g.lineTo(-18, -28); g.lineTo(-30, 12); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(63, -10); g.lineTo(18, -28); g.lineTo(30, 12); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-63, 33); g.quadraticCurveTo(0, 78, 63, 33); g.lineTo(46, 67); g.lineTo(28, 51); g.lineTo(9, 74); g.lineTo(-13, 50); g.lineTo(-36, 65); g.closePath(); g.fill();
  g.fillStyle = "#48260b"; g.fillRect(-12, -112, 24, 42);
  g.strokeStyle = "#8a4115"; g.lineWidth = 7; g.beginPath(); g.moveTo(2, -112); g.quadraticCurveTo(48, -145, 78, -119); g.stroke();
});

images.heifer = makeCanvas(380, 330, (g, w, h) => {
  g.translate(w / 2, h * .55);
  g.fillStyle = "rgba(236,62,19,.25)"; g.beginPath(); g.ellipse(0, 20, 168, 122, 0, 0, TWO_PI); g.fill();
  g.fillStyle = "#17100d"; g.beginPath(); g.ellipse(0, 28, 136, 83, 0, 0, TWO_PI); g.fill();
  g.fillStyle = "#d7c8a8";
  [[-88,30,45,31], [54,3,49,38], [-8,58,35,21]].forEach(v => { g.beginPath(); g.ellipse(v[0], v[1], v[2], v[3], .2, 0, TWO_PI); g.fill(); });
  g.fillStyle = "#15100d"; [-95,-43,61,110].forEach(x => g.fillRect(x, 72, 20, 87));
  g.fillStyle = "#8e846f"; g.beginPath(); g.ellipse(-120, -24, 63, 55, -.12, 0, TWO_PI); g.fill();
  g.strokeStyle = "#d7c18e"; g.lineWidth = 13;
  g.beginPath(); g.moveTo(-154,-52); g.lineTo(-190,-99); g.moveTo(-96,-66); g.lineTo(-62,-112); g.stroke();
  g.fillStyle = "#f14a1d"; g.shadowColor = "#ff3911"; g.shadowBlur = 18;
  g.beginPath(); g.arc(-142,-35,8,0,TWO_PI); g.arc(-105,-38,8,0,TWO_PI); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = "#4a120a"; g.lineWidth = 9; g.beginPath(); g.moveTo(125, 8); g.quadraticCurveTo(181,-27,160,-88); g.stroke();
});

images.cow = makeCanvas(360, 320, (g, w, h) => {
  g.translate(w / 2, h * .55);
  g.shadowColor = "#f1cf6c"; g.shadowBlur = 22; g.strokeStyle = "rgba(255,220,119,.78)"; g.lineWidth = 8;
  g.beginPath(); g.ellipse(-70, -103, 70, 17, 0, 0, TWO_PI); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = "#e6dcc6"; g.beginPath(); g.ellipse(18, 22, 125, 72, 0, 0, TWO_PI); g.fill();
  g.fillStyle = "#31251e"; [[-36,0,43,30],[62,-4,38,26],[7,47,32,20]].forEach(v=>{ g.beginPath(); g.ellipse(v[0],v[1],v[2],v[3],.2,0,TWO_PI); g.fill(); });
  g.fillStyle = "#ddd1bb"; [-70,-13,50,101].forEach(x=>g.fillRect(x,66,18,75));
  g.beginPath(); g.ellipse(-102,-32,57,49,-.08,0,TWO_PI); g.fill();
  g.fillStyle = "#4b372b"; g.beginPath(); g.arc(-120,-41,6,0,TWO_PI); g.arc(-87,-43,6,0,TWO_PI); g.fill();
  g.strokeStyle = "#a9906a"; g.lineWidth=9; g.beginPath(); g.moveTo(-139,-57);g.lineTo(-168,-84);g.moveTo(-74,-60);g.lineTo(-47,-87);g.stroke();
});

images.combine = makeCanvas(640, 420, (g, w, h) => {
  g.translate(w / 2, h * .57);
  g.shadowColor = "#ff3b0d"; g.shadowBlur = 40; g.fillStyle = "rgba(255,48,10,.18)"; g.fillRect(-274,-176,548,330); g.shadowBlur = 0;
  g.fillStyle = "#3a2117"; g.fillRect(-183,-154,300,207);
  g.fillStyle = "#171010"; g.fillRect(-114,-133,170,91);
  g.fillStyle = "#b52a13"; g.fillRect(-98,-117,56,15); g.fillRect(1,-117,41,15);
  g.fillStyle = "#69321a"; g.fillRect(106,-89,96,145);
  g.fillStyle = "#21120d"; g.beginPath(); g.arc(-130,58,87,0,TWO_PI); g.arc(122,62,99,0,TWO_PI); g.fill();
  g.strokeStyle = "#9a4b23"; g.lineWidth=13; g.beginPath();g.arc(-130,58,56,0,TWO_PI);g.arc(122,62,65,0,TWO_PI);g.stroke();
  g.fillStyle = "#8b351a"; g.fillRect(-291,82,540,39);
  g.strokeStyle = "#ce6b2a"; g.lineWidth=10;
  for(let x=-282;x<250;x+=42){g.beginPath();g.moveTo(x,81);g.lineTo(x+28,143);g.stroke();}
  g.fillStyle = "#1b0d09"; g.fillRect(-9,-207,32,58);
  g.fillStyle = "#d83e15"; g.beginPath();g.arc(8,-219,30,0,TWO_PI);g.fill();
  g.fillStyle="#ffad38";
  g.font="900 38px Impact";g.textAlign="center";g.fillText("666 HP",-30,-18);
});

images.gate = makeCanvas(360, 500, (g, w, h) => {
  const glow = g.createRadialGradient(w/2,h*.5,20,w/2,h*.5,180);
  glow.addColorStop(0,"rgba(255,177,56,.95)"); glow.addColorStop(.25,"rgba(226,48,12,.9)"); glow.addColorStop(.62,"rgba(103,8,4,.72)"); glow.addColorStop(1,"rgba(0,0,0,0)");
  g.fillStyle=glow;g.fillRect(0,0,w,h);
  g.strokeStyle="#25110d";g.lineWidth=30;g.beginPath();g.moveTo(45,460);g.lineTo(53,173);g.quadraticCurveTo(180,-22,307,173);g.lineTo(315,460);g.stroke();
  g.strokeStyle="#e34818";g.lineWidth=7;g.setLineDash([20,13]);g.beginPath();g.moveTo(74,447);g.lineTo(78,187);g.quadraticCurveTo(180,28,282,187);g.lineTo(286,447);g.stroke();
});

images.shells = makeCanvas(180, 180, (g,w,h)=>{
  g.translate(w/2,h/2);g.rotate(-.18);g.fillStyle="#b61e10";g.fillRect(-50,-63,42,126);g.fillRect(13,-63,42,126);g.fillStyle="#d6a84d";g.fillRect(-50,44,42,20);g.fillRect(13,44,42,20);g.strokeStyle="#ffe487";g.lineWidth=4;g.strokeRect(-50,-63,42,126);g.strokeRect(13,-63,42,126);
});

images.medkit = makeCanvas(180, 180, (g,w,h)=>{
  g.fillStyle="#d9c9ae";g.fillRect(24,39,132,116);g.fillStyle="#a51910";g.fillRect(72,54,37,87);g.fillRect(47,79,87,37);g.strokeStyle="#392018";g.lineWidth=8;g.strokeRect(24,39,132,116);
});

function normalizeAngle(a) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clearPath(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  for (let d = .12; d < length; d += .12) {
    if (wallAt(ax + dx * d / length, ay + dy * d / length)) return false;
  }
  return true;
}

function castRay(angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = .02; d < 25; d += .025) {
    const x = player.x + cos * d;
    const y = player.y + sin * d;
    const wall = wallAt(x, y);
    if (wall) return { dist: d, wall, x, y };
  }
  return { dist: 25, wall: 0, x: player.x + cos * 25, y: player.y + sin * 25 };
}

function resetGame() {
  Object.assign(player, { x: 2.5, y: 2.5, dir: .16, health: 100, ammo: 12, fireCooldown: 0, hurtCooldown: 0, bob: 0 });
  enemies = enemySeeds.map(([x,y,type], id) => ({
    id, x, y, type, hp: enemyData[type].hp, alive: true, awake: false,
    attackCooldown: Math.random(), pain: 0, phase: Math.random() * TWO_PI
  }));
  cows = [[3.5,12.5],[14.5,3.5],[15.5,16.5]].map(([x,y],id)=>({id,x,y,rescued:false,phase:id*2.1}));
  pickups = [
    {x:7.5,y:7.5,type:"shells",active:true},
    {x:10.5,y:14.5,type:"shells",active:true},
    {x:14.5,y:11.5,type:"medkit",active:true},
    {x:5.5,y:17.5,type:"medkit",active:true}
  ];
  boss = { x:16.5, y:17.5, hp:650, maxHp:650, active:false, alive:true, attackCooldown:1.6, pain:0, phase:0 };
  gate = { x:17.55, y:17.55, active:false };
  stats = { kills:0, cows:0, shots:0, hits:0, started:performance.now(), won:false };
  weaponKick = 0; muzzleFlash = 0; screenShake = 0;
  updateHUD();
}

function showOnly(screen) {
  [ui.title, ui.game, ui.end].forEach(el => el.classList.remove("active"));
  screen.classList.add("active");
}

function beginGame() {
  resetGame();
  mode = "playing";
  ui.briefing.classList.add("hidden");
  ui.pause.classList.add("hidden");
  showOnly(ui.game);
  ensureAudio();
  startMusic();
  say("Ah hell.", 2900);
  canvas.focus();
}

function returnToTitle() {
  mode = "title";
  document.exitPointerLock?.();
  ui.pause.classList.add("hidden");
  ui.end.classList.remove("active");
  showOnly(ui.title);
  stopMusic();
}

function togglePause(force) {
  if (mode !== "playing" && mode !== "paused") return;
  const shouldPause = force ?? mode === "playing";
  mode = shouldPause ? "paused" : "playing";
  ui.pause.classList.toggle("hidden", !shouldPause);
  if (shouldPause) {
    document.exitPointerLock?.();
    if (music) music.volume = muted ? 0 : .18;
  } else {
    if (music) music.volume = muted ? 0 : .48;
    canvas.focus();
  }
}

function say(text, duration = 2600) {
  ui.dialogueText.textContent = text;
  ui.dialogue.classList.remove("hidden");
  dialogueTimer = duration / 1000;
}

function updateHUD() {
  ui.health.textContent = Math.max(0, Math.ceil(player.health));
  ui.ammo.textContent = player.ammo;
  ui.cows.textContent = `${stats.cows} / 3`;
  ui.kills.textContent = `${stats.kills} / 10`;
  ui.bossHealth.style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
  ui.bossBar.classList.toggle("hidden", !boss.active || !boss.alive);

  if (stats.kills < 10 || stats.cows < 3) {
    const tasks = [];
    if (stats.cows < 3) tasks.push(`RECOVER ${3-stats.cows} COW${3-stats.cows===1?"":"S"}`);
    if (stats.kills < 10) tasks.push(`CLEANSE ${10-stats.kills} ABOMINATION${10-stats.kills===1?"":"S"}`);
    ui.objective.textContent = tasks.join(" · ");
  } else if (boss.alive) {
    ui.objective.textContent = "DESTROY THE INFERNAL COMBINE";
  } else {
    ui.objective.textContent = "REACH THE HELLGATE";
  }
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function tone(freq, duration, type="square", volume=.08, endFreq=null) {
  if (muted || !audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(now); osc.stop(now + duration);
}

function noise(duration=.12, volume=.12) {
  if (muted || !audioContext) return;
  const length = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);
  for(let i=0;i<length;i++) channel[i] = (Math.random()*2-1) * (1-i/length);
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer; gain.gain.value = volume;
  source.connect(gain).connect(audioContext.destination); source.start();
}

function sfx(name) {
  if (!audioContext) return;
  if (name === "shot") { tone(115,.22,"sawtooth",.16,38); noise(.18,.19); tone(55,.3,"square",.08,28); }
  if (name === "hit") { tone(210,.09,"square",.07,90); }
  if (name === "hurt") { tone(74,.28,"sawtooth",.12,32); noise(.11,.08); }
  if (name === "pickup") { tone(330,.09,"square",.07,480); setTimeout(()=>tone(620,.12,"square",.06,780),70); }
  if (name === "cow") { tone(120,.24,"sawtooth",.07,91); setTimeout(()=>tone(95,.34,"sawtooth",.06,68),130); }
  if (name === "boss") { tone(46,1.1,"sawtooth",.15,27); noise(.8,.05); }
  if (name === "gate") { tone(98,.8,"sine",.09,510); tone(43,1.2,"sawtooth",.05,34); }
}

function startMusic() {
  stopMusic();
  const probe = document.createElement("audio");
  const ext = probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? "m4a" : "ogg";
  musicPart = 0;
  music = new Audio(`audio/megalo-0${musicPart}.${ext}`);
  music.preload = "auto";
  music.volume = muted ? 0 : .48;
  music.addEventListener("ended", () => {
    if (mode === "playing" || mode === "paused") {
      musicPart = (musicPart + 1) % 3;
      music.src = `audio/megalo-0${musicPart}.${ext}`;
      music.play().catch(()=>{});
    }
  });
  music.play().catch(()=>{});
}

function stopMusic() {
  if (!music) return;
  music.pause();
  music.removeAttribute("src");
  music = null;
}

function toggleSound() {
  muted = !muted;
  ui.sound.textContent = muted ? "SOUND: OFF" : "SOUND: ON";
  ui.sound.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  if (music) music.volume = muted ? 0 : (mode === "paused" ? .18 : .48);
}

function collides(x, y, radius=.22) {
  return wallAt(x-radius,y-radius)||wallAt(x+radius,y-radius)||wallAt(x-radius,y+radius)||wallAt(x+radius,y+radius);
}

function moveEntity(entity, dx, dy, radius=.24) {
  if (!collides(entity.x + dx, entity.y, radius)) entity.x += dx;
  if (!collides(entity.x, entity.y + dy, radius)) entity.y += dy;
}

function updatePlayer(dt) {
  let forward = 0;
  let strafe = 0;
  if (keys.KeyW || keys.ArrowUp || keys.forward) forward += 1;
  if (keys.KeyS || keys.ArrowDown || keys.back) forward -= 1;
  if (keys.KeyA) strafe -= 1;
  if (keys.KeyD) strafe += 1;
  if (keys.ArrowLeft || keys.left) player.dir -= 1.72 * dt;
  if (keys.ArrowRight || keys.right) player.dir += 1.72 * dt;
  player.dir = normalizeAngle(player.dir);
  const moving = forward || strafe;
  if (moving) {
    const speed = (keys.ShiftLeft ? 3.25 : 2.55) * dt / Math.hypot(forward,strafe);
    const dx = (Math.cos(player.dir)*forward + Math.cos(player.dir+Math.PI/2)*strafe) * speed;
    const dy = (Math.sin(player.dir)*forward + Math.sin(player.dir+Math.PI/2)*strafe) * speed;
    moveEntity(player, dx, dy, .24);
    player.bob += dt * (keys.ShiftLeft ? 15 : 11);
  }
  player.fireCooldown = Math.max(0, player.fireCooldown-dt);
  player.hurtCooldown = Math.max(0, player.hurtCooldown-dt);
  weaponKick = Math.max(0, weaponKick-dt*4.5);
  muzzleFlash = Math.max(0, muzzleFlash-dt*8);
  screenShake = Math.max(0, screenShake-dt*5);
}

function shoot() {
  if (mode !== "playing" || player.fireCooldown > 0) return;
  ensureAudio();
  if (player.ammo <= 0) {
    player.fireCooldown = .35;
    tone(80,.08,"square",.05,70);
    say("Ah hell. Empty.", 1200);
    return;
  }
  player.ammo--;
  stats.shots++;
  player.fireCooldown = .56;
  weaponKick = 1;
  muzzleFlash = 1;
  screenShake = .45;
  sfx("shot");

  const targets = enemies.filter(e=>e.alive);
  if (boss.active && boss.alive) targets.push(boss);
  const wallDistance = castRay(player.dir).dist;
  let target = null;
  let nearest = Infinity;
  for (const enemy of targets) {
    const dx = enemy.x-player.x;
    const dy = enemy.y-player.y;
    const dist = Math.hypot(dx,dy);
    const diff = Math.abs(normalizeAngle(Math.atan2(dy,dx)-player.dir));
    const radius = enemy === boss ? .68 : .38;
    if (dist < nearest && dist < wallDistance+.15 && diff < Math.atan2(radius,dist)+.024 && clearPath(player.x,player.y,enemy.x,enemy.y)) {
      target=enemy; nearest=dist;
    }
  }

  if (target) {
    stats.hits++;
    const damage = 58 + Math.random()*25;
    target.hp -= damage;
    target.pain = .22;
    sfx("hit");
    if (target.hp <= 0) killTarget(target);
  }
  updateHUD();
}

function killTarget(target) {
  target.alive = false;
  screenShake = 1;
  if (target === boss) {
    gate.active = true;
    ui.bossBar.classList.add("hidden");
    say("I’m like you. I finish what I start.", 3800);
    sfx("gate");
    updateHUD();
    return;
  }
  stats.kills++;
  if (stats.kills % 3 === 0) pickups.push({x:target.x,y:target.y,type:"shells",active:true});
  if (stats.kills === 1) say("I’m like you. I don’t care for scarecrows.", 3400);
  else if (stats.kills === 4) say("Ah hell. They’re in the pumpkins.", 3000);
  else if (stats.kills === 7) say("I’m like you. I have chores to finish.", 3400);
  updateHUD();
  checkBoss();
}

function hurt(amount) {
  if (player.hurtCooldown > 0 || mode !== "playing") return;
  player.health -= amount;
  player.hurtCooldown = .55;
  screenShake = .8;
  sfx("hurt");
  ui.damage.classList.add("hit");
  setTimeout(()=>ui.damage.classList.remove("hit"),130);
  updateHUD();
  if (player.health <= 0) {
    say("Ah hell.", 500);
    setTimeout(()=>endGame(false),420);
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.pain = Math.max(0,enemy.pain-dt);
    enemy.attackCooldown -= dt;
    enemy.phase += dt * 2;
    const dist = distance(enemy,player);
    if (dist < 9.5 && clearPath(enemy.x,enemy.y,player.x,player.y)) enemy.awake = true;
    if (!enemy.awake) continue;
    if (dist > .78) {
      const data=enemyData[enemy.type];
      const step=data.speed*dt;
      moveEntity(enemy,(player.x-enemy.x)/dist*step,(player.y-enemy.y)/dist*step,.28);
    } else if (enemy.attackCooldown<=0) {
      hurt(enemyData[enemy.type].damage);
      enemy.attackCooldown = 1.0 + Math.random()*.55;
    }
  }

  if (boss.active && boss.alive) {
    boss.pain=Math.max(0,boss.pain-dt);
    boss.phase+=dt;
    boss.attackCooldown-=dt;
    const dist=distance(boss,player);
    if (dist>1.45) {
      const step=.42*dt;
      moveEntity(boss,(player.x-boss.x)/dist*step,(player.y-boss.y)/dist*step,.58);
    }
    if (boss.attackCooldown<=0 && clearPath(boss.x,boss.y,player.x,player.y)) {
      hurt(dist<2 ? 24 : 13);
      boss.attackCooldown=dist<2?1.15:1.8;
      tone(52,.5,"sawtooth",.11,25);
    }
  }
}

function updateItems() {
  for (const cow of cows) {
    if (!cow.rescued && distance(cow,player)<.72) {
      cow.rescued=true; stats.cows++; sfx("cow");
      if(stats.cows===1) say("I’m like you. I check on my cows.",3200);
      else if(stats.cows===2) say("Two cows. I’m like you. I can count.",3300);
      else say("Herd’s accounted for.",2600);
      updateHUD(); checkBoss();
    }
  }
  for (const pickup of pickups) {
    if (!pickup.active || distance(pickup,player)>.64) continue;
    if (pickup.type==="shells") {
      player.ammo=Math.min(24,player.ammo+6); say("Six shells. That’ll do.",1600);
    } else {
      player.health=Math.min(100,player.health+35); say("Still standing.",1500);
    }
    pickup.active=false; sfx("pickup"); updateHUD();
  }
  if (gate.active && distance(gate,player)<.82) endGame(true);
}

function checkBoss() {
  if (!boss.active && stats.kills>=10 && stats.cows>=3) {
    boss.active=true;
    say("I’m like you. I own heavy equipment.", 3900);
    sfx("boss");
    screenShake=1.2;
    updateHUD();
  }
}

function endGame(won) {
  if (mode === "ended") return;
  mode="ended";
  stats.won=won;
  document.exitPointerLock?.();
  const seconds=Math.max(1,Math.round((performance.now()-stats.started)/1000));
  const accuracy=stats.shots?Math.round(stats.hits/stats.shots*100):0;
  if (won) {
    ui.endEyebrow.textContent="THE FARM REMEMBERS";
    ui.endTitle.textContent="DAWN OVER PHIPPS FARM";
    ui.endText.textContent="The field is quiet. The herd is home. Somewhere beneath the smoking soil, Hell has learned to fear a man with morning chores.";
    say("Field’s clear. Let’s go feed the cows.",1800);
  } else {
    ui.endEyebrow.textContent="FARMING INCIDENT No. 666";
    ui.endTitle.textContent="AH HELL.";
    ui.endText.textContent="Phipps has temporarily died in a ridiculous farming incident. The cows remain disappointed, but optimistic.";
  }
  ui.endStats.textContent=`${seconds}s · ${stats.kills} CLEANSED · ${stats.cows} COWS · ${accuracy}% ACCURACY`;
  showOnly(ui.end);
  if (music) music.volume=muted?0:.25;
}

function update(dt) {
  if (mode!=="playing") return;
  if (dialogueTimer>0) {
    dialogueTimer-=dt;
    if(dialogueTimer<=0) ui.dialogue.classList.add("hidden");
  }
  updatePlayer(dt);
  updateEnemies(dt);
  updateItems();
}

function renderWorld() {
  const shakeX=(Math.random()-.5)*screenShake*7;
  const shakeY=(Math.random()-.5)*screenShake*5;
  ctx.save();
  ctx.translate(shakeX,shakeY);
  const sky=ctx.createLinearGradient(0,0,0,H*.53);
  sky.addColorStop(0,"#130406");sky.addColorStop(.48,"#6a160c");sky.addColorStop(1,"#dc4a17");
  ctx.fillStyle=sky;ctx.fillRect(-10,-10,W+20,H*.54+10);
  const floor=ctx.createLinearGradient(0,H*.48,0,H);
  floor.addColorStop(0,"#3d1b0e");floor.addColorStop(.55,"#170d08");floor.addColorStop(1,"#050403");
  ctx.fillStyle=floor;ctx.fillRect(-10,H*.48,W+20,H*.53);

  // Distant infernal sun and drifting embers.
  const sunX=W*.73-player.dir*28;
  const sun=ctx.createRadialGradient(sunX,95,4,sunX,95,62);
  sun.addColorStop(0,"#fff2a4");sun.addColorStop(.22,"#ff8a27");sun.addColorStop(.6,"rgba(207,28,6,.65)");sun.addColorStop(1,"rgba(90,0,0,0)");
  ctx.fillStyle=sun;ctx.fillRect(sunX-65,30,130,130);
  ctx.fillStyle="#ff8b2d";
  for(let i=0;i<38;i++){
    const x=((i*179 + performance.now()*.012*(i%3+1) - player.dir*130)%W+W)%W;
    const y=25+((i*83 - performance.now()*.009*(i%4+1))%(H*.42)+H*.42)%(H*.42);
    ctx.globalAlpha=.2+(i%5)*.11;ctx.fillRect(x,y,1+(i%3),1+(i%3));
  }
  ctx.globalAlpha=1;

  // Perspective furrows make the field readable while moving.
  ctx.strokeStyle="rgba(91,43,20,.42)";ctx.lineWidth=1;
  for(let i=-8;i<=8;i++){
    const horizonX=W/2+i*29-Math.tan(player.dir)*6;
    ctx.beginPath();ctx.moveTo(horizonX,H*.51);ctx.lineTo(W/2+i*105,H);ctx.stroke();
  }

  const depth=new Array(RAYS);
  for(let i=0;i<RAYS;i++){
    const angle=player.dir-FOV/2+(i/RAYS)*FOV;
    const hit=castRay(angle);
    const corrected=hit.dist*Math.cos(angle-player.dir);
    depth[i]=corrected;
    const height=Math.min(H*1.55,H*.82/Math.max(.05,corrected));
    const top=H*.5-height*.5;
    const shade=Math.max(.16,1-corrected/18);
    let base=hit.wall===1?[86,43,25]:hit.wall===2?[69,47,30]:[56,37,26];
    const frac=Math.abs((hit.x%1)-(hit.y%1));
    const seam=(Math.floor(frac*8)%2)?1:.72;
    const r=Math.floor(base[0]*shade*seam+50/(corrected+2));
    const g=Math.floor(base[1]*shade*seam);
    const b=Math.floor(base[2]*shade*seam);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.fillRect(i*RAY_WIDTH,top,RAY_WIDTH+1,height);
    if(i%13===0){ctx.fillStyle=`rgba(255,129,51,${.055*shade})`;ctx.fillRect(i*RAY_WIDTH,top,RAY_WIDTH,height);}
  }

  const billboards=[];
  enemies.filter(e=>e.alive).forEach(e=>billboards.push({entity:e,image:images[e.type],scale:enemyData[e.type].scale,bob:Math.sin(e.phase)*.035,tint:e.pain>0}));
  cows.filter(c=>!c.rescued).forEach(c=>billboards.push({entity:c,image:images.cow,scale:1,bob:Math.sin(performance.now()/450+c.phase)*.045}));
  pickups.filter(p=>p.active).forEach(p=>billboards.push({entity:p,image:images[p.type],scale:.48,bob:Math.sin(performance.now()/280+p.x)*.07}));
  if(boss.active&&boss.alive) billboards.push({entity:boss,image:images.combine,scale:1.72,bob:0,tint:boss.pain>0});
  if(gate.active) billboards.push({entity:gate,image:images.gate,scale:1.45,bob:0});
  billboards.sort((a,b)=>distance(b.entity,player)-distance(a.entity,player));
  for(const item of billboards) drawBillboard(item,depth);

  drawWeapon();
  ctx.restore();
}

function drawBillboard(item, depth) {
  const {entity,image,scale,bob=0,tint=false}=item;
  if(!image || !image.width) return;
  const dx=entity.x-player.x,dy=entity.y-player.y;
  const dist=Math.hypot(dx,dy);
  const relative=normalizeAngle(Math.atan2(dy,dx)-player.dir);
  if(Math.abs(relative)>FOV*.72||dist>.1+24) return;
  const projectedX=W/2+Math.tan(relative)*(W/2)/Math.tan(FOV/2);
  const size=H/dist*scale;
  const aspect=image.width/image.height;
  const drawW=size*aspect;
  const drawH=size;
  const left=projectedX-drawW/2;
  const top=H*.5-drawH*.57+bob*size;
  ctx.save();
  if(tint){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=.78;}
  const start=Math.max(0,Math.floor(left));
  const end=Math.min(W,Math.ceil(left+drawW));
  for(let sx=start;sx<end;sx+=2){
    const ray=Math.max(0,Math.min(RAYS-1,Math.floor(sx/RAY_WIDTH)));
    if(dist>depth[ray]+.36) continue;
    const sourceX=Math.max(0,Math.min(image.width-1,Math.floor((sx-left)/drawW*image.width)));
    ctx.drawImage(image,sourceX,0,Math.min(2,image.width-sourceX),image.height,sx,top,2,drawH);
  }
  ctx.restore();
}

function drawWeapon() {
  const image=images.weapon;
  if(!image||!image.width) return;
  const bobX=Math.sin(player.bob)*7;
  const bobY=Math.abs(Math.cos(player.bob))*5;
  const kick=weaponKick*58;
  const width=W*.62;
  const height=width/image.width*image.height;
  ctx.drawImage(image,W/2-width/2+bobX,H-height+18+bobY+kick,width,height);
  if(muzzleFlash>0){
    const x=W/2+bobX,y=H-height*.76+kick;
    const glow=ctx.createRadialGradient(x,y,2,x,y,85*muzzleFlash);
    glow.addColorStop(0,"rgba(255,255,214,.95)");glow.addColorStop(.25,"rgba(255,170,41,.85)");glow.addColorStop(1,"rgba(255,55,0,0)");
    ctx.fillStyle=glow;ctx.fillRect(x-100,y-100,200,200);
  }
}

function render() {
  if(mode!=="playing"&&mode!=="paused") return;
  renderWorld();
}

function loop(now) {
  const dt=Math.min(.04,(now-lastFrame)/1000);
  lastFrame=now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

$("#start-button").addEventListener("click",beginGame);
$("#briefing-start").addEventListener("click",beginGame);
$("#briefing-button").addEventListener("click",()=>ui.briefing.classList.remove("hidden"));
$(".modal-close").addEventListener("click",()=>ui.briefing.classList.add("hidden"));
$("#pause-button").addEventListener("click",()=>togglePause(true));
$("#resume-button").addEventListener("click",()=>togglePause(false));
$("#quit-button").addEventListener("click",returnToTitle);
$("#restart-button").addEventListener("click",beginGame);
$("#end-title-button").addEventListener("click",returnToTitle);
ui.sound.addEventListener("click",toggleSound);

window.addEventListener("keydown",event=>{
  keys[event.code]=true;
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.code)) event.preventDefault();
  if(event.code==="Space"&&!event.repeat) shoot();
  if(event.code==="Escape"&&mode==="playing") togglePause(true);
  else if(event.code==="Escape"&&mode==="paused") togglePause(false);
});
window.addEventListener("keyup",event=>{keys[event.code]=false;});

canvas.addEventListener("mousedown",event=>{
  if(mode!=="playing") return;
  if(document.pointerLockElement!==canvas) canvas.requestPointerLock?.();
  if(event.button===0) shoot();
});
document.addEventListener("mousemove",event=>{
  if(mode==="playing"&&document.pointerLockElement===canvas) player.dir=normalizeAngle(player.dir+event.movementX*.00235);
});

$$('[data-control]').forEach(button=>{
  const control=button.dataset.control;
  const down=event=>{event.preventDefault();keys[control]=true;};
  const up=event=>{event.preventDefault();keys[control]=false;};
  button.addEventListener("pointerdown",down);
  button.addEventListener("pointerup",up);
  button.addEventListener("pointercancel",up);
  button.addEventListener("pointerleave",up);
});
$("#touch-fire").addEventListener("pointerdown",event=>{event.preventDefault();shoot();});

window.addEventListener("blur",()=>{
  Object.keys(keys).forEach(k=>keys[k]=false);
  if(mode==="playing") togglePause(true);
});

resetGame();
requestAnimationFrame(loop);
