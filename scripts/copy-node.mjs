#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const src = process.execPath; // 현재 사용 중인 Node 실행 파일 경로
const destDir = path.resolve(projectRoot, 'dist', 'server');
const dest = path.join(destDir, process.platform === 'win32' ? 'node.exe' : 'node');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
try {
  fs.chmodSync(dest, 0o755);
} catch {}
console.log(`[copy-node] ${src} -> ${dest}`); 