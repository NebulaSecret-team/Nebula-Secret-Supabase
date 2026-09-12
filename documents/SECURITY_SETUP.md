# Nebula Secret - Security Setup Guide

## Overview

This document explains the security improvements made to the Nebula Secret website and provides instructions for further hardening.

## Security Improvements Implemented

### 1. Removed Sensitive Information from Console Logs ✅
- Removed `console.log` statements that exposed Supabase URL and API key
- Added `DEBUG` flag that can be enabled for development only
- All debug logging now goes through `dbg()` function

### 2. Fixed Stored XSS Vulnerability ✅
- Added `sanitizeHTML()` function that removes dangerous HTML tags and attributes
- Applied sanitization to homepage popup content
- Allowed tags: `b, i, em, strong, a, p, br, ul, ol, li, h1-h6, span, div, hr, blockquote, code, pre`
- Allowed attributes: `href, title, class, style, target, rel`
- Removed all event handler attributes (onclick, onload, etc.)

### 3. Strengthened Admin Authentication ✅
- Removed hardcoded `ADMIN_PASS` constant
- Default admin password only used when no admins exist in database
- Added secure session tokens (random 256-bit tokens)
- Session validation checks token match and 24-hour expiry
- Prevents simple `localStorage` bypass attempts

### 4. Improved Password Hashing ✅
- Upgraded from SHA-256 (with static salt) to PBKDF2 (with random salt)
- 100,000 iterations for key derivation
- Backward compatible with old SHA-256 and plaintext passwords
- Automatic password upgrade on login (old formats → PBKDF2)
- Password format: `pbkdf2::<iterations>::<salt_hex>::<hash_hex>`

### 5. Added SRI for CDN Scripts ✅
- Added Subresource Integrity (SRI) hash for Supabase JS library
- Prevents CDN compromise attacks
- Other CDN scripts already had SRI

### 6. Removed Personal Email from Placeholders ✅
- Removed `bong8686@gmail.com` from email configuration placeholder
- Uses generic placeholder instead

## Recommended Further Hardening

### 7. Enable Supabase Row Level Security (RLS) ⚠️ REQUIRES ACTION

**Current Status:** RLS is NOT enabled. Anyone with the publishable key can read/write all data.

**Why This Matters:** The publishable key (`sb_publishable_...`) is designed to be public, but it MUST be protected by RLS. Without RLS, anyone can:
- Read all orders, customer accounts, and admin passwords
- Modify or delete any data

**How to Enable (Basic - Read Only Protection):**

1. Go to Supabase Dashboard → SQL Editor
2. Open `rls_setup.sql` from this project
3. Run the first part (enable RLS + public read policy)
4. **DO NOT** run the write policies yet (they require Supabase Auth)

**Important:** If you enable RLS without setting up Supabase Auth, admin panel write operations will stop working. You have two options:

#### Option A: Migrate to Supabase Auth (Recommended for Production)

This requires code changes to use Supabase Auth for admin login instead of client-side authentication.

1. In Supabase Dashboard → Authentication → Providers, enable Email provider
2. Create admin users in Authentication → Users
3. Modify the website to use `supabase.auth.signInWithPassword()` for admin login
4. Run the full RLS policies from `rls_setup.sql`

#### Option B: Use Edge Function for Write Operations (Intermediate)

Create a Supabase Edge Function that uses the service_role key for write operations. This keeps the service_role key secure on the server.

1. Create an Edge Function that accepts write requests
2. Implement your own admin authentication in the function
3. Use the service_role key (stored as a secret) for database writes
4. Enable RLS with public read-only access

#### Option C: Keep Current Setup (Not Recommended for Production)

If you choose not to enable RLS, understand that:
- The publishable key grants full read/write access to your database
- Anyone who views your website source code can extract the key
- This is acceptable for testing/internal use but NOT for production

### 8. Other Recommendations

- **Use HTTPS:** Ensure your domain uses HTTPS (Vercel provides this by default)
- **Regular Password Changes:** Change admin passwords periodically
- **Backup Database:** Enable Point-in-Time Recovery in Supabase (paid plan)
- **Monitor Access:** Check Supabase Dashboard → Logs for unusual activity

## Security Checklist

- [x] Removed API key from console logs
- [x] Fixed XSS vulnerability
- [x] Strengthened admin authentication
- [x] Improved password hashing (PBKDF2)
- [x] Added SRI for CDN scripts
- [x] Removed personal email from placeholders
- [ ] Enable Supabase RLS (requires action - see above)
- [ ] Migrate to Supabase Auth (recommended for production)
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set up database backups

## Files Modified

- `index.html` - Main website file with all security improvements
- `rls_setup.sql` - SQL script for enabling RLS
- `SECURITY_SETUP.md` - This document

## Support

If you need help with any of these security improvements, please refer to the Supabase documentation or contact your web administrator.
