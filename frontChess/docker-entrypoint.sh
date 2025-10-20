#!/bin/sh
set -e

# Default backend URL (public Railway domain). Change if needed.
DEFAULT_API_URL="https://backend-42.up.railway.app"

# Use the runtime env VITE_API_URL if provided, otherwise default
API_URL=${VITE_API_URL:-$DEFAULT_API_URL}

echo "Frontend entrypoint: injecting API URL -> ${API_URL}"

# Replace placeholder in index.html if present
if [ -f /app/dist/index.html ]; then
  sed -i "s|__API_URL__|${API_URL}|g" /app/dist/index.html || true
fi

# Execute the provided command (serve) as PID 1
exec "$@"
