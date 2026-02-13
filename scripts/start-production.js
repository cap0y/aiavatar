#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';
import { spawn } from 'child_process';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('[PRODUCTION START] Starting production server...');

try {
  // Check if bundled Node.js runtime exists
  const bundledNodePath = path.resolve(projectRoot, 'dist', 'server', process.platform === 'win32' ? 'node.exe' : 'node');
  const serverIndexPath = path.resolve(projectRoot, 'dist', 'server', 'index.js');

  // Verify required files exist
  if (!fs.existsSync(bundledNodePath)) {
    throw new Error(`Bundled Node.js runtime not found: ${bundledNodePath}`);
  }

  if (!fs.existsSync(serverIndexPath)) {
    throw new Error(`Server bundle not found: ${serverIndexPath}`);
  }

  console.log(`[PRODUCTION START] Using bundled Node.js runtime: ${bundledNodePath}`);
  console.log(`[PRODUCTION START] Starting server: ${serverIndexPath}`);

  // Set environment variables for production
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000'
  };

  // Start the server using the bundled Node.js runtime
  const serverProcess = spawn(bundledNodePath, [serverIndexPath], {
    cwd: projectRoot,
    env: env,
    stdio: 'inherit'
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('[PRODUCTION START] Received SIGTERM, shutting down gracefully...');
    serverProcess.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('[PRODUCTION START] Received SIGINT, shutting down gracefully...');
    serverProcess.kill('SIGINT');
  });

  // Handle server process exit
  serverProcess.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[PRODUCTION START] Server terminated by signal: ${signal}`);
      process.exit(0);
    } else if (code !== 0) {
      console.error(`[PRODUCTION START] Server exited with code: ${code}`);
      process.exit(code);
    } else {
      console.log('[PRODUCTION START] Server exited successfully');
      process.exit(0);
    }
  });

  serverProcess.on('error', (error) => {
    console.error('[PRODUCTION START] Failed to start server:', error.message);
    process.exit(1);
  });

} catch (error) {
  console.error('[PRODUCTION START] Startup failed:', error.message);
  process.exit(1);
}