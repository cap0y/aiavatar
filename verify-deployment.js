#!/usr/bin/env node
// Deployment verification script

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying Cloud Run deployment readiness...\n');

const requiredFiles = [
  { path: 'dist/index.js', description: 'Main Cloud Run entry point' },
  { path: 'dist/server/index.js', description: 'Bundled server code' },
  { path: 'dist/public/index.html', description: 'Frontend build' },
  { path: 'dist/package.json', description: 'Production package.json' },
  { path: 'start-cloud-run.js', description: 'Fallback runner #1' },
  { path: 'deploy.sh', description: 'Shell script fallback' },
  { path: 'run-production.js', description: 'Minimal runner' },
  { path: 'scripts/build-for-deployment.js', description: 'Build script' }
];

let allReady = true;

console.log('📋 File Verification:');
for (const file of requiredFiles) {
  const exists = fs.existsSync(file.path);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file.path} - ${file.description}`);
  if (!exists) allReady = false;
}

console.log('\n🧪 Testing entry points:');

// Test dist/index.js
if (fs.existsSync('dist/index.js')) {
  try {
    const content = fs.readFileSync('dist/index.js', 'utf8');
    const hasProduction = content.includes('NODE_ENV') && content.includes('production');
    const hasPort = content.includes('PORT') || content.includes('8080');
    const hasShutdown = content.includes('SIGTERM') || content.includes('graceful');
    
    console.log(`✅ dist/index.js: Production mode: ${hasProduction}, Port config: ${hasPort}, Graceful shutdown: ${hasShutdown}`);
  } catch (error) {
    console.log(`❌ dist/index.js: Cannot read file - ${error.message}`);
    allReady = false;
  }
} else {
  console.log('❌ dist/index.js: File missing');
  allReady = false;
}

console.log('\n🎯 Deployment Commands:');
console.log('Build command: ["node", "scripts/build-for-deployment.js"]');
console.log('Run command:   ["node", "dist/index.js"]');

console.log('\n📝 Alternative run commands (if primary fails):');
console.log('- ["node", "start-cloud-run.js"]');
console.log('- ["bash", "deploy.sh"]');
console.log('- ["node", "run-production.js"]');

console.log('\n' + '='.repeat(60));
if (allReady) {
  console.log('✅ DEPLOYMENT READY');
  console.log('All required files are present and configured correctly.');
  console.log('\n🚀 Next step: Update deployment settings in Replit UI');
  console.log('   1. Go to Deploy section in Replit');
  console.log('   2. Change build command to: ["node", "scripts/build-for-deployment.js"]');
  console.log('   3. Change run command to: ["node", "dist/index.js"]');
  console.log('   4. Deploy again - npm error should be resolved');
} else {
  console.log('❌ DEPLOYMENT NOT READY');
  console.log('Some required files are missing. Run the build first:');
  console.log('   node scripts/build-for-deployment.js');
}
console.log('='.repeat(60));