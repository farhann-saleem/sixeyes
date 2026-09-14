# Current EC2 deployment — 2026-09-14

EC2 serves **both the website and API** at `https://www.marketingstudioie.site`. Vercel is superseded as the live host; its project can remain. Google redirect stays `/callback` on the same domain.

Actual host: Amazon Linux 2023, x86_64, approximately 2 GB RAM, 20 GB root disk, 2 GB swap. SSH user `ec2-user`, public IP `13.49.134.103`. Set DNS A records for `www` and `@` to that IP; remove the conflicting Vercel CNAME/A and old AAAA records. Allow inbound HTTP 80 and HTTPS 443 publicly; SSH 22 only from your own IP. Do not expose port 3001. Check whether the public IP is Elastic before stopping the instance; an automatically assigned address can change.

## Automatic updates

Push to `main` in `farhann-saleem/sixeyes`. `.github/workflows/deploy.yml` installs dependencies, runs tests/typechecks and builds the frontend on GitHub, then publishes a `deploy-<commit>` prerelease with an allowlisted archive and SHA-256 checksum. Failed checks publish nothing. EC2 checks releases every two minutes using outbound HTTPS; no admin SSH key or application secret is stored on GitHub. The public repository's release assets contain code and public catalog media only.

`deploy/update-release.py` installs the latest deployment release, runs npm as the unprivileged app user, switches `current`, and checks `/health` for the expected revision. Failed startup restores the previous release. A failed revision is not retried until a new commit or manual removal of `incoming/failed-revision`. Only current and previous releases are retained. Shared data is never removed by updates. This single-process deployment briefly interrupts HTTP during restart; provider-backed jobs resume from persisted rows, while jobs without a provider id fail clearly rather than resubmitting paid work.

Paths: `/opt/marketing-studio/releases/<commit>`, `/opt/marketing-studio/current`, `/opt/marketing-studio/shared/.env` (root:msapp 640), `/opt/marketing-studio/shared/data` (msapp 700). The app runs as msapp; source files are root-owned and read-only. Frontend builds run off-server. The fixed root deployment helper and systemd/Caddy configurations require a deliberate SSH installation when changed; pushes update application releases only.

```bash
sudo systemctl status ms-backend caddy ms-deploy.timer
sudo journalctl -u ms-backend -n 80 --no-pager
sudo journalctl -u ms-deploy -n 80 --no-pager
sudo systemctl start ms-deploy
curl -fsS http://127.0.0.1:3001/health
```

To pause deployment: `sudo systemctl stop ms-deploy.timer`. To roll back manually, stop the timer, point `current` at the retained previous release and restart `ms-backend`; investigate before re-enabling updates. Service logs and the health revision identify the installed commit. The installer checks archive paths/types and checksum; repository write access is production deployment access. Database changes need backwards compatibility: code rollback does not undo migrations.

## Verification still required

First GitHub release/install and HTTP startup, DNS/TLS, Google login, two-account live ownership checks, and an authorized generation with restart mid-job. Shared CPU timeline-v1 export remains a separate worker deployment gate. Do not call the complete project or multi-user capacity verified from unit tests alone. No paid generation is part of infrastructure smoke by default.

---

The historical runbook below records the earlier Lightsail/Ubuntu plan. Current EC2 settings and checked-in `deploy/` files supersede its host/package instructions.

# EC2 t3.micro update — 2026-09-14

The owner selected **EC2 t3.micro**. This replaces the older Lightsail decision retained below. Do not provision another host. Deploy one Node process with Caddy; build the frontend locally and transfer only the release allowlist. See `deploy/ms-backend.service`, `deploy/Caddyfile`, and `deploy/package-release.sh`.

Planned layout: `/opt/marketing-studio/releases/<release>`, `current` symlink, and `shared/data` for retained artifacts. Credentials remain outside the release bundle in a protected shared `.env`, linked into the current repo root. Systemd uses user `msapp`, explicit production origin, and a 384 MB V8 heap budget. This limits JavaScript heap only; it is not a total-process memory guarantee. Inspect memory/disk and existing services over SSH before installation. Add swap only after verifying free disk and existing swap.

SSH details are pending. DNS still points both site hostnames at the instance; only ports 80/443 should be public, SSH restricted to the owner, and port 3001 kept private. Check the instance's CPU credit mode and public-IP billing in AWS; no pricing/credit coverage is assumed. Run the same-origin, two-user, signed-media and restart smoke before reviewer traffic. A small review deployment is the target, not unbounded concurrency.

---

# Deploy — backend + frontend on one AWS box

Scope lock (owner 2026-09-14): **make it work for one month.** New AWS account, **$100 credit**. Not a
permanent hosting decision — revisit after the 8x review.

Env names: [ENV.md](ENV.md). Worker endpoints: [RUNPOD.md](RUNPOD.md). Costs: [COST.md](COST.md).
**Never commit `.env`.** Values go on the server only.

---

## The decision: one origin, one instance

Serve the **API and the built SPA from the same host**. Not Vercel + a separate backend.

This is forced by the code, not preference:

| Fact | File | Consequence |
| --- | --- | --- |
| Frontend calls relative `/api/...` with bare `fetch()` | `apps/frontend/src/auth.ts:13`, `studio.ts:53` | `fetch` defaults to `credentials: "same-origin"` — **cookies are not sent cross-origin** |
| Session cookie is `SameSite=Lax`, no `Domain` | `apps/backend/src/google-auth.ts:260` | a cross-site XHR drops it; login "succeeds" then `/api/auth/me` says logged out |
| `vercel.json` has **no** `/api` rewrite | `apps/frontend/vercel.json` | it only keeps `/api/` out of the SPA fallback. Nothing serves the API on Vercel. |
| There is no `VITE_API_URL` | — | the frontend cannot be pointed at another host without a code change |

A split deploy needs three coordinated changes (absolute API base, `credentials: "include"`,
`SameSite=None; Secure`). One origin needs **one** small change. For a one-month demo, take the one.

> Do **not** try to fix this with a Vercel rewrite proxy. Rewrites to an external origin pass through
> Vercel's edge, and your media responses (a swapped 720p clip measured **~17 MB**) will run into its
> payload and timeout limits. The box authorises reads; R2 serves migrated media.

### Bonus: your Google OAuth config already matches

`GOOGLE_*` is registered with redirect `https://www.marketingstudioie.site/callback`, and
`apps/frontend/src/main.tsx:9` already handles `pathname === "/callback"`. Point that hostname at this
instance and **no Google console change is needed.**

---

## Cost

| Line item | Cost / mo |
| --- | --- |
| Lightsail 1 GB / 2 vCPU / 40 GB SSD / 2 TB transfer | **$5.00** |
| Static IP (attached) | $0.00 |
| **Total against the $100 credit** | **$5.00** |

Lightsail is the right AWS product here — flat price, static IP included, 2 TB transfer, no VPC or
security-group work, and **no public-IPv4 surcharge** (EC2 charges $0.005/hr ≈ $3.60/mo for every address).
The equivalent EC2 t3.small build is ~$21/mo for no benefit at this size.

Sizing is justified: the backend does **no video encoding**. All five heavy encoders in `ffmpeg-local.ts`
(`trimVideoSegment`, `burnTexts`, `mixAudioBeds`, `makeStillVideo`, `makeBlackVideo`) have **zero callers** —
export is cloud-only (`studio-render.ts:135`). What remains is `ffprobe` metadata reads, an audio-only
mp3 transcode, a `-c:v copy` mux, and one-frame poster extraction. The memory fixes below are required; 1 GB still needs a concurrency/load smoke test.

Still running against the same credit: **~$14/mo of RunPod network volume** (200 GB at $0.07/GB) — that is
a separate account and unaffected by this.

---

## Prerequisites

- AWS account with the $100 credit, Lightsail enabled
- Control of DNS for `marketingstudioie.site`
- A filled `.env` (see [ENV.md](ENV.md)) — you will paste it onto the server, never commit it
- Supabase schema already applied (done 2026-09-14, 11/11 tables)

---

## Code and database prerequisites

SPA serving is implemented in `src/http.ts`, installed last by `src/index.ts`. Private GET/HEAD routes now require login; catalogs remain public. OAuth is same-origin with Secure cookies on HTTPS. Build the frontend before production startup. Do not deploy the SPA to Vercel alone: it has no backend API.

Apply `supabase/migrations/20260914160000_tenant_hardening.sql` (owner applied and REST permissions verified 2026-09-14). Production startup refuses a missing migration. Follow [SECURITY-HARDENING.md](SECURITY-HARDENING.md) for legacy media migration and two-user verification. Keep the service to **one Node process**.

---

## Steps

### 1. Instance

Lightsail → Create instance → **Ubuntu 24.04 LTS** → **$5/mo (1 GB)** plan. Then:

- Networking → **attach a static IP** (free while attached; billed if left unattached)
- Networking → firewall: allow **80/tcp** and **443/tcp**

### 2. DNS

Point at the static IP:

```
A   www.marketingstudioie.site   -> <STATIC_IP>
A   marketingstudioie.site       -> <STATIC_IP>
```

Wait for propagation before requesting certificates, or Caddy's ACME challenge fails.

### 3. Server packages

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
ffmpeg -version && ffprobe -version && node -v   # all four must succeed
```

`ffmpeg` **and** `ffprobe` are both required — `ffmpeg-local.ts` and `templates.ts` call each directly.

### 4. Code and build

```bash
git clone https://github.com/farhann-saleem/sixeyes.git ~/app
cd ~/app
(cd apps/backend  && npm ci)
(cd apps/frontend && npm ci && npm run build)   # produces apps/frontend/dist
```

### 5. Environment

```bash
install -m 600 /dev/null ~/app/.env
nano ~/app/.env        # paste your local .env, then change the values below
```

Must differ from local:

| Name | Value |
| --- | --- |
| `FRONTEND_URL` | `https://www.marketingstudioie.site` |
| `PORT` | `3001` (Caddy proxies to it) |
| `NODE_ENV` | `production` |

Confirm these are present and correct: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_*`,
`RUNPOD_API_KEY` + the three endpoint ids, `OPENROUTER_API_KEY`, `AI33_API_KEY`, `PEXELS_API_KEY`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SWICHNOW_*`.

`chmod 600` matters. Do not `git add` this file — the repo's `.gitignore` already blocks it.

### 6. systemd

`/etc/systemd/system/ms-backend.service`:

```ini
[Unit]
Description=Marketing Studio backend
After=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/app/apps/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ms-backend
sudo systemctl status ms-backend
journalctl -u ms-backend -f
```

`Restart=always` is load-bearing: the five `resumeInFlight*` calls at `index.ts:785-789` re-attach
in-flight avatar, swap, audio, studio-render and project jobs on boot, so a restart does not orphan work.

### 7. TLS

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
www.marketingstudioie.site {
	reverse_proxy 127.0.0.1:3001
	request_body {
		max_size 200MB
	}
}

marketingstudioie.site {
	redir https://www.marketingstudioie.site{uri} permanent
}
```

```bash
sudo systemctl reload caddy
```

`max_size` is not optional — face-swap and studio uploads are video files, and Caddy's default body limit
will reject them.

---

## Smoke test, in this order

```bash
curl -s https://www.marketingstudioie.site/health                  # backend alive
curl -s https://www.marketingstudioie.site/api/models/avatar       # vendor keys loaded
curl -s https://www.marketingstudioie.site/api/costs               # 401 without a session (expected)
```

Then in a browser:

1. Landing `/` renders — the SPA is being served.
2. `/pricing`, `/library`, `/avatar` render on **hard refresh** — the SPA fallback is correct.
3. Sign in with Google → a row appears in Supabase `profiles`. **This is the test that proves the
   same-origin cookie fix.** If you land back logged out, the cookie is being dropped.
4. Confirm a second Google account cannot list or read the first account’s jobs. Generate an avatar → job goes `PENDING → IN_PROGRESS → COMPLETED`, image renders.
5. `sudo systemctl restart ms-backend` mid-job → the job resumes, it does not hang.

Before touching a RunPod worker: `GET /health` on the endpoint, stop if `throttled > 0`, send
`{"input":{"op":"ping"}}`, then generate. See [RUNPOD.md](RUNPOD.md).

---

## Teardown — do not skip

The scope is one month. Lightsail bills until deleted, and an **unattached static IP is billable**.

```
Lightsail → Instances → delete the instance
Lightsail → Networking → release the static IP   (do this second, and actually do it)
```

Also consider, separately: the RunPod network volumes are **$14/mo** and keep billing at 200 GB whether
or not anything runs. The 100 GB CPU volume is sized for 4K frame extraction that is no longer done
(inputs are downscaled to 720p). RunPod volumes can only grow, so trimming means recreating them.

---

## Do not

- Split the frontend and backend across origins without the three-part auth change. It will look like it
  works and then silently fail login.
- Proxy `/api` through a Vercel rewrite. 17 MB media responses will hit its limits.
- Put the backend on RunPod. Cheapest CPU pod is ~$21/mo, and the pod-id proxy URL
  (`https://{podId}-3001.proxy.runpod.net`) changes on every rebuild, breaking the Google redirect and the
  SwichNow callback.
- Use EC2 for this size. ~$21/mo versus $5, largely because of the public-IPv4 charge.
- Commit `.env`, or bake keys into an image or a systemd unit.
- Expose port 3001 in the Lightsail firewall. Only Caddy should reach it.

---

## Remaining deployment checks

- R2 redirects and streaming legacy reads are implemented. Migrate existing rows on the host holding their files, then verify before removing local cache. Do not rebuild away unmigrated files.
- The 1 GB plan has not been load-tested. Disk-backed uploads and streaming reads remove the specific per-request memory buffers; vendor work and scratch still consume resources.
- **CPU worker timeline v1 remains a separate deployment gate** for documentary export.
- Test two Google accounts: each sees only its own jobs, media, identities and projects; copied foreign API URLs return 404, and signed URLs expire after 300 seconds.

## Launch-screen guidance — before the instance exists

The owner's launch screen currently shows Amazon Linux 2023, **t3.small**, and two gp3 volumes (8 + 12 GiB). Recommend Ubuntu Server 24.04 LTS x86_64 (ordinary Ubuntu, not paid Ubuntu Pro), one encrypted 20 GiB gp3 root volume, a new RSA PEM key named `marketing-studio`, SSH from My IP, HTTP/HTTPS from the internet, and one On-Demand instance. Keep the selected t3.small if the owner accepts its extra RAM; t3.micro remains the lower-memory budget choice. Actual size is not confirmed until launch. The screen's $0.0216/hour t3.small compute rate equals $15.55 for 30 days before disk/IP charges and credits. Do not assume “Free tier eligible” means zero cost. Prefer Standard CPU credit mode to avoid surplus CPU credit charges; performance can throttle when credits run out. Request public IPv4 and the downloaded key's local path only after launch.
