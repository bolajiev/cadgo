# Deployment

## Current production

- **Studio:** https://cadgo-3d.vercel.app/studio
- **Vercel project:** `bolaji7773s-projects/cadgo-3d`
- **Framework preset:** Next.js
- **Required environment variable:** `OPENCODE_GO_API_KEY` (Production, Secret)
- **Deployment protection:** disabled for the production domain

The root `/` redirects to `/studio`.

## Deploying updates

From the repository root:

```sh
npx vercel --prod --token "$VERCEL_TOKEN"
```

Or connect the GitHub repository in Vercel → Project → Settings → Git and let pushes deploy automatically.

Optional environment variables:

- `CADGO_AGENT_UPSTREAM_TIMEOUT_MS` (default `240000`)
- `CADGO_AGENT_RATE_LIMIT` (default `200`, per session)
- `CADGO_AGENT_IP_RATE_LIMIT` (default `1000`, per IP)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` or Vercel KV equivalents for durable rate limiting
- `BLOB_READ_WRITE_TOKEN` for large share links

## Verify a deployment

- `https://cadgo-3d.vercel.app/studio` loads logged out, with no Vercel login or challenge.
- Title is `Cadgo — AI 3D assembly studio`.
- Concept labs has 5 entries, including Lighthouse scene.
- Export has 6 entries, including Scene GLB and Part STLs.
- Load Lighthouse, play `beacon_angle`.
- Export the Scene GLB and confirm it contains the `beacon_angle` animation.
- Send a small agent prompt; confirm a part compiles and the final answer arrives.
- Share links use the public origin.

## Optional custom domain

A custom domain is not required. If you attach one later:

1. Add the domain in Vercel → Project → Settings → Domains.
2. Copy the exact DNS records Vercel shows.
3. In Cloudflare DNS, set those records to **DNS only** (grey cloud). Vercel handles TLS and its own CDN.
4. If you must use the Cloudflare proxy:
   - SSL/TLS → **Full (strict)**
   - Disable Rocket Loader, Bot Fight Mode and Under Attack mode for judging
   - Bypass cache for `/api/*`
   - Test the streaming agent turn; do not let Cloudflare buffer the SSE response
5. Wait for Vercel to show **Valid Configuration** and issue the certificate.

## Alternative: Cloudflare Tunnel (local fallback)

This exposes a locally running `next start` server on a domain. The machine must stay awake and online during judging.

```sh
npm run build
npm run start -- -p 3000
cloudflared tunnel login
cloudflared tunnel create cadgo
cloudflared tunnel route dns cadgo <your-domain>
```

Add an ingress rule for the hostname to `http://localhost:3000`, then run `cloudflared tunnel run cadgo`. Test the SSE agent stream and uploads/downloads.

## Not recommended before the deadline: Cloudflare Pages/Workers

The server uses Node APIs and Vercel-specific settings:

- `lib/share/storage.ts` uses `node:fs/promises` for local share storage.
- Large shares use `@vercel/blob`.
- `app/api/studio2/agent/route.ts` uses `maxDuration = 300`.
- Rate limiting has an in-process default and an optional Redis REST adapter.

A Workers port would need `@opennextjs/cloudflare`, R2 for shares, KV or a Durable Object for rate limiting, and a review of the function/streaming limits. That is a separate project, not a deployment switch.
