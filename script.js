/* ===================================================
   HW2 — Cliff Walking: Q-learning vs SARSA
   script.js
   =================================================== */

// ─────────────────────────────────────────────────────────────
// 1. Cliff Walking Environment
// ─────────────────────────────────────────────────────────────
class CliffWalkingEnv {
  constructor(rows = 4, cols = 12) {
    this.rows = rows;
    this.cols = cols;
    this.start = (rows - 1) * cols;          // bottom-left
    this.goal  = rows * cols - 1;            // bottom-right
    // cliff: bottom row, col 1 … cols-2
    this.cliff = new Set();
    for (let c = 1; c < cols - 1; c++) {
      this.cliff.add((rows - 1) * cols + c);
    }
    this.state = this.start;
  }

  reset() {
    this.state = this.start;
    return this.state;
  }

  // action: 0=up, 1=down, 2=left, 3=right
  step(action) {
    const r = Math.floor(this.state / this.cols);
    const c = this.state % this.cols;
    let nr = r, nc = c;
    if (action === 0) nr = Math.max(r - 1, 0);
    if (action === 1) nr = Math.min(r + 1, this.rows - 1);
    if (action === 2) nc = Math.max(c - 1, 0);
    if (action === 3) nc = Math.min(c + 1, this.cols - 1);

    const nextState = nr * this.cols + nc;

    if (this.cliff.has(nextState)) {
      this.state = this.start;
      return { nextState: this.start, reward: -100, done: false };
    }
    if (nextState === this.goal) {
      this.state = nextState;
      return { nextState, reward: -1, done: true };
    }
    this.state = nextState;
    return { nextState, reward: -1, done: false };
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Q-Table helper
// ─────────────────────────────────────────────────────────────
function makeQTable(states, actions) {
  return Array.from({ length: states }, () => new Float64Array(actions));
}

function epsilonGreedy(Q, state, epsilon, nA) {
  if (Math.random() < epsilon) return Math.floor(Math.random() * nA);
  const q = Q[state];
  let best = 0;
  for (let a = 1; a < nA; a++) if (q[a] > q[best]) best = a;
  return best;
}

function maxQ(Q, state) {
  const q = Q[state];
  let m = q[0];
  for (let a = 1; a < q.length; a++) if (q[a] > m) m = q[a];
  return m;
}

// ─────────────────────────────────────────────────────────────
// 3. Q-Learning (Off-policy)
// ─────────────────────────────────────────────────────────────
function runQLearning(params) {
  const { rows, cols, epsilon, alpha, gamma, episodes } = params;
  const env   = new CliffWalkingEnv(rows, cols);
  const nS    = rows * cols;
  const nA    = 4;
  const Q     = makeQTable(nS, nA);
  const rewards = [];
  const steps   = [];   // NEW: steps per episode

  for (let ep = 0; ep < episodes; ep++) {
    let s = env.reset();
    let totalR = 0;
    let t = 0;
    while (t < 2000) {
      const a = epsilonGreedy(Q, s, epsilon, nA);
      const { nextState: sp, reward: r, done } = env.step(a);
      // Off-policy update: max over a'
      Q[s][a] += alpha * (r + gamma * maxQ(Q, sp) - Q[s][a]);
      totalR += r;
      s = sp;
      t++;
      if (done) break;
    }
    rewards.push(totalR);
    steps.push(t);
  }
  return { Q, rewards, steps };
}

// ─────────────────────────────────────────────────────────────
// 4. SARSA (On-policy)
// ─────────────────────────────────────────────────────────────
function runSARSA(params) {
  const { rows, cols, epsilon, alpha, gamma, episodes } = params;
  const env   = new CliffWalkingEnv(rows, cols);
  const nS    = rows * cols;
  const nA    = 4;
  const Q     = makeQTable(nS, nA);
  const rewards = [];
  const steps   = [];   // NEW: steps per episode

  for (let ep = 0; ep < episodes; ep++) {
    let s = env.reset();
    let a = epsilonGreedy(Q, s, epsilon, nA);
    let totalR = 0;
    let t = 0;
    while (t < 2000) {
      const { nextState: sp, reward: r, done } = env.step(a);
      const ap = epsilonGreedy(Q, sp, epsilon, nA);
      // On-policy update: use actual next action a'
      Q[s][a] += alpha * (r + gamma * Q[sp][ap] - Q[s][a]);
      totalR += r;
      s = sp;
      a = ap;
      t++;
      if (done) break;
    }
    rewards.push(totalR);
    steps.push(t);
  }
  return { Q, rewards, steps };
}

// ─────────────────────────────────────────────────────────────
// 5. Environment Grid (static preview)
// ─────────────────────────────────────────────────────────────
function buildEnvGrid(rows, cols) {
  const container = document.getElementById('env-grid');
  container.style.gridTemplateColumns = `repeat(${cols}, 48px)`;
  container.innerHTML = '';

  const cliffSet = new Set();
  for (let c = 1; c < cols - 1; c++) cliffSet.add((rows - 1) * cols + c);
  const start = (rows - 1) * cols;
  const goal  = rows * cols - 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = document.createElement('div');
      cell.className = 'env-cell';
      if (idx === start)       { cell.classList.add('cell-start'); cell.textContent = 'S'; }
      else if (idx === goal)   { cell.classList.add('cell-goal');  cell.textContent = 'G'; }
      else if (cliffSet.has(idx)) { cell.classList.add('cell-cliff'); cell.textContent = '☠'; }
      else                     { cell.classList.add('cell-normal'); }
      container.appendChild(cell);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Generic Line Chart (reusable)
// ─────────────────────────────────────────────────────────────
function smoothData(arr, w = 10) {
  return arr.map((_, i) => {
    const lo = Math.max(0, i - w + 1);
    const slice = arr.slice(lo, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * series: [{ data: number[], color: string, glowColor: string, label: string }]
 */
function drawLineChart(canvasId, series, xLabel = 'Episodes', yLabel = 'Value') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 24, bottom: 48, left: 64 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  const smoothed = series.map(s => smoothData(s.data));
  const allVals  = smoothed.flatMap(d => d);
  const minR = Math.min(...allVals);
  const maxR = Math.max(...allVals);
  const range = maxR - minR || 1;
  const nPts  = series[0].data.length;

  const toX = i => PAD.left + (i / (nPts - 1)) * plotW;
  const toY = v => PAD.top + plotH - ((v - minR) / range) * plotH;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 5; k++) {
    const y = PAD.top + (k / 5) * plotH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
  }
  for (let k = 0; k <= 5; k++) {
    const x = PAD.left + (k / 5) * plotW;
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + plotH); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + plotH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top + plotH); ctx.lineTo(PAD.left + plotW, PAD.top + plotH); ctx.stroke();

  // Y-axis labels
  ctx.fillStyle = 'rgba(136,146,164,0.9)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let k = 0; k <= 5; k++) {
    const v = minR + (k / 5) * range;
    const y = PAD.top + plotH - (k / 5) * plotH;
    ctx.fillText(v.toFixed(0), PAD.left - 8, y + 4);
  }

  // X-axis labels
  ctx.textAlign = 'center';
  for (let k = 0; k <= 5; k++) {
    const ep = Math.round((k / 5) * (nPts - 1));
    const x = toX(ep);
    ctx.fillText(ep, x, PAD.top + plotH + 18);
  }

  // Axis titles
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = 'rgba(136,146,164,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, PAD.left + plotW / 2, H - 6);
  ctx.save();
  ctx.translate(14, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // Lines
  smoothed.forEach((data, si) => {
    const { color, glowColor } = series[si];
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  });
}

function drawLearningChart(qRewards, sRewards) {
  drawLineChart('learning-chart',
    [
      { data: qRewards, color: '#ff5f5f', glowColor: 'rgba(255,95,95,0.5)' },
      { data: sRewards, color: '#00d4e8', glowColor: 'rgba(0,212,232,0.5)' },
    ],
    'Episodes', 'Reward Sum'
  );
}

function drawStepsChart(qSteps, sSteps) {
  drawLineChart('steps-chart',
    [
      { data: qSteps, color: '#ff5f5f', glowColor: 'rgba(255,95,95,0.5)' },
      { data: sSteps, color: '#00d4e8', glowColor: 'rgba(0,212,232,0.5)' },
    ],
    'Episodes', 'Steps'
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Q-Table Heatmap
// ─────────────────────────────────────────────────────────────
function drawQHeatmap(canvasId, Q, rows, cols) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const CELL = 42, GAP = 2;
  const W = cols * (CELL + GAP) - GAP;
  const H = rows * (CELL + GAP) - GAP;
  canvas.width  = W;
  canvas.height = H;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Compute max Q per state
  const maxVals = Q.map(row => Math.max(...row));

  // Filter out extreme cliff-penalty states to get a fair range
  const cliffSet = new Set();
  for (let c = 1; c < cols - 1; c++) cliffSet.add((rows - 1) * cols + c);
  const validVals = maxVals.filter((_, i) => !cliffSet.has(i));
  const minV = Math.min(...validVals);
  const maxV = Math.max(...validVals);
  const range = maxV - minV || 1;

  const start = (rows - 1) * cols;
  const goal  = rows * cols - 1;

  // Color ramp: dark blue → cyan → yellow
  function valueToColor(t) {
    // t in [0,1]
    const r = Math.round(t < 0.5 ? 0 : (t - 0.5) * 2 * 255);
    const g = Math.round(t < 0.5 ? t * 2 * 200 : 200 + (t - 0.5) * 2 * 55);
    const b = Math.round(t < 0.5 ? 80 + t * 2 * 100 : Math.max(0, 180 - (t - 0.5) * 2 * 180));
    return `rgb(${r},${g},${b})`;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = c * (CELL + GAP);
      const y = r * (CELL + GAP);

      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 5);

      if (cliffSet.has(idx)) {
        ctx.fillStyle = 'rgba(192,57,43,0.5)';
      } else if (idx === goal) {
        ctx.fillStyle = 'rgba(243,156,18,0.6)';
      } else if (idx === start) {
        ctx.fillStyle = 'rgba(39,174,96,0.5)';
      } else {
        const t = (maxVals[idx] - minV) / range;
        ctx.fillStyle = valueToColor(Math.max(0, Math.min(1, t)));
      }
      ctx.fill();

      // Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = x + CELL / 2, cy = y + CELL / 2;
      if (idx === goal) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter,sans-serif'; ctx.fillText('G', cx, cy);
      } else if (idx === start) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter,sans-serif'; ctx.fillText('S', cx, cy);
      } else if (cliffSet.has(idx)) {
        ctx.fillStyle = '#ff8080'; ctx.font = '12px sans-serif'; ctx.fillText('☠', cx, cy);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '9px Inter,sans-serif';
        ctx.fillText(maxVals[idx].toFixed(1), cx, cy);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 8. Policy Grid (Canvas arrows)
// ─────────────────────────────────────────────────────────────
const ACTION_ARROWS = ['↑', '↓', '←', '→'];

function drawPolicyCanvas(canvasId, Q, rows, cols, qColor, pathStates) {
  const canvas = document.getElementById(canvasId);
  const CELL = 42, GAP = 2;
  const W = cols * (CELL + GAP) - GAP;
  const H = rows * (CELL + GAP) - GAP;
  canvas.width  = W;
  canvas.height = H;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const cliffSet = new Set();
  for (let c = 1; c < cols - 1; c++) cliffSet.add((rows - 1) * cols + c);
  const start = (rows - 1) * cols;
  const goal  = rows * cols - 1;

  const pathMap = new Map();
  if (pathStates) {
    pathStates.forEach((s, i) => { if (!pathMap.has(s)) pathMap.set(s, i); });
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = c * (CELL + GAP);
      const y = r * (CELL + GAP);
      const onPath = pathMap.has(idx);

      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 5);

      if (idx === goal) {
        ctx.fillStyle = 'rgba(243,156,18,0.35)';
      } else if (idx === start) {
        ctx.fillStyle = 'rgba(39,174,96,0.35)';
      } else if (cliffSet.has(idx)) {
        ctx.fillStyle = 'rgba(192,57,43,0.4)';
      } else if (onPath) {
        const rgb = qColor === '#ff5f5f' ? '255,95,95' : '0,212,232';
        ctx.fillStyle = `rgba(${rgb},0.18)`;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
      }
      ctx.fill();

      if (onPath && idx !== start && idx !== goal) {
        ctx.strokeStyle = qColor;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      if (idx === goal) {
        ctx.fillStyle = '#f9d06f'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillText('G', cx, cy);
      } else if (idx === start) {
        ctx.fillStyle = '#5dde8a'; ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillText('S', cx, cy);
      } else if (cliffSet.has(idx)) {
        ctx.fillStyle = '#ff8080'; ctx.font = '13px sans-serif'; ctx.fillText('☠', cx, cy);
      } else {
        const qRow = Q[idx];
        let best = 0;
        for (let a = 1; a < qRow.length; a++) if (qRow[a] > qRow[best]) best = a;
        ctx.fillStyle = onPath ? '#fff' : qColor;
        ctx.font = onPath ? 'bold 16px sans-serif' : '16px sans-serif';
        ctx.fillText(ACTION_ARROWS[best], cx, cy);
      }

      if (onPath && idx !== start && idx !== goal && !cliffSet.has(idx)) {
        const step = pathMap.get(idx);
        ctx.fillStyle = qColor;
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(step, x + CELL - 3, y + 2);
      }
    }
  }

  if (pathStates && pathStates.length > 1) {
    ctx.save();
    ctx.strokeStyle = qColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([4, 3]);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pathStates.forEach((s, i) => {
      const pc = s % cols;
      const pr = Math.floor(s / cols);
      const px = pc * (CELL + GAP) + CELL / 2;
      const py = pr * (CELL + GAP) + CELL / 2;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// 9. Greedy path extraction
// ─────────────────────────────────────────────────────────────
function greedyPath(Q, rows, cols) {
  const env = new CliffWalkingEnv(rows, cols);
  let s = env.reset();
  const path = [s];
  const visited = new Set([s]);
  for (let step = 0; step < rows * cols; step++) {
    const qRow = Q[s];
    let best = 0;
    for (let a = 1; a < qRow.length; a++) if (qRow[a] > qRow[best]) best = a;
    const { nextState, done } = env.step(best);
    path.push(nextState);
    if (done || visited.has(nextState)) break;
    visited.add(nextState);
    s = nextState;
  }
  return { path, reachedGoal: path[path.length - 1] === env.goal };
}

// ─────────────────────────────────────────────────────────────
// 10. Statistical helpers
// ─────────────────────────────────────────────────────────────
function std(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

function convergenceEpisode(rewards, threshold, window = 50) {
  for (let i = window; i < rewards.length; i++) {
    const slice = rewards.slice(i - window, i);
    const avg = slice.reduce((a, b) => a + b, 0) / window;
    if (avg >= threshold) return i - window;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 11. Analysis section
// ─────────────────────────────────────────────────────────────
function updateAnalysis(qRewards, sRewards, qQ, sQ, params, qPath, sPath, qGoal, sGoal) {
  const { epsilon } = params;
  const last100Q = qRewards.slice(-100);
  const last100S = sRewards.slice(-100);
  const stdQ = std(last100Q).toFixed(1);
  const stdS = std(last100S).toFixed(1);
  const avgQ = (last100Q.reduce((a,b)=>a+b,0)/100).toFixed(1);
  const avgS = (last100S.reduce((a,b)=>a+b,0)/100).toFixed(1);
  const threshold = -30;
  const convQ = convergenceEpisode(qRewards, threshold);
  const convS = convergenceEpisode(sRewards, threshold);

  const convText = convQ !== null && convS !== null
    ? (convQ < convS
        ? `Q-learning 約在第 ${convQ} 回合收斂，SARSA 約在第 ${convS} 回合，<strong>Q-learning 收斂較快</strong>。`
        : convQ > convS
          ? `SARSA 約在第 ${convS} 回合收斂，Q-learning 約在第 ${convQ} 回合，<strong>SARSA 收斂較快</strong>。`
          : `兩者約同時在第 ${convQ} 回合收斂。`)
    : convQ === null && convS === null
      ? '兩個演算法在設定的回合數內尚未完全收斂（收斂門檻：均值 ≥ ' + threshold + '）。'
      : convQ === null
        ? `SARSA 約在第 ${convS} 回合收斂，<strong>Q-learning 尚未收斂</strong>。`
        : `Q-learning 約在第 ${convQ} 回合收斂，<strong>SARSA 尚未收斂</strong>。`;

  const stabText = parseFloat(stdQ) > parseFloat(stdS)
    ? `Q-learning 波動明顯較大（σ = ${stdQ} vs ${stdS}），因為其策略緊貼懸崖，ε-greedy 探索容易意外落入懸崖（獎勵 −100）。`
    : parseFloat(stdQ) < parseFloat(stdS)
      ? `SARSA 波動較大（σ = ${stdS} vs ${stdQ}），因其路徑較長，單次探索誤差影響更大。`
      : `兩者波動相近，訓練已充分收斂（σ ≈ ${stdQ}）。`;

  const html = `
  <div class="analysis-sections">
    <div class="analysis-block">
      <h3>📈 一、學習表現（Learning Performance）</h3>
      <div class="stat-row">
        <div class="stat-card q-card">
          <div class="stat-label">Q-learning 最終平均獎勵</div>
          <div class="stat-value q-val">${avgQ}</div>
        </div>
        <div class="stat-card s-card">
          <div class="stat-label">SARSA 最終平均獎勵</div>
          <div class="stat-value s-val">${avgS}</div>
        </div>
        <div class="stat-card q-card">
          <div class="stat-label">Q-learning 收斂回合</div>
          <div class="stat-value q-val">${convQ !== null ? convQ : 'N/A'}</div>
        </div>
        <div class="stat-card s-card">
          <div class="stat-label">SARSA 收斂回合</div>
          <div class="stat-value s-val">${convS !== null ? convS : 'N/A'}</div>
        </div>
      </div>
      <p class="analysis-text">${convText}</p>
    </div>

    <div class="analysis-block">
      <h3>🛤️ 二、策略行為（Policy Behavior）</h3>
      <div class="stat-row">
        <div class="stat-card q-card">
          <div class="stat-label">Q-learning 最短路徑（步數）</div>
          <div class="stat-value q-val">${qGoal ? qPath.length - 1 : 'N/A'}</div>
        </div>
        <div class="stat-card s-card">
          <div class="stat-label">SARSA 最短路徑（步數）</div>
          <div class="stat-value s-val">${sGoal ? sPath.length - 1 : 'N/A'}</div>
        </div>
      </div>
      <p class="analysis-text">
        <strong>Q-learning (Off-policy)</strong> 使用 <code>max<sub>a'</sub> Q(s',a')</code> 更新，學到的是「理論最優策略」。
        即使訓練中偶爾因 ε-greedy 掉入懸崖，它仍然學會沿懸崖邊最短路徑前進（共 ${qGoal ? qPath.length-1 : 'N/A'} 步）。
        這是一種<strong>冒險型策略</strong>。<br/><br/>
        <strong>SARSA (On-policy)</strong> 使用實際選取的 a' 更新，將探索的隨機性納入 Q 值估計中。
        在懸崖邊，隨機動作可能導致掉崖，因此 SARSA 學會<strong>遠離懸崖的保守路徑</strong>（共 ${sGoal ? sPath.length-1 : 'N/A'} 步）。
      </p>
    </div>

    <div class="analysis-block">
      <h3>📊 三、穩定性分析（Stability Analysis）</h3>
      <div class="stat-row">
        <div class="stat-card q-card">
          <div class="stat-label">Q-learning 獎勵標準差（最後 100 回合）</div>
          <div class="stat-value q-val">σ = ${stdQ}</div>
        </div>
        <div class="stat-card s-card">
          <div class="stat-label">SARSA 獎勵標準差（最後 100 回合）</div>
          <div class="stat-value s-val">σ = ${stdS}</div>
        </div>
      </div>
      <p class="analysis-text">
        ${stabText}<br/>
        在 ε = ${epsilon} 的設定下，每一步有 ${(epsilon*100).toFixed(0)}% 機率隨機探索。
        對 SARSA 而言，這種隨機性<strong>直接影響 Q 值更新</strong>，促使它選擇更安全的路徑；
        對 Q-learning 而言，更新規則不受探索動作影響，策略仍然最優，但執行時風險較高。
      </p>
    </div>

    <div class="analysis-block">
      <h3>🏁 四、結論</h3>
      <div class="conclusion-box">
        <strong>收斂速度：</strong>${convQ !== null && convS !== null ? (convQ <= convS ? 'Q-learning 較快收斂。' : 'SARSA 較快收斂。') : '取決於參數設定。'}<br/>
        <strong>穩定性：</strong>${parseFloat(stdQ) <= parseFloat(stdS) ? 'Q-learning 最後階段較穩定（路徑固定且不掉崖）。' : 'SARSA 最後階段較穩定（保守路徑波動小）。'}<br/>
        <strong>適用場景：</strong>需要安全性的真實系統（如機器人、自駕車）宜選 <strong style="color:var(--s-color)">SARSA</strong>；
        可離線訓練後關閉探索再部署的場景則 <strong style="color:var(--q-color)">Q-learning</strong> 的最優策略更高效。
      </div>
    </div>
  </div>`;

  document.getElementById('analysis-content').innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// 12. Progress simulation (async)
// ─────────────────────────────────────────────────────────────
function setProgress(pct, label) {
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-label').textContent = label;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────
// 13. Main: Run Training
// ─────────────────────────────────────────────────────────────
async function runTraining() {
  const epsilon  = parseFloat(document.getElementById('epsilon').value);
  const alpha    = parseFloat(document.getElementById('alpha').value);
  const gamma    = parseFloat(document.getElementById('gamma').value);
  const episodes = parseInt(document.getElementById('episodes').value);
  const rows     = 4, cols = 12;

  const params = { rows, cols, epsilon, alpha, gamma, episodes };

  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  document.getElementById('progress-wrap').style.display = 'flex';
  setProgress(0, 'Q-learning 訓練中...');
  await sleep(30);

  const qResult = runQLearning(params);
  setProgress(40, 'SARSA 訓練中...');
  await sleep(30);

  const sResult = runSARSA(params);
  setProgress(75, '繪製視覺化...');
  await sleep(30);

  const { path: qPath, reachedGoal: qGoal } = greedyPath(qResult.Q, rows, cols);
  const { path: sPath, reachedGoal: sGoal } = greedyPath(sResult.Q, rows, cols);

  // Existing charts
  drawLearningChart(qResult.rewards, sResult.rewards);
  drawStepsChart(qResult.steps, sResult.steps);

  // Policy canvases
  drawPolicyCanvas('q-policy-canvas', qResult.Q, rows, cols, '#ff5f5f', qPath);
  drawPolicyCanvas('s-policy-canvas', sResult.Q, rows, cols, '#00d4e8', sPath);

  // Heatmaps
  drawQHeatmap('q-heatmap-canvas', qResult.Q, rows, cols);
  drawQHeatmap('s-heatmap-canvas', sResult.Q, rows, cols);

  // Analysis
  updateAnalysis(qResult.rewards, sResult.rewards, qResult.Q, sResult.Q, params, qPath, sPath, qGoal, sGoal);

  setProgress(100, '完成！');
  await sleep(500);

  document.getElementById('progress-wrap').style.display = 'none';
  btn.disabled = false;
}

// ─────────────────────────────────────────────────────────────
// 14. Slider live update + Init
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const sliders = [
    { id: 'epsilon', valId: 'epsilon-val', digits: 2 },
    { id: 'alpha',   valId: 'alpha-val',   digits: 2 },
    { id: 'gamma',   valId: 'gamma-val',   digits: 2 },
    { id: 'episodes',valId: 'episodes-val', digits: 0 },
  ];
  sliders.forEach(({ id, valId, digits }) => {
    const el  = document.getElementById(id);
    const out = document.getElementById(valId);
    el.addEventListener('input', () => {
      out.textContent = parseFloat(el.value).toFixed(digits);
    });
  });

  buildEnvGrid(4, 12);
});
