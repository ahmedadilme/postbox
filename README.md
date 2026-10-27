# Postbox

Postbox is a web email dashboard for connecting multiple mail accounts. The current app supports Better Auth email/password sign-in, Google and Microsoft account connection, manual IMAP/SMTP configuration, message sync and sending, search, folders, smart folders, snoozing, and account signatures.

## Current scope

- The free plan supports up to two connected accounts, five custom folders, and seven days of message history.
- Mail is synced to the application database so it can be shown in the dashboard. Connected account credentials are encrypted at rest; message content is not end-to-end encrypted.
- Search accepts Gmail-style filters including `from:`, `to:`, `cc:`, `subject:`, `has:attachment`, `is:unread`, `is:read`, `is:starred`, `is:flagged`, `before:YYYY-MM-DD`, and `after:YYYY-MM-DD`. Put phrases in quotes; separate words narrow results.
- Paid checkout is not configured. The Stripe billing gateway is not implemented.
- AI features, SSO, and enterprise retention controls are not available yet. Labels can be created, applied to messages, and used to filter the inbox. Team members can share drafts, leave internal comments, assign messages to a teammate, and review the message activity timeline for note and assignment changes. Shared draft edits use revision checks to prevent silent overwrites; only the draft owner can send it or change its sharing setting. Each teammate can filter the inbox to messages assigned to them.
- Team admins can create seven-day invitation links; recipients must sign in or create an account with the invited email address to accept. Links are shared manually rather than sent by email. Team admins can review a team scoped audit log of invitations, membership, email account, and shared draft changes.

## Development

For a production deployment on a bare-metal Linux VPS, see [DEPLOYMENT-VPS.md](DEPLOYMENT-VPS.md).

Requirements: Node.js, npm, and PostgreSQL.

1. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`.
2. Apply every SQL migration in `lib/db/migrations/` in numeric order, starting with `0000_initial.sql`. The application schema currently requires migrations `0000` through `0010`; existing databases need the newer migrations too.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev` and open `http://localhost:3000`.

OAuth account connections also require the corresponding Google or Microsoft client credentials and callback URLs in the environment.

Set a strong `SYNC_CRON_SECRET` in `.env` (for example, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). In local development, run `npm run sync:scheduler` in a second terminal alongside `npm run dev`. Docker Compose starts the `sync-scheduler` service automatically. Both call `GET /api/sync` immediately and then every five minutes with `Authorization: Bearer <SYNC_CRON_SECRET>`. Other deployment platforms need an equivalent scheduler. Failed syncs retry after five minutes; syncs left running for thirty minutes are reclaimed on a later scheduler run.
