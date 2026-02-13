#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('[DEPLOYMENT PREP] Preparing deployment without bundling issues...');

try {
  // Step 1: Clean only the dist directory safely
  console.log('[DEPLOYMENT PREP] Cleaning dist directory...');
  const distPath = path.resolve(projectRoot, 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log('[DEPLOYMENT PREP] Removed dist directory');
  }

  // Step 2: Build frontend with Vite
  console.log('[DEPLOYMENT PREP] Building frontend...');
  execSync('vite build', { cwd: projectRoot, stdio: 'inherit' });

  // Step 3: Skip backend bundling - use tsx directly in production
  // This avoids ESM bundling complexity and runtime require issues
  console.log('[DEPLOYMENT PREP] Skipping backend bundling (using tsx for production)');

  // Step 4: Create production start script that uses tsx
  console.log('[DEPLOYMENT PREP] Creating production starter...');
  const startScript = `#!/usr/bin/env node
// Production starter that uses tsx instead of bundled files
import { spawn } from 'child_process';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('[PRODUCTION] Starting server with tsx...');

// Set production environment
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: process.env.PORT || '5000'
};

// Start server with tsx (no bundling required)
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: projectRoot,
  env: env,
  stdio: 'inherit'
});

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('[PRODUCTION] Shutting down gracefully...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[PRODUCTION] Shutting down gracefully...');
  serverProcess.kill('SIGINT');
});

serverProcess.on('exit', (code) => {
  process.exit(code || 0);
});
`;

  fs.writeFileSync(path.resolve(projectRoot, 'start-production.js'), startScript);
  console.log('[DEPLOYMENT PREP] Created start-production.js');

  // Step 5: Verify frontend build
  const indexPath = path.resolve(projectRoot, 'dist', 'public', 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('Frontend build failed - index.html not found');
  }

  console.log('[DEPLOYMENT PREP] ✓ Frontend built successfully');
  console.log('[DEPLOYMENT PREP] ✓ Production starter created');
  console.log('[DEPLOYMENT PREP] Ready for deployment!');
  console.log('');
  console.log('Deployment Configuration:');
  console.log('  build: ["node", "scripts/prepare-deployment.js"]');
  console.log('  run: ["node", "start-production.js"]');
  console.log('');
  console.log('Alternative (simpler):');
  console.log('  build: ["npm", "run", "build"]');
  console.log('  run: ["npx", "tsx", "server/index.ts"]');

} catch (error) {
  console.error('[DEPLOYMENT PREP] Failed:', error.message);
  process.exit(1);
}