# Publish code-only multiplayer

Recommended setup: **one Render Web Service hosts the website and game server**. Players open one link. The host chooses **Play with friends → Create crew**, copies a five-digit code such as `48271`, and sends it to friends. Friends open that same link, enter the code and choose **Join crew**. Maximum: four players per crew.

## Deploy on Render

1. Sign in at https://dashboard.render.com and connect GitHub.
2. Choose **New → Blueprint** and select `arnavsingh0418/SpaceApps`, branch `main`.
3. Render reads `render.yaml`. Review the proposed service `outpost-down-crew` and choose **Deploy Blueprint**. The blueprint requests the Free instance; review the selected plan before creating the service.
4. Wait until the service is **Live**, then open the exact HTTPS URL Render displays. This is the game link to give everyone. No environment variables or API keys are needed.
5. Open that link in two separate browsers/devices. Create a crew in one, enter its five-digit code in the other. Both should show the same code and crew members. The host assigns power to start the mission.

If creating the service manually instead, choose **New → Web Service**, link the same repository, and use:

- Runtime: Node; branch: `main`; root directory: leave blank.
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm run server`
- Health check path: `/health`
- Environment variable: `NODE_VERSION=24`
- Instances: **1**. Leave autoscaling off.

The website and WebSocket server use the same Render port automatically. TLS is supplied by Render. The client connects to `wss://<the-current-website>/crew`; no server-address field is shown to players. The `/health` URL returns a small JSON status response. GitHub pushes trigger Render rebuilds when automatic deployments are enabled.

## What to expect

Rooms are temporary and live in server memory. Codes work while the crew exists; everyone leaving, a server restart or a new deployment ends those rooms. Host means crew leader: the shared cloud server runs the simulation. The host's computer does not need to accept incoming network connections. No router port forwarding, NASA key, ElevenLabs key, database, Firebase or Supabase is required for this version.

Render Free sleeps after 15 minutes without traffic and can take about a minute to wake. For a presentation, open the game beforehand and test a crew. Use an always-on paid instance if you need to avoid cold starts; review current pricing in Render. One instance is essential because room state is in memory. Multiple instances or resuming after server restarts would require shared storage and reconnect/session work.

## Optional: Vercel website + Render server

Deploy the Render service above first. In Vercel, import the repository, use build command `npm run build` and output directory `dist`. Set `VITE_CREW_SERVER` to `wss://YOUR-ACTUAL-RENDER-HOST/crew`, then deploy/redeploy. This is a public connection URL, not a secret. Players open the Vercel link and still enter only the five-digit code. All website deployments intended to share codes must point to the same server.

The existing private Sites preview is a static website. It does not become a multiplayer server from this code change. Use the Render-hosted game link for the simplest working deployment, or explicitly configure that preview to use the hosted backend.

## Local verification

Run `npm run build`, then `npm run server`. Open http://localhost:2567 in two browsers and repeat the create/join flow. No Vite server is needed. With the server running:

```sh
npm run test:net
node scripts/crew-lobby-qa.mjs
```

For development, `npm run dev` proxies `/crew` to the local server on port 2567.

References: https://render.com/docs/deploy-node-express-app, https://render.com/docs/websocket, https://render.com/docs/free.
