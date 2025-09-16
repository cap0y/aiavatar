#!/usr/bin/env node
// Build script for Cloud Run deployment

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting deployment build process...\n');

function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function copyFile(src, dest, description) {
  console.log(`📋 ${description}...`);
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function createMainEntryPoint() {
  console.log('🔧 Creating main entry point (dist/index.js)...');
  
  const entryPointContent = `#!/usr/bin/env node
// Main Cloud Run entry point
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '8080';

console.log('[STARTUP] Starting application...');
console.log('[STARTUP] Environment:', process.env.NODE_ENV);
console.log('[STARTUP] Port:', process.env.PORT);

// Import and start the server
try {
  const serverPath = join(__dirname, 'server', 'index.js');
  console.log('[STARTUP] Loading server from:', serverPath);
  
  await import(serverPath);
} catch (error) {
  console.error('[STARTUP] Failed to start server:', error);
  process.exit(1);
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
`;

  try {
    fs.mkdirSync('dist', { recursive: true });
    fs.writeFileSync('dist/index.js', entryPointContent);
    console.log('✅ Main entry point created\n');
  } catch (error) {
    console.error('❌ Failed to create main entry point:', error.message);
    process.exit(1);
  }
}

function createProductionPackageJson() {
  console.log('📦 Creating production package.json...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Create minimal production package.json
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      type: packageJson.type,
      main: 'index.js',
      scripts: {
        start: 'node index.js'
      },
      dependencies: packageJson.dependencies,
      engines: {
        node: '>=18.0.0'
      }
    };
    
    fs.writeFileSync('dist/package.json', JSON.stringify(prodPackageJson, null, 2));
    console.log('✅ Production package.json created\n');
  } catch (error) {
    console.error('❌ Failed to create production package.json:', error.message);
    process.exit(1);
  }
}

// Build process
console.log('🏗️  Building for deployment...\n');

// Step 1: Clean previous builds
runCommand('npm run clean', 'Cleaning previous builds');

// Step 2: Build frontend with Vite
runCommand('vite build', 'Building frontend');

// Step 3: Build server with esbuild
runCommand('npm run build:server', 'Building server');

// Step 4: Create main entry point
createMainEntryPoint();

// Step 5: Create production package.json
createProductionPackageJson();

// Step 6: Verify all required files exist
console.log('🔍 Verifying build outputs...');

const requiredFiles = [
  'dist/index.js',
  'dist/server/index.js', 
  'dist/public/index.html',
  'dist/package.json'
];

let allPresent = true;
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allPresent = false;
  }
}

if (allPresent) {
  console.log('\n🎉 Build completed successfully!');
  console.log('📁 All required files are present in dist/ directory');
  console.log('🚀 Ready for Cloud Run deployment');
} else {
  console.log('\n❌ Build incomplete - some required files are missing');
  process.exit(1);
}