# Updating Postbox on the VPS

These commands match the current deployment at `/home/root/apps/postbox`, with the production environment at `/etc/postbox/postbox.env` and PM2 processes named `postbox-web` and `postbox-sync`.

Run commands as the same Linux user that owns the checkout and PM2 processes. Your shell prompt shows `root`, so the examples use that account. If PM2 is owned by another user, switch to that user before running the PM2 commands.

## 1. Check the current deployment and back up the database

```bash
cd /home/root/apps/postbox
git status --short
pm2 status
```

If `git status` shows local changes, review and preserve them before pulling. Record the current revision, load the production database URL, and make a compressed database backup:

```bash
OLD_REV=$(git rev-parse HEAD)
set -a
. /etc/postbox/postbox.env
set +a
set -o pipefail
pg_dump "$DATABASE_URL" | gzip > "/root/postbox-backup-$(date +%Y-%m-%d-%H%M%S).sql.gz"
```

Confirm `pg_dump` completed and the backup file exists before continuing:

```bash
ls -lh /root/postbox-backup-*.sql.gz | tail -n 1
```

## 2. Pull and build the new version

```bash
cd /home/root/apps/postbox
git pull --ff-only
set -a
. /etc/postbox/postbox.env
set +a
npm ci --include=dev
npm run build
```

If install or build fails, stop here and inspect the error. The current running processes will continue using the existing build until restarted.

## 3. Apply new database migrations, if any

List migration files added by this update:

```bash
git diff --name-only --diff-filter=A "$OLD_REV" HEAD -- 'lib/db/migrations/*.sql'
```

For each listed migration, inspect it, then apply the new files in numeric order. Example:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/0012_example.sql
```

Do not rerun every migration on every update. Apply only migrations introduced by the release, and stop on the first SQL error. If an existing migration was changed instead of adding a new one, review the diff and the database state before applying anything.

## 4. Restart the app and scheduler

```bash
pm2 restart postbox-web --update-env
pm2 restart postbox-sync --update-env
pm2 save
pm2 status
```

Check that the app responds locally and over HTTPS:

```bash
curl -I http://127.0.0.1:3004/sign-in
curl -I https://postbox.boliflow.com/sign-in
```

Your current web process listens on port `3004`. If you change it in PM2 or Nginx, use the configured port in the local check.

Review logs for startup, database, or sync errors:

```bash
pm2 logs postbox-web --lines 100
pm2 logs postbox-sync --lines 100
```

## 5. Verify the mobile app install files

This release should serve the manifest, service worker, and app icons. Check them over HTTPS:

```bash
curl -I https://postbox.boliflow.com/manifest.webmanifest
curl -I https://postbox.boliflow.com/sw.js
curl -I https://postbox.boliflow.com/icon-192.png
curl -I https://postbox.boliflow.com/icon-512.png
```

Then sign in on the phone and use **Install Postbox** in the account menu. On iPhone or iPad, use **Share → Add to Home Screen**. The installed icon opens `/`, which shows the mailbox when signed in and the landing page when signed out. `/app` redirects to `/` for compatibility.

## Rollback notes

If the new app fails after restart, inspect PM2 logs first. To roll back code, check out the previous known-good revision, reinstall dependencies, rebuild with `/etc/postbox/postbox.env` loaded, and restart both PM2 processes. Restore the database backup only if the update applied a migration that must be rolled back; restoring replaces the current database contents, so confirm the recovery point before doing so.

Keep the database backup and `/etc/postbox/postbox.env` private. The database contains mail, and the environment file contains credentials and encryption keys.
