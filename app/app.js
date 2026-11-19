// Neon Sunset Cover Studio — an offline GTA-style poster cover maker.
// Every photo stays on the machine (FileReader only). The cover is drawn on a
// 2D canvas: photo panels, a colour grade, hand-drawn badge and skyline art,
// bold display lettering, then exported as a PNG in a post size.
'use strict';

/* ------------------------------------------------------------------ state */

const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide' },
};
const GRADES = {
  sunset: { filter: 'saturate(1.28) contrast(1.08)', wash: ['#ff2e88', '#ff7a3d', '#ffd166'], washMode: 'overlay' },
  neon: { filter: 'saturate(1.7) hue-rotate(-12deg) contrast(1.12)', wash: ['#ff2e9e', '#3d2bff', '#00e5ff'], washMode: 'overlay' },
  noir: { filter: 'grayscale(1) contrast(1.28) brightness(1.05)', wash: ['#222222', '#555555', '#dddddd'], washMode: 'soft-light' },
  gold: { filter: 'sepia(0.5) saturate(1.5) contrast(1.06)', wash: ['#7a4a00', '#e8a020', '#ffe9a8'], washMode: 'overlay' },
};

const state = {
  size: '1080x1080',
  layout: 'hero',
  grade: 'sunset',
  gradeStrength: 0.7,
  title: 'VICE NIGHTS',
  subtitle: 'a Leonida story',
  titleSize: 110,
  titlePos: 'bottom',
  titleColor: '#ffffff',
  outline: true,
  badge: true,
  grain: true,
  photos: [], // { img: HTMLImageElement, name: string }
  panels: [
    { photo: -1, scale: 1.15, ox: 0, oy: 0 },
    { photo: -1, scale: 1.15, ox: 0, oy: 0 },
    { photo: -1, scale: 1.15, ox: 0, oy: 0 },
    { photo: -1, scale: 1.15, ox: 0, oy: 0 },
  ],
  selectedPanel: 0,
  selectedPhoto: -1,
};

/* ------------------------------------------------------------------ helpers */

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

/* ------------------------------------------------------------------ layouts */

// Panel rectangles in cover pixels. Gutters are applied by the renderer.
function layoutRects(layout, W, H) {
  const wide = W >= H;
  if (layout === 'full') return [{ x: 0, y: 0, w: W, h: H }];
  if (layout === 'grid') {
    return [
      { x: 0, y: 0, w: W / 2, h: H / 2 },
      { x: W / 2, y: 0, w: W / 2, h: H / 2 },
      { x: 0, y: H / 2, w: W / 2, h: H / 2 },
      { x: W / 2, y: H / 2, w: W / 2, h: H / 2 },
    ];
  }
  if (layout === 'strip') {
    if (wide) {
      return [
        { x: 0, y: 0, w: W / 3, h: H },
        { x: W / 3, y: 0, w: W / 3, h: H },
        { x: (2 * W) / 3, y: 0, w: W / 3, h: H },
      ];
    }
    return [
      { x: 0, y: 0, w: W, h: H / 3 },
      { x: 0, y: H / 3, w: W, h: H / 3 },
      { x: 0, y: (2 * H) / 3, w: W, h: H / 3 },
    ];
  }
  // hero: one large panel + two small ones
  if (wide) {
    return [
      { x: 0, y: 0, w: W * 0.62, h: H },
      { x: W * 0.62, y: 0, w: W * 0.38, h: H / 2 },
      { x: W * 0.62, y: H / 2, w: W * 0.38, h: H / 2 },
    ];
  }
  return [
    { x: 0, y: 0, w: W, h: H * 0.62 },
    { x: 0, y: H * 0.62, w: W / 2, h: H * 0.38 },
    { x: W / 2, y: H * 0.62, w: W / 2, h: H * 0.38 },
  ];
}
function panelCount(layout) {
  return layout === 'full' ? 1 : layout === 'grid' ? 4 : 3;
}

/* ------------------------------------------------------------------ drawing */

// A sunset skyline, drawn with code: dark towers with lit windows.
function drawSkyline(ctx, W, H, yBase, height, seed) {
  const r = mulberry32(seed);
  let x = -10;
  ctx.save();
  while (x < W + 10) {
    const bw = W * (0.04 + r() * 0.09);
    const bh = height * (0.35 + r() * 0.65);
    ctx.fillStyle = '#160a24';
    ctx.fillRect(x, yBase - bh, bw, bh);
    ctx.fillStyle = '#ffd166';
    for (let wy = yBase - bh + 8; wy < yBase - 8; wy += 16) {
      for (let wx = x + 6; wx < x + bw - 6; wx += 14) {
        if (r() < 0.28) ctx.fillRect(wx, wy, 4, 6);
      }
    }
    x += bw + 3 + r() * 10;
  }
  ctx.restore();
}

// The badge: a setting sun with rays and a palm silhouette, drawn by hand.
function drawBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  // sun disc
  const sun = ctx.createRadialGradient(0, -r * 0.1, r * 0.1, 0, 0, r);
  sun.addColorStop(0, '#ffe9a8');
  sun.addColorStop(0.55, '#ff9a3d');
  sun.addColorStop(1, '#ff2e88');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(0, -r * 0.08, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // rays
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  for (let k = 0; k < 8; k++) {
    const a = (-Math.PI / 2) + (k - 3.5) * 0.32;
    const x1 = Math.cos(a) * r * 0.72;
    const y1 = -r * 0.08 + Math.sin(a) * r * 0.72;
    const x2 = Math.cos(a) * r * 0.95;
    const y2 = -r * 0.08 + Math.sin(a) * r * 0.95;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Palm trunk: a thick curved stroke from the badge's lower edge to the crown.
  ctx.strokeStyle = '#1b1030';
  ctx.lineWidth = r * 0.13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, r * 0.92);
  ctx.quadraticCurveTo(-r * 0.18, r * 0.5, r * 0.02, r * 0.22);
  ctx.stroke();
  // Palm fronds: short curved strokes arcing out of the crown, then drooping.
  ctx.lineWidth = r * 0.1;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI * 0.06 - (k / 5) * Math.PI * 0.88;
    const len = r * (0.38 + (k % 3) * 0.06);
    const tipX = r * 0.02 + Math.cos(a) * len;
    const tipY = r * 0.22 + Math.sin(a) * len * 0.3 + r * 0.26;
    ctx.beginPath();
    ctx.moveTo(r * 0.02, r * 0.22);
    ctx.quadraticCurveTo(
      r * 0.02 + Math.cos(a) * len * 0.6,
      r * 0.22 + Math.sin(a) * len * 0.25 - r * 0.08,
      tipX, tipY,
    );
    ctx.stroke();
  }
  // ring
  ctx.strokeStyle = 'rgba(255,233,168,0.9)';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// One photo panel: cover-fit with the panel's pan/zoom, then the colour grade.
function drawPhotoPanel(ctx, rect, panel, grade, strength) {
  const g = GRADES[grade];
  const photo = state.photos[panel.photo];
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (photo) {
    const img = photo.img;
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const s = base * panel.scale;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const dx = rect.x + (rect.w - dw) / 2 + panel.ox;
    const dy = rect.y + (rect.h - dh) / 2 + panel.oy;
    ctx.filter = g.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    // Empty panel: a drawn sunset placeholder so the layout reads even before photos.
    const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    sky.addColorStop(0, '#2a1050');
    sky.addColorStop(0.55, '#c22e6e');
    sky.addColorStop(1, '#ff9a3d');
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,233,168,0.9)';
    ctx.beginPath();
    ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.42, Math.min(rect.w, rect.h) * 0.14, 0, Math.PI * 2);
    ctx.fill();
    drawSkyline(ctx, rect.w, rect.h, rect.y + rect.h * 0.82, rect.h * 0.3, 11);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.max(13, rect.w * 0.045)}px "CoverUI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h * 0.58);
  }
  // Colour wash over the panel.
  if (strength > 0) {
    const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    wash.addColorStop(0, g.wash[0]);
    wash.addColorStop(0.5, g.wash[1]);
    wash.addColorStop(1, g.wash[2]);
    ctx.globalCompositeOperation = g.washMode;
    ctx.globalAlpha = 0.34 * strength;
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// Bold display title with outline and gradient fill, fitted to the cover width.
// The title and subtitle are laid out as one block that always fits on-canvas.
function drawTitle(ctx, W, H) {
  const title = state.title.trim();
  const subtitle = state.subtitle.trim();
  if (!title && !subtitle) return;
  const unit = W / 1080;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit the title size to the cover width.
  let titlePx = state.titleSize * unit;
  const setFont = (s) => { ctx.font = `900 ${s}px "CoverDisplay", "Arial Narrow", sans-serif`; };
  if (title) {
    setFont(titlePx);
    while (ctx.measureText(title.toUpperCase()).width > W * 0.94 && titlePx > 24) {
      titlePx *= 0.94;
      setFont(titlePx);
    }
  }
  const subPx = Math.max(16, state.titleSize * 0.24 * unit);
  const gap = titlePx * 0.22;
  const blockH = (title ? titlePx : 0) + (title && subtitle ? gap : 0) + (subtitle ? subPx : 0);
  let titleY = 0;
  let subY = 0;
  if (state.titlePos === 'top') {
    const top = H * 0.04;
    titleY = top + titlePx / 2;
    subY = top + titlePx + gap + subPx / 2;
  } else if (state.titlePos === 'middle') {
    const top = H * 0.5 - blockH / 2;
    titleY = top + titlePx / 2;
    subY = top + titlePx + gap + subPx / 2;
  } else {
    const bottom = H * 0.965;
    subY = bottom - subPx / 2;
    titleY = bottom - subPx - gap - titlePx / 2;
  }
  // Readability scrim behind the whole lettering block.
  const scrimTop = (title ? titleY - titlePx / 2 : subY - subPx / 2) - 26 * unit;
  const scrimBottom = (subtitle ? subY + subPx / 2 : titleY + titlePx / 2) + 26 * unit;
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, scrimBottom);
  scrim.addColorStop(0, 'rgba(10,4,20,0)');
  scrim.addColorStop(0.5, 'rgba(10,4,20,0.55)');
  scrim.addColorStop(1, 'rgba(10,4,20,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, W, scrimBottom - scrimTop);

  if (title) {
    setFont(titlePx);
    const grad = ctx.createLinearGradient(0, titleY - titlePx * 0.5, 0, titleY + titlePx * 0.5);
    grad.addColorStop(0, state.titleColor);
    grad.addColorStop(0.55, state.titleColor);
    grad.addColorStop(1, shade(state.titleColor, 0.62));
    const text = title.toUpperCase();
    if (state.outline) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#14081f';
      ctx.lineWidth = titlePx * 0.09;
      ctx.strokeText(text, W / 2, titleY);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = titlePx * 0.02;
      ctx.strokeText(text, W / 2, titleY);
    }
    ctx.fillStyle = grad;
    ctx.fillText(text, W / 2, titleY);
  }
  if (subtitle) {
    ctx.font = `italic 700 ${subPx}px "CoverUI", sans-serif`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(subtitle.toUpperCase(), W / 2, subY);
    // small rule lines flanking the subtitle
    const tw = ctx.measureText(subtitle.toUpperCase()).width;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(2, subPx * 0.08);
    ctx.beginPath();
    ctx.moveTo(W / 2 - tw / 2 - 90 * unit, subY);
    ctx.lineTo(W / 2 - tw / 2 - 26 * unit, subY);
    ctx.moveTo(W / 2 + tw / 2 + 26 * unit, subY);
    ctx.lineTo(W / 2 + tw / 2 + 90 * unit, subY);
    ctx.stroke();
  }
}

// Film grain + vignette over the whole cover.
function drawFinish(ctx, W, H) {
  if (!state.grain) return;
  const r = mulberry32(20261119);
  ctx.save();
  for (let i = 0; i < W * H / 260; i++) {
    const v = r();
    ctx.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(r() * W, r() * H, 1.6, 1.6);
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,2,16,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// The full cover render. Returns the canvas it drew on.
function renderCover(target, W, H) {
  const ctx = target.getContext('2d');
  if (target.width !== W) target.width = W;
  if (target.height !== H) target.height = H;
  // Backdrop: deep violet with a warm horizon glow behind the panels.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160a24');
  bg.addColorStop(0.6, '#3d1445');
  bg.addColorStop(1, '#12081f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(state.layout, W, H);
  const gutter = Math.max(5, Math.round(W * 0.006));
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    const r = rects[i];
    const inset = {
      x: r.x + gutter, y: r.y + gutter,
      w: r.w - gutter * 2, h: r.h - gutter * 2,
    };
    // Thin pale frame line around each panel.
    ctx.fillStyle = 'rgba(255,238,200,0.85)';
    ctx.fillRect(r.x + gutter / 2, r.y + gutter / 2, r.w - gutter, r.h - gutter);
    drawPhotoPanel(ctx, inset, state.panels[i], state.grade, state.gradeStrength);
  }
  // A drawn skyline strip crowns a full-bleed cover.
  if (state.layout === 'full') {
    drawSkyline(ctx, W, H, H * 0.16, H * 0.1, 5);
  }
  drawTitle(ctx, W, H);
  if (state.badge) {
    const br = Math.max(34, W * 0.052);
    drawBadge(ctx, W - br * 1.25, br * 1.3, br);
  }
  drawFinish(ctx, W, H);
  return target;
}

/* ------------------------------------------------------------------ preview */

const previewCanvas = $('previewCanvas');
const exportCanvas = document.createElement('canvas');

function renderPreview() {
  const { w, h } = SIZES[state.size];
  renderCover(previewCanvas, w, h);
  // Mark the selected panel with a gold frame on the preview.
  const ctx = previewCanvas.getContext('2d');
  const rects = layoutRects(state.layout, w, h);
  const n = panelCount(state.layout);
  if (state.selectedPanel < n) {
    const r = rects[state.selectedPanel];
    ctx.save();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(4, w * 0.008);
    ctx.setLineDash([18, 10]);
    ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ photos */

function addPhoto(img, name) {
  state.photos.push({ img, name });
  state.selectedPhoto = state.photos.length - 1;
  // Place it in the selected panel if that panel is empty.
  if (state.panels[state.selectedPanel].photo < 0) {
    state.panels[state.selectedPanel].photo = state.selectedPhoto;
  }
  refreshPhotoStrip();
  refreshPanelPhotoSelect();
  renderPreview();
}
function loadPhotoFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => addPhoto(img, file.name);
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}
function loadSample(url, name) {
  const img = new Image();
  img.onload = () => addPhoto(img, name);
  img.src = url;
}
function refreshPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((p, i) => {
    const t = document.createElement('img');
    t.className = 'thumb' + (i === state.selectedPhoto ? ' is-active' : '');
    t.src = p.img.src;
    t.alt = p.name;
    t.title = p.name;
    t.addEventListener('click', () => {
      state.selectedPhoto = i;
      state.panels[state.selectedPanel].photo = i;
      refreshPhotoStrip();
      refreshPanelPhotoSelect();
      renderPreview();
    });
    strip.appendChild(t);
  });
}
function refreshPanelPhotoSelect() {
  const sel = $('panelPhoto');
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = '— empty —';
  sel.appendChild(none);
  state.photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = p.name;
    sel.appendChild(o);
  });
  sel.value = String(state.panels[state.selectedPanel].photo);
}

/* ------------------------------------------------------------------ export */

function exportCover(sizeKey) {
  const { w, h } = SIZES[sizeKey || state.size];
  renderCover(exportCanvas, w, h);
  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neon-sunset-cover-${w}x${h}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve({ blob, width: w, height: h });
    }, 'image/png');
  });
}
// Automation hook: render the export and hand back a data URL (used by screenshots/tests).
window.__exportCoverDataURL = function (sizeKey) {
  const { w, h } = SIZES[sizeKey || state.size];
  renderCover(exportCanvas, w, h);
  return exportCanvas.toDataURL('image/png');
};
window.__coverState = function () {
  return { size: state.size, layout: state.layout, grade: state.grade, photos: state.photos.length };
};

/* ------------------------------------------------------------------ wiring */

function setActive(groupEl, btn, attr) {
  groupEl.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
}
function bindControls() {
  $('photoInput').addEventListener('change', (e) => {
    for (const f of e.target.files) loadPhotoFile(f);
    e.target.value = '';
  });
  document.querySelectorAll('.sampleBtn').forEach((b) => {
    b.addEventListener('click', () => loadSample(b.dataset.sample, b.textContent.trim()));
  });
  document.querySelectorAll('.layoutBtn').forEach((b) => {
    b.addEventListener('click', () => {
      state.layout = b.dataset.layout;
      state.selectedPanel = 0;
      setActive($('layoutBtns'), b);
      refreshPanelPhotoSelect();
      renderPreview();
    });
  });
  document.querySelectorAll('.gradeBtn').forEach((b) => {
    b.addEventListener('click', () => {
      state.grade = b.dataset.grade;
      setActive($('gradeBtns'), b);
      renderPreview();
    });
  });
  document.querySelectorAll('.sizeBtn').forEach((b) => {
    b.addEventListener('click', () => {
      state.size = b.dataset.size;
      setActive($('sizeRow'), b);
      renderPreview();
    });
  });
  document.querySelectorAll('#titleColors .swatch').forEach((b) => {
    b.addEventListener('click', () => {
      state.titleColor = b.dataset.color;
      setActive($('titleColors'), b);
      renderPreview();
    });
  });
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  $('titleSizeSlider').addEventListener('input', (e) => { state.titleSize = Number(e.target.value); renderPreview(); });
  $('titlePos').addEventListener('change', (e) => { state.titlePos = e.target.value; renderPreview(); });
  $('gradeSlider').addEventListener('input', (e) => { state.gradeStrength = Number(e.target.value) / 100; renderPreview(); });
  $('zoomSlider').addEventListener('input', (e) => {
    state.panels[state.selectedPanel].scale = Number(e.target.value);
    renderPreview();
  });
  $('outlineCheck').addEventListener('change', (e) => { state.outline = e.target.checked; renderPreview(); });
  $('badgeCheck').addEventListener('change', (e) => { state.badge = e.target.checked; renderPreview(); });
  $('grainCheck').addEventListener('change', (e) => { state.grain = e.target.checked; renderPreview(); });
  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[state.selectedPanel].photo = Number(e.target.value);
    if (Number(e.target.value) >= 0) state.selectedPhoto = Number(e.target.value);
    refreshPhotoStrip();
    renderPreview();
  });
  $('fillBtn').addEventListener('click', () => {
    const p = state.panels[state.selectedPanel];
    p.scale = 1;
    p.ox = 0;
    p.oy = 0;
    $('zoomSlider').value = '1';
    renderPreview();
  });
  $('resetBtn').addEventListener('click', () => {
    const p = state.panels[state.selectedPanel];
    p.scale = 1.15;
    p.ox = 0;
    p.oy = 0;
    $('zoomSlider').value = '1.15';
    renderPreview();
  });
  $('exportBtn').addEventListener('click', async () => {
    $('exportStatus').textContent = 'Rendering PNG…';
    const out = await exportCover(state.size);
    const { w, h } = SIZES[state.size];
    $('exportStatus').textContent = out
      ? `Exported ${w} × ${h} PNG (${Math.round(out.blob.size / 1024)} KiB). Check your downloads.`
      : 'Export failed — try again.';
  });

  // Panel picking, panning and zooming on the preview canvas.
  let drag = null;
  const toCover = (e) => {
    const r = previewCanvas.getBoundingClientRect();
    const { w, h } = SIZES[state.size];
    return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) };
  };
  const hitPanel = (x, y) => {
    const { w, h } = SIZES[state.size];
    const rects = layoutRects(state.layout, w, h);
    for (let i = 0; i < panelCount(state.layout); i++) {
      const r = rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  };
  previewCanvas.addEventListener('pointerdown', (e) => {
    const p = toCover(e);
    const hit = hitPanel(p.x, p.y);
    if (hit < 0) return;
    state.selectedPanel = hit;
    $('zoomSlider').value = String(state.panels[hit].scale);
    refreshPanelPhotoSelect();
    renderPreview();
    drag = { x: p.x, y: p.y, ox: state.panels[hit].ox, oy: state.panels[hit].oy };
    previewCanvas.setPointerCapture(e.pointerId);
  });
  previewCanvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toCover(e);
    const panel = state.panels[state.selectedPanel];
    panel.ox = drag.ox + (p.x - drag.x);
    panel.oy = drag.oy + (p.y - drag.y);
    renderPreview();
  });
  previewCanvas.addEventListener('pointerup', () => { drag = null; });
  previewCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selectedPanel];
    panel.scale = clamp(panel.scale * (e.deltaY < 0 ? 1.08 : 0.93), 1, 3);
    $('zoomSlider').value = String(panel.scale);
    renderPreview();
  }, { passive: false });
}

/* ------------------------------------------------------------------ shot mode */

// ?shot=cover  renders an export full-frame (for screenshots of exported covers).
// ?shot=editor loads a sample and leaves the editor open (for the app screenshot).
// Params: layout, size, grade, title, subtitle, sample (1 or 2), sample2.
async function runShotMode(params) {
  const mode = params.get('shot');
  const sample = params.get('sample') || '1';
  const sample2 = params.get('sample2');
  const load = (url, name) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { addPhoto(img, name); resolve(); };
    img.onerror = () => resolve();
    img.src = url;
  });
  if (params.get('layout')) state.layout = params.get('layout');
  if (params.get('size') && SIZES[params.get('size')]) state.size = params.get('size');
  if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
  if (params.get('title') !== null) state.title = params.get('title');
  if (params.get('subtitle') !== null) state.subtitle = params.get('subtitle');
  if (params.get('titlepos')) state.titlePos = params.get('titlepos');
  await load(sample === '2' ? 'samples/pier.png' : 'samples/boulevard.png', 'sample-' + sample);
  if (sample2) await load(sample2 === '2' ? 'samples/pier.png' : 'samples/boulevard.png', 'sample-' + sample2);
  // Spread the loaded photos across the panels.
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    if (state.photos.length > 0) state.panels[i].photo = i % state.photos.length;
  }
  renderPreview();
  if (mode === 'cover') {
    const url = window.__exportCoverDataURL(state.size);
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.background = '#000';
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'display:block;width:100vw;height:100vh;object-fit:contain;background:#000;';
    document.body.appendChild(img);
  }
  window.__ready = true;
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  bindControls();
  refreshPanelPhotoSelect();
  try {
    await document.fonts.load('900 100px "CoverDisplay"');
    await document.fonts.load('700 20px "CoverUI"');
    await document.fonts.ready;
  } catch (err) {
    // Fallbacks in the font stack still render; the cover stays usable.
  }
  const params = new URLSearchParams(location.search);
  if (params.get('shot')) {
    await runShotMode(params);
  } else {
    renderPreview();
  }
  window.__ready = true;
}
boot();
