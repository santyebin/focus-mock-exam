#!/usr/bin/env node
/* Draws the app icons (PNG) for the installable web app, with no dependencies: node tools/make-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [0x12, 0x38, 0x5f];
const WHITE = [0xff, 0xff, 0xff];
// "F" mark on a 32-unit grid (same as the favicon): vertical stem and two arms, round caps
const SEGMENTS = [[[10, 8], [10, 24]], [[10, 8], [22, 8]], [[10, 16], [19, 16]]];
const STROKE = 3.2;

function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  const x = a[0] + t * dx - px, y = a[1] + t * dy - py;
  return Math.sqrt(x * x + y * y);
}

function draw(size, opts) {
  const px = Buffer.alloc(size * size * 4);
  const pad = opts.maskable ? 0 : 0;
  const radius = opts.maskable ? 0 : size * 0.22;
  const glyphScale = opts.maskable ? 0.62 : 0.8; // maskable icons keep the mark inside the safe zone
  const S = 4; // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const fx = x + (sx + 0.5) / S, fy = y + (sy + 0.5) / S;
        // rounded-square background
        const cx = Math.min(Math.max(fx, pad + radius), size - pad - radius), cy = Math.min(Math.max(fy, pad + radius), size - pad - radius);
        const inBg = radius === 0 || (fx - cx) * (fx - cx) + (fy - cy) * (fy - cy) <= radius * radius;
        if (!inBg) continue;
        bg++;
        // glyph, centered: map pixel to the 32-unit grid
        const g = 32 / (size * glyphScale);
        const ux = (fx - size / 2) * g + 16, uy = (fy - size / 2) * g + 16;
        if (SEGMENTS.some(([a, b]) => distSeg(ux, uy, a, b) <= STROKE / 2)) fg++;
      }
      const i = (y * size + x) * 4;
      const n = S * S;
      const a = bg / n, f = bg ? fg / bg : 0;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(NAVY[c] * (1 - f) + WHITE[c] * f);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, px);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), draw(192, {}));
fs.writeFileSync(path.join(dir, 'icon-512.png'), draw(512, {}));
fs.writeFileSync(path.join(dir, 'icon-maskable-512.png'), draw(512, { maskable: true }));
fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), draw(180, { maskable: true }));
console.log('Wrote icons/: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png');
