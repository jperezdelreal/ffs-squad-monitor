# Deployment Guide

This guide covers how to deploy the FFS Squad Monitor dashboard to production.

## Prerequisites

- Node.js 18+ installed
- Access to the FFS repository heartbeat file (or adjust `FFS_HEARTBEAT_PATH`)
- A server or hosting platform

## Health Check

The dashboard includes a health check endpoint for monitoring:

```bash
GET /api/health
```

Returns:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-03-11T16:00:00.000Z"
}
```

## Deployment Options

### Option 1: Static + Separate Backend (Recommended)

Deploy the frontend to a static host (GitHub Pages, Netlify, Vercel) and run the backend API separately.

**Step 1: Build the static frontend**

```bash
npm run build
```

This creates a `dist/` directory with static HTML, CSS, and JS files.

**Step 2: Deploy static files**

Upload the `dist/` folder to your static hosting provider:

- **GitHub Pages**: Push `dist/` to a `gh-pages` branch
- **Netlify/Vercel**: Connect your repo and point build output to `dist/`
- **Cloudflare Pages**: Deploy the `dist/` directory

**Step 3: Run the backend API server**

The backend needs to serve the API endpoints. You can run Vite in preview mode or create a standalone Express server:

```bash
# Using Vite preview (quick option)
npm run preview -- --port 3000 --host 0.0.0.0

# Or build and serve with a static server
npm install -g serve
serve dist -p 3000
```

**CORS Considerations**: If frontend and backend are on different domains, configure CORS headers in `vite.config.js`.

---

### Option 2: Single Node.js Server

Run both the static frontend and API from a single Node.js server.

**Step 1: Build the frontend**

```bash
npm run build
```

**Step 2: Run Vite preview server**

```bash
npm run preview -- --port 3000 --host 0.0.0.0
```

This serves both the static files and the API endpoints defined in `vite.config.js`.

**For production**: Keep the process running with a process manager like `pm2`:

```bash
npm install -g pm2
pm2 start "npm run preview -- --port 3000 --host 0.0.0.0" --name ffs-monitor
pm2 save
pm2 startup
```

---

### Option 3: Docker Container (All-in-One)

Deploy everything in a Docker container for portability.

**Use the included Dockerfile:**

```bash
# Build the image
docker build -t ffs-squad-monitor .

# Run the container
docker run -d -p 3000:3000 \
  -v /path/to/FirstFrameStudios:/ffs \
  -e FFS_HEARTBEAT_PATH=/ffs/tools/.ralph-heartbeat.json \
  --name ffs-monitor \
  ffs-squad-monitor
```

**docker-compose.yml example:**

```yaml
version: '3.8'
services:
  monitor:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ../FirstFrameStudios:/ffs:ro
    environment:
      - FFS_HEARTBEAT_PATH=/ffs/tools/.ralph-heartbeat.json
      - NODE_ENV=production
    restart: unless-stopped
```

---

## Environment Variables

Configure these environment variables for your deployment:

| Variable             | Default                                     | Description                          |
|----------------------|---------------------------------------------|--------------------------------------|
| `FFS_HEARTBEAT_PATH` | `../FirstFrameStudios/tools/.ralph-heartbeat.json` | Path to FFS heartbeat file           |
| `PORT`               | `5173` (dev), `4173` (preview)              | Server port                          |
| `NODE_ENV`           | `development`                               | Set to `production` for prod builds  |

**Example:**

```bash
export FFS_HEARTBEAT_PATH=/app/ffs/tools/.ralph-heartbeat.json
export PORT=3000
npm run preview
```

---

## Testing Production Build Locally

Before deploying, test the production build on your local machine:

```bash
# Build the project
npm run build

# Preview the production build
npm run preview
```

Open `http://localhost:4173` and verify:

- ✅ Dashboard loads correctly
- ✅ Heartbeat monitor displays status
- ✅ Logs stream in real-time
- ✅ Agent activity shows correctly
- ✅ Health check endpoint responds: `http://localhost:4173/api/health`

---

## Post-Deployment Checklist

After deploying to production:

- [ ] Verify health check endpoint responds: `GET https://your-domain.com/api/health`
- [ ] Check heartbeat monitor updates in real-time
- [ ] Confirm log streaming works (`/api/logs/stream`)
- [ ] Test agent roster and issue fetching
- [ ] Monitor server logs for errors
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)

---

## Troubleshooting

### "Cannot find heartbeat file"

Ensure `FFS_HEARTBEAT_PATH` points to a valid location and the file exists:

```bash
ls -l "$FFS_HEARTBEAT_PATH"
```

### API endpoints return 404

If using a static host for the frontend:
- The backend API must run separately
- Update frontend API calls to point to your backend server URL

### Health check fails

Test the endpoint directly:

```bash
curl http://localhost:4173/api/health
```

Expected response:
```json
{"status":"ok","version":"0.1.0","timestamp":"..."}
```

---

## Monitoring & Logging

For production deployments, consider:

- **Process monitoring**: Use `pm2` or `systemd` to keep the server running
- **Uptime monitoring**: Ping `/api/health` every minute
- **Log aggregation**: Capture stdout/stderr for debugging

---

## Scaling Considerations

- The dashboard is lightweight and can run on minimal resources (512MB RAM, 1 CPU)
- API endpoints cache data (issues cache TTL: 30s)
- Log streaming uses Server-Sent Events (SSE) — one connection per client
- For high traffic, consider a reverse proxy (nginx, Caddy) with caching

---

## Related Documentation

- [README.md](../README.md) — Getting started and development guide
- [vite.config.js](../vite.config.js) — API endpoint implementations
- Issue #24 — Original deployment tracking issue
