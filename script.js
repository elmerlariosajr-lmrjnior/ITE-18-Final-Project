let timeLeft = 100;
const initialTime = 100;

let inventory = null; 
let running = false;
let timerId = null;

// Goals
const TOTAL_PIPES = 4;
const TOTAL_DEER = 4;
const TOTAL_TRASH = 12;

let trashSorted = 0;
let pipeFixedCount = 0;
let deerRescuedCount = 0;

function $(id) { return document.getElementById(id); }

// ---------- Sounds ----------
function playSound(id) {
  const el = document.querySelector(id);
  if (el && el.components && el.components.sound) el.components.sound.playSound();
}

// ---------- UI ----------
function setToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(setToast._tid);
  setToast._tid = setTimeout(() => (t.style.opacity = "0"), 1300);
}

function updateHUD() {
  const timeText = $("timeText");
  const invText = $("invText");

  if (timeText) timeText.textContent = timeLeft;

  if (invText) {
    invText.textContent = inventory
      ? (inventory.type === "trash"
          ? `Trash (${inventory.trashType})`
          : `Tool (${inventory.tool})`)
      : "None";
  }

  const bar = $("bar-fill");
  if (bar) {
    const pct = Math.max(0, Math.min(100, (timeLeft / initialTime) * 100));
    bar.style.width = `${pct}%`;
  }
}

function updateObjectiveText() {
  const obj = $("objectiveText");
  if (!obj) return;

  obj.textContent =
    `Objective: Sort trash (${trashSorted}/${TOTAL_TRASH}) • Fix pipes (${pipeFixedCount}/${TOTAL_PIPES}) • Rescue deer (${deerRescuedCount}/${TOTAL_DEER})`;
}

function isAllDone() {
  return (
    trashSorted >= TOTAL_TRASH &&
    pipeFixedCount >= TOTAL_PIPES &&
    deerRescuedCount >= TOTAL_DEER
  );
}

// ---------- End states ----------
function loseGame() {
  stopTimer();
  running = false;
  const hud = $("hud");
  if (hud) hud.style.display = "none";
  const lose = $("end-screen-lose");
  if (lose) lose.style.display = "block";
}

function winGame() {
  stopTimer();
  running = false;
  const hud = $("hud");
  if (hud) hud.style.display = "none";
  const win = $("end-screen-win");
  if (win) win.style.display = "block";
}

// ---------- Timer ----------
function startTimer() {
  if (timerId) return;

  timerId = setInterval(() => {
    if (!running) return;

    timeLeft--;
    updateHUD();

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHUD();
      loseGame();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

// =========================================================
// AUTO SCALE + SNAP TO GROUND (works for ANY GLB size)
// =========================================================
AFRAME.registerComponent("autoscale-to", {
  schema: { size: { type: "number", default: 1.2 } },
  init() {
    this.el.addEventListener("model-loaded", () => {
      const obj = this.el.getObject3D("mesh");
      if (!obj) return;

      const box = new THREE.Box3().setFromObject(obj);
      const s = new THREE.Vector3();
      box.getSize(s);

      const maxDim = Math.max(s.x, s.y, s.z);
      if (maxDim <= 0) return;

      const scale = this.data.size / maxDim;
      obj.scale.setScalar(scale);

      const box2 = new THREE.Box3().setFromObject(obj);
      const minY = box2.min.y;

      obj.position.y -= minY;
      obj.updateMatrixWorld(true);
    });
  }
});

// =========================================================
// REALISTIC GRASS (procedural texture)
// =========================================================
function makeGrassTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#4b6a3a";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random();
    if (r < 0.65) ctx.fillStyle = `rgba(60, 110, 55, ${0.10 + Math.random() * 0.20})`;
    else ctx.fillStyle = `rgba(90, 70, 40, ${0.05 + Math.random() * 0.18})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = 6 + Math.random() * 18;
    ctx.strokeStyle = `rgb(${30 + Math.random() * 20}, ${110 + Math.random() * 80}, ${25 + Math.random() * 20})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() * 2 - 1), y - h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return c.toDataURL("image/png");
}

// Apply ONLY grass texture
function applyGrassTexture() {
  const grassImg = document.getElementById("grassTex");
  const ground = document.getElementById("ground");

  if (!grassImg || !ground) return;

  grassImg.onload = () => {
    ground.setAttribute("material", "src: #grassTex; repeat: 60 60; roughness: 1; metalness: 0;");
  };

  grassImg.src = makeGrassTexture();
}

// =========================================================
// WORLD SPAWNERS
// =========================================================
function spawnTrees() {
  const env = $("env");
  if (!env) return;

  for (let i = 0; i < 70; i++) {
    const x = (Math.random() * 160) - 80;
    const z = (Math.random() * 160) - 95;
    if (Math.abs(x) < 14 && Math.abs(z + 10) < 14) continue;

    const tree = document.createElement("a-entity");
    tree.setAttribute("gltf-model", "assets/models/trees.glb");
    tree.setAttribute("position", `${x} 0 ${z}`);
    tree.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
    tree.setAttribute("autoscale-to", "size: 3.2");
    env.appendChild(tree);
  }
}

function spawnTrash() {
  const spawner = $("trashSpawner");
  if (!spawner) return;

  const trashTypes = [
    { type: "plastic", model: "assets/models/plastic_bottle.glb", size: 0.35 },
    { type: "metal",   model: "assets/models/soda_can.glb",      size: 0.25 },
    { type: "paper",   model: "assets/models/paper_sheet.glb",   size: 0.40 },
  ];

  const points = [];
  for (let i = 0; i < 4; i++) points.push([-28 + Math.random() * 16, 0, -26 + Math.random() * 14]);
  for (let i = 0; i < 4; i++) points.push([10 + Math.random() * 26, 0, -26 + Math.random() * 14]);
  for (let i = 0; i < 4; i++) points.push([-20 + Math.random() * 40, 0, -60 + Math.random() * 22]);

  for (let i = 0; i < TOTAL_TRASH; i++) {
    const t = trashTypes[i % trashTypes.length];
    const [x, y, z] = points[i];

    const item = document.createElement("a-entity");
    item.classList.add("clickable", "trash");
    item.setAttribute("data-type", t.type);
    item.setAttribute("gltf-model", t.model);
    item.setAttribute("position", `${x} ${y} ${z}`);
    item.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
    item.setAttribute("autoscale-to", `size: ${t.size}`);
    spawner.appendChild(item);
  }
}

function spawnPipes() {
  const scene = document.querySelector("a-scene");
  if (!scene) return;

  const pipePositions = [
    [20, 0, -12],
    [26, 0, -18],
    [15, 0, -20],
    [30, 0, -12],
  ];

  pipePositions.forEach((p, idx) => {
    const [x, y, z] = p;

    const pipe = document.createElement("a-entity");
    pipe.setAttribute("id", `pipe_${idx}`);
    pipe.setAttribute("gltf-model", "assets/models/pipe.glb");
    pipe.setAttribute("position", `${x} ${y} ${z}`);
    pipe.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
    pipe.setAttribute("autoscale-to", "size: 2.2");
    scene.appendChild(pipe);

    const leak = document.createElement("a-sphere");
    leak.setAttribute("id", `leak_${idx}`);
    leak.setAttribute("position", `${x + 1} 0.5 ${z}`);
    leak.setAttribute("radius", "0.18");
    leak.setAttribute("color", "#3fd3ff");
    scene.appendChild(leak);

    const repair = document.createElement("a-box");
    repair.classList.add("clickable", "repair-target");
    repair.setAttribute("data-repair-id", `${idx}`);
    repair.setAttribute("position", `${x + 1} 0.4 ${z}`);
    repair.setAttribute("width", "1");
    repair.setAttribute("height", "1");
    repair.setAttribute("depth", "1");
    repair.setAttribute("material", "transparent:true; opacity:0;");
    scene.appendChild(repair);
  });
}

function spawnDeer() {
  const scene = document.querySelector("a-scene");
  if (!scene) return;

  const deerPositions = [
    [0, 0, -40],
    [-12, 0, -55],
    [14, 0, -58],
    [22, 0, -42],
  ];

  deerPositions.forEach((p, idx) => {
    const [x, y, z] = p;

    const deer = document.createElement("a-entity");
    deer.setAttribute("id", `deer_${idx}`);
    deer.classList.add("clickable", "animal");
    deer.setAttribute("data-deer-id", `${idx}`);
    deer.setAttribute("gltf-model", "assets/models/deers.glb");
    deer.setAttribute("position", `${x} ${y} ${z}`);
    deer.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
    deer.setAttribute("autoscale-to", "size: 1.1");
    scene.appendChild(deer);
  });
}

// =========================================================
// Drop Item (Q)
// =========================================================
function getDropPoint(distance = 1.6) {
  const rig = document.querySelector("#rig");
  const cam = document.querySelector("#player");
  if (!rig || !cam) return { x: 0, y: 0.2, z: 0 };

  const rigPos = rig.object3D.position;
  const yaw = cam.object3D.rotation.y;

  return {
    x: rigPos.x + Math.sin(yaw) * distance,
    y: 0.15,
    z: rigPos.z - Math.cos(yaw) * distance
  };
}

function dropItem() {
  if (!inventory) return setToast("Nothing to drop.");

  const scene = document.querySelector("a-scene");
  if (!scene) return;

  const p = getDropPoint();

  if (inventory.type === "tool") {
    const wrench = document.createElement("a-box");
    wrench.classList.add("clickable", "tool");
    wrench.setAttribute("data-tool", "wrench");
    wrench.setAttribute("position", `${p.x} 0.25 ${p.z}`);
    wrench.setAttribute("width", "0.6");
    wrench.setAttribute("height", "0.2");
    wrench.setAttribute("depth", "0.2");
    wrench.setAttribute("color", "#9e9e9e");
    scene.appendChild(wrench);
  }

  if (inventory.type === "trash") {
    const modelMap = {
      plastic: { model: "assets/models/plastic_bottle.glb", size: 0.35 },
      metal:   { model: "assets/models/soda_can.glb",      size: 0.25 },
      paper:   { model: "assets/models/paper_sheet.glb",   size: 0.40 },
    };
    const cfg = modelMap[inventory.trashType];

    const item = document.createElement("a-entity");
    item.classList.add("clickable", "trash");
    item.setAttribute("data-type", inventory.trashType);
    item.setAttribute("gltf-model", cfg.model);
    item.setAttribute("position", `${p.x} 0 ${p.z}`);
    item.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
    item.setAttribute("autoscale-to", `size: ${cfg.size}`);
    scene.appendChild(item);
  }

  inventory = null;
  updateHUD();
  setToast("Item dropped (Q)");
}

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "q") dropItem();
});

// =========================================================
// Click logic
// =========================================================
function onSceneClick(evt) {
  if (!running) return;

  const el = evt.detail?.intersectedEl;
  if (!el) return;

  if (el.classList.contains("trash")) {
    if (inventory) return setToast("Inventory full. Drop item (Q) or sort first.");
    const trashType = el.getAttribute("data-type");
    inventory = { type: "trash", trashType };
    el.parentNode.removeChild(el);
    playSound("#pickupSound");
    setToast(`Picked up ${trashType} trash`);
    updateHUD();
    return;
  }

  if (el.classList.contains("bin")) {
    const binType = el.getAttribute("data-bin");
    if (!inventory || inventory.type !== "trash") return setToast("Pick up trash first.");

    if (inventory.trashType === binType) {
      trashSorted++;
      inventory = null;
      playSound("#successSound");
      setToast(`Correct! ${trashSorted}/${TOTAL_TRASH} sorted`);
      updateHUD();
      updateObjectiveText();
      if (isAllDone()) winGame();
    } else {
      playSound("#wrongSound");
      setToast("Wrong bin! Try another bin.");
      updateHUD();
    }
    return;
  }

  if (el.classList.contains("tool")) {
    if (inventory) return setToast("Inventory full. Drop item (Q) first.");
    inventory = { type: "tool", tool: "wrench" };
    el.parentNode.removeChild(el);
    playSound("#pickupSound");
    setToast("Picked up wrench!");
    updateHUD();
    return;
  }

  if (el.classList.contains("repair-target")) {
    const id = el.getAttribute("data-repair-id");
    if (el.getAttribute("data-fixed") === "1") return setToast("This pipe is already fixed.");

    if (!inventory || inventory.type !== "tool" || inventory.tool !== "wrench") {
      return setToast("You need the wrench to fix pipes.");
    }

    el.setAttribute("data-fixed", "1");
    pipeFixedCount++;

    const leak = document.getElementById(`leak_${id}`);
    if (leak) leak.setAttribute("visible", "false");

    playSound("#successSound");
    setToast(`Pipe fixed! ${pipeFixedCount}/${TOTAL_PIPES}`);
    updateObjectiveText();
    if (isAllDone()) winGame();
    return;
  }

  if (el.classList.contains("animal")) {
    if (el.getAttribute("data-rescued") === "1") return setToast("This deer is already rescued.");

    el.setAttribute("data-rescued", "1");
    deerRescuedCount++;
    el.setAttribute("visible", "false");

    playSound("#successSound");
    setToast(`Deer rescued! ${deerRescuedCount}/${TOTAL_DEER}`);
    updateObjectiveText();
    if (isAllDone()) winGame();
    return;
  }
}

// =========================================================
// Boot
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  // Apply grass only (sky removed)
  applyGrassTexture();

  // Spawn world
  spawnTrees();
  spawnTrash();
  spawnPipes();
  spawnDeer();

  const scene = document.querySelector("a-scene");
  if (scene) scene.addEventListener("click", onSceneClick);

  const startBtn = $("start-button");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      $("start-screen").style.display = "none";
      $("hud").style.display = "block";
      $("end-screen-win").style.display = "none";
      $("end-screen-lose").style.display = "none";

      timeLeft = initialTime;
      inventory = null;
      trashSorted = 0;
      pipeFixedCount = 0;
      deerRescuedCount = 0;

      running = true;
      updateHUD();
      updateObjectiveText();
      startTimer();
      setToast("GO! Finish everything in 100 seconds!");
      playSound("#bgSound");
    });
  }

  // ✅ Sprint (no interval spam)
  const player = document.getElementById("player");
  if (player) {
    const WALK = 45;
    const RUN  = 65;

    player.setAttribute("wasd-controls", `acceleration: ${WALK}; fly: false`);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Shift") player.setAttribute("wasd-controls", `acceleration: ${RUN}; fly: false`);
    });

    document.addEventListener("keyup", (e) => {
      if (e.key === "Shift") player.setAttribute("wasd-controls", `acceleration: ${WALK}; fly: false`);
    });
  }
});
