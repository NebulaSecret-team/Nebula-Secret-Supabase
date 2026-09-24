# Security Review Skill — Nebula-Secret-Supabase

Hand this to a developer to run a full security review of the storefront (static HTML + Supabase + Vercel).
Stack-specific notes are marked **[NS]** — everything else is generic and reusable on other projects.

---

## 1. Scope

| Asset | Value |
|---|---|
| Prod site | `https://nebula-secret-supabase.vercel.app` |
| UAT site | `https://nebula-secret-supabase-uat.vercel.app` |
| Supabase project | `xwhhsoppcpkijxxychjm` (`https://xwhhsoppcpkijxxychjm.supabase.co`) |
| Supabase publishable key | Public by design (`sb_publishable_…`) — do **not** report as a leak |
| Secret keys to hunt for | Supabase **service_role** / `sb_secret_`, Resend **API** key, Vercel tokens, PATs |
| Repo | `NebulaSecret-team/Nebula-Secret-Supabase` |

Out of scope: Denial-of-service, physical attacks, social engineering of staff.

---

## 2. Tools

| Layer | Tool | Purpose |
|---|---|---|
| Secrets | **gitleaks** (or trufflehog) | Committed keys/tokens in git history |
| SAST | **Semgrep** (`--config auto`) or CodeQL | Static code patterns (XSS, injection) |
| Dependencies | `npm audit` / OWASP Dependency-Check / Trivy fs | Known CVEs in packages |
| DAST | **OWASP ZAP** baseline + API scan | Live-site vulnerabilities |
| Quick probes | **Nuclei** (template scan) | Misconfigurations, exposed files, headers |
| IaC/Config | **Checkov** / tfsec | Infra-as-code issues (if Terraform appears later) |
| Auth/DB | **Manual Supabase review** (section 5) | RLS, auth, API exposure — automated tools can't cover this |
| Browser | Burp Suite Community / browser DevTools | Manual request inspection |

Install (one-time):

```bash
# macOS/Linux (or WSL on Windows)
brew install gitleaks semgrep zap nuclei trivy   # or use the official installers
# Windows: winget install gitleaks; npm i -g @semgrep/cli ; nuclei install
```

---

## 3. Pipeline (run in this order)

### Step 1 — Secrets in git history
```bash
gitleaks detect --source . --redact -v
# [NS] expected findings: SB publishable key (public by design) — ignore ONLY that;
# any service_role/secret/private key = CRITICAL
```

### Step 2 — SAST
```bash
semgrep scan --config auto --quiet --sarif --output semgrep.sarif .
# Focus rules: javascript.xss, dangerouslySetInnerHTML, eval, innerHTML sinks
```
**[NS]** XSS rules matter most: all user content must pass `esc`/`escJs`/`sanitizeHTML` (allowlist in `SECURITY_SETUP.md`). Grep for unsanitized sinks:
```bash
grep -n "innerHTML\s*+=" index.html admin.js | head -50   # every hit must use esc()/escJs()
```

### Step 3 — Dependencies
```bash
# [NS] No package.json — CDN pins with SRI in index.html:934-938 instead:
grep -n "integrity=" index.html          # every CDN <script>/<link> MUST have integrity=
grep -n "cdn\." index.html               # verify each URL is pinned @version, not @latest
trivy fs --scanners vuln .               # if any lockfiles appear later
```

### Step 4 — Nuclei (fast live scan)
```bash
nuclei -u https://nebula-secret-supabase.vercel.app -severity critical,high,medium -o nuclei-prod.txt
nuclei -u https://nebula-secret-supabase-uat.vercel.app -severity critical,high,medium -o nuclei-uat.txt
nuclei -u https://xwhhsoppcpkijxxychjm.supabase.co -severity critical,high   # Supabase REST exposure
```

### Step 5 — OWASP ZAP (DAST)
```bash
# Baseline (passive, safe):
zap-baseline.py -t https://nebula-secret-supabase.vercel.app -r zap-report.html -J zap-report.json

# Active scan only on UAT (never prod without permission):
zap-full-scan.py -t https://nebula-secret-supabase-uat.vercel.app -r zap-active-uat.html
```
Pay attention to: CSP, cookies (`HttpOnly`/`Secure`), CORS, security headers, clickjacking.

### Step 6 — Manual API tests
```bash
K='sb_publishable_2GnjItYkv_TRex8Z9YKTag_oUdiyHEk'
B='https://xwhhsoppcpkijxxychjm.supabase.co/rest/v1'

# [NS] These 4 must all behave as documented — any deviation = RLS regression:
curl -s "$B/site_settings?select=id" -H "apikey: $K"
#   expect EXACTLY: accounts,cats,content,orders,products,quotes,theme

curl -s "$B/site_settings?id=eq.admins&select=id" -H "apikey: $K"
#   expect: [] (password hashes never public)

curl -s -X POST "$B/site_settings" -H "apikey: $K" -H "Content-Type: application/json" \
  -d '{"id":"probe","data":{}}' -o /dev/null -w '%{http_code}\n'
#   expect: 401/403 (anon cannot write outside orders/quotes/accounts)

curl -s "$B/profiles?select=id&limit=1" -H "apikey: $K"
#   expect: 1 row (admin login pre-check depends on public read)
```

### Step 7 — Headers & config
```bash
curl -sI https://nebula-secret-supabase.vercel.app | grep -iE 'content-security|x-frame|x-content-type|strict-transport|referrer'
# expect CSP, X-Frame-Options or frame-ancestors, HSTS, Referrer-Policy present
curl -sI https://nebula-secret-supabase.vercel.app/api/keep-alive   # must stay GET-only ping
```
Also verify `robots.txt`, `vercel.json` rewrites/headers, and that `.vercel/` + `.env*` are gitignored.

---

## 4. OWASP Top 10 checklist **[NS-mapped]**

- [ ] **A01 Broken access control** — RLS covers every table; admin actions check `profiles.role` (not client-supplied role); `admin.js` never trusts `user_metadata`
- [ ] **A02 Cryptographic failures** — no plaintext passwords (legacy `pbkdf2::` format only); HTTPS only; SRI on all CDN deps
- [ ] **A03 Injection** — every dynamic insert into HTML passes `esc`/`escJs`; no `eval`/`Function` on user data; SQL only via PostgREST params (no string-built SQL)
- [ ] **A04 Insecure design** — checkout/quote writes are anon-by-design but scoped to 3 JSONB ids; secrets (`admins`, `activity_log`) admin-only
- [ ] **A05 Misconfiguration** — RLS ON on all 9 public tables; zero `user_metadata`-based policies; security headers present; no directory listing
- [ ] **A06 Vulnerable components** — CDN pins with valid `integrity=`; versions not bumped without rehashing
- [ ] **A07 Auth failures** — Supabase Auth for admin; session token 24h; rate-limit login attempts if reachable; no default creds
- [ ] **A08 Data integrity** — Resend via serverless only (`api/send-email.js`), API key server-side env var
- [ ] **A09 Logging/monitoring** — `site_settings.activity_log` admin-written only; confirm failed admin logins surface somewhere
- [ ] **A10 SSRF** — serverless functions must not fetch user-supplied URLs

---

## 5. Manual Supabase review (highest value — tools can't do this)

1. **RLS**: every table in `public` has `relrowsecurity = true`; list policies, flag any using `auth.jwt()->…user_metadata` or `(select auth.uid())` without a profiles join for roles.
2. **Roles**: `anon` may `SELECT` only on the 7 public ids; `INSERT/UPDATE` only on `orders`,`quotes`,`accounts`; no access to `admins`/`activity_log`.
3. **Auth**: confirm admin login path reads `profiles.role IN ('admin','superadmin')`; `app_metadata.role` is secondary/legacy only.
4. **Edge cases**: legacy `pbkdf2::` fallback and 24h token — document or plan removal.
5. **Exposure**: `GET /rest/v1/` with only the publishable key must not reveal schema beyond intended tables (check exposed RPCs in the API settings).

---

## 6. Report template

```markdown
# Security Review — <date> — <prod|uat>
## Critical   (fix now)
## High       (fix this week)
## Medium     (next sprint)
## Low/Info
## False positives / accepted risk (with rationale)
Tool versions + exact commands used + commit SHA reviewed
```

Severity: Critical = data leak / RCE / auth bypass · High = exploitable w/ user interaction · Medium = hardening · Low: best practice.

---

## 7. Quick CI additions (recommended)

```yaml
# .github/workflows/security.yml (sketch)
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
      - run: npx @semgrep/cli scan --config auto --error .
      - run: nuclei -u https://nebula-secret-supabase.vercel.app -severity critical,high || true
```

---

## 8. References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Repo-local: `SECURITY_SETUP.md` (esc/sanitize allowlist), `SUPABASE_SECURITY_AUTH_GUIDE.md`, `documents/`
