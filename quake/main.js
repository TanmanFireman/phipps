import { loadGameData } from "./getgame.js";

const titleScreen = document.querySelector("#titleScreen");
const loadingScreen = document.querySelector("#loadingScreen");
const gameShell = document.querySelector("#gameShell");
const errorScreen = document.querySelector("#errorScreen");
const startButton = document.querySelector("#startButton");
const retryButton = document.querySelector("#retryButton");
const musicButton = document.querySelector("#musicButton");
const gameMusicButton = document.querySelector("#gameMusicButton");
const statusLabel = document.querySelector("#statusLabel");
const statusDetail = document.querySelector("#statusDetail");
const progressBar = document.querySelector("#progressBar");
const errorMessage = document.querySelector("#errorMessage");
const canvas = document.querySelector("#canvas");
const output = document.querySelector("#output");
const exportFile = document.querySelector("#exportFile");
const music = document.querySelector("#music");

const tracks = [
  "../audio/megalo-00.ogg",
  "../audio/megalo-01.ogg",
  "../audio/megalo-02.ogg",
];
let trackIndex = 0;
let musicEnabled = true;
let pakDict = {};
let deliveryPromise;
let dependencyTotal = 0;
let dependencyDone = 0;
let dependencyLast = 0;

function showOnly(screen) {
  [titleScreen, loadingScreen, gameShell, errorScreen].forEach((item) => {
    item.hidden = item !== screen;
  });
}

function normalizeStatus(text) {
  return String(text || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function report(label, loaded = 0, total = null) {
  statusLabel.textContent = String(label).toUpperCase();
  if (total && Number.isFinite(total)) {
    const ratio = Math.max(0.03, Math.min(1, loaded / total));
    progressBar.style.width = `${ratio * 100}%`;
    const isBytes = total > 1024;
    statusDetail.textContent = isBytes
      ? `${(loaded / 1048576).toFixed(1)} MB / ${(total / 1048576).toFixed(1)} MB`
      : `${loaded} / ${total}`;
  } else {
    progressBar.style.width = "12%";
    statusDetail.textContent = "THE OLD MACHINERY IS MOVING";
  }
}

function appendConsole(text, isError = false) {
  const line = isError ? `(!) ${text}` : text;
  output.value += `${line}\n`;
  if (output.value.length > 1048576) output.value = output.value.slice(-524288);
  output.scrollTop = output.scrollHeight;
  (isError ? console.error : console.log)(text);
}

function playTrack(index) {
  trackIndex = (index + tracks.length) % tracks.length;
  music.src = tracks[trackIndex];
  music.volume = 0.34;
  if (musicEnabled) music.play().catch(() => {});
}

function updateMusicButtons() {
  musicButton.textContent = `MUSIC: ${musicEnabled ? "ON" : "OFF"}`;
  musicButton.setAttribute("aria-pressed", String(!musicEnabled));
  gameMusicButton.textContent = musicEnabled ? "♫" : "×";
  gameMusicButton.setAttribute("aria-label", musicEnabled ? "Mute music" : "Play music");
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled) music.play().catch(() => {});
  else music.pause();
  updateMusicButtons();
}

music.addEventListener("ended", () => playTrack(trackIndex + 1));
musicButton.addEventListener("click", toggleMusic);
gameMusicButton.addEventListener("click", toggleMusic);
playTrack(0);
music.pause();
updateMusicButtons();

async function ensureDelivery() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This build needs Service Worker support. Use a current desktop version of Chrome, Edge, Firefox, or Safari.");
  }
  const registration = await navigator.serviceWorker.register("./sw.js?v=8", { scope: "./" });
  await registration.update().catch(() => {});
  const pendingWorker = registration.installing || registration.waiting;
  if (pendingWorker && pendingWorker.state !== "activated") {
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The updated game loader did not activate.")), 10000);
      pendingWorker.addEventListener("statechange", () => {
        if (pendingWorker.state === "activated") {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    });
  }
  await navigator.serviceWorker.ready;

  if (!navigator.serviceWorker.controller || navigator.serviceWorker.controller.scriptURL !== registration.active?.scriptURL) {
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("The game loader did not take control. Refresh the page once and try again.")), 8000);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }
}

deliveryPromise = ensureDelivery();

function createModule() {
  dependencyTotal = 0;
  dependencyDone = 0;
  dependencyLast = 0;

  window.Module = {
    _canLockPointer: true,
    canvas,
    arguments: [
      "-game", "lq1",
      "-winsize", "960", "540",
      "+skill", "1",
      "+map", "phipps1",
      "+fov", "100",
      "+scr_conspeed", "720",
      "+name", "PHIPPS",
    ],
    print: (text) => appendConsole(text),
    printErr: (text) => appendConsole(text, true),
    setStatus(text) {
      const clean = normalizeStatus(text);
      if (!clean) return;
      const match = clean.match(/([^()]*)\((\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?|\?)\)/);
      if (match) {
        const total = match[3] === "?" ? null : Number(match[3]);
        report(match[1] || "Loading engine", Number(match[2]), total);
      } else {
        report(clean);
      }
    },
    monitorRunDependencies(left) {
      const difference = dependencyLast - left;
      if (difference > 0) dependencyDone += difference;
      else if (difference < 0) dependencyTotal -= difference;
      dependencyLast = left;
      report("Preparing engine dependencies", dependencyDone, Math.max(dependencyTotal, 1));
    },
    onRuntimeInitialized() {
      Object.entries(pakDict).forEach(([filename, bytes]) => {
        appendConsole(`Writing ${filename} to the Quake filesystem (${bytes.length} bytes)`);
        const file = window.FS.open(`/id1/${filename}`, "w");
        window.FS.write(file, bytes, 0, bytes.length, 0);
        window.FS.close(file);
      });
      this.hideConsole();
      report("Phippsgate is open", 1, 1);
    },
    hideConsole() {
      output.style.display = "none";
      canvas.style.display = "block";
      canvas.focus();
    },
    showConsole() {
      canvas.style.display = "none";
      output.style.display = "block";
      output.focus();
    },
    setGamma(value) {
      const gamma = Number(Number(value).toFixed(2));
      canvas.style.filter = `brightness(${(1.35 - gamma) * 2})`;
    },
    captureMouse() {
      if (document.pointerLockElement !== canvas) {
        appendConsole("Click the game view to capture the mouse.");
      }
    },
    exportFile(filePath) {
      try {
        const bytes = new Uint8Array(window.FS.readFile(filePath));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
        exportFile.href = url;
        exportFile.download = filePath.split("/").pop();
        exportFile.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        appendConsole(`Export failed: ${error.message}`, true);
      }
    },
  };
}

function loadEngineScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "runtime/qwasm-sw.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("The compiled Quake engine could not be loaded."));
    document.body.append(script);
  });
}

async function startGame() {
  startButton.disabled = true;
  if (musicEnabled) music.play().catch(() => {});
  showOnly(loadingScreen);
  report("Arming the Phippsgate loader");

  try {
    await deliveryPromise;
    pakDict = await loadGameData(report);
    createModule();
    report("Starting GPL Quake engine");
    showOnly(gameShell);
    await loadEngineScript();
  } catch (error) {
    console.error(error);
    errorMessage.textContent = error?.message || String(error);
    showOnly(errorScreen);
  }
}

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  canvas.focus();
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", () => window.location.reload());

window.addEventListener("unhandledrejection", (event) => {
  appendConsole(event.reason?.message || String(event.reason), true);
});
