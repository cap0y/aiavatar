#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('[CLOUD RUN ENTRY] Creating Cloud Run optimized entry point...');

// Ensure dist directory exists
const distPath = path.resolve(projectRoot, 'dist');
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Create the Cloud Run entry point
const entryPointContent = `#!/usr/bin/env node
// Cloud Run optimized entry point - Direct Node.js execution bypassing npm

// Set production environment
process.env.NODE_ENV = 'production';

// Cloud Run compatible port configuration
const PORT = process.env.PORT || '8080';
process.env.PORT = PORT;

console.log('[CLOUD RUN] Starting Korean Caregiving Platform...');
console.log(\`[CLOUD RUN] Environment: \${process.env.NODE_ENV}\`);
console.log(\`[CLOUD RUN] Port: \${PORT}\`);
console.log(\`[CLOUD RUN] Node.js version: \${process.version}\`);

// Graceful shutdown handlers for Cloud Run
const gracefulShutdown = (signal) => {
  console.log(\`[CLOUD RUN] Received \${signal}, shutting down gracefully...\`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[CLOUD RUN] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CLOUD RUN] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Import and start the server
try {
  console.log('[CLOUD RUN] Importing server module...');
  await import('./server/index.js');
  console.log('[CLOUD RUN] Server started successfully');
} catch (error) {
  console.error('[CLOUD RUN] Failed to start server:', error.message);
  console.error('[CLOUD RUN] Error stack:', error.stack);
  process.exit(1);
}`;

// Write the entry point
const entryPointPath = path.resolve(distPath, 'index.js');
fs.writeFileSync(entryPointPath, entryPointContent);

// Make it executable
fs.chmodSync(entryPointPath, 0o755);

console.log('[CLOUD RUN ENTRY] Entry point created successfully:', entryPointPath);

// Create production package.json for Cloud Run
const productionPackageJson = {
  "name": "korean-caregiving-platform",
  "version": "1.0.0",
  "type": "module",
  "description": "Korean caregiving platform - Production build",
  "main": "index.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "start": "node index.js"
  }
};

const packageJsonPath = path.resolve(distPath, 'package.json');
fs.writeFileSync(packageJsonPath, JSON.stringify(productionPackageJson, null, 2));

console.log('[CLOUD RUN ENTRY] Production package.json created:', packageJsonPath);

// Verify required files exist
const requiredFiles = [
  'index.js',
  'package.json'
];

const missingFiles = [];
for (const file of requiredFiles) {
  const filePath = path.resolve(distPath, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('[CLOUD RUN ENTRY] Missing required files:', missingFiles);
  process.exit(1);
}

console.log('[CLOUD RUN ENTRY] All required files verified');
console.log('[CLOUD RUN ENTRY] Cloud Run entry point setup complete');