#!/usr/bin/env bash
#
# Start the image viewer API and the Vite dev client together.
#
# Usage:
#   ./start.sh
#   npm start
#   IMAGE_DIR=/path/to/pictures ./start.sh
#
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

API_PORT=3001

info() { printf '\033[1;34m[start]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[start]\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Node.js is not installed."
[ -d node_modules ] || fail "Server dependencies are missing. Run: npm install"
[ -d client/node_modules ] || fail "Client dependencies are missing. Run: npm --prefix client install"

if (exec 3<>"/dev/tcp/127.0.0.1/${API_PORT}") 2>/dev/null; then
  fail "Port ${API_PORT} is already in use. Stop the process using it (lsof -ti :${API_PORT} | xargs kill) first."
fi

pids=()

cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

info "API -> http://localhost:${API_PORT}"
node server/index.js &
pids+=("$!")

info "App -> http://localhost:5173"
npm --prefix client run dev &
pids+=("$!")

# macOS ships Bash 3.2, which has no `wait -n`, so poll for the first exit.
while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      info "A process stopped; shutting down the other one."
      exit 1
    fi
  done
  sleep 1
done
