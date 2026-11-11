# Updating Postbox on the VPS

These commands match the current deployment at `/home/root/apps/postbox`, with the production environment at `/etc/postbox/postbox.env` and PM2 processes named `postbox-web` and `postbox-sync`.

Run commands as the same Linux user that owns the checkout and PM2 processes. Your shell prompt shows `root`, so the examples use that account. If PM2 is owned by another user, switch to that user before running the PM2 commands.

This procedure starts after the code changes have been pushed to the GitHub branch checked out on the VPS. It does not require copying files to `/var/www`, creating a new symlink, or reloading Nginx: Nginx proxies requests to the Next.js process, which serves the app and its `public` files.

## 1. Check the current deployment and back up the database

```bash
set -e
cd /home/root/apps/postbox
git status --short
pm2 status
```

If `git status` shows local changes, review and preserve them before pulling. Record the current revision, load the production database URL, and make a compressed database backup:

```bash
OLD_REV=$(git rev-parse HEAD)
git pull --ff-only
git log -1 --oneline
```

Confirm that the latest commit is the one you pushed. Load the production database URL and make a compressed database backup before applying any schema changes:

```bash
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

## 2. Install dependencies and build the new version

```bash
cd /home/root/apps/postbox
set -a
. /etc/postbox/postbox.env
set +a
npm ci --include=dev
npm run build
```

Do not restart PM2 if install or build fails. The running app should continue using its existing process until the new build succeeds. npm audit and funding notices do not by themselves mean the build failed; look for the final successful build summary.

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

Your current web process listens on port `3004`. If you change it in PM2 or Nginx, use the configured port in the local check. Nginx does not need to be reloaded for an application-only update.

Review logs for startup, database, or sync errors:

```bash
pm2 logs postbox-web --lines 100
pm2 logs postbox-sync --lines 100
```

## 5. Verify the mobile app install files

Check that the manifest, service worker, and both required app icons return HTTP `200` from the Next.js server and from the public HTTPS domain:

```bash
for path in manifest.webmanifest sw.js icon-192.png icon-512.png; do
  printf '%-24s local: ' "/$path"
  curl -sS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:3004/$path"
  printf '%-24s public: ' "/$path"
  curl -sS -o /dev/null -w '%{http_code}\n' "https://postbox.boliflow.com/$path"
done
curl -fsS https://postbox.boliflow.com/manifest.webmanifest | grep -E '"(id|start_url|scope)"'
```

All eight status codes should be `200`; the manifest should show `"id": "/"` and `"start_url": "/"`. If a local check fails, confirm the checkout contains `public/sw.js` and the icon files, then inspect `pm2 logs postbox-web --lines 100`. If local checks pass but public checks fail, inspect the Nginx proxy configuration. No static-file symlink is needed when Nginx proxies the requests to Next.js.

## 6. Install Postbox on the phone

Opening the site does not automatically add an icon to the home screen. First open `https://postbox.boliflow.com` in the phone's browser and sign in. In Postbox, open the account menu and select **Install Postbox**. If the browser does not show its install prompt:

- **Android / Chrome:** open Chrome's `⋮` menu and select **Install app** or **Add to Home screen**.
- **iPhone / iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**.

The installed app opens `/`. A signed-in session shows the mailbox there; a signed-out session shows the landing page. `/app` redirects to `/` for compatibility. If Postbox was added before this update, remove the old home-screen shortcut and add it again so the browser picks up the updated manifest.

## Rollback notes

If the new app fails after restart, inspect PM2 logs first. To roll back code, check out the previous known-good revision, reinstall dependencies, rebuild with `/etc/postbox/postbox.env` loaded, and restart both PM2 processes. Restore the database backup only if the update applied a migration that must be rolled back; restoring replaces the current database contents, so confirm the recovery point before doing so.

Keep the database backup and `/etc/postbox/postbox.env` private. The database contains mail, and the environment file contains credentials and encryption keys.
