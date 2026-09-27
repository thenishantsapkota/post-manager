#!/usr/bin/env bash
# Update the Pi: builds on THIS machine and pushes the result (see push-to-pi.sh).
# Run it from your computer, not on the Pi: the Pi never builds or runs the
# full `npm ci`; it only installs the three runtime packages.
set -euo pipefail

if [[ "$(uname -s)" == "Linux" && "$(uname -m)" =~ ^(aarch64|armv7l|armv6l)$ ]]; then
  echo "This looks like the Raspberry Pi. Updates are built on your computer and pushed here:"
  echo "  (on your computer, in the project folder)  deploy/update.sh"
  exit 1
fi

exec "$(dirname "$0")/push-to-pi.sh" "$@"
