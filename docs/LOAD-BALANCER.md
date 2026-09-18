# Production Load Balancer & High Availability Architecture

Date: 2026-09-18  
Status: Production Operational Architecture  
Host Target: AWS Lightsail / EC2 behind Caddy TLS + Vercel Edge

---

## 1. Current Split Architecture

Marketing Studio operates with an edge-split hosting architecture:
1. **Frontend**: Deployed to Vercel's global CDN edge (`https://www.marketingstudioie.site`). Static assets (JS, CSS, SVGs, images) are served directly from edge points of presence with immutable caching headers.
2. **Backend API**: Hosted on dedicated Linux instances (`https://api.marketingstudioie.site`) behind Caddy web server with automatic Let's Encrypt TLS and reverse proxying to `127.0.0.1:3001`.
3. **Heavy Media & Artifacts**: Served via Cloudflare R2 with direct pre-signed URLs (302 redirects) to guarantee zero backend memory buffering and $0 egress.

---

## 2. Reverse Proxy & Upstream Load Balancing (Caddy)

When scaling backend capacity beyond a single node, Caddy acts as the Layer 7 load balancer distributing traffic across multiple local or private-network Node.js workers:

```caddyfile
# /etc/caddy/Caddyfile on API Gateway
api.marketingstudioie.site {
    # Automatic TLS via Let's Encrypt
    encode gzip zstd

    # Health-checked upstream load balancing pool
    reverse_proxy 127.0.0.1:3001 127.0.0.1:3002 {
        lb_policy round_robin
        lb_try_duration 2s

        # Active health checks
        health_uri /health
        health_interval 5s
        health_timeout 2s
        health_status 200

        # Preserve client headers and pass to Express
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## 3. Health Check Endpoints

The backend provides two distinct health check probes:
- **Liveness Probe**: `GET /health`  
  Returns `200 OK` with `{ "ok": true, "service": "marketing-studio-backend", "revision": "..." }`. Used by load balancers and container orchestrators to route traffic only to healthy worker instances.
- **Deep Dependency Probe**: `GET /api/studio/health`  
  Validates connectivity to RunPod GPU/CPU endpoints, R2 credentials, and Supabase database. Returns granular status on worker availability.

---

## 4. Connection Draining & Zero-Downtime Updates

Automatic updates via `/usr/local/sbin/ms-update-release` perform graceful restarts:
1. Systemd stops accepting new connections on the primary worker.
2. Existing long-running requests finish within a 15-second timeout window.
3. Systemd starts the new revision and validates `/health` returns 200 before cutting traffic over.
