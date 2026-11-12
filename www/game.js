(() => {
  const COLS = 20;
  const ROWS = 20;
  const STORAGE_KEY = "snake-game-highscore";
  const START_INTERVAL = 160;
  const MIN_INTERVAL = 70;
  const SPEED_STEP = 6;

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

  const state = {
    snake: [],
    dir: DIRS.right,
    queuedDir: DIRS.right,
    food: { x: 10, y: 8 },
    score: 0,
    highScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
    status: "ready", // ready | running | paused | over
    lastTick: 0,
    interval: START_INTERVAL,
    cell: 20,
  };

  highScoreEl.textContent = String(state.highScore);

  function opposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
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
    state.score = 0;
    state.interval = START_INTERVAL;
    state.lastTick = 0;
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
    state.food = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
  }

  function setStatus(status) {
    state.status = status;
    if (status === "ready") {
      overlay.classList.remove("hidden");
      overlayTitle.textContent = "贪吃蛇";
      overlayText.textContent = "吃掉果实，避开墙壁和自己。";
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

  function startGame() {
    if (state.status === "running") return;
    if (state.status !== "paused") resetGame();
    setStatus("running");
  }

  function togglePause() {
    if (state.status === "running") setStatus("paused");
    else if (state.status === "paused") setStatus("running");
  }

  function restartGame() {
    resetGame();
    setStatus("running");
  }

  function queueDirection(name) {
    const next = DIRS[name];
    if (!next) return;
    if (state.status === "ready") startGame();
    if (state.status !== "running") return;
    if (!opposite(next, state.dir)) state.queuedDir = next;
  }

  function tick() {
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
      if (state.score > state.highScore) {
        state.highScore = state.score;
        highScoreEl.textContent = String(state.highScore);
        localStorage.setItem(STORAGE_KEY, String(state.highScore));
      }
      state.interval = Math.max(MIN_INTERVAL, START_INTERVAL - state.score * SPEED_STEP);
      placeFood();
    } else {
      state.snake.pop();
    }
  }

  function endGame() {
    setStatus("over");
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

  function draw() {
    const size = canvas.clientWidth;
    const cell = state.cell || size / COLS;

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

    const food = state.food;
    const fx = food.x * cell;
    const fy = food.y * cell;
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
    queueDirection(dir);
  }

  let swipeStart = null;

  function onPointerDown(event) {
    if (event.target.closest(".dpad")) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? "right" : "left");
    else queueDirection(dy > 0 ? "down" : "up");
  }

  btnStart.addEventListener("click", startGame);
  btnPause.addEventListener("click", togglePause);
  btnRestart.addEventListener("click", restartGame);
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
      queueDirection(btn.dataset.dir);
    });
  });

  resetGame();
  setStatus("ready");
  resizeCanvas();
  requestAnimationFrame(loop);
})();
