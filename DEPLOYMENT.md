# Production Deployment (kelvin-control.site)

## Target architecture
- Frontend (Vercel): `https://kelvin-control.site`
- Backend (VPS): `https://api.kelvin-control.site` (Node + PM2 behind Nginx)

---

## 1) DNS records (you do this at your domain provider)

Create these records:

- `@` (kelvin-control.site) -> Vercel (A or CNAME as instructed by Vercel dashboard)
- `www` -> Vercel target (`cname.vercel-dns.com` usually)
- `api` -> VPS public IP (A record)

Wait until DNS propagates.

---

## 2) Backend on VPS (run on server)

From repo root:

```bash
cd /home/kelvin/.openclaw/workspace/Agents-Mission-Control
npm install
npm run build --workspace backend
pm2 start ecosystem.config.cjs
pm2 save
```

Check:

```bash
pm2 status
curl http://127.0.0.1:4000/api/health
```

---

## 3) Nginx reverse proxy for API (you do this with sudo)

Create `/etc/nginx/sites-available/kelvin-control-api`:

```nginx
server {
  server_name api.kelvin-control.site;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/kelvin-control-api /etc/nginx/sites-enabled/kelvin-control-api
sudo nginx -t
sudo systemctl reload nginx
```

TLS cert:

```bash
sudo certbot --nginx -d api.kelvin-control.site
```

---

## 4) Frontend on Vercel (you do this in Vercel)

Import repo: `kelvinCB/Agents-Mission-Control`
Project root: `frontend`

Set env var in Vercel project:
- `VITE_API_BASE=https://api.kelvin-control.site`

Set custom domain:
- `kelvin-control.site`
- optional: `www.kelvin-control.site`

Deploy.

---

## 5) Post-deploy checks

- Frontend loads on `https://kelvin-control.site`
- API health: `https://api.kelvin-control.site/api/health`
- Upload memory, rename, delete, and sync to GitHub all work.

---

## 6) Auto-deploy backend on every push/merge to `main`

This repo now includes `.github/workflows/deploy-backend.yml`.

Trigger:
- Any push to `main`
- Any merged PR to `main` (because merge creates a push event)
- Manual run from Actions (`workflow_dispatch`)

### Required GitHub secrets (repo → Settings → Secrets and variables → Actions)

- `VPS_HOST` → your server IP or hostname
- `VPS_USER` → SSH user (example: `kelvin`)
- `VPS_SSH_KEY` → private key content (recommended: dedicated deploy key)

> Optional: if you use a non-standard SSH port, edit workflow and set `port` in the SSH action.

### What deployment does on VPS

1. `git fetch origin main`
2. `git checkout main`
3. `git pull --ff-only origin main`
4. `npm ci`
5. `npm run build --workspace backend`
6. `pm2 startOrReload ecosystem.config.cjs --update-env`
7. Healthcheck: `curl http://127.0.0.1:4000/api/health`

If any step fails, GitHub Action fails and code is not considered deployed.

## Notes
- Backend persists memory files in `data/memory` on VPS disk.
- Files are only pushed to GitHub when using **Guardar memories a GitHub**.
- CORS origins are controlled by `CORS_ORIGINS` in `ecosystem.config.cjs`.
