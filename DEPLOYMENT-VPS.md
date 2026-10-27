# Deploy Postbox to a Linux VPS

This guide deploys Postbox on an Ubuntu or Debian VPS at `postbox.boliflow.com`, without Docker. It uses Node.js, PostgreSQL, systemd, and Caddy for HTTPS.

## 1. Prepare DNS and the VPS

Create DNS records for `postbox.boliflow.com` pointing to the VPS public IPv4 address (an `A` record) and, if configured on the VPS, IPv6 address (an `AAAA` record). Wait for DNS to resolve before requesting HTTPS certificates.

Allow inbound TCP ports **22**, **80**, and **443** in the VPS firewall/security group. Do not expose PostgreSQL port 5432 publicly. For UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Connect over SSH and update the operating system:

```bash
sudo apt update
sudo apt upgrade -y
```

Install PostgreSQL, Caddy, and the build tools:

```bash
sudo apt install -y postgresql postgresql-contrib caddy git build-essential
```

Install a supported Node.js 22 LTS release using the official Node.js installation instructions for your distribution. Verify `node --version` reports v22 and `npm --version` works. The build stage needs enough memory; on a small VPS, add swap or build the app elsewhere and deploy the matching Linux production artifact.

## 2. Create the database

Create a database and a dedicated login. Generate a URL-safe database password so it does not need escaping inside `DATABASE_URL`:

```bash
DB_PASSWORD="$(openssl rand -hex 32)"
printf 'Save this database password in your secrets manager: %s\n' "$DB_PASSWORD"
sudo -u postgres psql <<SQL
CREATE ROLE postbox LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE postbox OWNER postbox;
SQL
```

Retain the generated password securely; use it in the `DATABASE_URL` below.

Keep PostgreSQL bound to localhost or its Unix socket. Confirm local access works before proceeding:

```bash
psql "postgres://postbox:${DB_PASSWORD}@127.0.0.1:5432/postbox" -c 'select 1;'
```

## 3. Install the application

Create a service user and app directory. Check out the intended production branch or release into `/opt/postbox` (use your repository URL):

```bash
sudo useradd --system --create-home --home-dir /var/lib/postbox --shell /usr/sbin/nologin postbox
sudo mkdir -p /opt/postbox
sudo chown postbox:postbox /opt/postbox
sudo -u postbox git clone YOUR_REPOSITORY_URL /opt/postbox
```

If `/opt/postbox` already contains a checkout, update it to the release you intend to deploy instead of cloning over it. Install locked dependencies and build as the service user:

```bash
cd /opt/postbox
sudo -u postbox npm ci
sudo -u postbox npm run build
```

## 4. Configure production secrets

Create `/etc/postbox` and a root-owned environment file. Keep it out of the repository and restrict access:

```bash
sudo install -d -o root -g postbox -m 0750 /etc/postbox
sudo install -o root -g postbox -m 0640 /dev/null /etc/postbox/postbox.env
sudoedit /etc/postbox/postbox.env
```

Add these values (generate each secret with `openssl rand -hex 32`):

```dotenv
NODE_ENV=production
DATABASE_URL=postgres://postbox:URL_SAFE_DATABASE_PASSWORD@127.0.0.1:5432/postbox
BETTER_AUTH_URL=https://postbox.boliflow.com
BETTER_AUTH_SECRET=64_HEX_CHARACTERS_FROM_OPENSSL
ENCRYPTION_KEY=64_HEX_CHARACTERS_FROM_OPENSSL
SYNC_CRON_SECRET=64_HEX_CHARACTERS_FROM_OPENSSL
```

Use independent random values for the three application secrets. `ENCRYPTION_KEY` must be exactly 64 hexadecimal characters. **Back it up securely and never rotate or lose it:** Postbox uses it to decrypt stored email account credentials. Losing it makes saved mailbox passwords and OAuth tokens unusable. `BETTER_AUTH_SECRET` also needs to remain stable so sessions and auth behavior are not disrupted.

If using Google or Microsoft sign-in/account linking, add the corresponding client ID and secret to this file and configure the provider redirect URI as `https://postbox.boliflow.com/api/auth/google/callback` or `https://postbox.boliflow.com/api/auth/outlook/callback`. Those credentials are optional for password-only/manual IMAP use.

## 5. Apply database migrations

The application does not automatically run SQL migrations on startup. Apply every checked-in migration in numeric order, including migrations `0000` through `0010`:

```bash
cd /opt/postbox
set -a
. /etc/postbox/postbox.env
set +a
for migration in lib/db/migrations/*.sql; do
  echo "Applying $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

For an existing database, take a backup first and verify which migrations have already been applied. Do not blindly re-run non-idempotent migrations. Keep the database and uploaded/attached message data in backups according to your retention needs.

## 6. Run Postbox with systemd

Create `/etc/systemd/system/postbox.service`:

```ini
[Unit]
Description=Postbox web application
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=postbox
Group=postbox
WorkingDirectory=/opt/postbox
EnvironmentFile=/etc/postbox/postbox.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Confirm the Node and npm paths with `command -v node` and `command -v npm`; change `ExecStart` if npm is not at `/usr/bin/npm`. Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now postbox
sudo systemctl status postbox
sudo journalctl -u postbox -n 100 --no-pager
```

The app listens on port 3000 by default. Keep that port private to the VPS; the reverse proxy is the public entry point.

## 7. Keep mailbox sync running

The sync scheduler is a separate long-running process. Create `/etc/systemd/system/postbox-sync.service`:

```ini
[Unit]
Description=Postbox mailbox sync scheduler
After=network-online.target postgresql.service postbox.service
Wants=network-online.target

[Service]
Type=simple
User=postbox
Group=postbox
WorkingDirectory=/opt/postbox
EnvironmentFile=/etc/postbox/postbox.env
Environment=SYNC_ENDPOINT=http://127.0.0.1:3000/api/sync
Environment=SYNC_INTERVAL_MS=300000
ExecStart=/usr/bin/node scripts/sync-scheduler.mjs
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Check `command -v node` and update `ExecStart` if needed. Start it and verify its logs:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now postbox-sync
sudo systemctl status postbox-sync
sudo journalctl -u postbox-sync -n 100 --no-pager
```

It calls the authenticated sync endpoint immediately and then every five minutes. Keep `SYNC_CRON_SECRET` private. An individual mailbox can still fail to sync if its IMAP credentials or provider settings are invalid; check the app's account status and service logs.

## 8. Configure Caddy and HTTPS

Replace `/etc/caddy/Caddyfile` with:

```caddyfile
postbox.boliflow.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Validate and reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

Caddy obtains and renews a public HTTPS certificate automatically when DNS points to this VPS and ports 80 and 443 are reachable.

## 9. Verify the deployment

Check each layer:

```bash
sudo systemctl is-active postgresql postbox postbox-sync caddy
curl -I https://postbox.boliflow.com/sign-in
sudo journalctl -u postbox -u postbox-sync -u caddy --since '15 minutes ago' --no-pager
```

Create a user, sign in, add a mailbox, and confirm it completes an initial sync. Use the account's sync status and logs to diagnose provider authentication problems. If the app is behind a different proxy or deployed on a non-default URL, keep `BETTER_AUTH_URL` set to the exact public HTTPS origin.

## 10. Updating and backing up

For an update, back up PostgreSQL, deploy the intended commit, install dependencies, build, apply only new migrations, and restart the app and scheduler:

```bash
cd /opt/postbox
sudo -u postbox git fetch --all --tags
sudo -u postbox git checkout YOUR_RELEASE
sudo -u postbox npm ci
sudo -u postbox npm run build
# Apply only migrations added since the previous release.
sudo systemctl restart postbox postbox-sync
sudo systemctl status postbox postbox-sync
```

Back up PostgreSQL regularly, test restoration, and separately back up `/etc/postbox/postbox.env` through a secure secrets process. Restrict backups because they contain email and authentication data.

## Operational notes

- The app stores synchronized message content and encrypted mailbox credentials in PostgreSQL. Treat the database and backups as sensitive.
- This repository does not configure database backups, monitoring/alerting, or automated migration execution; set those up for the VPS before relying on it for important mail.
- Never publish PostgreSQL on the public internet. Permit outbound access from the VPS to your mail providers' IMAP/SMTP endpoints.
- Do not commit `.env` files, production secrets, database dumps, or OAuth client secrets.
