#!/bin/zsh
# Build the static demo and publish it to the gh-pages branch (GitHub Pages source: gh-pages, /).
# Usage: ./scripts/deploy_demo.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
SHA=$(git rev-parse --short HEAD)

(cd web && ../nodew npm run build:demo)
cd web/dist-demo
touch .nojekyll                     # serve files as-is, no Jekyll processing
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy demo from $SHA"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "✅ Pushed. Live in ~1 min: https://melloo21.github.io/pickleball-analyzer/"
