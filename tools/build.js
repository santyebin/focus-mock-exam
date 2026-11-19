#!/usr/bin/env node
/*
 * Builds dist/: a standalone static site for any web host (GitHub Pages, Netlify, S3, nginx…).
 *  - wraps index.html in a complete HTML document (doctype, head, body)
 *  - adds cache-busting ?v=<hash> to every local CSS/JS URL so visitors get updates immediately
 *  - adds favicon, social-preview tags, robots.txt and .nojekyll
 * Usage: node tools/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });

const hashes = {};
for (const dir of ['assets', 'src', 'data']) {
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, dir))) {
    const rel = dir + '/' + f;
    const buf = fs.readFileSync(path.join(root, rel));
    fs.writeFileSync(path.join(out, rel), buf);
    hashes[rel] = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
  }
}

let page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
page = page.replace(/(src|href)="((?:assets|src|data)\/[^"?]+)"/g, (m, attr, rel) => {
  if (!hashes[rel]) throw new Error('index.html references a missing file: ' + rel);
  return attr + '="' + rel + '?v=' + hashes[rel] + '"';
});

const split = page.indexOf('<div id="app"');
if (split < 0) throw new Error('index.html has no <div id="app">');
const headPart = page
  .slice(0, split)
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/i, '')
  .trim();
const bodyPart = page.slice(split).trim();

const description = 'Free adaptive practice test in the GMAT exam format: three 45-minute sections, Question Review & Edit, and a 205-805 score with official percentiles.';
const favicon = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#13283f"/><path d="M10 24V8h12M10 16h9" stroke="#ffffff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
);

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
</head>
<body>
${bodyPart}
</body>
</html>
`;

fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');

let bytes = 0, files = 0;
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else { bytes += fs.statSync(p).size; files++; }
  }
})(out);
console.log(`Built dist/: ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
