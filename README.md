# Damak Banda · Auto Poster

A self-hosted platform that designs, schedules and automatically publishes image posts to the **Damak Banda** Facebook page, with daily, weekly, monthly and yearly **Rashifal** from Nepali Patro.

Built with TanStack Start (React, Nitro node server), SQLite (Drizzle + libSQL) and `@napi-rs/canvas`, which shapes Devanagari text correctly (conjuncts, matras and Nepali digits).

## Features

- **Rashifal (राशिफल)**: fetched automatically from Nepali Patro for all four periods. You can edit the text, preview the exact images, and post as an album (cover + 12 sign images) or as a single cover with the full text in the caption.
- **Your own templates**: upload a design, then place text, photo, logo and box layers on it with a drag-and-drop editor. Variables like `{sign_np}`, `{rashifal}` and `{date_bs}` are filled in automatically. Rashifal sign templates can use a different background per rashi. "Exact preview" renders with the same engine that makes the posts.
- **Image editing**: crop (square, 4:5 feed, 9:16 story, landscape, free), rotate, flip, brightness, contrast, saturation, blur, black & white, sepia, resize, and a logo watermark. Edits always save a new copy.
- **Composer**: caption, multiple images (posted as one album), designed cards, and a Facebook-style preview. Post now, schedule in Nepal time, or save a draft.
- **Automations**: daily, weekly or custom-cron jobs that post the Rashifal, or rotate through a **content library** (greetings, quotes, notices) in order or at random.
- **Reliability**: failed publishes retry with backoff. Posts interrupted by a restart are marked for review, never silently re-posted. Each Rashifal set is posted only once. If the day's set isn't published yet, the job retries every 15 minutes for up to 6 hours.
- **Admin login** (single password). Every server function checks the session.

## Nepali Patro credit (required)

Rashifal content belongs to **Nepali Patro (nepalipatro.com.np)** and is used with their permission. The app enforces the credit in code:

- Every Rashifal image carries a source line: `स्रोत: नेपाली पात्रो (nepalipatro.com.np) · <astrologer>`. On custom templates without a visible `{credit}` layer, a credit strip is drawn automatically.
- Every Rashifal caption ends with the credit block and the astrologer's name, even if the caption template leaves it out.

Please keep it that way. The logic lives in `src/lib/credit.ts`.

## Getting started

Requires Node 22+.

```bash
npm install
cp .env.example .env     # then set ADMIN_PASSWORD and SESSION_SECRET
npm run dev              # http://localhost:3000
```

The database and images are stored in `./data`, and migrations run automatically on start.

### Connect the Facebook page

1. Open **Settings → Facebook page**.
2. Either paste a Page ID + Page access token, or use **"Get a token that doesn't expire"**. That helper takes an App ID, an App Secret and a short-lived user token from the Graph API Explorer, and returns a permanent page token. The App Secret is not stored.
3. Required permissions: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.

### Post Rashifal every morning

**Automations → Daily rashifal** creates a 6:00 AM job. Presets are included for weekly, monthly and yearly too.

## Production

```bash
npm run build
npm start                # serves .output on PORT (default 3000)
```

Run it from the project folder: native modules (`@napi-rs/canvas`, libSQL) load from `node_modules`, and fonts come from `assets/fonts`. Put it behind HTTPS (e.g. Caddy or Nginx) and keep `./data` on persistent storage. A small VPS or an always-on machine works well. Keep it on a single instance, because the scheduler runs inside the server process.

If your host sleeps when idle, set `CRON_SECRET` and call the cron endpoint every few minutes:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron
```

## Hosting on a Raspberry Pi

Works on a Pi 4 or Pi 5 (2 GB+ RAM) running **64-bit Raspberry Pi OS**. The Pi only needs outbound internet: images are uploaded straight to Facebook, so nothing has to reach the Pi from outside.

```bash
# On the Pi
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs git
git clone <your-repo-url> ~/damak-banda-auto-posts && cd ~/damak-banda-auto-posts
npm ci                     # installs the ARM builds of canvas and libSQL
cp .env.example .env && nano .env   # set ADMIN_PASSWORD and SESSION_SECRET
npm run build
sudo cp deploy/damak-banda.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now damak-banda
```

Open `http://<pi-ip>:3000` from any device on your network. After code changes, run `deploy/update.sh`.

- Run `npm ci` **on the Pi**. Don't copy `node_modules` from a Mac; native modules are per-platform.
- Keep the clock synced (on by default: `timedatectl` should show "System clock synchronized: yes"). Schedules are computed in Nepal time regardless of the Pi's time zone.
- Back up `./data` (the database and images). An SSD instead of the SD card is more durable.
- To manage it away from home, use [Tailscale](https://tailscale.com) (private) or a Cloudflare Tunnel. Avoid port-forwarding the admin panel.

## Project layout

```
src/
  routes/            pages (_app/*) and HTTP endpoints (api/cron)
  functions/         server functions (RPC), all behind authMiddleware
  server/            database, Facebook client, Nepali Patro client, scheduler, rendering
    render/          canvas engine: built-in designs, template engine, image edits
  nitro/media.ts     authenticated image serving (/api/media/:id)
  lib/               shared types, schemas, zodiac data, Nepali date, credit
  components/        UI kit, image editor, media picker, card designer
drizzle/             SQL migrations (npm run db:generate after schema changes)
assets/fonts/        Mukta (Devanagari + Latin)
```
