# Deployment

This app deploys to a home server via DockerHub + Portainer, the same flow as `personal_lms`.

## One-time setup

1. DockerHub login on your dev machine:
   ```bash
   docker login
   ```
2. (Optional) Override the DockerHub user:
   ```bash
   export DOCKERHUB_USERNAME=your-dockerhub-user
   ```
   Defaults to `caseyinhaengsin`.

## Build and push

```bash
./build-and-push.sh            # builds + pushes :latest
./build-and-push.sh v1.0.0     # builds + pushes :v1.0.0 and :latest
```

Builds for `linux/amd64` so the image runs on the server regardless of your dev machine's arch.

## Deploy via Portainer

**Stacks → Add stack → name `resume-builder-web`**, then paste:

```yaml
services:
  resume-builder-web:
    image: caseyinhaengsin/resume-builder-web:latest
    container_name: resume-builder-web
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: "production"
      PORT: "3000"
      HOST: "0.0.0.0"
    volumes:
      - /mnt/user/appdata/resume-builder-web/data:/app/data
    restart: unless-stopped
```

Adjust the host volume path (`/mnt/user/appdata/...`) to match your server's appdata layout. The container writes the SQLite DB and uploaded images under `/app/data`, so that single mount covers all persistent state.

Click **Deploy the stack**.

## Updating

1. `./build-and-push.sh` on your dev machine.
2. In Portainer → the stack → **Pull and redeploy**.

Migrations run automatically on container start (see `scripts/migrate.mjs`), so no manual exec step is needed after redeploys.

## Schema changes

The `drizzle/` folder + `drizzle/meta/_journal.json` are the authoritative migration history — commit them to git.

When you change `app/db/schema.ts`:

```bash
pnpm exec drizzle-kit generate   # produces drizzle/<NNNN>_<name>.sql + updates meta/
git add drizzle/ app/db/schema.ts
git commit -m "schema: <what changed>"
./build-and-push.sh
# Portainer → stack → Update with Re-pull image ✓
```

The container's startup migrator applies any new migrations in order and records them in `__drizzle_migrations`. Already-applied migrations are skipped on subsequent boots.

**Don't use `pnpm db:push` for production schema changes.** Push applies the schema directly without updating the migrator journal, which desyncs `drizzle/meta/` from the SQL files and breaks the migrator on the next deploy. Use it only for throwaway local experimentation, and run `drizzle-kit generate` afterward to capture the change properly.

## Data layout

Inside the container, `/app/data/` holds:
- `resume.db` (+ `-shm`, `-wal`) — SQLite database
- `uploads/` — company logos / images

Back up the host-side volume directory to back up everything.

## Notes

- App listens on port `3000` (React Router's default `react-router-serve`). Map to whatever external port you want, or front it with a reverse proxy (Nginx, Caddy, Traefik) for HTTPS.
- No required secrets at the moment — auth is local. If/when env-based secrets are added (e.g. session keys, API keys), set them in the Portainer stack `environment:` block.
