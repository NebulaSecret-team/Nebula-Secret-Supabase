# Resend Email Service Setup Guide

This guide will help you configure Resend as your email service provider for the Nebula Secret website.

## 📋 Overview

We've migrated from EmailJS to **Resend** for email sending. The main benefits:

- ✅ **Better deliverability** - Emails are less likely to go to spam
- ✅ **Server-side security** - API key is stored in Vercel environment variables, never exposed to the client
- ✅ **Beautiful HTML emails** - Professional email templates built into the Edge Function
- ✅ **Free plan** - 100 emails/day, 3,000 emails/month (enough for B2B wholesale)
- ✅ **Vercel native integration** - Works perfectly with Vercel Edge Functions

## 🔧 Step 1: Sign Up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Click **"Sign Up"**
3. You can sign up with:
   - GitHub account (recommended, since you already use GitHub)
   - Google account
   - Email address
4. Complete the signup process

## 🔑 Step 2: Get Your API Key

1. After signing in, go to the **Resend Dashboard**
2. Click on **"API Keys"** in the left sidebar
3. Click **"Create API Key"**
4. Fill in the form:
   - **Name**: `Nebula Secret Vercel` (or any name you like)
   - **Permission**: `Full access` (or `Sending access` if you only need to send emails)
   - **Domain**: Leave as `All domains` for now
5. Click **"Create API Key"**
6. **IMPORTANT**: Copy the API key immediately! It will only be shown once.
   - The API key starts with `re_` (e.g., `re_1234567890abcdef`)
7. Save this API key somewhere safe - you'll need it for Vercel configuration

## 🌐 Step 3: Verify Your Domain (Recommended)

To improve email deliverability and send from your own domain (e.g., `noreply@nebulasecret.com`), you should verify your domain.

### Option A: Use nebulasecret.com (Recommended)

If you own the `nebulasecret.com` domain:

1. In the Resend Dashboard, click **"Domains"** in the left sidebar
2. Click **"Add Domain"**
3. Enter your domain: `nebulasecret.com`
4. Click **"Next"**
5. Resend will show you DNS records to add to your domain registrar
6. Go to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare)
7. Add the DNS records provided by Resend:
   - **SPF record** (TXT)
   - **DKIM record** (TXT)
   - **MX record** (optional, for receiving emails)
8. Wait for DNS propagation (usually 5-30 minutes, sometimes up to 24 hours)
9. Back in Resend, click **"Verify"** to check if the DNS records are correctly configured
10. Once verified, your domain status will show as **"Verified"** (green checkmark)

### Option B: Use resend.dev (Quick Start)

If you don't want to verify a domain yet, you can use Resend's built-in `resend.dev` domain for testing:

- Sender email: `onboarding@resend.dev`
- This is only for testing - emails can only be sent to your own email address
- For production use, you should verify your own domain

## ⚙️ Step 4: Configure Vercel Environment Variables

Now you need to add the Resend API key and other configuration to your Vercel project.

### For Production (nebula-secret-supabase.vercel.app)

1. Go to your Vercel Dashboard: [https://vercel.com/nebula-secret-wholesale/nebula-secret-supabase](https://vercel.com/nebula-secret-wholesale/nebula-secret-supabase)
2. Click on **"Settings"** tab
3. Click on **"Environment Variables"** in the left sidebar
4. Add the following environment variables:

| Key | Value | Environment |
|-----|-------|-------------|
| `RESEND_API_KEY` | `re_your_api_key_here` | Production, Preview, Development |
| `MAIL_FROM` | `Nebula Secret <noreply@nebulasecret.com>` (or `onboarding@resend.dev` for testing) | Production, Preview, Development |
| `MAIL_RECIPIENTS` | `sales@nebulasecret.com,admin@nebulasecret.com` (comma-separated) | Production, Preview, Development |
| `MAIL_ENABLED` | `true` | Production, Preview, Development |

5. Click **"Save"** for each variable

### For UAT (uat.nebulasecret.com)

Repeat the same steps for your UAT project in Vercel. You can use the same Resend API key for both production and UAT.

## 🔄 Step 5: Redeploy Your Project

After adding the environment variables, you need to redeploy your project for the changes to take effect.

1. In Vercel, go to the **"Deployments"** tab
2. Find the latest deployment
3. Click on the **three dots** (...) next to the deployment
4. Click **"Redeploy"**
5. Confirm the redeployment
6. Wait for the deployment to complete (usually 1-2 minutes)

## 🧪 Step 6: Test Email Sending

### Test 1: Contact Form

1. Go to your website: `https://uat.nebulasecret.com/#/about?scroll=contact`
2. Fill in the contact form:
   - Name: `Test User`
   - Email: `your_email@example.com`
   - Company: `Test Company`
   - Inquiry Type: `Wholesale`
   - Message: `This is a test email from Resend integration.`
3. Click **"Send Message"**
4. You should see a success message: "Thank you, Test User! Your message has been sent..."
5. Check the recipient email inbox (e.g., `sales@nebulasecret.com`) for the email
6. Also check the spam folder just in case

### Test 2: Order Confirmation

1. Add a product to your cart
2. Go to checkout
3. Place an order
4. Check both the customer email and admin email for the order confirmation
5. The email should have a beautiful HTML format with order details

### Test 3: Password Reset

1. Go to: `https://uat.nebulasecret.com/#/account?reset=1`
2. Enter your email address
3. Click **"Send Reset Link"**
4. Check your email for the password reset link
5. Note: Password reset emails are sent by Supabase Auth, not Resend. This test is to verify Supabase Auth is working.

## 📊 Step 7: Monitor Email Delivery

You can monitor email delivery in the Resend Dashboard:

1. Go to [https://resend.com/dashboard](https://resend.com/dashboard)
2. Click on **"Emails"** in the left sidebar
3. You'll see a list of all sent emails with:
   - Recipient email address
   - Subject line
   - Status (Delivered, Bounced, Complained, etc.)
   - Timestamp
4. Click on any email to see detailed information:
   - HTML content
   - Delivery status
   - Opens and clicks (if tracking is enabled)
   - Error messages (if any)

## 🔧 Troubleshooting

### Problem: "Email service not configured" error

**Solution:**
- Check that `RESEND_API_KEY` environment variable is set correctly in Vercel
- Make sure you redeployed after adding the environment variable
- Verify the API key is correct (starts with `re_`)

### Problem: Emails going to spam

**Solution:**
- Verify your domain in Resend (Step 3 above)
- Make sure SPF and DKIM records are correctly configured
- Use a recognizable sender name and email address
- Avoid spammy keywords in the subject line and content

### Problem: "Domain not verified" error

**Solution:**
- If using `noreply@nebulasecret.com`, make sure you've verified the `nebulasecret.com` domain in Resend
- If you haven't verified a domain yet, use `onboarding@resend.dev` as the sender for testing
- Note: With `onboarding@resend.dev`, you can only send emails to your own Resend account email

### Problem: Rate limit exceeded

**Solution:**
- Resend free plan: 100 emails/day, 3,000 emails/month
- The Edge Function also has a rate limit of 10 requests/minute per IP
- Wait a minute and try again
- If you need more emails, consider upgrading to a paid Resend plan

### Problem: Edge Function returning 500 error

**Solution:**
- Check Vercel logs for the Edge Function:
  1. Go to Vercel Dashboard → your project → **"Functions"** tab
  2. Find `api/send-email` function
  3. Check the logs for error messages
- Common errors:
  - Invalid API key
  - Missing environment variables
  - Invalid sender email address

## 📝 Environment Variables Reference

Here's a complete list of environment variables used by the email system:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RESEND_API_KEY` | ✅ Yes | Your Resend API key | `re_1234567890abcdef` |
| `MAIL_FROM` | ✅ Yes | Sender email address | `Nebula Secret <noreply@nebulasecret.com>` |
| `MAIL_RECIPIENTS` | ✅ Yes | Comma-separated list of admin recipients | `sales@nebulasecret.com,admin@nebulasecret.com` |
| `MAIL_ENABLED` | ⭕ Optional | Enable/disable email sending (default: true) | `true` |
| `ALLOWED_ORIGINS` | ⭕ Optional | Comma-separated list of allowed CORS origins | `https://uat.nebulasecret.com,https://nebula-secret-supabase.vercel.app` |

## 🎉 Success!

You've successfully configured Resend as your email service provider! Your website can now send:

- ✅ **Order confirmation emails** - Beautiful HTML emails with order details
- ✅ **Contact form inquiries** - Customer inquiries sent to your admin inbox
- ✅ **Password reset emails** - (Handled by Supabase Auth, not Resend)

All with server-side security - your API key is never exposed to the client!

## 📞 Need Help?

If you run into any issues:

1. Check the troubleshooting section above
2. Check Vercel logs for Edge Function errors
3. Check Resend dashboard for email delivery status
4. Contact Resend support at [https://resend.com/contact](https://resend.com/contact)
5. Or ask me for help! 😊
