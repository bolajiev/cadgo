# Deployment

## Recommended: Vercel app + Cloudflare DNS

Cadgo is a Next.js server app. It uses Node route handlers for the model proxy and share storage, and OpenSCAD runs in the browser. Deploy it on Vercel and use Cloudflare for DNS. Do not migrate the server to Cloudflare Pages or Workers before the hackathon.

### Vercel

1. Import the repository into the `cadgo-v2` Vercel project.
2. Project → Settings → Domains → add `omotalk.chat` and `www.omotalk.chat`.
3. Vercel shows the exact DNS values. They are typically:
   - apex `omotalk.chat`: `A 76.76.21.21`
   - `www`: `CNAME cname.vercel-dns.com`
   - plus any TXT verification record Vercel asks for.
4. Set the canonical host in Vercel and redirect the other host to it.
5. Set the environment variables:
   - `OPENCODE_GO_API_KEY` (required)
   - `CADGO_AGENT_UPSTREAM_TIMEOUT_MS` (default `240000`)
   - `CADGO_AGENT_RATE_LIMIT` (default `200`, per session)
   - `CADGO_AGENT_IP_RATE_LIMIT` (default `1000`, per IP)
   - optional `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` or Vercel KV equivalents for durable rate limiting
   - optional `BLOB_READ_WRITE_TOKEN` for large share links
6. Deploy.

### Cloudflare DNS

1. Open `omotalk.chat` → DNS → Records.
2. Add the A/CNAME records Vercel shows. Use the values Vercel gives, not the examples above if they differ.
3. Set **Proxy status to DNS only** (grey cloud) for those records. Vercel provides TLS and its own CDN; the orange cloud can break domain verification and may buffer or challenge the agent's SSE stream.
4. If you must use the Cloudflare proxy:
   - SSL/TLS → Overview → **Full (strict)**.
   - Disable Rocket Loader, Bot Fight Mode and Under Attack mode for the judging period.
   - Add a cache bypass rule for `/api/*`.
   - Test the streaming agent turn; Cloudflare must not buffer the event stream.
5. Wait for Vercel to show **Valid Configuration** and issue the certificate.

### Verify

- `https://omotalk.chat/studio` loads logged out, with no Vercel/Cloudflare login or challenge.
- Title is `Cadgo — AI 3D assembly studio`.
- Concept labs has 5 entries, including Lighthouse scene.
- Export has 6 entries, including Scene GLB and Part STLs.
- Load Lighthouse, play `beacon_angle`.
- Export the Scene GLB and confirm it contains the `beacon_angle` animation.
- Run a bounded scene prompt; it completes or shows a clear timeout with Retry.
- `www` redirects to the canonical host.
- Share links use the public origin.

## Alternative: Cloudflare Tunnel (local fallback)

This exposes a locally running `next start` server on the domain. It is useful as a backup, but the machine must stay awake and online during judging.

```sh
npm run build
npm run start -- -p 3000
cloudflared tunnel login
cloudflared tunnel create cadgo
cloudflared tunnel route dns cadgo omotalk.chat
```

Use a `~/.cloudflared/config.yml` with an ingress rule for `omotalk.chat` to `http://localhost:3000`, then run `cloudflared tunnel run cadgo`. Keep the server and tunnel running. Cloudflare proxies the traffic, so test the SSE agent stream and the upload/download paths.

## Not recommended before the deadline: Cloudflare Pages/Workers

The server uses Node APIs and Vercel-specific settings:

- `lib/share/storage.ts` uses `node:fs/promises` for local share storage.
- Large shares use `@vercel/blob`.
- `app/api/studio2/agent/route.ts` uses `maxDuration = 300`.
- Rate limiting has an in-process default and an optional Redis REST adapter.

A Cloudflare Workers port would need `@opennextjs/cloudflare`, R2 for shares, KV or a Durable Object for rate limiting, and a review of the function/streaming limits. That is a separate project, not a deployment switch. Use Vercel for the hackathon and revisit Workers afterwards.
