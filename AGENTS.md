## Cursor Cloud specific instructions

### Services overview

| Service | How to run | Notes |
|---|---|---|
| Local Postgres + pgvector | `docker compose up -d postgres` | Port 5434; auto-initializes extensions via `scripts/init-db.sql` |
| Next.js dev server | `pnpm dev` | http://localhost:3000 |

### Startup sequence (after update script has run)

1. Start Docker daemon: `sudo dockerd &>/tmp/dockerd.log &` then `sudo chmod 666 /var/run/docker.sock`
2. Start Postgres: `docker compose up -d postgres` (wait for healthy: `docker compose ps`)
3. Apply any new migrations: `pnpm db:migrate`
4. (Optional) Seed if DB is empty: `pnpm tsx scripts/seed-curated.ts`
5. Start dev server: `pnpm dev`

### Key gotchas for cloud agents

- **Node version**: Node 24 is required. Use `source ~/.nvm/nvm.sh && nvm use 24` before any pnpm/node command.
- **DB fallback**: When `DATABASE_URL` is unset, all code (app + scripts) defaults to `postgresql://library:changeme@localhost:5434/library` (local Docker). This is the expected local dev path.
- **No AI_GATEWAY_API_KEY needed for basic dev**: The app runs fine without it; only enrichment pipeline scripts require it. The warning `[ai] AI_GATEWAY_API_KEY is not set` is safe to ignore.
- **Docker-in-Docker**: The cloud VM requires `fuse-overlayfs` storage driver and `iptables-legacy`. These are configured in `/etc/docker/daemon.json` and via `update-alternatives`.
- **pnpm.onlyBuiltDependencies**: The project allowlists `sharp`, `esbuild`, and `unrs-resolver` for postinstall scripts — no interactive `pnpm approve-builds` needed.

### Checks (see README for full script table)

- `pnpm lint` — ESLint
- `pnpm typecheck` — TypeScript strict
- `pnpm smoke` — production smoke test (requires network access to production site)
