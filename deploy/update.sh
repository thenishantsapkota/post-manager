#!/usr/bin/env bash
# Pull the latest code, rebuild and restart. Run on the Pi from the project folder.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci
npm run build
sudo systemctl restart damak-banda
echo "Updated and restarted."
