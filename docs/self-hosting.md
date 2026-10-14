# Self-host on an old laptop (Ubuntu Server)

This guide turns a spare laptop running Ubuntu Server into the home for your game nights. It takes about 30 minutes.
The same steps work on a Raspberry Pi 4/5 or any always-on Linux box.

You'll end up with:

- The app running in Docker, restarting by itself after reboots and power cuts
- The laptop staying on with the lid closed
- A way for friends to reach it (on your Wi-Fi, or from anywhere)
- Nightly database backups

---

## 1. Prepare the laptop

Log in to the laptop (or SSH into it) and update it:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
```

Find its address on your network. You'll use this a lot:

```bash
hostname -I
# e.g. 192.168.1.50
```

> Tip: In your router's settings, give the laptop a **DHCP reservation** (a fixed IP) so this address never changes.

## 2. Keep it awake with the lid closed

By default, a laptop suspends when you close the lid. Turn that off:

```bash
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/^#\?HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind

# Belt and braces: never sleep or hibernate.
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

Close the lid and check it still answers `ping 192.168.1.50` from another device.

> Leaving a laptop plugged in 24/7 is fine, but keep it somewhere ventilated. If your laptop's BIOS has a
> "battery charge limit" (often 60% or 80%), turning it on extends the battery's life.

## Using CasaOS? Install from the dashboard instead

If you've installed [CasaOS](https://casaos.zimaspace.com), you can skip steps 3–5 and the terminal:

1. Open [`docker-compose.casaos.yml`](../docker-compose.casaos.yml) from this repo and copy its contents.
   It uses prebuilt images from GitHub Container Registry, built by the **Publish images** workflow.
   (Running your own fork? Replace `ghcr.io/karangohil/` with your username, and after the first build mark both
   packages **Public** under your GitHub profile → Packages → package settings.)
2. Change the two placeholders in your copy:
   - `change-me-to-something-long` → a long password of letters and numbers (it appears **twice**; both must match)
   - `PUBLIC_URL` → the address friends will type, e.g. `http://192.168.1.50:8080`
3. In the CasaOS dashboard: **App Store → "+" (top right) → Install a customized app → Import**, paste it, and install.
4. Open the new **Vinyl & Board Games Night** tile, or go to `http://<laptop-ip>:8080`.

Data is stored in `/DATA/AppData/vinyl-and-board-games-night/`. To update, use the app's settings in CasaOS to
pull the latest image (or run `docker compose pull && docker compose up -d` in a terminal).

You still need SSH once for step 2 (lid closed) and step 7 (backups). For backups with CasaOS, replace the
`docker compose exec` line in `deploy/backup.sh` with `docker exec vbgn-db pg_dump -U vbgn vbgn`.

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (or run `newgrp docker`), then check:

```bash
docker run --rm hello-world
docker compose version   # needs v2.24 or newer
```

## 4. Get the app and configure it

```bash
git clone https://github.com/KaranGohil/vinyl-and-board-games-night.git
cd vinyl-and-board-games-night
cp .env.example .env
```

Open `.env` (`nano .env`) and set at least:

```ini
POSTGRES_PASSWORD=<paste the output of: openssl rand -hex 24>
PUBLIC_URL=http://192.168.1.50:8080
```

`PUBLIC_URL` is the address friends will type. It's used for the link inside calendar invites.

## 5. Start it

```bash
docker compose up -d --build
```

The first build takes a few minutes. Then check everything is healthy:

```bash
docker compose ps
curl http://localhost:8080/api/health   # {"ok":true}
```

Open `http://192.168.1.50:8080` from your phone on the same Wi-Fi. You should see the "Start a night" page.

Because every service uses `restart: unless-stopped`, the app comes back on its own after a reboot.

## 6. Let friends reach it

Pick one option.

### Option A — Same Wi-Fi only (simplest)

Nothing to do. Anyone on your home network can open `http://192.168.1.50:8080`. Good for a household or for testing.

### Option B — Cloudflare Tunnel (recommended for friends anywhere)

A tunnel gives you a public `https://` address without opening any ports on your router or exposing your home IP.
You need a free Cloudflare account and a domain whose DNS is managed by Cloudflare.

1. In the Cloudflare dashboard, go to **Zero Trust → Networks → Tunnels → Create a tunnel**. Choose **Cloudflared**
   and name it (e.g. `game-night`).
2. On the install screen, copy the **token** (the long string after `--token`). You don't need to run their
   install command; Docker will.
3. Add a **Public hostname**: subdomain `games`, your domain, service **HTTP** → `web:80`.
4. In `.env`, set:
   ```ini
   TUNNEL_TOKEN=<the token>
   PUBLIC_URL=https://games.yourdomain.com
   ```
5. Start with the tunnel:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
   ```

Visit `https://games.yourdomain.com`. HTTPS is handled by Cloudflare.

### Option C — Tailscale (private group)

[Tailscale](https://tailscale.com) puts your devices on a private network. It's the most private option, but every
friend needs to install Tailscale and accept your invite, so it suits a small regular group better than casual guests.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4   # e.g. 100.101.102.103
```

Set `PUBLIC_URL=http://100.101.102.103:8080` (or your machine's MagicDNS name) and share that address with people
on your tailnet.

> **Avoid** forwarding ports on your router straight to the laptop unless you know why you need to. If you do,
> use `docker-compose.https.yml` (Caddy with automatic HTTPS) as described in [cloud.md](cloud.md).

## 7. Back up the database

Laptop drives fail. Back up nightly:

```bash
chmod +x deploy/backup.sh
./deploy/backup.sh          # test it once: creates backups/vbgn-<date>.sql.gz
crontab -e
```

Add this line (runs at 3:15 every night, keeps the newest 14 backups):

```
15 3 * * * cd /home/<you>/vinyl-and-board-games-night && ./deploy/backup.sh >> backups/backup.log 2>&1
```

Copy the `backups/` folder somewhere else from time to time (a USB stick, or `rclone` to cloud storage).

**Restore** a backup:

```bash
gunzip -c backups/vbgn-2026-10-13-0315.sql.gz | docker compose exec -T db psql -U vbgn -d vbgn
```

## 8. Updating

```bash
cd vinyl-and-board-games-night
git pull
docker compose up -d --build     # add the same -f flags you started with
```

Database changes apply automatically when the API starts.

## 9. Basic hardening

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8080/tcp     # skip this if you only use Cloudflare Tunnel
sudo ufw enable
sudo apt install -y unattended-upgrades   # automatic security updates
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `docker compose up` says `Set POSTGRES_PASSWORD in .env` | You skipped step 4. Copy `.env.example` to `.env` and fill it in. |
| `ports: !reset` error | Your Docker Compose is older than v2.24. Re-run the Docker install in step 3. |
| Page loads but nothing saves | Run `docker compose logs api`. Usually a wrong `POSTGRES_PASSWORD` after changing it: the database keeps the first password it was created with. |
| Calendar invite links point to `localhost` | Set `PUBLIC_URL` in `.env`, then `docker compose up -d`. |
| Laptop goes to sleep anyway | Re-check step 2, then reboot. Some laptops also need "wake on lid open" disabled in the BIOS. |
