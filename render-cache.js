// render-cache.js — pre-rendered layers and sprites so the game can look RICHER
// while each frame does LESS work.
//
// The hot path used to rebuild everything from scratch 60×/second: a linear
// gradient + stroke per visible tile, 80 shimmer stars, and gaussian shadowBlur on
// every gem and glow particle (shadowBlur is the most expensive canvas op there is).
// Everything static is now painted ONCE per level into offscreen canvases:
//
//   • tileLayer  — the whole level's terrain, with art we could never afford live:
//                  per-tile mineral speckle, planet-themed surface details (grass /
//                  craters / embers / ice sheen / circuit ticks), ambient occlusion
//                  under every ledge, and pre-glowed hazard spikes.
//   • sky        — gradient + horizon glow + nebulae + a distant sister world.
//   • starLayers — two parallax starfields (drawn wrapped, 2 drawImage calls).
//   • vignette   — a soft planet-tinted edge darkening, one drawImage per frame.
//   • glowSprite / gemHalo — tiny radial-gradient sprites that replace per-frame
//                  shadowBlur on particles and gems.
//
// Per frame the background+terrain becomes ~5 drawImage calls. Every cache keys on
// (planet, attempt), so Retry Remix / Daily Signal layouts rebuild automatically.
// All functions degrade to null when no real canvas exists (node test harness) —
// callers keep their old direct-draw fallbacks.

var RenderCache = {
  _tile: null, _tileKey: null,
  _sky: null, _skyKey: null,
  _vig: null, _vigKey: null,
  _starFar: null, _starNear: null,
  _twinkles: null,
  _glows: {}, // color|radius -> sprite canvas

  canvasSupported() {
    if (typeof document === "undefined" || !document.createElement) return false;
    const c = document.createElement("canvas");
    return !!(c && typeof c.getContext === "function" && c.getContext("2d"));
  },

  _mk(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  },

  // One key per distinct world layout — remix attempts repaint automatically.
  keyFor(game) {
    return game ? `${game.currentPlanetIndex}:${game.retryAttempt || 0}` : "0:0";
  },

  invalidate() {
    this._tile = this._tileKey = null;
    this._sky = this._skyKey = null;
    this._vig = this._vigKey = null;
  },

  // Deterministic per-tile hash for texture variety (stable across frames/rebuilds).
  _hash(r, c) {
    let h = (r * 73856093) ^ (c * 19349663);
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  // ---------------- terrain layer ----------------

  TILE_PALETTES: [
    { top: "#5eea7f", body: "#a16207", shade: "#78350f", detail: "#bbf7d0", flecks: "#d9f99d" },
    { top: "#94a3b8", body: "#475569", shade: "#334155", detail: "#e2e8f0", flecks: "#cbd5e1" },
    { top: "#fb923c", body: "#c2410c", shade: "#7c2d12", detail: "#fed7aa", flecks: "#fdba74" },
    { top: "#a78bfa", body: "#5b21b6", shade: "#312e81", detail: "#e9d5ff", flecks: "#ddd6fe" },
    { top: "#f472b6", body: "#1e293b", shade: "#0f172a", detail: "#fbcfe8", flecks: "#f9a8d4" }
  ],

  tileLayer(game) {
    if (!this.canvasSupported() || !game) return null;
    const key = this.keyFor(game);
    if (this._tile && this._tileKey === key) return this._tile;
    const map = game.getActiveMap ? game.getActiveMap() : null;
    if (!map) return null;
    const T = (typeof TILE_SIZE !== "undefined") ? TILE_SIZE : 32;
    const layer = this._mk(map[0].length * T, map.length * T);
    const ctx = layer.getContext("2d");
    const pal = this.TILE_PALETTES[game.currentPlanetIndex] || this.TILE_PALETTES[0];
    const planet = game.currentPlanetIndex;

    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const val = map[r][c];
        if (val !== 1 && val !== 2) continue;
        const tx = c * T, ty = r * T;

        if (val === 1) {
          const isTop = (r > 0 && map[r - 1][c] !== 1);
          const airL = (c > 0 && map[r][c - 1] !== 1);
          const airR = (c < map[r].length - 1 && map[r][c + 1] !== 1);
          const grad = ctx.createLinearGradient(tx, ty, tx, ty + T);
          grad.addColorStop(0, isTop ? pal.top : pal.body);
          grad.addColorStop(1, pal.shade);
          ctx.fillStyle = grad;
          ctx.fillRect(tx, ty, T, T);

          // Mineral flecks + body texture (deterministic per tile — bake-time only).
          for (let i = 0; i < 4; i++) {
            const h1 = this._hash(r * 7 + i, c * 11 + i);
            const h2 = this._hash(c * 5 + i, r * 13 + i);
            ctx.fillStyle = h1 > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.10)";
            ctx.fillRect(tx + 3 + h1 * (T - 8), ty + 6 + h2 * (T - 10), 2 + h2 * 2, 1.5);
          }
          if (this._hash(r, c) > 0.72) {
            ctx.fillStyle = pal.flecks;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(tx + 6 + this._hash(c, r) * (T - 14), ty + 10 + this._hash(r + 1, c) * (T - 16), 2, 2);
            ctx.globalAlpha = 1;
          }

          if (isTop) {
            // Surface cap + bright sun-edge.
            ctx.fillStyle = pal.top;
            ctx.fillRect(tx, ty, T, 7);
            ctx.fillStyle = "rgba(255,255,255,0.30)";
            ctx.fillRect(tx, ty, T, 2);
            // Planet-themed surface life (only affordable because it bakes once).
            for (let i = 0; i < 3; i++) {
              const h = this._hash(r * 31 + i, c * 17 + i);
              const px = tx + 4 + h * (T - 8);
              if (planet === 0) {        // Earth: grass blades
                ctx.strokeStyle = "rgba(20,83,45,0.85)";
                ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.moveTo(px, ty + 7); ctx.lineTo(px + (h - 0.5) * 3, ty + 1.5); ctx.stroke();
              } else if (planet === 1) { // Moon: micro-craters
                ctx.fillStyle = "rgba(51,65,85,0.55)";
                ctx.beginPath(); ctx.ellipse(px, ty + 4, 2.4, 1.3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "rgba(226,232,240,0.5)";
                ctx.fillRect(px - 2, ty + 2.4, 4, 1);
              } else if (planet === 2) { // Jupiter: ember studs
                ctx.fillStyle = h > 0.5 ? "#fde68a" : "#fdba74";
                ctx.fillRect(px, ty + 2 + h * 3, 2, 2);
              } else if (planet === 3) { // Glacies: ice shards
                ctx.fillStyle = "rgba(233,213,255,0.8)";
                ctx.beginPath(); ctx.moveTo(px, ty + 7); ctx.lineTo(px + 2, ty + 1 + h * 2); ctx.lineTo(px + 4, ty + 7); ctx.closePath(); ctx.fill();
              } else {                   // Mag-Net: circuit ticks
                ctx.fillStyle = h > 0.5 ? "#f9a8d4" : "#67e8f9";
                ctx.fillRect(px, ty + 3, 3, 1.2);
                if (h > 0.6) ctx.fillRect(px + 1, ty + 3, 1.2, 3);
              }
            }
            if (planet === 3) {          // ice sheen streak across the cap
              ctx.fillStyle = "rgba(255,255,255,0.18)";
              ctx.fillRect(tx + 4, ty + 4, T - 8, 1.2);
            }
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.08)";
            if ((c * 17 + r * 11) % 5 === 0) {
              ctx.beginPath(); ctx.arc(tx + 10, ty + 12, 2, 0, Math.PI * 2); ctx.fill();
            }
          }

          // Ambient occlusion: world feels solid — soft shade under ledges and on
          // air-facing walls. Pure gradient cost, paid once.
          if (isTop && r + 1 < map.length && map[r + 1][c] === 1) {
            const ao = ctx.createLinearGradient(0, ty + T, 0, ty + T + 7);
            ao.addColorStop(0, "rgba(0,0,0,0.30)");
            ao.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = ao;
            ctx.fillRect(tx, ty + T, T, 7);
          }
          if (airL) { ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(tx, ty, 1.6, T); }
          if (airR) { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(tx + T - 1.6, ty, 1.6, T); }

          ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
          ctx.lineWidth = 1;
          ctx.strokeRect(tx + 0.5, ty + 0.5, T - 1, T - 1);
        } else {
          // Hazard spikes: the glow is BAKED (shadowBlur once, never per frame).
          ctx.save();
          ctx.fillStyle = "#fb7185";
          ctx.strokeStyle = "#ffe4e6";
          ctx.shadowBlur = 9;
          ctx.shadowColor = "#fb7185";
          ctx.beginPath();
          ctx.moveTo(tx, ty + T);
          ctx.lineTo(tx + T / 2, ty);
          ctx.lineTo(tx + T, ty + T);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          // Hot tip + lava pool at the base for menace.
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath(); ctx.moveTo(tx + T / 2 - 2, ty + 6); ctx.lineTo(tx + T / 2, ty + 1); ctx.lineTo(tx + T / 2 + 2, ty + 6); ctx.closePath(); ctx.fill();
          const pool = ctx.createLinearGradient(0, ty + T - 5, 0, ty + T);
          pool.addColorStop(0, "rgba(251,113,133,0)");
          pool.addColorStop(1, "rgba(251,113,133,0.45)");
          ctx.fillStyle = pool;
          ctx.fillRect(tx - 3, ty + T - 5, T + 6, 5);
          ctx.restore();
        }
      }
    }
    this._tile = layer;
    this._tileKey = key;
    return layer;
  },

  // ---------------- sky / starfield / vignette ----------------

  SKY_ACCENTS: ["#14532d", "#0e7490", "#7c2d12", "#4c1d95", "#831843"],
  NEBULAE: ["#86efac", "#67e8f9", "#fdba74", "#c4b5fd", "#f9a8d4"],

  sky(game) {
    if (!this.canvasSupported() || !game || !game.canvas) return null;
    const key = this.keyFor(game) + ":" + game.canvas.width;
    if (this._sky && this._skyKey === key) return this._sky;
    const W = game.canvas.width, H = game.canvas.height;
    const sky = this._mk(W, H);
    const ctx = sky.getContext("2d");
    const p = game.currentPlanetIndex;
    const accent = this.SKY_ACCENTS[p] || "#0f172a";
    const nebula = this.NEBULAE[p] || "#93c5fd";

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, accent);
    grad.addColorStop(0.55, (game.currentPlanet && game.currentPlanet.skyColor) || "#0b1022");
    grad.addColorStop(1, "#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Far pin-stars baked straight into the sky (the parallax fields sit above).
    for (let i = 0; i < 60; i++) {
      const h1 = this._hash(i, p + 2), h2 = this._hash(p + 5, i);
      ctx.globalAlpha = 0.25 + h2 * 0.3;
      ctx.fillStyle = i % 7 === 0 ? nebula : "#e2e8f0";
      ctx.fillRect(h1 * W, h2 * H * 0.8, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Nebula blobs — soft multi-stop radials we'd never run per frame.
    const blob = (bx, by, br, alpha) => {
      const ng = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      ng.addColorStop(0, nebula + "");
      ng.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    };
    blob(W * 0.78, H * 0.18, 95, 0.16);
    blob(W * 0.22, H * 0.27, 70, 0.10);
    blob(W * 0.5, H * 0.08, 120, 0.06);

    // A distant sister world watching over the level (per-planet body).
    const bodies = [
      { x: 0.86, y: 0.13, r: 16, c1: "#cbd5e1", c2: "#64748b" }, // Earth sees the Moon
      { x: 0.84, y: 0.15, r: 18, c1: "#7dd3fc", c2: "#1d4ed8" }, // Moon sees Earth
      { x: 0.88, y: 0.12, r: 13, c1: "#fef3c7", c2: "#b45309" }, // Jupiter: Io
      { x: 0.85, y: 0.14, r: 15, c1: "#ddd6fe", c2: "#6d28d9" }, // Glacies twin
      { x: 0.87, y: 0.13, r: 14, c1: "#fbcfe8", c2: "#9d174d" }  // Mag-Net core
    ];
    const b = bodies[p] || bodies[0];
    const bx = W * b.x, by = H * b.y, br = b.r;
    const bg = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.4, br * 0.2, bx, by, br);
    bg.addColorStop(0, b.c1);
    bg.addColorStop(1, b.c2);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(2,6,23,0.45)"; // night-side bite
    ctx.beginPath(); ctx.arc(bx + br * 0.45, by - br * 0.1, br * 0.92, 0, Math.PI * 2); ctx.fill();

    // Horizon glow where sky meets terrain — grounds the whole scene.
    const hg = ctx.createLinearGradient(0, H * 0.68, 0, H);
    hg.addColorStop(0, "rgba(0,0,0,0)");
    hg.addColorStop(1, this._withAlpha(nebula, 0.18));
    ctx.fillStyle = hg;
    ctx.fillRect(0, H * 0.68, W, H * 0.32);

    this._sky = sky;
    this._skyKey = key;
    return sky;
  },

  _withAlpha(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },

  // Two wrapped parallax starfields (speeds applied by the caller).
  starLayers(W, H) {
    if (!this.canvasSupported()) return null;
    if (this._starFar && this._starFar.width === W) return { far: this._starFar, near: this._starNear };
    const paint = (count, minS, maxS, alpha, sparkle) => {
      const c = this._mk(W, H);
      const ctx = c.getContext("2d");
      for (let i = 0; i < count; i++) {
        const h1 = this._hash(i * 3 + 1, i + 7), h2 = this._hash(i + 11, i * 5 + 3), h3 = this._hash(i * 13, i);
        const x = h1 * W, y = h2 * H * 0.92, s = minS + h3 * (maxS - minS);
        ctx.globalAlpha = alpha * (0.55 + h3 * 0.45);
        ctx.fillStyle = i % 9 === 0 ? "#bae6fd" : i % 13 === 0 ? "#fde68a" : "#f8fafc";
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        if (sparkle && i % 8 === 0) { // 4-point twinkle cross on a few
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillRect(x - s * 3, y - 0.5, s * 6, 1);
          ctx.fillRect(x - 0.5, y - s * 3, 1, s * 6);
        }
      }
      ctx.globalAlpha = 1;
      return c;
    };
    this._starFar = paint(48, 0.5, 1.2, 0.5, false);
    this._starNear = paint(26, 1.0, 2.1, 0.85, true);
    return { far: this._starFar, near: this._starNear };
  },

  // A dozen LIVE twinkle stars keep the sky breathing (12 arcs/frame, no shadows).
  twinkles(W, H) {
    if (!this._twinkles || this._twinkles.W !== W) {
      const list = [];
      for (let i = 0; i < 12; i++) {
        list.push({ x: this._hash(i, 99) * W, y: this._hash(77, i) * H * 0.7, s: 0.8 + this._hash(i, i) * 1.4, ph: this._hash(i * 9, 3) * 6.28 });
      }
      this._twinkles = { W, list };
    }
    return this._twinkles.list;
  },

  // Planet-tinted vignette: focuses the eye, hides tile pop-in at the edges.
  vignette(game) {
    if (!this.canvasSupported() || !game || !game.canvas) return null;
    const key = (game.currentPlanetIndex || 0) + ":" + game.canvas.width;
    if (this._vig && this._vigKey === key) return this._vig;
    const W = game.canvas.width, H = game.canvas.height;
    const v = this._mk(W, H);
    const ctx = v.getContext("2d");
    const g = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.52, W / 2, H * 0.52, H * 0.95);
    g.addColorStop(0, "rgba(2,6,23,0)");
    g.addColorStop(1, "rgba(2,6,23,0.34)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    this._vig = v;
    this._vigKey = key;
    return v;
  },

  // ---------------- glow sprites (replace per-frame shadowBlur) ----------------

  glowSprite(color, radius) {
    const r = radius || 10;
    const key = color + "|" + r;
    if (this._glows[key]) return this._glows[key];
    if (!this.canvasSupported()) return null;
    const size = r * 4;
    const c = this._mk(size, size);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.35, this._safeAlpha(color, 0.55));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this._glows[key] = c;
    return c;
  },

  _safeAlpha(color, a) {
    if (color && color[0] === "#" && (color.length === 7)) return this._withAlpha(color, a);
    return color; // named/rgba colors: midpoint stop just reuses the color
  }
};

if (typeof window !== "undefined") window.RenderCache = RenderCache;
if (typeof module !== "undefined" && module.exports) module.exports = { RenderCache };
