# dmosh heavy-mode server (reference)

Optional native-ffmpeg backend for large/long clips and motion-vector effects
the browser can't do. The web app stays 100% client-side unless you point it at
one of these by setting `VITE_MOSH_SERVER`.

It reuses the **exact same** pure engine as the browser (`../src/mosh/avi.ts`,
`../src/mosh/ops.ts`) via [`tsx`](https://github.com/privatenumber/tsx), so the
structural effects are identical — only faster (native ffmpeg, no wasm) and
without the browser memory ceiling. The one server-only effect is
`motionTransfer`, which needs FFglitch.

> Status: reference implementation. It is not deployed anywhere by default —
> you host it. Nothing in the web app depends on it unless `VITE_MOSH_SERVER`
> is set.

## Run locally

```bash
cd server
npm install
npm start          # needs `ffmpeg` on PATH; listens on :8787
```

Then build the web app pointed at it:

```bash
VITE_MOSH_SERVER=http://localhost:8787 npm run dev   # from repo root
# optional shared secret:
VITE_MOSH_SERVER=http://localhost:8787 VITE_MOSH_SERVER_TOKEN=secret npm run dev
# server side: MOSH_TOKEN=secret CORS_ORIGIN=https://yoursite npm start
```

## Docker

```bash
docker build -f server/Dockerfile -t dmosh-server .
docker run -p 8787:8787 -e MOSH_TOKEN=secret dmosh-server
```

## API contract

Matches `src/mosh/serverBackend.ts`:

| Method | Path | Body / returns |
| --- | --- | --- |
| `POST` | `/jobs` | multipart: `effect, intensity, seed, keepAudio, range, clip, clip2?` → `{ id }` |
| `GET` | `/jobs/:id` | `{ status, progress, phase, error? }` |
| `GET` | `/jobs/:id/result` | the moshed `video/mp4` |

`Authorization: Bearer <MOSH_TOKEN>` is required when `MOSH_TOKEN` is set.

## FFglitch (`motionTransfer`)

`motionTransfer` paints one clip's motion vectors onto another's content. It
shells out to `ffgac` and `ffedit` from [ffglitch.org](https://ffglitch.org/) —
install those and put them on `PATH` (they are **not** in the Docker image by
default; add them in a downstream image). Without them, every other effect still
works; `motionTransfer` returns an error.
