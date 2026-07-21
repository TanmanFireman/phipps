"use strict";

// PHIPPS // THE HAYGATE COMPLEX
// An original browser raycaster campaign. No Quake game data is used.

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const canvas = $("#game");
const ctx = canvas.getContext("2d", { alpha:false });
const W = canvas.width, H = canvas.height;
const FOV = Math.PI/3, TWO_PI = Math.PI*2, RAYS = 480, RAY_W = W/RAYS;
const MW = 40, MH = 30;

const ui = {
  title:$("#title-screen"), game:$("#game-screen"), end:$("#end-screen"), briefing:$("#briefing"), pause:$("#pause-overlay"),
  health:$("#health"), healthBar:$("#health-bar"), ammo:$("#ammo"), ammoName:$("#ammo-name"), weapon:$("#weapon-name"),
  kills:$("#kills"), secrets:$("#secrets"), key:$("#key-indicator"), objective:$("#objective"), prompt:$("#use-prompt"),
  dialogue:$("#dialogue"), dialogueText:$("#dialogue-text"), damage:$("#damage-flash"), water:$("#water-tint"),
  bossBar:$("#boss-bar"), bossHealth:$("#boss-health"), sound:$("#sound-toggle"),
  endEyebrow:$("#end-eyebrow"), endTitle:$("#end-title"), endText:$("#end-text"), endStats:$("#end-stats")
};

let mode="title", lastFrame=performance.now(), muted=false, dialogueTimer=0, screenShake=0, weaponKick=0, muzzle=0;
let audioContext=null, music=null, musicPart=0, grid=[], doors=[], enemies=[], pickups=[], projectiles=[], boss=null, gate=null, levelState={}, stats={};
const keys=Object.create(null);
const images={};

function loadImage(name,src){const i=new Image();i.src=src;images[name]=i;}
loadImage("shotgun","assets/phipps-shotgun.webp");
loadImage("scarecrow","assets/scarecrow-demon.webp");

const player={x:3.5,y:15.5,dir:0,health:100,weapon:"shotgun",shells:16,spikes:0,hasDriver:false,hasKey:false,fireCooldown:0,hurtCooldown:0,bob:0,onWater:false,elevation:0};

function makeCanvas(w,h,draw){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);return c;}

images.gourd=makeCanvas(260,320,(g,w,h)=>{
  g.translate(w/2,h*.58);g.strokeStyle="#3b1e0c";g.lineWidth=14;g.lineCap="round";
  g.beginPath();g.moveTo(-72,35);g.lineTo(-108,116);g.moveTo(72,35);g.lineTo(108,116);g.moveTo(-48,78);g.lineTo(-58,145);g.moveTo(48,78);g.lineTo(58,145);g.stroke();
  const z=g.createRadialGradient(0,-5,8,0,4,110);z.addColorStop(0,"#ffc253");z.addColorStop(.42,"#d95716");z.addColorStop(1,"#531208");g.fillStyle=z;
  g.beginPath();g.ellipse(0,5,101,91,0,0,TWO_PI);g.fill();g.strokeStyle="#7e2b11";g.lineWidth=7;
  [-58,-28,28,58].forEach(x=>{g.beginPath();g.moveTo(x,-72);g.quadraticCurveTo(x*.3,5,x,82);g.stroke();});
  g.fillStyle="#140503";g.beginPath();g.moveTo(-62,-14);g.lineTo(-17,-31);g.lineTo(-29,10);g.closePath();g.fill();g.beginPath();g.moveTo(62,-14);g.lineTo(17,-31);g.lineTo(29,10);g.closePath();g.fill();
  g.beginPath();g.moveTo(-61,33);g.quadraticCurveTo(0,77,61,33);g.lineTo(42,67);g.lineTo(18,49);g.lineTo(0,73);g.lineTo(-23,48);g.lineTo(-45,64);g.closePath();g.fill();
  g.fillStyle="#4b2c0d";g.fillRect(-11,-113,22,41);
});

images.heifer=makeCanvas(370,320,(g,w,h)=>{
  g.translate(w/2,h*.58);g.fillStyle="#18130f";g.beginPath();g.ellipse(15,17,134,79,0,0,TWO_PI);g.fill();
  g.fillStyle="#d8ccb5";[[-50,-2,41,28],[68,1,35,28],[14,43,35,18]].forEach(v=>{g.beginPath();g.ellipse(v[0],v[1],v[2],v[3],.2,0,TWO_PI);g.fill();});
  g.fillStyle="#15100d";[-82,-29,55,105].forEach(x=>g.fillRect(x,65,19,79));
  g.fillStyle="#9a8c72";g.beginPath();g.ellipse(-112,-39,58,51,-.1,0,TWO_PI);g.fill();
  g.strokeStyle="#d9bf88";g.lineWidth=12;g.beginPath();g.moveTo(-148,-64);g.lineTo(-181,-108);g.moveTo(-91,-72);g.lineTo(-61,-115);g.stroke();
  g.fillStyle="#ff4719";g.shadowColor="#ff2408";g.shadowBlur=18;g.beginPath();g.arc(-135,-48,7,0,TWO_PI);g.arc(-99,-50,7,0,TWO_PI);g.fill();g.shadowBlur=0;
});

images.warden=makeCanvas(430,520,(g,w,h)=>{
  g.translate(w/2,h*.55);g.shadowColor="#dc471d";g.shadowBlur=42;g.fillStyle="rgba(211,52,20,.25)";g.beginPath();g.ellipse(0,15,175,235,0,0,TWO_PI);g.fill();g.shadowBlur=0;
  g.fillStyle="#242321";g.fillRect(-115,-128,230,225);g.fillStyle="#4f352a";g.fillRect(-138,-89,46,241);g.fillRect(92,-89,46,241);
  g.fillStyle="#131515";g.beginPath();g.moveTo(-106,-134);g.lineTo(0,-213);g.lineTo(106,-134);g.lineTo(83,-40);g.lineTo(-83,-40);g.closePath();g.fill();
  g.strokeStyle="#b0783f";g.lineWidth=13;for(let x=-75;x<=75;x+=30){g.beginPath();g.moveTo(x,-123);g.lineTo(x+10,-61);g.stroke();}
  g.fillStyle="#ff5121";g.shadowColor="#ff2c0a";g.shadowBlur=25;g.beginPath();g.arc(-40,-110,12,0,TWO_PI);g.arc(40,-110,12,0,TWO_PI);g.fill();g.shadowBlur=0;
  g.fillStyle="#14100d";g.beginPath();g.arc(-73,102,66,0,TWO_PI);g.arc(73,102,66,0,TWO_PI);g.fill();g.strokeStyle="#7d482c";g.lineWidth=12;g.beginPath();g.arc(-73,102,43,0,TWO_PI);g.arc(73,102,43,0,TWO_PI);g.stroke();
  g.fillStyle="#b2391a";g.fillRect(-145,155,290,35);g.strokeStyle="#d98a45";g.lineWidth=10;for(let x=-137;x<140;x+=35){g.beginPath();g.moveTo(x,154);g.lineTo(x+23,211);g.stroke();}
});

images.key=makeCanvas(220,150,(g,w,h)=>{
  g.translate(26,18);g.strokeStyle="#f2b936";g.lineWidth=18;g.lineCap="round";g.shadowColor="#e2851c";g.shadowBlur=18;g.beginPath();g.arc(47,55,35,0,TWO_PI);g.moveTo(81,55);g.lineTo(177,55);g.lineTo(177,89);g.moveTo(142,55);g.lineTo(142,82);g.stroke();g.shadowBlur=0;
});

images.switch=makeCanvas(200,250,(g,w,h)=>{
  g.fillStyle="#302c28";g.fillRect(25,25,150,200);g.strokeStyle="#8c6e4d";g.lineWidth=8;g.strokeRect(25,25,150,200);g.fillStyle="#9b1d12";g.fillRect(57,52,86,72);g.fillStyle="#e17828";g.fillRect(72,67,56,42);g.strokeStyle="#d6b171";g.lineWidth=13;g.beginPath();g.moveTo(99,150);g.lineTo(133,203);g.stroke();
});

images.driverPickup=makeCanvas(320,180,(g,w,h)=>{
  g.translate(16,20);g.fillStyle="#34312d";g.fillRect(55,36,214,73);g.fillStyle="#8f3d1e";g.fillRect(78,19,118,27);g.fillStyle="#171817";g.fillRect(18,55,65,36);g.fillStyle="#64503b";g.fillRect(186,102,36,52);g.strokeStyle="#d18437";g.lineWidth=7;g.strokeRect(55,36,214,73);
});

images.driver=makeCanvas(900,500,(g,w,h)=>{
  g.translate(w/2,h);g.fillStyle="#2d211b";g.beginPath();g.moveTo(-390,0);g.lineTo(-250,-180);g.lineTo(-130,-130);g.lineTo(-170,0);g.closePath();g.fill();g.beginPath();g.moveTo(390,0);g.lineTo(250,-180);g.lineTo(130,-130);g.lineTo(170,0);g.closePath();g.fill();
  g.fillStyle="#393936";g.fillRect(-135,-395,270,325);g.fillStyle="#171919";g.fillRect(-69,-470,138,255);g.fillStyle="#8d3b1d";g.fillRect(-115,-350,230,55);g.fillStyle="#c87631";g.fillRect(-15,-486,30,150);g.strokeStyle="#8e7658";g.lineWidth=13;g.strokeRect(-135,-395,270,325);
});

images.shells=makeCanvas(170,170,(g,w,h)=>{g.translate(w/2,h/2);g.rotate(-.15);g.fillStyle="#a51e14";g.fillRect(-48,-60,39,120);g.fillRect(12,-60,39,120);g.fillStyle="#d4a54a";g.fillRect(-48,42,39,18);g.fillRect(12,42,39,18);});
images.spikes=makeCanvas(180,180,(g,w,h)=>{g.translate(w/2,h/2);g.fillStyle="#795130";g.fillRect(-67,-54,134,108);g.strokeStyle="#d8a654";g.lineWidth=7;g.strokeRect(-67,-54,134,108);g.strokeStyle="#30231a";g.lineWidth=10;for(let y=-31;y<=31;y+=31){g.beginPath();g.moveTo(-47,y);g.lineTo(47,y);g.stroke();}});
images.medkit=makeCanvas(180,180,(g,w,h)=>{g.fillStyle="#d8cdb9";g.fillRect(25,39,130,116);g.fillStyle="#9c1c13";g.fillRect(72,55,36,86);g.fillRect(47,80,86,36);g.strokeStyle="#30231c";g.lineWidth=8;g.strokeRect(25,39,130,116);});
images.gate=makeCanvas(380,500,(g,w,h)=>{const z=g.createRadialGradient(w/2,h*.5,12,w/2,h*.5,190);z.addColorStop(0,"#efe4bb");z.addColorStop(.16,"#ef7528");z.addColorStop(.48,"#802118");z.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=z;g.fillRect(0,0,w,h);g.strokeStyle="#272421";g.lineWidth=34;g.beginPath();g.moveTo(45,465);g.lineTo(53,170);g.quadraticCurveTo(190,-20,327,170);g.lineTo(335,465);g.stroke();g.strokeStyle="#d05525";g.lineWidth=8;g.setLineDash([20,13]);g.beginPath();g.moveTo(75,448);g.lineTo(80,188);g.quadraticCurveTo(190,35,300,188);g.lineTo(305,448);g.stroke();});
images.fireball=makeCanvas(100,100,(g,w,h)=>{const z=g.createRadialGradient(50,50,2,50,50,48);z.addColorStop(0,"#fff6c6");z.addColorStop(.2,"#ffb12e");z.addColorStop(.55,"#d72c0d");z.addColorStop(1,"rgba(110,0,0,0)");g.fillStyle=z;g.fillRect(0,0,w,h);});

const enemyData={
  gourd:{hp:75,speed:.72,damage:10,scale:.78},
  scarecrow:{hp:112,speed:.56,damage:15,scale:1.12},
  heifer:{hp:154,speed:.48,damage:20,scale:1.02}
};

const enemySeeds=[
  [5.2,13.2,"gourd"],[8.8,15.5,"scarecrow"],[14.3,8.4,"gourd"],[18.4,8.1,"scarecrow"],[14.2,20.3,"heifer"],[20.1,20.6,"gourd"],
  [15.6,13.1,"gourd"],[20.2,16.8,"scarecrow"],[25.3,6.3,"scarecrow"],[26.4,11.3,"gourd"],[31.3,6.3,"heifer"],[35.1,7.1,"scarecrow"],
  [33.4,11.2,"gourd"],[25.2,18.2,"gourd"],[27.1,22.5,"scarecrow"],[25.2,26.1,"heifer"],[28.7,18.3,"gourd"],[32.2,18.3,"scarecrow"],
  [35.5,18.6,"heifer"],[33.1,25.2,"gourd"],[36.2,26.2,"scarecrow"],[34.9,20.4,"gourd"]
];

function setTile(x,y,v){if(x>=0&&y>=0&&x<MW&&y<MH)grid[y][x]=v;}
function line(x1,y1,x2,y2,v){if(x1===x2){for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)setTile(x1,y,v);}else{for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)setTile(x,y1,v);}}
function box(x1,y1,x2,y2,v){line(x1,y1,x2,y1,v);line(x1,y2,x2,y2,v);line(x1,y1,x1,y2,v);line(x2,y1,x2,y2,v);}

function buildMap(){
  grid=Array.from({length:MH},()=>Array(MW).fill(0));
  box(0,0,MW-1,MH-1,1);
  box(1,10,7,20,3); setTile(7,15,0);
  line(7,12,11,12,3);line(7,18,11,18,3);setTile(7,15,0);setTile(11,15,0);
  box(11,5,22,24,1);setTile(11,15,0);setTile(22,8,0);setTile(22,20,0);
  box(22,3,38,13,2);setTile(22,8,0);
  line(28,3,28,10,2);setTile(28,6,0);line(28,10,38,10,2);setTile(33,10,0);
  box(22,16,38,28,2);setTile(22,20,0);line(30,16,30,28,2);setTile(30,20,0);
  box(1,6,6,10,1);setTile(3,10,0);
  box(13,1,19,5,1);setTile(16,5,0);
  box(15,24,21,28,3);setTile(18,24,0);
  // Machinery islands and cover.
  line(15,9,17,9,3);line(18,20,20,20,3);line(24,8,26,8,2);line(34,4,36,4,2);line(24,23,25,23,3);line(33,22,34,22,2);
  doors=[
    {id:"tractor",x:22,y:20,type:"key",open:0,target:0},
    {id:"bulkhead",x:30,y:20,type:"switch",open:0,target:0},
    {id:"secret-a",x:3,y:10,type:"secret",open:0,target:0,found:false},
    {id:"secret-b",x:16,y:5,type:"secret",open:0,target:0,found:false},
    {id:"secret-c",x:18,y:24,type:"secret",open:0,target:0,found:false}
  ];
}

function doorAt(tx,ty){return doors.find(d=>d.x===tx&&d.y===ty);}
function wallAt(x,y){
  const tx=Math.floor(x),ty=Math.floor(y);if(tx<0||ty<0||tx>=MW||ty>=MH)return 1;
  const d=doorAt(tx,ty);if(d&&d.open<.92)return d.type==="secret"?5:4;
  return grid[ty][tx];
}

function floorType(x,y){
  x=Math.floor(x);y=Math.floor(y);
  if(x>=12&&x<=21&&y>=12&&y<=18&&y!==15)return "water";
  if(x>=31&&y>=17)return "lower";
  if(x>=22&&y<=13)return "metal";
  return "dirt";
}

function resetGame(){
  buildMap();Object.assign(player,{x:3.5,y:15.5,dir:0,health:100,weapon:"shotgun",shells:16,spikes:0,hasDriver:false,hasKey:false,fireCooldown:0,hurtCooldown:0,bob:0,onWater:false,elevation:0});
  enemies=enemySeeds.map(([x,y,type],id)=>({id,x,y,type,hp:enemyData[type].hp,alive:true,awake:false,attackCooldown:Math.random(),pain:0,phase:Math.random()*TWO_PI}));
  pickups=[
    {x:16.4,y:18.4,type:"driver",active:true},{x:5,y:8,type:"medkit",active:true},{x:16,y:3,type:"spikes",active:true},
    {x:18,y:26,type:"shells",active:true},{x:13.5,y:22,type:"shells",active:true},{x:25.5,y:12,type:"medkit",active:true},
    {x:34.5,y:5.8,type:"key",active:true},{x:27,y:17.7,type:"spikes",active:true},{x:36,y:12,type:"shells",active:true}
  ];
  projectiles=[];boss={x:35,y:23.8,hp:900,maxHp:900,alive:true,active:false,attackCooldown:1.2,pain:0,phase:0};gate={x:36.6,y:25.9,active:false};
  levelState={enteredCourtyard:false,keyDoor:false,switchOn:false,lower:false,gateOpen:false};
  stats={kills:0,secrets:0,shots:0,hits:0,started:performance.now(),won:false};dialogueTimer=0;screenShake=0;weaponKick=0;muzzle=0;
  ui.water.classList.remove("active");ui.prompt.classList.add("hidden");updateHUD();
}

function normalize(a){while(a>Math.PI)a-=TWO_PI;while(a< -Math.PI)a+=TWO_PI;return a;}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function clearPath(ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy);for(let d=.12;d<l;d+=.12)if(wallAt(ax+dx*d/l,ay+dy*d/l))return false;return true;}
function castRay(angle){const c=Math.cos(angle),s=Math.sin(angle);for(let d=.02;d<34;d+=.025){const x=player.x+c*d,y=player.y+s*d,w=wallAt(x,y);if(w)return{dist:d,wall:w,x,y};}return{dist:34,wall:0,x:player.x+c*34,y:player.y+s*34};}
function collides(x,y,r=.22){return wallAt(x-r,y-r)||wallAt(x+r,y-r)||wallAt(x-r,y+r)||wallAt(x+r,y+r);}
function moveEntity(e,dx,dy,r=.24){if(!collides(e.x+dx,e.y,r))e.x+=dx;if(!collides(e.x,e.y+dy,r))e.y+=dy;}

function showOnly(el){[ui.title,ui.game,ui.end].forEach(x=>x.classList.remove("active"));el.classList.add("active");}
function say(text,duration=2600){ui.dialogueText.textContent=text;ui.dialogue.classList.remove("hidden");dialogueTimer=duration/1000;}

function beginGame(){resetGame();mode="playing";ui.briefing.classList.add("hidden");ui.pause.classList.add("hidden");showOnly(ui.game);ensureAudio();startMusic();say("Ah hell. It’s got a basement.",3000);canvas.focus();}
function pause(force){if(mode!=="playing"&&mode!=="paused")return;const p=force??mode==="playing";mode=p?"paused":"playing";ui.pause.classList.toggle("hidden",!p);if(p){document.exitPointerLock?.();if(music)music.volume=muted?0:.16;}else{if(music)music.volume=muted?0:.48;canvas.focus();}}

function updateObjective(){
  if(!levelState.enteredCourtyard)ui.objective.textContent="BREACH THE PROCESSING COURTYARD";
  else if(!player.hasKey)ui.objective.textContent="RECOVER THE BRASS TRACTOR KEY";
  else if(!levelState.keyDoor)ui.objective.textContent="UNLOCK THE FREIGHT WING";
  else if(!levelState.switchOn)ui.objective.textContent="RESTORE THE FREIGHT ELEVATOR";
  else if(!boss.active)ui.objective.textContent="DESCEND TO THE HAYGATE";
  else if(boss.alive)ui.objective.textContent="DESTROY THE GATE WARDEN";
  else ui.objective.textContent="ENTER THE HAYGATE AND SEAL IT";
}

function updateHUD(){
  ui.health.textContent=Math.max(0,Math.ceil(player.health));ui.healthBar.style.width=`${Math.max(0,player.health)}%`;
  const driver=player.weapon==="driver";ui.weapon.textContent=driver?"FENCEPOST DRIVER":"DOUBLE BARREL";ui.ammo.textContent=driver?player.spikes:player.shells;ui.ammoName.textContent=driver?"IRON SPIKES":"SHELLS";
  ui.kills.textContent=`${stats.kills} / 22`;ui.secrets.textContent=`${stats.secrets} / 3`;ui.key.classList.toggle("owned",player.hasKey);ui.key.querySelector("strong").textContent=player.hasKey?"ACQUIRED":"—";
  ui.bossHealth.style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;ui.bossBar.classList.toggle("hidden",!boss.active||!boss.alive);
  $$("#weapon-switch span").forEach((el,i)=>el.classList.toggle("active",i===(driver?1:0)));
  updateObjective();
}

function ensureAudio(){if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==="suspended")audioContext.resume();}
function tone(freq,duration,type="square",volume=.08,end=freq){if(muted||!audioContext)return;const n=audioContext.currentTime,o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(freq,n);o.frequency.exponentialRampToValueAtTime(Math.max(1,end),n+duration);g.gain.setValueAtTime(volume,n);g.gain.exponentialRampToValueAtTime(.0001,n+duration);o.connect(g).connect(audioContext.destination);o.start(n);o.stop(n+duration);}
function noise(duration=.12,volume=.1){if(muted||!audioContext)return;const n=Math.floor(audioContext.sampleRate*duration),b=audioContext.createBuffer(1,n,audioContext.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=audioContext.createBufferSource(),g=audioContext.createGain();s.buffer=b;g.gain.value=volume;s.connect(g).connect(audioContext.destination);s.start();}
function sfx(n){if(n==="shot"){tone(110,.24,"sawtooth",.16,35);noise(.18,.2);}if(n==="driver"){tone(180,.1,"square",.09,62);noise(.06,.08);}if(n==="hit")tone(210,.08,"square",.06,85);if(n==="hurt"){tone(72,.28,"sawtooth",.12,31);noise(.1,.08);}if(n==="pickup"){tone(330,.08,"square",.06,480);setTimeout(()=>tone(620,.12,"square",.05,760),60);}if(n==="door")tone(78,.7,"sawtooth",.09,42);if(n==="secret"){tone(220,.12,"square",.06,440);setTimeout(()=>tone(660,.18,"square",.05,880),110);}if(n==="boss"){tone(43,1.2,"sawtooth",.16,25);noise(.8,.05);}if(n==="gate"){tone(82,1.2,"sine",.1,510);tone(37,1.5,"sawtooth",.07,30);}}
function startMusic(){stopMusic();const a=document.createElement("audio"),ext=a.canPlayType('audio/mp4; codecs="mp4a.40.2"')?"m4a":"ogg";musicPart=0;music=new Audio(`audio/megalo-0${musicPart}.${ext}`);music.volume=muted?0:.48;music.preload="auto";music.addEventListener("ended",()=>{if(mode==="playing"||mode==="paused"){musicPart=(musicPart+1)%3;music.src=`audio/megalo-0${musicPart}.${ext}`;music.play().catch(()=>{});}});music.play().catch(()=>{});}
function stopMusic(){if(music){music.pause();music.removeAttribute("src");music=null;}}
function toggleSound(){muted=!muted;ui.sound.textContent=muted?"SOUND: OFF":"SOUND: ON";if(music)music.volume=muted?0:(mode==="paused"?.16:.48);}

function ammo(){return player.weapon==="driver"?player.spikes:player.shells;}
function switchWeapon(which){if(which==="driver"&&!player.hasDriver){say("Need a faster fencepost driver.",1400);return;}player.weapon=which;updateHUD();tone(which==="driver"?260:120,.09,"square",.04,which==="driver"?340:85);}

function shoot(){
  if(mode!=="playing"||player.fireCooldown>0)return;ensureAudio();
  if(ammo()<=0){player.fireCooldown=.28;tone(75,.08,"square",.05,65);say("Ah hell. Empty.",1100);return;}
  const driver=player.weapon==="driver";if(driver)player.spikes--;else player.shells--;stats.shots++;player.fireCooldown=driver?.115:.56;weaponKick=1;muzzle=1;screenShake=driver?.18:.48;sfx(driver?"driver":"shot");
  const targets=enemies.filter(e=>e.alive);if(boss.active&&boss.alive)targets.push(boss);const wall=castRay(player.dir).dist;let target=null,nearest=Infinity;
  for(const e of targets){const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy),diff=Math.abs(normalize(Math.atan2(dy,dx)-player.dir)),r=e===boss?.72:.38;if(d<nearest&&d<wall+.15&&diff<Math.atan2(r,d)+(driver?.018:.035)&&clearPath(player.x,player.y,e.x,e.y)){target=e;nearest=d;}}
  if(target){stats.hits++;const damage=driver?21+Math.random()*10:62+Math.random()*29;target.hp-=damage;target.pain=.2;sfx("hit");if(target.hp<=0)killTarget(target);}
  updateHUD();
}

function killTarget(target){
  target.alive=false;screenShake=1;
  if(target===boss){gate.active=true;sfx("gate");say("I’m like you. I shut the equipment down when I’m done.",4000);updateHUD();return;}
  stats.kills++;if(stats.kills%4===0)pickups.push({x:target.x,y:target.y,type:Math.random()>.45?"shells":"spikes",active:true});
  if(stats.kills===1)say("I’m like you. I don’t enjoy night shift.",3000);else if(stats.kills===8)say("Ah hell. This facility has management.",3000);else if(stats.kills===16)say("I’m like you. I believe in finishing a job.",3200);updateHUD();
}

function hurt(amount){if(player.hurtCooldown>0||mode!=="playing")return;player.health-=amount;player.hurtCooldown=.52;screenShake=.85;sfx("hurt");ui.damage.classList.add("hit");setTimeout(()=>ui.damage.classList.remove("hit"),130);updateHUD();if(player.health<=0)setTimeout(()=>endGame(false),350);}

function interactable(){
  for(let d=.25;d<1.55;d+=.12){const tx=Math.floor(player.x+Math.cos(player.dir)*d),ty=Math.floor(player.y+Math.sin(player.dir)*d),door=doorAt(tx,ty);if(door&&door.open<.92)return{kind:"door",item:door};}
  if(!levelState.switchOn&&Math.hypot(player.x-27.2,player.y-25.6)<1.6)return{kind:"switch"};
  if(Math.hypot(player.x-gate.x,player.y-gate.y)<1.5)return{kind:"gate"};
  return null;
}

function use(){
  if(mode!=="playing")return;const it=interactable();if(!it){tone(55,.06,"square",.025,50);return;}
  if(it.kind==="switch"){
    levelState.switchOn=true;doors.find(d=>d.id==="bulkhead").target=1;sfx("door");say("Freight lift has power. Ah hell, so does everything else.",3500);updateHUD();return;
  }
  if(it.kind==="gate"){
    if(boss.alive)say("Something large is keeping that gate open.",2000);else endGame(true);return;
  }
  const d=it.item;
  if(d.type==="secret"){
    d.target=1;if(!d.found){d.found=true;stats.secrets++;sfx("secret");say(stats.secrets===1?"I’m like you. I check behind suspicious walls.":"SECRET FOUND",2200);updateHUD();}return;
  }
  if(d.type==="key"){
    if(!player.hasKey){say("Needs the brass tractor key.",1800);tone(64,.1,"square",.04,56);return;}
    d.target=1;levelState.keyDoor=true;sfx("door");say("Same key as the old Massey. Of course.",2400);updateHUD();return;
  }
  if(d.type==="switch"){
    if(!levelState.switchOn){say("Freight elevator has no power.",1800);return;}d.target=1;sfx("door");
  }
}

function updateDoors(dt){for(const d of doors){const speed=d.type==="secret"?.75:1.05;d.open+=Math.sign(d.target-d.open)*Math.min(Math.abs(d.target-d.open),speed*dt);}}

function updatePlayer(dt){
  let f=0,s=0;if(keys.KeyW||keys.ArrowUp||keys.forward)f++;if(keys.KeyS||keys.ArrowDown||keys.back)f--;if(keys.KeyA)s--;if(keys.KeyD)s++;
  if(keys.ArrowLeft||keys.left)player.dir-=1.72*dt;if(keys.ArrowRight||keys.right)player.dir+=1.72*dt;player.dir=normalize(player.dir);
  player.onWater=floorType(player.x,player.y)==="water";ui.water.classList.toggle("active",player.onWater);
  if(f||s){const speed=(player.onWater?1.45:(keys.ShiftLeft?3.2:2.55))*dt/Math.hypot(f,s);moveEntity(player,(Math.cos(player.dir)*f+Math.cos(player.dir+Math.PI/2)*s)*speed,(Math.sin(player.dir)*f+Math.sin(player.dir+Math.PI/2)*s)*speed,.23);player.bob+=dt*(player.onWater?6:11);}
  player.fireCooldown=Math.max(0,player.fireCooldown-dt);player.hurtCooldown=Math.max(0,player.hurtCooldown-dt);weaponKick=Math.max(0,weaponKick-dt*(player.weapon==="driver"?8:4.5));muzzle=Math.max(0,muzzle-dt*9);screenShake=Math.max(0,screenShake-dt*4.7);
  const active=interactable();ui.prompt.classList.toggle("hidden",!active);if(active)ui.prompt.textContent=active.kind==="switch"?"E · THROW POWER LEVER":active.kind==="gate"?"E · ENTER HAYGATE":"E · OPEN / USE";
  if(!levelState.enteredCourtyard&&player.x>11.5){levelState.enteredCourtyard=true;say("I’m like you. I’ve seen worse irrigation.",2800);updateHUD();}
  if(!levelState.lower&&player.x>30.8&&player.y>16){levelState.lower=true;player.elevation=1;say("Sublevel six. Farm only has two floors.",2600);if(!boss.active){boss.active=true;sfx("boss");screenShake=1.3;updateHUD();}}
}

function updatePickups(){
  for(const p of pickups){if(!p.active||dist(p,player)>.62)continue;p.active=false;sfx("pickup");
    if(p.type==="key"){player.hasKey=true;say("Brass tractor key acquired.",2500);}
    if(p.type==="driver"){player.hasDriver=true;player.weapon="driver";player.spikes+=80;say("Fencepost driver. I’m like you. I improvise.",3200);}
    if(p.type==="shells")player.shells=Math.min(40,player.shells+8);
    if(p.type==="spikes")player.spikes=Math.min(180,player.spikes+45);
    if(p.type==="medkit")player.health=Math.min(100,player.health+35);updateHUD();
  }
  if(!boss.alive&&dist(gate,player)<.74)endGame(true);
}

function updateEnemies(dt){
  for(const e of enemies){if(!e.alive)continue;e.pain=Math.max(0,e.pain-dt);e.attackCooldown-=dt;e.phase+=dt*2;const d=dist(e,player);if(d<10&&clearPath(e.x,e.y,player.x,player.y))e.awake=true;if(!e.awake)continue;
    if(d>.8){const step=enemyData[e.type].speed*dt;moveEntity(e,(player.x-e.x)/d*step,(player.y-e.y)/d*step,.28);}else if(e.attackCooldown<=0){hurt(enemyData[e.type].damage);e.attackCooldown=1+Math.random()*.55;}
  }
  if(boss.active&&boss.alive){boss.pain=Math.max(0,boss.pain-dt);boss.phase+=dt;boss.attackCooldown-=dt;const d=dist(boss,player);if(d>2.4){const step=.38*dt;moveEntity(boss,(player.x-boss.x)/d*step,(player.y-boss.y)/d*step,.62);}if(boss.attackCooldown<=0&&clearPath(boss.x,boss.y,player.x,player.y)){const a=Math.atan2(player.y-boss.y,player.x-boss.x);projectiles.push({x:boss.x,y:boss.y,vx:Math.cos(a)*3.4,vy:Math.sin(a)*3.4,life:4,phase:0});boss.attackCooldown=1.15;tone(51,.34,"sawtooth",.09,29);}}
}

function updateProjectiles(dt){for(const p of projectiles){if(p.life<=0)continue;p.life-=dt;p.phase+=dt*8;p.x+=p.vx*dt;p.y+=p.vy*dt;if(wallAt(p.x,p.y))p.life=0;else if(dist(p,player)<.42){p.life=0;hurt(18);}}projectiles=projectiles.filter(p=>p.life>0);}

function update(dt){if(mode!=="playing")return;if(dialogueTimer>0){dialogueTimer-=dt;if(dialogueTimer<=0)ui.dialogue.classList.add("hidden");}updateDoors(dt);updatePlayer(dt);updatePickups();updateEnemies(dt);updateProjectiles(dt);if((keys.fire||keys.Space)&&player.weapon==="driver")shoot();}

function render(){if(mode!=="playing"&&mode!=="paused")return;const sx=(Math.random()-.5)*screenShake*8,sy=(Math.random()-.5)*screenShake*6;ctx.save();ctx.translate(sx,sy);
  const lower=player.elevation>0;const sky=ctx.createLinearGradient(0,0,0,H*.52);sky.addColorStop(0,lower?"#080b0b":"#13100f");sky.addColorStop(1,lower?"#4a1b16":"#765233");ctx.fillStyle=sky;ctx.fillRect(-10,-10,W+20,H*.54+10);
  const floor=ctx.createLinearGradient(0,H*.48,0,H);floor.addColorStop(0,player.onWater?"#324e3c":lower?"#382019":"#3e3022");floor.addColorStop(1,"#050606");ctx.fillStyle=floor;ctx.fillRect(-10,H*.48,W+20,H*.55);
  ctx.fillStyle=lower?"rgba(227,65,24,.55)":"rgba(224,142,66,.32)";for(let i=0;i<28;i++){const x=((i*191+performance.now()*.01*(i%3+1)-player.dir*120)%W+W)%W,y=18+((i*71-performance.now()*.007*(i%4+1))%(H*.38)+H*.38)%(H*.38);ctx.globalAlpha=.15+(i%4)*.1;ctx.fillRect(x,y,2,2);}ctx.globalAlpha=1;
  const depth=new Array(RAYS);for(let i=0;i<RAYS;i++){const a=player.dir-FOV/2+i/RAYS*FOV,h=castRay(a),d=h.dist*Math.cos(a-player.dir);depth[i]=d;const wh=Math.min(H*1.7,H*.86/Math.max(.04,d)),top=H*.5-wh*.5,shade=Math.max(.14,1-d/24);let base=h.wall===1?[82,76,66]:h.wall===2?[63,69,66]:h.wall===3?[84,57,37]:h.wall===4?[83,61,42]:[91,74,54];const frac=Math.abs((h.x%1)-(h.y%1)),seam=Math.floor(frac*9)%2?1:.7;ctx.fillStyle=`rgb(${Math.floor(base[0]*shade*seam+45/(d+2))},${Math.floor(base[1]*shade*seam)},${Math.floor(base[2]*shade*seam)})`;ctx.fillRect(i*RAY_W,top,RAY_W+1,wh);if(h.wall===4&&i%9<2){ctx.fillStyle=`rgba(211,108,48,${.16*shade})`;ctx.fillRect(i*RAY_W,top,RAY_W,wh);}if(h.wall===5&&i%13<2){ctx.fillStyle=`rgba(240,192,115,${.11*shade})`;ctx.fillRect(i*RAY_W,top,RAY_W,wh);}}
  const sprites=[];enemies.filter(e=>e.alive).forEach(e=>sprites.push({e,img:images[e.type],scale:enemyData[e.type].scale,bob:Math.sin(e.phase)*.03,tint:e.pain>0}));
  pickups.filter(p=>p.active).forEach(p=>sprites.push({e:p,img:p.type==="driver"?images.driverPickup:images[p.type],scale:p.type==="driver"?.55:.42,bob:Math.sin(performance.now()/280+p.x)*.065}));
  if(!levelState.switchOn)sprites.push({e:{x:27.2,y:25.6},img:images.switch,scale:.66,bob:0});
  if(boss.active&&boss.alive)sprites.push({e:boss,img:images.warden,scale:1.62,bob:0,tint:boss.pain>0});
  sprites.push({e:gate,img:images.gate,scale:1.42,bob:0});projectiles.forEach(p=>sprites.push({e:p,img:images.fireball,scale:.36,bob:Math.sin(p.phase)*.1}));
  sprites.sort((a,b)=>dist(b.e,player)-dist(a.e,player));sprites.forEach(s=>drawBillboard(s,depth));drawWeapon();ctx.restore();
}

function drawBillboard(o,depth){const {e,img,scale,bob=0,tint=false}=o;if(!img||!img.width)return;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy),rel=normalize(Math.atan2(dy,dx)-player.dir);if(Math.abs(rel)>FOV*.73||d>33)return;const px=W/2+Math.tan(rel)*(W/2)/Math.tan(FOV/2),size=H/d*scale,dw=size*(img.width/img.height),left=px-dw/2,top=H*.5-size*.57+bob*size;ctx.save();if(tint){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=.78;}for(let x=Math.max(0,Math.floor(left));x<Math.min(W,Math.ceil(left+dw));x+=2){const r=Math.max(0,Math.min(RAYS-1,Math.floor(x/RAY_W)));if(d>depth[r]+.38)continue;const src=Math.max(0,Math.min(img.width-1,Math.floor((x-left)/dw*img.width)));ctx.drawImage(img,src,0,Math.min(2,img.width-src),img.height,x,top,2,size);}ctx.restore();}

function drawWeapon(){const driver=player.weapon==="driver",img=driver?images.driver:images.shotgun;if(!img||!img.width)return;const bx=Math.sin(player.bob)*6,by=Math.abs(Math.cos(player.bob))*4,kick=weaponKick*(driver?28:58),width=driver?W*.58:W*.62,height=width/img.width*img.height;ctx.drawImage(img,W/2-width/2+bx,H-height+16+by+kick,width,height);if(muzzle>0){const x=W/2+bx,y=H-height*(driver?.85:.76)+kick,z=ctx.createRadialGradient(x,y,2,x,y,(driver?45:85)*muzzle);z.addColorStop(0,"rgba(255,255,220,.96)");z.addColorStop(.25,"rgba(255,169,42,.84)");z.addColorStop(1,"rgba(255,50,0,0)");ctx.fillStyle=z;ctx.fillRect(x-100,y-100,200,200);}}

function endGame(won){if(mode==="ended")return;mode="ended";document.exitPointerLock?.();const sec=Math.max(1,Math.round((performance.now()-stats.started)/1000)),acc=stats.shots?Math.round(stats.hits/stats.shots*100):0;if(won){ui.endEyebrow.textContent="E1 COMPLETE · COW SEVEN RECOVERED";ui.endTitle.textContent="THE HAYGATE IS SILENT";ui.endText.textContent="At 4:06 AM, the irrigation ran clear. At 4:07, Phipps fed the herd. Beneath the barn, something ancient decided to remain very quiet.";}else{ui.endEyebrow.textContent="AGRICULTURAL INCIDENT 666-B";ui.endTitle.textContent="AH HELL.";ui.endText.textContent="Phipps has temporarily died beneath his own milking shed. This will be reflected in the morning safety report.";}ui.endStats.textContent=`${sec}s · ${stats.kills}/22 CLEANSED · ${stats.secrets}/3 SECRETS · ${acc}% ACCURACY`;showOnly(ui.end);if(music)music.volume=muted?0:.22;}

function loop(now){const dt=Math.min(.04,(now-lastFrame)/1000);lastFrame=now;update(dt);render();requestAnimationFrame(loop);}

$("#start-button").addEventListener("click",beginGame);$("#briefing-start").addEventListener("click",beginGame);$("#briefing-button").addEventListener("click",()=>ui.briefing.classList.remove("hidden"));$(".modal-close").addEventListener("click",()=>ui.briefing.classList.add("hidden"));
$("#pause-button").addEventListener("click",()=>pause(true));$("#resume-button").addEventListener("click",()=>pause(false));$("#restart-button").addEventListener("click",beginGame);$("#end-restart").addEventListener("click",beginGame);ui.sound.addEventListener("click",toggleSound);
window.addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if((e.code==="Space")&&!e.repeat)shoot();if(e.code==="KeyE"&&!e.repeat)use();if(e.code==="Digit1")switchWeapon("shotgun");if(e.code==="Digit2")switchWeapon("driver");if(e.code==="Escape"&&mode==="playing")pause(true);else if(e.code==="Escape"&&mode==="paused")pause(false);});
window.addEventListener("keyup",e=>{keys[e.code]=false;});canvas.addEventListener("mousedown",e=>{if(mode!=="playing")return;if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();if(e.button===0){keys.fire=true;shoot();}});window.addEventListener("mouseup",e=>{if(e.button===0)keys.fire=false;});document.addEventListener("mousemove",e=>{if(mode==="playing"&&document.pointerLockElement===canvas)player.dir=normalize(player.dir+e.movementX*.00235);});
$$('[data-control]').forEach(b=>{const c=b.dataset.control,down=e=>{e.preventDefault();keys[c]=true;},up=e=>{e.preventDefault();keys[c]=false;};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("pointerleave",up);});
$("#touch-fire").addEventListener("pointerdown",e=>{e.preventDefault();keys.fire=true;shoot();});$("#touch-fire").addEventListener("pointerup",()=>keys.fire=false);$("#touch-use").addEventListener("pointerdown",e=>{e.preventDefault();use();});$("#touch-switch").addEventListener("pointerdown",e=>{e.preventDefault();switchWeapon(player.weapon==="shotgun"?"driver":"shotgun");});
window.addEventListener("blur",()=>{Object.keys(keys).forEach(k=>keys[k]=false);if(mode==="playing")pause(true);});

resetGame();requestAnimationFrame(loop);
