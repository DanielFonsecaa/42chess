#!/usr/bin/env bash
set -euo pipefail

echo "== 42chess start helper: build both services =="
ROOT_DIR="$(pwd)"

# If Node is installed via nvm, non-interactive bash may not have nvm loaded.
# Try to source common nvm/bootstrap files so `npm` is available when this
# script is executed from bash (e.g. ./start.sh) even if you use nvm in zsh.
if [ -n "${NVM_DIR-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
elif [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi
# Also try common profile files which may load nvm
if [ -s "$HOME/.profile" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.profile"
fi
if [ -s "$HOME/.bashrc" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.bashrc"
fi

# Build backend
if [ -d "${ROOT_DIR}/backChess" ]; then
  echo "-- Building backend (backChess)"
  cd "${ROOT_DIR}/backChess"
  if [ -f package.json ]; then
    # Prefer CI install but fall back to install
    if command npm -v >/dev/null 2>&1; then
      npm ci --silent || npm install --silent || true
      npm start --if-present || true
    else
      echo "npm not found, skipping backend install/build"
    fi
  else
    echo "no package.json in backChess, skipping"
  fi
  cd "${ROOT_DIR}"
fi

# Build frontend
if [ -d "${ROOT_DIR}/frontChess" ]; then
  echo "-- Building frontend (frontChess)"
  cd "${ROOT_DIR}/frontChess"
  if [ -f package.json ]; then
    if command npm -v >/dev/null 2>&1; then
      npm ci --silent || npm install --silent || true
      npm run build || true
    else
      echo "npm not found, skipping frontend install/build"
    fi
  else
    echo "no package.json in frontChess, skipping"
  fi
  cd "${ROOT_DIR}"
fi

# Fallback: if docker compose exists, show how to run it (don't auto-run)
if [ -f "${ROOT_DIR}/docker-compose.yml" ] || [ -f "${ROOT_DIR}/docker-compose.yaml" ]; then
  echo
  echo "Docker compose file found. To start services using Docker Compose run:"
  echo "  docker compose up --build"
fi

echo
echo "Build helper finished."
exit 0
