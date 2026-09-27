#!/usr/bin/env bash
# Build on this machine and deploy to the Raspberry Pi over SSH. The Pi only
# runs the app: it never builds, and installs just the three runtime packages.
#
#   deploy/push-to-pi.sh              # code only (keeps the Pi's data)
#   deploy/push-to-pi.sh --with-data  # also replace the Pi's data with this machine's
#
# Settings (override with environment variables):
#   PI_HOST=nishant@raspberrypi.local   PI_DIR=damak-banda-auto-posts   PI_SERVICE=damak-banda
#
# One-time setup so you aren't asked for a password each time:
#   ssh-copy-id nishant@raspberrypi.local
set -euo pipefail

PI_HOST="${PI_HOST:-nishant@raspberrypi.local}"
PI_DIR="${PI_DIR:-damak-banda-auto-posts}"   # relative to the Pi user's home
PI_SERVICE="${PI_SERVICE:-damak-banda}"
WITH_DATA=false
[[ "${1:-}" == "--with-data" ]] && WITH_DATA=true

cd "$(dirname "$0")/.."

# Reuse one SSH connection so a password (if any) is asked only once.
SOCK="$(mktemp -u /tmp/pi-ssh-XXXXXX)"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$SOCK" -o ControlPersist=120)
ssh_pi() { ssh "${SSH_OPTS[@]}" "$PI_HOST" "$@"; }
trap 'ssh "${SSH_OPTS[@]}" -O exit "$PI_HOST" 2>/dev/null || true' EXIT

echo "==> Checking connection to $PI_HOST"
ssh_pi "mkdir -p ~/$PI_DIR && command -v node >/dev/null || { echo 'Node.js is not installed on the Pi'; exit 1; }; \
  command -v rsync >/dev/null || { echo 'rsync is not installed on the Pi: run  sudo apt install -y rsync'; exit 1; }"
if ssh_pi "[ -d ~/$PI_DIR/.git ]"; then
  echo "   Note: ~/$PI_DIR on the Pi is a git clone. This script replaces its package.json with a"
  echo "   runtime-only one, so deploy with this script from now on instead of git pull there."
fi

echo "==> Building locally"
npm run build

# The built server bundles everything except three native/runtime packages, so
# the Pi installs only those (seconds) instead of the whole dev toolchain.
echo "==> Preparing runtime dependencies"
RUNTIME="$(mktemp -d)"
node -e '
  const v = (p) => require("./node_modules/" + p + "/package.json").version
  const deps = Object.fromEntries(["@napi-rs/canvas", "@libsql/client", "drizzle-orm"].map((p) => [p, v(p)]))
  process.stdout.write(JSON.stringify({ name: "damak-banda-runtime", private: true, type: "module", dependencies: deps }, null, 2))
' > "$RUNTIME/package.json"
# Lock file includes the ARM builds (npm records every platform's optional packages).
(cd "$RUNTIME" && npm install --package-lock-only --no-audit --no-fund >/dev/null)

if $WITH_DATA; then
  echo
  echo "WARNING: this replaces the Pi's database and images (including its Facebook"
  echo "connection, posts and automations) with the ones on this machine."
  read -r -p "Type 'yes' to continue: " answer
  [[ "$answer" == "yes" ]] || { echo "Cancelled."; exit 1; }
  # Consistent snapshot even if the local dev server is running.
  SNAP="$(mktemp -d)"
  sqlite3 data/app.db ".backup '$SNAP/app.db'"
fi

echo "==> Copying app to $PI_HOST:~/$PI_DIR"
RSYNC=(rsync -az --delete -e "ssh ${SSH_OPTS[*]}")
"${RSYNC[@]}" .output/ "$PI_HOST:$PI_DIR/.output/"
"${RSYNC[@]}" drizzle/ "$PI_HOST:$PI_DIR/drizzle/"
"${RSYNC[@]}" assets/ "$PI_HOST:$PI_DIR/assets/"
"${RSYNC[@]}" deploy/ "$PI_HOST:$PI_DIR/deploy/"
rsync -az -e "ssh ${SSH_OPTS[*]}" "$RUNTIME/package.json" "$RUNTIME/package-lock.json" "$PI_HOST:$PI_DIR/"
rsync -az -e "ssh ${SSH_OPTS[*]}" .env.example "$PI_HOST:$PI_DIR/"
rm -rf "$RUNTIME"

echo "==> Installing dependencies on the Pi (only if they changed)"
ssh_pi "cd ~/$PI_DIR && \
  NEW=\$(sha1sum package-lock.json | cut -d' ' -f1) && OLD=\$(cat .deps-hash 2>/dev/null || true) && \
  if [ \"\$NEW\" != \"\$OLD\" ] || [ ! -d node_modules/@napi-rs/canvas ]; then \
    echo '   installing runtime packages...' && \
    npm ci --omit=dev --no-audit --no-fund && echo \"\$NEW\" > .deps-hash; \
  else echo '   unchanged, skipping'; fi"

ssh_pi "cd ~/$PI_DIR && [ -f .env ] || echo '   NOTE: no .env on the Pi yet: copy .env.example to .env and set ADMIN_PASSWORD and SESSION_SECRET'"

if $WITH_DATA; then
  echo "==> Replacing data on the Pi"
  ssh_pi "sudo systemctl stop $PI_SERVICE 2>/dev/null || true; mkdir -p ~/$PI_DIR/data && rm -f ~/$PI_DIR/data/app.db-wal ~/$PI_DIR/data/app.db-shm"
  rsync -az -e "ssh ${SSH_OPTS[*]}" "$SNAP/app.db" "$PI_HOST:$PI_DIR/data/app.db"
  [ -d data/media ] && "${RSYNC[@]}" data/media/ "$PI_HOST:$PI_DIR/data/media/"
  rm -rf "$SNAP"
fi

echo "==> Installing/updating the $PI_SERVICE service"
# Fill in the Pi's real user and folder so the unit never points at a missing user.
ssh_pi "sed -e \"s/^User=.*/User=\$(whoami)/\" -e \"s|^WorkingDirectory=.*|WorkingDirectory=\$HOME/$PI_DIR|\" \
    ~/$PI_DIR/deploy/damak-banda.service > /tmp/$PI_SERVICE.service && \
  if ! cmp -s /tmp/$PI_SERVICE.service /etc/systemd/system/$PI_SERVICE.service; then \
    sudo cp /tmp/$PI_SERVICE.service /etc/systemd/system/$PI_SERVICE.service && sudo systemctl daemon-reload && \
    sudo systemctl enable $PI_SERVICE >/dev/null 2>&1 && echo '   service file updated'; \
  fi && rm -f /tmp/$PI_SERVICE.service"

echo "==> Restarting $PI_SERVICE"
ssh_pi "sudo systemctl restart $PI_SERVICE && sleep 4 && \
  if systemctl is-active --quiet $PI_SERVICE; then echo '   running'; \
  else echo '   FAILED to start. Last log lines:'; journalctl -u $PI_SERVICE -n 20 --no-pager; exit 1; fi"

echo "==> Done: http://${PI_HOST#*@}:3000"
