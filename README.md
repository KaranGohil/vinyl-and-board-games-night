# Vinyl & Board Games Night

Plan a night of records and board games with friends. Offer a few possible nights, share one link, and let everyone
vote on **when** to meet, **which games** to play and **which vinyl** to spin. When the host locks in the night,
everyone adds it to their calendar in one tap.

It's built to be **self-hosted**: run it on an old laptop, a Raspberry Pi or a cheap cloud server with one command.

![CI](https://github.com/KaranGohil/vinyl-and-board-games-night/actions/workflows/ci.yml/badge.svg)

## How it works

1. **Host creates a night** with a few possible dates and gets two links: an invite link to share, and a private
   host link.
2. **Friends join with just a name.** No accounts or passwords.
3. **Everyone adds what they can bring**: board games (with player count) and records (with the artist).
   Adding something counts as a vote for it.
4. **Everyone votes** on the nights they're free, the games they'd play and the records they want to hear. Results
   update live.
5. **The host locks in a night.** Everyone gets **Add to Google Calendar** and **Apple / Outlook (.ics)** buttons,
   with the top games and records listed in the invite.

## Run it in 2 minutes (Docker)

You need [Docker](https://docs.docker.com/get-docker/) with Compose v2.24 or newer.

```bash
git clone https://github.com/KaranGohil/vinyl-and-board-games-night.git
cd vinyl-and-board-games-night
cp .env.example .env        # then set POSTGRES_PASSWORD (and PUBLIC_URL) in .env
docker compose up -d --build
```

Open <http://localhost:8080>.

## Hosting guides

| Where | Guide |
| --- | --- |
| Old laptop or Raspberry Pi at home (Ubuntu Server) | [docs/self-hosting.md](docs/self-hosting.md) |
| CasaOS dashboard (no terminal) | [docs/self-hosting.md#using-casaos-install-from-the-dashboard-instead](docs/self-hosting.md#using-casaos-install-from-the-dashboard-instead) |
| Cloud server with your own domain and HTTPS | [docs/cloud.md](docs/cloud.md) |

The home guide covers keeping a laptop awake with the lid closed, reaching it from outside your Wi-Fi with
Cloudflare Tunnel or Tailscale (no router port-forwarding), nightly backups and updates.

## Tech stack

| Part | Choice |
| --- | --- |
| Front end | React 18, TypeScript, Vite, React Router |
| API | Node 22, Fastify 5, TypeScript, Zod validation |
| Database | PostgreSQL 16, plain SQL migrations applied on startup |
| Calendar | RFC 5545 `.ics` files + Google Calendar links (no API keys needed) |
| Packaging | Docker Compose: Postgres, API, Nginx; optional Caddy (HTTPS) or Cloudflare Tunnel |
| Quality | Vitest unit tests and API tests against real Postgres, GitHub Actions CI |

```
apps/
  api/        Fastify API, SQL migrations, tests
  web/        React app
deploy/       Nginx and Caddy config, backup script
docs/         Hosting guides
```

## Local development

Requirements: Node 20+ and a Postgres database. The quickest Postgres is Docker:

```bash
docker run -d --name vbgn-db -p 5432:5432 \
  -e POSTGRES_USER=vbgn -e POSTGRES_PASSWORD=vbgn -e POSTGRES_DB=vbgn postgres:16-alpine

npm install
DATABASE_URL=postgres://vbgn:vbgn@localhost:5432/vbgn npm run dev -w apps/api   # API on :3000
npm run dev -w apps/web                                                          # app on :5173
```

Tests:

```bash
npm test                                   # unit tests
TEST_DATABASE_URL=postgres://vbgn:vbgn@localhost:5432/vbgn npm test -w apps/api   # + API tests (wipes that database)
```

## API

All routes are under `/api`. A browser keeps two per-event secrets in local storage and sends them as headers:
`X-Participant-Token` (after joining) and `X-Host-Token` (from the host link).

| Method | Route | Who | Does |
| --- | --- | --- | --- |
| `POST` | `/events` | anyone | Create an event with candidate nights; returns invite and host links |
| `GET` | `/events/:id` | anyone | Event, nights, games and vinyl with vote counts |
| `POST` | `/events/:id/participants` | anyone | Join with a display name |
| `PUT` | `/events/:id/availability` | participant | Set the nights you're free |
| `POST` | `/events/:id/items` | participant | Add a game or record |
| `DELETE` | `/events/:id/items/:itemId` | adder or host | Remove an item |
| `PUT` | `/events/:id/votes` | participant | Set your game and record votes |
| `POST` | `/events/:id/lock` | host | Lock in a night (or `null` to unlock) |
| `GET` | `/events/:id/calendar.ics` | anyone | Calendar file once a night is locked |
| `GET` | `/health` | anyone | Health check |

## Privacy and security

- No accounts and no email. Anyone with the invite link can join, so share it with the people you want.
- Keep the host link private: whoever has it can lock in the night and remove items.
- Data stays in your own Postgres database. Nothing is sent to third parties, except the Google Fonts stylesheet the
  page loads (remove the two font `<link>` tags in `apps/web/index.html` if you'd rather not).

## Roadmap

- [ ] Look up games on BoardGameGeek and records on Discogs or MusicBrainz to fill in details and cover art
- [ ] Recurring nights (e.g. first Friday of every month)
- [ ] MCP server so you can ask Claude to "set up a game night next Friday and add Catan"
- [ ] Optional email reminders for self-hosters who configure SMTP

## License

[MIT](LICENSE)
