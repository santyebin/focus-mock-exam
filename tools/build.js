#!/usr/bin/env node
/*
 * Builds dist/: the static site for any web host (GitHub Pages, Netlify, S3, nginx…).
 *  - wraps index.html in a complete HTML document (doctype, head, body)
 *  - adds a content hash (?v=…) to every local CSS/JS URL so visitors get updates at once
 *  - writes the offline service worker with this release's version and file list
 *  - copies the question editor, web-app manifest and icons; adds favicon, link-preview tags, robots.txt, .nojekyll
 * Usage: node tools/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

const hashes = {};
for (const dir of ['assets', 'src', 'data', 'icons']) {
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, dir))) {
    const rel = dir + '/' + f;
    const buf = fs.readFileSync(path.join(root, rel));
    fs.writeFileSync(path.join(out, rel), buf);
    hashes[rel] = hash(buf);
  }
}
const bust = (html) => html.replace(/(src|href)="((?:assets|src|data|icons)\/[^"?]+)"/g, (m, attr, rel) => {
  if (!hashes[rel]) throw new Error('page references a missing file: ' + rel);
  return attr + '="' + rel + '?v=' + hashes[rel] + '"';
});

// ---- main page: the source index.html is a fragment (artifact format); wrap it in a full document ----
let page = bust(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
const split = page.indexOf('<div id="app"');
if (split < 0) throw new Error('index.html has no <div id="app">');
const headPart = page.slice(0, split)
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/i, '')
  .trim();
const description = 'Free adaptive practice in the GMAT exam format: full mocks with the real exam screens, section tests, practice with explanations, and a spaced-repetition mistake log.';
const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#13283f"/><path d="M10 24V8h12M10 16h9" stroke="#ffffff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${headPart}
<meta name="theme-color" content="#13283f">
<meta property="og:type" content="website">
<meta property="og:title" content="Focus Mock Exam">
<meta property="og:description" content="${description}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${favicon}">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png?v=${hashes['icons/apple-touch-icon.png']}">
</head>
<body>
${page.slice(split).trim()}
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), html);

// ---- question editor (already a full document) ----
const editor = bust(fs.readFileSync(path.join(root, 'editor.html'), 'utf8'));
fs.writeFileSync(path.join(out, 'editor.html'), editor);

// ---- web-app manifest ----
fs.copyFileSync(path.join(root, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));

// ---- service worker: precache exactly the files this release references ----
const refs = new Set();
[html, editor].forEach((h) => h.replace(/(?:src|href)="((?:assets|src|data|icons)\/[^"]+)"/g, (m, u) => refs.add(u)));
['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'].forEach((u) => refs.add(u));
const files = ['index.html', 'editor.html', 'manifest.webmanifest'].concat(Array.from(refs).sort());
const version = hash(Buffer.from(files.join('|') + JSON.stringify(hashes)));
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').replace(/const BUILD = \{[^\n]*\};/, 'const BUILD = ' + JSON.stringify({ version: version, files: files }) + ';');
if (!sw.includes(version)) throw new Error('sw.js is missing its BUILD placeholder');
fs.writeFileSync(path.join(out, 'sw.js'), sw);

fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');

let bytes = 0, count = 0;
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else { bytes += fs.statSync(p).size; count++; } } })(out);
console.log(`Built dist/: ${count} files, ${(bytes / 1024).toFixed(0)} KB, release ${version}, ${files.length} files precached for offline use`);
