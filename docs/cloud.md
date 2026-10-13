# Deploy to a cloud server (VPS)

Any small Linux virtual server works: DigitalOcean, Hetzner, Linode, AWS Lightsail, Oracle Cloud and so on.
The smallest plan (1 vCPU, 1 GB RAM) is enough for a friend group.

## 1. Create the server

- Image: **Ubuntu 24.04 LTS**
- Add your SSH key when creating it
- Note its public IP address

## 2. Point a domain at it

At your DNS provider, add an **A record**: `games.yourdomain.com` → the server's public IP.
Wait until `ping games.yourdomain.com` shows that IP.

## 3. Install Docker and the app

SSH in, then follow steps 3–4 of [self-hosting.md](self-hosting.md) (install Docker, clone, create `.env`).
In `.env` set:

```ini
POSTGRES_PASSWORD=<output of: openssl rand -hex 24>
PUBLIC_URL=https://games.yourdomain.com
DOMAIN=games.yourdomain.com
```

## 4. Start with automatic HTTPS

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

[Caddy](https://caddyserver.com) gets and renews a Let's Encrypt certificate for you. Open
`https://games.yourdomain.com`.

## 5. Backups and updates

Same as the laptop guide: [backups](self-hosting.md#7-back-up-the-database) and
[updating](self-hosting.md#8-updating). Remember to pass both `-f` files when you update.
Many VPS providers also offer automatic server snapshots for a small fee.
