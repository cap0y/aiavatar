#!/bin/bash
# Cloud Run deployment script that ensures Node.js runtime is available

echo "[DEPLOY] Starting Cloud Run deployment..."
echo "[DEPLOY] Node.js version: $(node --version)"
echo "[DEPLOY] NPM version: $(npm --version 2>/dev/null || echo 'npm not found')"

# Set production environment
export NODE_ENV=production
export PORT=${PORT:-8080}

echo "[DEPLOY] Environment: $NODE_ENV"
echo "[DEPLOY] Port: $PORT"

# Try different startup methods in order of preference
echo "[DEPLOY] Attempting to start server..."

# Method 1: Direct execution of built entry point (most reliable)
if [ -f "dist/index.js" ]; then
    echo "[DEPLOY] Starting with dist/index.js (direct execution)"
    exec node dist/index.js
fi

# Method 2: Cloud Run entry point
if [ -f "start-cloud-run.js" ]; then
    echo "[DEPLOY] Starting with start-cloud-run.js"
    exec node start-cloud-run.js
fi

# Method 3: Built server file
if [ -f "dist/server/index.js" ]; then
    echo "[DEPLOY] Starting with dist/server/index.js"
    exec node dist/server/index.js
fi

# Method 4: NPX fallback (if available)
if command -v npx &> /dev/null; then
    echo "[DEPLOY] Starting with npx fallback"
    exec npx node dist/index.js 2>/dev/null || exec npx node dist/server/index.js
fi

# Method 5: TypeScript source (development fallback)
if command -v npx &> /dev/null && [ -f "server/index.ts" ]; then
    echo "[DEPLOY] Starting with tsx (development mode)"
    exec npx tsx server/index.ts
fi

echo "[DEPLOY] ERROR: Could not start server with any method"
exit 1