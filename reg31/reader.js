/* Photo reader for the REG 31 Assistant.
   Finds lines of characters in a photo (ignoring dust, barcodes and glare), cleans each line up, and hands it to Tesseract.
   Everything runs in the browser. Results are suggestions: the form still needs your eyes on the vehicle. */
(function () {
'use strict';

const MAXW = 1600;

function toGray(src, maxW) {
  const sc = Math.min(1, maxW / src.width);
  const w = Math.round(src.width * sc), h = Math.round(src.height * sc);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  return { w, h, gray };
}

// mean filter via integral image (radius r)
function boxBlur(a, w, h, r) {
  const W = w + 1, I = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += a[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; } }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

function components(mask, w, h) {
  const lab = new Int32Array(w * h); const parent = [0];
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  let next = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!mask[i]) continue;
    let l = 0;
    const nb = [];
    if (x > 0 && lab[i - 1]) nb.push(lab[i - 1]);
    if (y > 0) { if (lab[i - w]) nb.push(lab[i - w]); if (x > 0 && lab[i - w - 1]) nb.push(lab[i - w - 1]); if (x < w - 1 && lab[i - w + 1]) nb.push(lab[i - w + 1]); }
    if (!nb.length) { l = next; parent[next] = next; next++; } else { l = Math.min.apply(null, nb); nb.forEach((n) => uni(l, n)); }
    lab[i] = l;
  }
  const boxes = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = lab[y * w + x]; if (!l) continue; const r = find(l);
    let b = boxes.get(r);
    if (!b) { b = { x0: x, y0: y, x1: x, y1: y, area: 0 }; boxes.set(r, b); }
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; b.area++;
  }
  return Array.from(boxes.values()).map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, area: b.area }));
}

// group character-sized components into text lines
function findLines(img, sign, maxFrac) {
  const { w, h, gray } = img;
  const bg = boxBlur(gray, w, h, 30);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = (sign * (gray[i] - bg[i]) > 20) ? 1 : 0;
  const comps = components(mask, w, h).filter((c) => c.h >= 14 && c.h <= h * (maxFrac || 0.22) && c.w <= c.h * 1.3 && c.w >= c.h * 0.12 && c.area >= 0.18 * c.w * c.h && c.area <= 0.92 * c.w * c.h);
  comps.sort((a, b) => a.x0 - b.x0);
  const lines = [];
  comps.forEach((c) => {
    const cy = (c.y0 + c.y1) / 2;
    let best = null, bd = 1e9;
    lines.forEach((L) => {
      const mh = L.mh, last = L.items[L.items.length - 1];
      if (Math.abs(cy - L.cy) < 0.4 * mh && Math.abs(c.h - mh) < 0.35 * mh && c.x0 - last.x1 < 2.4 * mh && c.x0 >= last.x0) {
        const d = Math.abs(cy - L.cy); if (d < bd) { bd = d; best = L; }
      }
    });
    if (best) { best.items.push(c); best.cy = best.items.reduce((s, k) => s + (k.y0 + k.y1) / 2, 0) / best.items.length; best.mh = best.items.reduce((s, k) => s + k.h, 0) / best.items.length; }
    else lines.push({ items: [c], cy, mh: c.h });
  });
  return lines.filter((L) => L.items.length >= 3).map((L) => {
    const x0 = Math.min.apply(null, L.items.map((k) => k.x0)), x1 = Math.max.apply(null, L.items.map((k) => k.x1));
    const y0 = Math.min.apply(null, L.items.map((k) => k.y0)), y1 = Math.max.apply(null, L.items.map((k) => k.y1));
    return { n: L.items.length, mh: L.mh, x0, x1, y0, y1, sign };
  });
}

function otsu(hist, total) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, max = 0, th = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > max) { max = v; th = t; }
  }
  return th;
}

// Crop a region, flatten the lighting, binarize, drop specks, return a clean dark-on-white canvas for OCR.
function cleanCrop(img, box, sign, lineH, trimPrefix, outH) {
  const pad = Math.round(lineH * 0.35);
  const x0 = Math.max(0, box.x0 - pad), y0 = Math.max(0, box.y0 - pad), x1 = Math.min(img.w - 1, box.x1 + pad), y1 = Math.min(img.h - 1, box.y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = img.gray[(y0 + y) * img.w + x0 + x];
  const bg = boxBlur(g, w, h, Math.max(8, Math.round(lineH * 0.6)));
  const gs = boxBlur(g, w, h, 1);
  const norm = new Uint8Array(w * h); const hist = new Float64Array(256);
  for (let i = 0; i < norm.length; i++) {
    let v = 128 + sign * (gs[i] / Math.max(1, bg[i]) * 128 - 128) * 2.2; // text -> bright
    v = Math.max(0, Math.min(255, v)); norm[i] = v; hist[v | 0]++;
  }
  const th = otsu(hist, w * h);
  const mask = new Uint8Array(w * h); for (let i = 0; i < mask.length; i++) mask[i] = norm[i] > th ? 1 : 0;
  const comps = components(mask, w, h);
  // keep only glyph-sized pieces
  const keep = new Uint8Array(w * h);
  let ok = comps.filter((c) => c.h >= lineH * 0.5 && c.h <= lineH * 1.5 && c.area >= 0.12 * c.w * c.h);
  if (!ok.length) return null;
  // keep only pieces sitting on the same line as most glyphs (drops barcode fragments, reflections)
  const cys = ok.map((c) => (c.y0 + c.y1) / 2).sort((a, b) => a - b), med = cys[cys.length >> 1];
  ok = ok.filter((c) => Math.abs((c.y0 + c.y1) / 2 - med) < 0.3 * lineH && c.h >= lineH * 0.6);
  if (!ok.length) return null;
  if (trimPrefix && ok.length > 17) { // drop a short leading word such as "VIN" separated by a wide gap
    const so = ok.slice().sort((a, b) => a.x0 - b.x0);
    for (let k = 1; k <= 4 && k < so.length; k++) {
      const gap = so[k].x0 - so[k - 1].x1;
      if (gap > lineH * 0.9 && so.length - k >= 15) { const cut = so[k].x0; ok = ok.filter((c) => c.x0 >= cut); break; }
    }
  }
  const gx0 = Math.min.apply(null, ok.map((c) => c.x0)), gx1 = Math.max.apply(null, ok.map((c) => c.x1));
  const gy0 = Math.min.apply(null, ok.map((c) => c.y0)), gy1 = Math.max.apply(null, ok.map((c) => c.y1));
  // paint kept components (bbox-bounded) from the mask
  for (const c of ok) for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) { const i = y * w + x; if (mask[i]) keep[i] = 1; }
  const cw = gx1 - gx0 + 1, ch = gy1 - gy0 + 1;
  const OH = outH || 64; const target = OH / ch; const B = Math.round(OH * 0.44);
  const out = document.createElement('canvas'); out.width = Math.round(cw * target) + B * 2; out.height = OH + B * 2;
  const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
  const tg = tmp.getContext('2d'); const id = tg.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const v = keep[(gy0 + y) * w + gx0 + x] ? 0 : 255; const k = (y * cw + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
  tg.putImageData(id, 0, 0);
  const og = out.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, out.width, out.height);
  og.imageSmoothingEnabled = true; og.drawImage(tmp, B, B, Math.round(cw * target), OH);
  return out;
}

// find lines inside a user-drawn box (coordinates are returned in full-image space)
function findLinesIn(img, box, sign) {
  const x0 = Math.max(0, box.x0), y0 = Math.max(0, box.y0), x1 = Math.min(img.w - 1, box.x1), y1 = Math.min(img.h - 1, box.y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 20 || h < 10) return [];
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = img.gray[(y0 + y) * img.w + x0 + x];
  return findLines({ w, h, gray }, sign, 1.0).map((L) => Object.assign({}, L, { x0: L.x0 + x0, x1: L.x1 + x0, y0: L.y0 + y0, y1: L.y1 + y0 }));
}
// grayscale copy with the lighting flattened (helps reading whole labels and documents)
function flatCanvas(img) {
  const { w, h, gray } = img;
  const bg = boxBlur(gray, w, h, 40);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const id = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, 128 + (gray[i] / Math.max(1, bg[i]) * 128 - 128) * 1.8)); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  return c;
}
window.Reader = { toGray, findLines, findLinesIn, cleanCrop, flatCanvas, MAXW };
})();
