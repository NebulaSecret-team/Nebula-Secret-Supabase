# AGENTS.md — Nebula-Secret-Supabase

Static storefront. No `package.json`, no build/test/lint, no CI. Deploy = push to `main` → Vercel auto-deploys.

## Layout (real entrypoints)

- `index.html` (~300KB, inline JS): storefront + ALL shared globals + Supabase client init. Edit here for store logic.
- `admin.js`: lazy-loaded only on `#/admin`. Depends on globals from `index.html` (`$`, `supabase`, `sbSave`, `getProducts`, `showToast`, …) — never load or test it standalone.
- `api/keep-alive.js`: Vercel cron `GET /api/keep-alive` (daily `0 12 * * *`, see `vercel.json`), pings Supabase to prevent free-plan pause.
- `api/send-email.js`: `POST /api/send-email`, sends via Resend API. Needs env vars (below); `{type: "order"|"contact", params: {...}}`.
- `images/`, `robots.txt`. Guides, audits and reports live in `documents/` (incl. `sitemap.xml`, `architecture.html`, `security-audit-report.html`, setup guides). `WEBSITE_MIGRATION_GUIDE.md` is garbled — ignore it.

## Supabase — single source of truth

- Project ref `xwhhsoppcpkijxxychjm`, URL `https://xwhhsoppcpkijxxychjm.supabase.co`. Key `sb_publishable_2GnjItYkv_TRex8Z9YKTag_oUdiyHEk`.
- URL+key are hardcoded in **two places that must stay in sync**: `index.html:942-943` (`SB_URL`/`SB_KEY`) and the fallback in `api/keep-alive.js`.
- Agent MCP scope lives in `~/.config/opencode/opencode.jsonc` (`project_ref=`); if Supabase calls get permission errors, check the ref matches above, re-auth (`npx -y opencode-ai mcp auth supabase`), restart OpenCode.
- Tables: `site_settings`, `categories`, `products`, `customer_accounts`, `admin_users`, `orders`, `order_items`. RLS is ON; `admin_users` / `customer_accounts` / `order_items` have RLS enabled with no policies (writes will fail) — check `pg_policies` before assuming write access. (`SECURITY_SETUP.md` claim "RLS NOT enabled" is stale.)
- Auth: Supabase Auth email login for admin (`SUPABASE_SECURITY_AUTH_GUIDE.md`); legacy PBKDF2 fallback format `pbkdf2::<iter>::<salt_hex>::<hash_hex>`, 24h session token.

## Vercel

- Team `nebula-secret-wholesale`, project `nebula-secret-supabase`, prod `https://nebula-secret-supabase-nebula-secret-wholesale.vercel.app`.
- Link: `vercel link --project nebula-secret-supabase --scope nebula-secret-wholesale`. `.vercel/` and `.env*` are gitignored — never commit them.
- `send-email` requires: `RESEND_API_KEY` (secret), `MAIL_FROM` (e.g. `Nebula Secret <noreply@nebulasecret.com>`), `MAIL_RECIPIENTS`, `MAIL_ENABLED=true`, `ALLOWED_ORIGINS`. Domain DNS (DKIM/SPM/return-path) is configured at the registrar for `send.` subdomain. Test: `curl -X POST <prod>/api/send-email -H 'Content-Type: application/json' -d '{"type":"order","params":{"from_name":"T","from_email":"t@e.com"}}'`. `GET /api/email-config` reports which vars are set.

## Conventions / gotchas

- CDN deps pinned with SRI in `index.html:934-937` (supabase-js 2.49.1, jspdf, html2canvas, flatpickr via jsdelivr). Don't bump versions without updating integrity hashes.
- XSS: user content must go through `esc`/`escJs`/`sanitizeHTML` (allowlist in `SECURITY_SETUP.md`); debug logging via `dbg()` flag, never log keys.
- `.gitignore` also ignores `README.md`, `*.sql`, `migrate.html`, `DEPLOYMENT_GUIDE.md` — files with those names won't commit.
- GitHub repo `NebulaSecret-team/Nebula-Secret-Supabase`, `gh` CLI works (`gh pr list --repo NebulaSecret-team/Nebula-Secret-Supabase`). Old remotes (`nebula-secrect-devops/*`, Vercel team `nebula-secret-devops`, Supabase refs `mszftmnmcbxgzmbjapzo`/`vqpqmdxfkxxncdmaaviw`) are retired — don't re-add.
