#!/usr/bin/env node
// Clean script for removing build artifacts

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const isAllClean = args.includes('--all');
const isCacheClean = args.includes('--cache');

function removeDirectory(dirPath, description) {
  if (fs.existsSync(dirPath)) {
    console.log(`🧹 Removing ${description}...`);
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`✅ ${description} removed`);
  } else {
    console.log(`ℹ️  ${description} doesn't exist, skipping`);
  }
}

console.log('🧹 Starting cleanup process...\n');

if (isCacheClean) {
  // Clean only cache
  removeDirectory('node_modules/.vite', 'Vite cache');
  removeDirectory('.vite', 'Vite cache directory');
} else if (isAllClean) {
  // Clean everything including node_modules
  removeDirectory('dist', 'Build directory (dist)');
  removeDirectory('node_modules/.vite', 'Vite cache');
  removeDirectory('.vite', 'Vite cache directory');
  removeDirectory('node_modules', 'Node modules');
  console.log('📋 Run "npm install" to restore dependencies');
} else {
  // Default clean - just build artifacts
  removeDirectory('dist', 'Build directory (dist)');
  removeDirectory('node_modules/.vite', 'Vite cache');
  removeDirectory('.vite', 'Vite cache directory');
}

console.log('\n✨ Cleanup completed!\n');