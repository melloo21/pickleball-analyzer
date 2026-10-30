#!/bin/zsh
# One command to run Dink Lab: builds the TypeScript UI if needed, then starts the Python API.
# Open http://localhost:8000 afterwards.
set -e
HERE="${0:A:h}"; cd "$HERE"
./uvw sync -q
[[ -d web/node_modules ]] || (cd web && ../nodew npm install --no-audit)
if [[ ! -d web/dist || -n "$(find web/src web/index.html -newer web/dist -print -quit)" ]]; then
  (cd web && ../nodew npm run build)
fi
echo "🏓 Dink Lab running at http://localhost:${PORT:-8000}"
exec ./uvw run uvicorn app.server:app --host 127.0.0.1 --port "${PORT:-8000}"
