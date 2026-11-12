(() => {
  const COLS = 20;
  const ROWS = 20;
  const STORAGE_CLASSIC = "snake-game-highscore";
  const STORAGE_GRAVITY = "snake-game-highscore-gravity";
  const START_INTERVAL = 160;
  const MIN_INTERVAL = 70;
  const SPEED_STEP = 6;
  const TILT_DEAD = 9;
  const TILT_HYST = 7;
  const FALLBACK_MS = 1000;
  const FOOD_LERP_MS = 140;
  const TRAIL_MS = 320;

  const DIRS = {
    up: { x: 0, y: -1, name: "up" },
    down: { x: 0, y: 1, name: "down" },
    left: { x: -1, y: 0, name: "left" },
    right: { x: 1, y: 0, name: "right" },
  };

  const KEY_MAP = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    a: "left",
    s: "down",
    d: "right",
    W: "up",
    A: "left",
    S: "down",
    D: "right",
  };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayScore = document.getElementById("overlay-score");
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");
  const btnRestart = document.getElementById("btn-restart");
  const btnCalibrate = document.getElementById("btn-calibrate");
  const tiltHud = document.getElementById("tilt-hud");
  const bubble = document.getElementById("bubble");
  const fallbackHint = document.getElementById("fallback-hint");
  const hint = document.getElementById("hint");
  const modeClassicBtn = document.getElementById("mode-classic");
  const modeGravityBtn = document.getElementById("mode-gravity");

  const state = {
    mode: "classic",
    snake: [],
    dir: DIRS.right,
    queuedDir: DIRS.right,
    food: { x: 10, y: 8 },
    foodFrom: { x: 10, y: 8 },
    foodMoveAt: 0,
    foodTrail: [],
    foodCredit: 0,
    score: 0,
    highScoreClassic: Number(localStorage.getItem(STORAGE_CLASSIC) || 0),
    highScoreGravity: Number(localStorage.getItem(STORAGE_GRAVITY) || 0),
    highScore: 0,
    status: "ready",
    lastTick: 0,
    interval: START_INTERVAL,
    cell: 20,
    lastManualDir: "right",
    tilt: {
      beta: 0,
      gamma: 0,
      calBeta: 0,
      calGamma: 0,
      dir: null,
      strength: 0,
      hasEvent: false,
      fallback: false,
      calibrated: false,
      listening: false,
      fallbackTimer: 0,
    },
  };

  state.highScore = state.highScoreClassic;
  highScoreEl.textContent = String(state.highScore);

  function opposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function storageKey() {
    return state.mode === "gravity" ? STORAGE_GRAVITY : STORAGE_CLASSIC;
  }

  function highScoreFor(mode) {
    return mode === "gravity" ? state.highScoreGravity : state.highScoreClassic;
  }

  function resetGame() {
    const midY = Math.floor(ROWS / 2);
    state.snake = [
      { x: 6, y: midY },
      { x: 5, y: midY },
      { x: 4, y: midY },
    ];
    state.dir = DIRS.right;
    state.queuedDir = DIRS.right;
    state.lastManualDir = "right";
    state.score = 0;
    state.interval = START_INTERVAL;
    state.lastTick = 0;
    state.foodCredit = 0;
    state.foodTrail = [];
    placeFood();
    scoreEl.textContent = "0";
  }

  function placeFood() {
    const taken = new Set(state.snake.map((p) => `${p.x},${p.y}`));
    const free = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!taken.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    const next = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
    state.food = next;
    state.foodFrom = { x: next.x, y: next.y };
    state.foodMoveAt = 0;
  }

  function applyOverlay() {
    const { status, mode } = state;
    if (status === "ready") {
      overlay.classList.remove("hidden");
      if (mode === "gravity") {
        overlayTitle.textContent = "重力贪吃蛇";
        overlayText.textContent = "倾斜手机控制方向，果实也会顺着重力滚动。点「校准」把当前姿势设为水平。";
      } else {
        overlayTitle.textContent = "贪吃蛇";
        overlayText.textContent = "吃掉果实，避开墙壁和自己。";
      }
      overlayScore.classList.add("hidden");
      btnStart.textContent = "开始";
      btnStart.disabled = false;
      btnPause.textContent = "暂停";
      btnPause.disabled = true;
    } else if (status === "running") {
      overlay.classList.add("hidden");
      btnStart.textContent = "进行中";
      btnStart.disabled = true;
      btnPause.textContent = "暂停";
      btnPause.disabled = false;
    } else if (status === "paused") {
      overlay.classList.remove("hidden");
      overlayTitle.textContent = "已暂停";
      overlayText.textContent = "再按一次空格或点「继续」恢复。";
      overlayScore.classList.add("hidden");
      btnStart.textContent = "进行中";
      btnStart.disabled = true;
      btnPause.textContent = "继续";
      btnPause.disabled = false;
    } else if (status === "over") {
      overlay.classList.remove("hidden");
      overlayTitle.textContent = "游戏结束";
      overlayText.textContent = "撞到墙壁或自己了。再来一局？";
      overlayScore.textContent = `本局分数 ${state.score}　最高分 ${state.highScore}`;
      overlayScore.classList.remove("hidden");
      btnStart.textContent = "开始";
      btnStart.disabled = false;
      btnPause.textContent = "暂停";
      btnPause.disabled = true;
    }
  }

  function setStatus(status) {
    state.status = status;
    applyOverlay();
    const locked = status === "running" || status === "paused";
    modeClassicBtn.disabled = locked;
    modeGravityBtn.disabled = locked;
  }

  function updateModeUI() {
    const gravity = state.mode === "gravity";
    modeClassicBtn.classList.toggle("active", !gravity);
    modeGravityBtn.classList.toggle("active", gravity);
    modeClassicBtn.setAttribute("aria-pressed", String(!gravity));
    modeGravityBtn.setAttribute("aria-pressed", String(gravity));
    tiltHud.classList.toggle("hidden", !gravity);
    if (hint) {
      hint.textContent = gravity
        ? "倾斜手机转向，空格暂停。也可使用方向键作为备用。"
        : "方向键或 WASD 移动，空格暂停";
    }
    updateFallbackHint();
    updateTiltHud();
  }

  function updateFallbackHint() {
    const show = state.mode === "gravity" && state.tilt.fallback;
    fallbackHint.classList.toggle("hidden", !show);
  }

  function setMode(mode) {
    if (mode !== "classic" && mode !== "gravity") return;
    if (state.status === "running" || state.status === "paused") return;
    if (state.mode === mode) {
      updateModeUI();
      return;
    }
    state.mode = mode;
    state.highScore = highScoreFor(mode);
    highScoreEl.textContent = String(state.highScore);
    if (mode === "gravity") startOrientationListening();
    if (state.status === "ready" || state.status === "over") applyOverlay();
    updateModeUI();
  }

  function startGame() {
    if (state.status === "running") return;
    ensureOrientationPermission();
    if (state.status !== "paused") {
      resetGame();
      if (state.mode === "gravity" && state.tilt.hasEvent) calibrateTilt();
    }
    setStatus("running");
  }

  function togglePause() {
    if (state.status === "running") setStatus("paused");
    else if (state.status === "paused") setStatus("running");
  }

  function restartGame() {
    ensureOrientationPermission();
    resetGame();
    if (state.mode === "gravity" && state.tilt.hasEvent) calibrateTilt();
    setStatus("running");
  }

  function queueDirection(name, source) {
    const next = DIRS[name];
    if (!next) return;
    if (source !== "tilt") state.lastManualDir = name;
    if (state.status === "ready" && source !== "tilt") startGame();
    if (state.status !== "running") return;
    if (!opposite(next, state.dir)) state.queuedDir = next;
  }

  function tryMoveFood(dirName) {
    const d = DIRS[dirName];
    if (!d) return false;
    const next = { x: state.food.x + d.x, y: state.food.y + d.y };
    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) return false;
    if (state.snake.some((part) => part.x === next.x && part.y === next.y)) return false;
    const now = performance.now();
    state.foodTrail.push({ x: state.food.x, y: state.food.y, born: now });
    if (state.foodTrail.length > 5) state.foodTrail.shift();
    state.foodFrom = { x: state.food.x, y: state.food.y };
    state.food = next;
    state.foodMoveAt = now;
    return true;
  }

  function gravityDir() {
    if (state.tilt.hasEvent && !state.tilt.fallback && state.tilt.dir) return state.tilt.dir;
    return state.lastManualDir;
  }

  function maybeRollFood() {
    const dir = gravityDir();
    if (!dir) return;
    let amount;
    if (state.tilt.hasEvent && !state.tilt.fallback && state.tilt.dir) {
      const extra = Math.max(0, state.tilt.strength - TILT_DEAD);
      amount = Math.min(1.25, extra / 18);
    } else {
      amount = 0.5;
    }
    state.foodCredit += amount;
    while (state.foodCredit >= 1) {
      state.foodCredit -= 1;
      if (!tryMoveFood(dir)) {
        state.foodCredit = 0;
        break;
      }
    }
  }

  function recordScore() {
    if (state.score <= state.highScore) return;
    state.highScore = state.score;
    if (state.mode === "gravity") state.highScoreGravity = state.score;
    else state.highScoreClassic = state.score;
    highScoreEl.textContent = String(state.highScore);
    localStorage.setItem(storageKey(), String(state.highScore));
  }

  function tick() {
    if (state.mode === "gravity") maybeRollFood();

    state.dir = state.queuedDir;
    const head = state.snake[0];
    const next = { x: head.x + state.dir.x, y: head.y + state.dir.y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      endGame();
      return;
    }

    const hitSelf = state.snake.some((part, i) => i !== state.snake.length - 1 && part.x === next.x && part.y === next.y);
    if (hitSelf) {
      endGame();
      return;
    }

    state.snake.unshift(next);
    if (next.x === state.food.x && next.y === state.food.y) {
      state.score += 1;
      scoreEl.textContent = String(state.score);
      recordScore();
      state.interval = Math.max(MIN_INTERVAL, START_INTERVAL - state.score * SPEED_STEP);
      placeFood();
    } else {
      state.snake.pop();
    }
  }

  function endGame() {
    setStatus("over");
  }

  function resolveTiltDir(dBeta, dGamma, prevDir) {
    const absB = Math.abs(dBeta);
    const absG = Math.abs(dGamma);
    if (absB < TILT_DEAD && absG < TILT_DEAD) return null;
    const vDir = absB >= TILT_DEAD ? (dBeta > 0 ? "down" : "up") : null;
    const hDir = absG >= TILT_DEAD ? (dGamma > 0 ? "right" : "left") : null;
    if (!vDir) return hDir;
    if (!hDir) return vDir;
    const prevIsV = prevDir === "up" || prevDir === "down";
    const prevIsH = prevDir === "left" || prevDir === "right";
    if (prevIsV) return absG > absB + TILT_HYST ? hDir : vDir;
    if (prevIsH) return absB > absG + TILT_HYST ? vDir : hDir;
    return absG > absB ? hDir : vDir;
  }

  function calibrateTilt() {
    state.tilt.calBeta = state.tilt.beta;
    state.tilt.calGamma = state.tilt.gamma;
    state.tilt.calibrated = true;
    state.tilt.dir = null;
    state.tilt.strength = 0;
    updateTiltHud();
  }

  function updateTiltHud() {
    if (!bubble) return;
    const dGamma = state.tilt.gamma - state.tilt.calGamma;
    const dBeta = state.tilt.beta - state.tilt.calBeta;
    const span = 28;
    const x = Math.max(-1, Math.min(1, dGamma / span));
    const y = Math.max(-1, Math.min(1, dBeta / span));
    const maxPx = 13;
    bubble.style.transform = `translate(${x * maxPx}px, ${y * maxPx}px)`;
  }

  function onDeviceOrientation(event) {
    const beta = event.beta;
    const gamma = event.gamma;
    if (beta == null && gamma == null) return;
    state.tilt.beta = typeof beta === "number" ? beta : 0;
    state.tilt.gamma = typeof gamma === "number" ? gamma : 0;
    state.tilt.hasEvent = true;
    if (state.tilt.fallback) {
      state.tilt.fallback = false;
      updateFallbackHint();
    }
    if (!state.tilt.calibrated) calibrateTilt();
    const dBeta = state.tilt.beta - state.tilt.calBeta;
    const dGamma = state.tilt.gamma - state.tilt.calGamma;
    state.tilt.strength = Math.max(Math.abs(dBeta), Math.abs(dGamma));
    state.tilt.dir = resolveTiltDir(dBeta, dGamma, state.tilt.dir);
    updateTiltHud();
    if (state.mode === "gravity" && state.tilt.dir) {
      queueDirection(state.tilt.dir, "tilt");
    }
  }

  function startOrientationListening() {
    if (state.tilt.listening) return;
    state.tilt.listening = true;
    window.addEventListener("deviceorientation", onDeviceOrientation);
    if (state.tilt.fallbackTimer) clearTimeout(state.tilt.fallbackTimer);
    state.tilt.fallbackTimer = setTimeout(() => {
      if (!state.tilt.hasEvent) {
        state.tilt.fallback = true;
        updateFallbackHint();
      }
    }, FALLBACK_MS);
  }

  async function ensureOrientationPermission() {
    if (state.mode !== "gravity") return;
    startOrientationListening();
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        if (result !== "granted" && !state.tilt.hasEvent) {
          state.tilt.fallback = true;
          updateFallbackHint();
        }
      } catch (err) {
        if (!state.tilt.hasEvent) {
          state.tilt.fallback = true;
          updateFallbackHint();
        }
      }
    }
  }

  function resizeCanvas() {
    const size = Math.floor(canvas.clientWidth);
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cell = size / COLS;
    draw();
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function foodVisualPos(now) {
    if (!state.foodMoveAt) return { x: state.food.x, y: state.food.y };
    const t = Math.min(1, (now - state.foodMoveAt) / FOOD_LERP_MS);
    const ease = 1 - (1 - t) * (1 - t);
    return {
      x: state.foodFrom.x + (state.food.x - state.foodFrom.x) * ease,
      y: state.foodFrom.y + (state.food.y - state.foodFrom.y) * ease,
    };
  }

  function drawFood(cell, now) {
    if (state.mode === "gravity") {
      state.foodTrail = state.foodTrail.filter((p) => now - p.born < TRAIL_MS);
      state.foodTrail.forEach((p) => {
        const age = (now - p.born) / TRAIL_MS;
        const alpha = (1 - age) * 0.35;
        const r = (cell * 0.28) * (1 - age * 0.4);
        ctx.fillStyle = `rgba(251, 113, 133, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x * cell + cell / 2, p.y * cell + cell / 2, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const pos = foodVisualPos(now);
    const fx = pos.x * cell;
    const fy = pos.y * cell;
    const pad = cell * 0.18;
    ctx.fillStyle = "#fb7185";
    ctx.shadowColor = "rgba(251, 113, 133, 0.55)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(fx + cell / 2, fy + cell / 2, (cell - pad * 2) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#86efac";
    ctx.fillRect(fx + cell * 0.48, fy + cell * 0.12, cell * 0.08, cell * 0.18);
  }

  function draw() {
    const size = canvas.clientWidth;
    const cell = state.cell || size / COLS;
    const now = performance.now();

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0a1620";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(74, 222, 128, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }

    drawFood(cell, now);

    state.snake.forEach((part, index) => {
      const x = part.x * cell;
      const y = part.y * cell;
      const inset = index === 0 ? cell * 0.08 : cell * 0.14;
      ctx.fillStyle = index === 0 ? "#86efac" : "#22c55e";
      ctx.shadowColor = "rgba(74, 222, 128, 0.25)";
      ctx.shadowBlur = index === 0 ? 10 : 0;
      roundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2, cell * 0.28);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (index === 0) {
        const eye = cell * 0.09;
        const ox = state.dir.x * cell * 0.14;
        const oy = state.dir.y * cell * 0.14;
        ctx.fillStyle = "#052e16";
        if (state.dir.x === 0) {
          ctx.beginPath();
          ctx.arc(x + cell * 0.35 + ox, y + cell * 0.45 + oy, eye, 0, Math.PI * 2);
          ctx.arc(x + cell * 0.65 + ox, y + cell * 0.45 + oy, eye, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x + cell * 0.55 + ox, y + cell * 0.32 + oy, eye, 0, Math.PI * 2);
          ctx.arc(x + cell * 0.55 + ox, y + cell * 0.68 + oy, eye, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  function loop(ts) {
    if (state.status === "running") {
      if (!state.lastTick) state.lastTick = ts;
      if (ts - state.lastTick >= state.interval) {
        state.lastTick = ts;
        tick();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  function onKeyDown(event) {
    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (state.status === "ready" || state.status === "over") startGame();
      else togglePause();
      return;
    }
    const dir = KEY_MAP[event.key];
    if (!dir) return;
    event.preventDefault();
    queueDirection(dir, "key");
  }

  let swipeStart = null;

  function onPointerDown(event) {
    if (event.target.closest(".dpad") || event.target.closest(".tilt-hud") || event.target.closest(".mode-switch")) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? "right" : "left", "swipe");
    else queueDirection(dy > 0 ? "down" : "up", "swipe");
  }

  btnStart.addEventListener("click", startGame);
  btnPause.addEventListener("click", togglePause);
  btnRestart.addEventListener("click", restartGame);
  btnCalibrate.addEventListener("click", () => {
    ensureOrientationPermission();
    calibrateTilt();
  });
  modeClassicBtn.addEventListener("click", () => setMode("classic"));
  modeGravityBtn.addEventListener("click", () => {
    setMode("gravity");
    ensureOrientationPermission();
  });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  document.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      queueDirection(btn.dataset.dir, "dpad");
    });
  });

  resetGame();
  setStatus("ready");
  updateModeUI();
  resizeCanvas();
  requestAnimationFrame(loop);
})();
