# Deploy Postbox to your Linux VPS

This guide matches your deployment layout for `postbox.boliflow.com`:

- Application checkout and files: `/home/<VPS_USER>/apps/postbox`
- Web-root symlink: `/var/www/postbox` → `/home/<VPS_USER>/apps/postbox`
- TLS certificate and key: `/etc/nginx/ssl/`
- Nginx reverse proxy: public ports 80 and 443 → `127.0.0.1:3000`
- PM2 processes: Next.js web app and the mailbox sync scheduler
- PostgreSQL: local VPS service, not publicly exposed

Replace `<VPS_USER>` and the certificate filenames below with the actual VPS username and filenames. Commands use `/home/$DEPLOY_USER` because `~` changes to root's home when used with `sudo`.

## 1. DNS, firewall, and packages

Point the `A` record for `postbox.boliflow.com` to the VPS public IPv4 address. Add an `AAAA` record only if IPv6 is configured and reachable on the VPS.

Allow inbound TCP ports **22**, **80**, and **443** in the VPS firewall/security group. Do not expose PostgreSQL port 5432. For UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Update the system and install PostgreSQL, Nginx, Git, and build tools:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y postgresql postgresql-contrib nginx git build-essential
```

Install a supported Node.js 22 LTS release system-wide. Verify `node --version` reports v22 and `npm --version` works for the VPS account that will run Postbox. Install PM2 globally:

```bash
sudo npm install --global pm2
```

The app build needs enough memory. On a small VPS, add swap or build the app on another Linux machine with the same Node major version and deploy the resulting files.

## 2. Create the database

Create a dedicated PostgreSQL login and database. The generated hex password is URL-safe for `DATABASE_URL`:

```bash
DB_PASSWORD="$(openssl rand -hex 32)"
printf 'Save this database password in your secrets manager: %s\n' "$DB_PASSWORD"
sudo -u postgres psql <<SQL
CREATE ROLE postbox LOGIN PASSWORD '${DB_PASSWORD}';
CREATE DATABASE postbox OWNER postbox;
SQL
```

Retain the password securely for the environment file. Keep PostgreSQL bound to localhost or its Unix socket, and verify local access:

```bash
psql "postgres://postbox:${DB_PASSWORD}@127.0.0.1:5432/postbox" -c 'select 1;'
```

## 3. Check out Postbox under your VPS account

Set `DEPLOY_USER` to the Linux username that will own the app and run PM2:

```bash
DEPLOY_USER="your_vps_username"
sudo -u "$DEPLOY_USER" mkdir -p "/home/$DEPLOY_USER/apps/postbox"
sudo -u "$DEPLOY_USER" git clone YOUR_REPOSITORY_URL "/home/$DEPLOY_USER/apps/postbox"
sudo ln -sfn "/home/$DEPLOY_USER/apps/postbox" /var/www/postbox
```

If the checkout already exists, update it to the release you want instead of cloning over it. Keep the checkout and build owned by `$DEPLOY_USER`; do not run `npm install` or `npm run build` as root.

Nginx will proxy requests to the app on loopback. The `/var/www/postbox` symlink is part of your filesystem layout; Nginx does not serve the app files directly.

## 4. Configure production secrets

Create an environment file readable by the PM2 user, but not by other users. Replace `DEPLOY_USER` with the chosen account:

```bash
DEPLOY_USER="your_vps_username"
sudo install -d -o root -g "$DEPLOY_USER" -m 0750 /etc/postbox
sudo install -o root -g "$DEPLOY_USER" -m 0640 /dev/null /etc/postbox/postbox.env
sudoedit /etc/postbox/postbox.env
```

Add these values. Generate a separate random secret for `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, and `SYNC_CRON_SECRET` using `openssl rand -hex 32`:

```dotenv
NODE_ENV=production
DATABASE_URL=postgres://postbox:URL_SAFE_DATABASE_PASSWORD@127.0.0.1:5432/postbox
BETTER_AUTH_URL=https://postbox.boliflow.com
BETTER_AUTH_SECRET=64_HEX_CHARACTERS
ENCRYPTION_KEY=64_HEX_CHARACTERS
SYNC_CRON_SECRET=64_HEX_CHARACTERS
```

`ENCRYPTION_KEY` must be exactly 64 hexadecimal characters. Back it up securely and keep it stable: Postbox uses it to decrypt saved email credentials. Losing or rotating it makes those credentials unusable. Keep `BETTER_AUTH_SECRET` stable to preserve authentication behavior.

## 5. Apply database migrations

The app does not run migrations on startup. Apply all migrations through `0011` in numeric order. Stop immediately on the first error so later migrations do not run against a partial schema:

```bash
cd "/home/$DEPLOY_USER/apps/postbox"
set -e
set -a
. /etc/postbox/postbox.env
set +a
for migration in lib/db/migrations/*.sql; do
  echo "Applying $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

The `0000_initial.sql` migration creates and repairs the tenant tables and `teamId` columns required by later migrations. If an earlier attempt printed errors such as `relation "team" does not exist`, update the checkout to a revision containing that repair, then rerun the loop above. The current migration files are safe to rerun after a partial first attempt. For a database that already contains production data, take a backup before applying schema changes.

## 6. Install dependencies and build

Load the production environment for the build, install the locked dependencies, and build as the VPS account:

```bash
cd "/home/$DEPLOY_USER/apps/postbox"
set -a
. /etc/postbox/postbox.env
set +a
npm ci
npm run build
```

The `ENCRYPTION_KEY` is required during the build as well as at runtime.

## 7. Run the app and sync scheduler with PM2

Create `/home/<VPS_USER>/apps/postbox/ecosystem.config.cjs` and replace `<VPS_USER>` in `cwd` with the actual username:

```js
module.exports = {
  apps: [
    {
      name: "postbox-web",
      cwd: "/home/<VPS_USER>/apps/postbox",
      script: "./node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3000",
      interpreter: "node",
      node_args: "--env-file=/etc/postbox/postbox.env",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: "postbox-sync",
      cwd: "/home/<VPS_USER>/apps/postbox",
      script: "scripts/sync-scheduler.mjs",
      interpreter: "node",
      node_args: "--env-file=/etc/postbox/postbox.env",
      env: {
        NODE_ENV: "production",
        SYNC_ENDPOINT: "http://127.0.0.1:3000/api/sync",
        SYNC_INTERVAL_MS: "300000",
      },
      autorestart: true,
      max_restarts: 10,
    },
  ],
}
```

Start the web app first and verify it responds locally. Then start the scheduler and save the PM2 process list:

```bash
cd "/home/$DEPLOY_USER/apps/postbox"
pm2 start ecosystem.config.cjs --only postbox-web
curl -I http://127.0.0.1:3000/sign-in
pm2 start ecosystem.config.cjs --only postbox-sync
pm2 status
pm2 logs --lines 100
pm2 save
```

Configure PM2 to restore processes after a reboot. Run this as `$DEPLOY_USER` and execute the `sudo` command that PM2 prints:

```bash
pm2 startup systemd
```

Then save the process list again and verify PM2's startup service:

```bash
pm2 save
sudo systemctl status "pm2-$DEPLOY_USER"
```

The sync process calls the authenticated sync endpoint immediately and every five minutes. Check `pm2 logs postbox-sync` for failed syncs. A mailbox can still fail when its provider credentials or IMAP settings are invalid.

## 8. Configure Nginx and your existing TLS certificates

Confirm the certificate and private key filenames under `/etc/nginx/ssl/`. The example below assumes:

- `/etc/nginx/ssl/postbox.boliflow.com/fullchain.pem`
- `/etc/nginx/ssl/postbox.boliflow.com/privkey.pem`

Use the actual certificate paths if they differ. Keep the private key readable only by root and the Nginx master process.

Create `/etc/nginx/sites-available/postbox`:

```nginx
server {
    listen 80;
    server_name postbox.boliflow.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name postbox.boliflow.com;

    ssl_certificate     /etc/nginx/ssl/postbox.boliflow.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/postbox.boliflow.com/privkey.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Enable the site and reload Nginx:

```bash
sudo ln -sfn /etc/nginx/sites-available/postbox /etc/nginx/sites-enabled/postbox
sudo nginx -t
sudo systemctl enable --now nginx postgresql
sudo systemctl reload nginx
```

Keep the app bound to `127.0.0.1:3000`; only Nginx should accept public web traffic. `client_max_body_size` may be adjusted to match the attachment size you intend to allow.

## 9. Verify the deployment

```bash
pm2 status
curl -I http://127.0.0.1:3000/sign-in
curl -I https://postbox.boliflow.com/sign-in
sudo nginx -t
sudo journalctl -u nginx --since '15 minutes ago' --no-pager
pm2 logs --lines 100
```

Create a Postbox user, sign in, add a mail account, and confirm the initial sync completes. Use the account's sync status and PM2 logs to diagnose provider authentication problems.

## 10. Updating and backing up

Back up PostgreSQL, update the checkout, build with the production environment, apply only new migrations, and restart both PM2 processes:

```bash
cd "/home/$DEPLOY_USER/apps/postbox"
git fetch --all --tags
git checkout YOUR_RELEASE
set -a
. /etc/postbox/postbox.env
set +a
npm ci
npm run build
# Apply only migrations added since the last deployment.
pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

Back up PostgreSQL regularly and test restoring it. Back up `/etc/postbox/postbox.env` securely, especially `ENCRYPTION_KEY`. Database backups and synchronized email contain sensitive data.

## Operational notes

- Postbox stores synchronized message content and encrypted mailbox credentials in PostgreSQL. Treat the database and backups as sensitive.
- This repository does not configure database backups, monitoring, or alerting. Set those up before relying on the VPS for important mail.
- Never publish PostgreSQL on the public internet. Allow outbound access from the VPS to mail providers' IMAP and SMTP endpoints.
- Postbox account connections use manually entered IMAP/SMTP credentials. Some providers require app passwords or block password-based access.
- Do not commit `.env` files, production secrets, database dumps, or OAuth client secrets.
