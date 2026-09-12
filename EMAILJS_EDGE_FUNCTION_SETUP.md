# EmailJS Vercel Edge Function Setup Guide

## Overview

This Edge Function protects your EmailJS credentials by keeping them on the server side. Instead of exposing your EmailJS keys in the frontend code, all email requests go through this secure endpoint.

## Benefits

- **Security**: EmailJS private key is never exposed to the client
- **CORS Protection**: Only allowed origins can send emails
- **Rate Limiting**: Can be extended with rate limiting
- **Logging**: All email attempts are logged on the server

## Setup Steps

### 1. Get EmailJS Credentials

1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/admin)
2. Create an account or log in
3. Create an Email Service (Gmail, Outlook, etc.)
4. Create Email Templates:
   - Order confirmation template
   - Contact form template
5. Get your credentials:
   - **Service ID**: Found in Email Services
   - **Template IDs**: Found in Email Templates
   - **Public Key**: Found in Account → API Keys
   - **Private Key**: Found in Account → API Keys (keep this secret!)

### 2. Configure Vercel Environment Variables

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (nebula-secret-supabase)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `EMAILJS_SERVICE_ID` | Your EmailJS service ID | `service_xxxxxxx` |
| `EMAILJS_TEMPLATE_ID` | Order confirmation template ID | `template_xxxxxxx` |
| `EMAILJS_CONTACT_TEMPLATE_ID` | Contact form template ID | `template_yyyyyyy` |
| `EMAILJS_PUBLIC_KEY` | Your EmailJS public key | `xxxxxxxxxxxxxxxx` |
| `EMAILJS_PRIVATE_KEY` | Your EmailJS private key (SECRET) | `yyyyyyyyyyyyyyyy` |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://nebula-secret-supabase.vercel.app,https://nebulasecret.com` |

5. Click **Save**

### 3. Deploy to Vercel

The Edge Function is located at `/api/send-email.js` and will be automatically deployed when you push to GitHub.

### 4. Test the Endpoint

You can test the endpoint using curl:

```bash
curl -X POST https://nebula-secret-supabase.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "order",
    "params": {
      "from_name": "Test Customer",
      "from_email": "test@example.com",
      "order_number": "NS-1234567",
      "message": "Test order"
    }
  }'
```

## API Reference

### Endpoint

`POST /api/send-email`

### Request Body

```json
{
  "type": "order" | "contact",
  "params": {
    "from_name": "Customer Name",
    "from_email": "customer@example.com",
    "to_email": "sales@nebulasecret.com",
    "order_number": "NS-1234567",
    "message": "Order details or message",
    "...": "Other template parameters"
  }
}
```

### Response

**Success (200):**
```json
{
  "ok": true,
  "message": "Email sent successfully"
}
```

**Error (400/500):**
```json
{
  "error": "Error description",
  "detail": "Detailed error message (if available)"
}
```

## Security Considerations

1. **Never commit secrets**: The `.env` file should be in `.gitignore`
2. **Use Vercel environment variables**: Never hardcode credentials in code
3. **CORS protection**: Only allowed origins can send emails
4. **Rate limiting**: Consider adding rate limiting to prevent abuse
5. **Input validation**: All input is validated before sending

## Troubleshooting

### Email not sending

1. Check Vercel function logs: **Vercel Dashboard** → **Functions** → **Logs**
2. Verify environment variables are set correctly
3. Check EmailJS dashboard for failed sends
4. Test the endpoint directly with curl

### CORS errors

1. Verify `ALLOWED_ORIGINS` includes your domain
2. Make sure the origin matches exactly (including https://)
3. Check browser console for specific CORS error messages

### 405 Method Not Allowed

- The endpoint only accepts POST requests
- Make sure you're using the correct HTTP method

## Migration from Client-Side EmailJS

If you're migrating from client-side EmailJS:

1. Remove EmailJS SDK from frontend (optional, can keep for fallback)
2. Update email sending functions to use `/api/send-email`
3. Remove EmailJS credentials from localStorage and admin panel
4. Configure environment variables in Vercel
5. Test thoroughly

## Fallback Option

If the Edge Function is not available, the frontend can fall back to direct EmailJS calls. This is configured in the admin panel under **Order Emails**.

## Support

For issues with this Edge Function:
1. Check Vercel function logs
2. Check EmailJS dashboard
3. Review this setup guide
4. Contact support if issues persist
