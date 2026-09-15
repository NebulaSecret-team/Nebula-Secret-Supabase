// Vercel Edge Function: Send email via Resend API
// This protects Resend API key by keeping it on the server side
// Environment variables required:
// - RESEND_API_KEY: Your Resend API key (secret, never expose to client)
// - MAIL_FROM: Sender email address (e.g., "Nebula Secret <noreply@nebulasecret.com>")
// - MAIL_RECIPIENTS: Comma-separated list of email recipients for order/contact emails
// - ALLOWED_ORIGINS: Comma-separated list of allowed origins (CORS)

export const config = {
  runtime: 'edge',
};

// Best-effort per-instance rate limit (edge isolates don't share state:
// 10 requests/min per IP here; pair with Vercel Firewall/WAF for strict limits)
const _rl = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  for (const [key, value] of _rl.entries()) {
    if (value.timestamp < windowStart) _rl.delete(key);
  }
  const key = ip || 'unknown';
  const entry = _rl.get(key);
  if (!entry) {
    _rl.set(key, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.timestamp + RATE_LIMIT_WINDOW - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Whitelist of allowed template parameters
const ALLOWED_ORDER_PARAMS = [
  'store_name', 'order_no', 'date', 'customer', 'email', 'phone',
  'contact', 'address', 'items', 'total', 'currency', 'rate', 'status', 'message'
];

const ALLOWED_CONTACT_PARAMS = [
  'from_name', 'from_email', 'company', 'inquiry_type', 'subject',
  'message', 'reply_to', 'store_name', 'date'
];

function filterParams(params, allowedKeys) {
  const filtered = {};
  for (const key of allowedKeys) {
    if (params[key] !== undefined) {
      filtered[key] = params[key];
    }
  }
  return filtered;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildOrderEmailHtml(params) {
  const storeName = escapeHtml(params.store_name || 'Nebula Secret');
  const orderNo = escapeHtml(params.order_no || 'N/A');
  const date = escapeHtml(params.date || 'N/A');
  const customer = escapeHtml(params.customer || 'N/A');
  const email = escapeHtml(params.email || 'N/A');
  const phone = escapeHtml(params.phone || 'N/A');
  const address = escapeHtml(params.address || 'N/A');
  const items = escapeHtml(params.items || 'N/A').replace(/\n/g, '<br>');
  const total = escapeHtml(params.total || 'N/A');
  const currency = escapeHtml(params.currency || 'EUR');
  const status = escapeHtml(params.status || 'New');
  const message = escapeHtml(params.message || '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - ${storeName}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1b1c; padding:30px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:24px;">${storeName}</h1>
              <p style="color:#999; margin:8px 0 0 0; font-size:14px;">Wholesale Supplier & OEM/ODM Manufacturer</p>
            </td>
          </tr>
          <!-- Order Info -->
          <tr>
            <td style="padding:30px;">
              <h2 style="color:#1a1b1c; margin:0 0 20px 0; font-size:20px; border-bottom:2px solid #e91e63; padding-bottom:10px;">Order Confirmation</h2>
              
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; width:40%; font-weight:bold; color:#1a1b1c;">Order Number</td>
                  <td style="padding:10px; color:#333;">${orderNo}</td>
                </tr>
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; font-weight:bold; color:#1a1b1c;">Date</td>
                  <td style="padding:10px; color:#333;">${date}</td>
                </tr>
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; font-weight:bold; color:#1a1b1c;">Status</td>
                  <td style="padding:10px;"><span style="background-color:#4caf50; color:#fff; padding:4px 12px; border-radius:12px; font-size:12px;">${status}</span></td>
                </tr>
              </table>
              
              <h3 style="color:#1a1b1c; margin:20px 0 10px 0; font-size:16px;">Customer Information</h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; width:40%; font-weight:bold; color:#1a1b1c;">Name</td>
                  <td style="padding:10px; color:#333;">${customer}</td>
                </tr>
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; font-weight:bold; color:#1a1b1c;">Email</td>
                  <td style="padding:10px; color:#333;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; font-weight:bold; color:#1a1b1c;">Phone</td>
                  <td style="padding:10px; color:#333;">${phone}</td>
                </tr>
                <tr>
                  <td style="padding:10px; background-color:#f9f9f9; font-weight:bold; color:#1a1b1c;">Shipping Address</td>
                  <td style="padding:10px; color:#333;">${address}</td>
                </tr>
              </table>
              
              <h3 style="color:#1a1b1c; margin:20px 0 10px 0; font-size:16px;">Order Items</h3>
              <div style="background-color:#fafafa; border-left:4px solid #e91e63; padding:15px; border-radius:0 8px 8px 0; margin-bottom:20px; color:#333; line-height:1.7;">
                ${items}
              </div>
              
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:15px; background-color:#1a1b1c; color:#fff; font-size:18px; font-weight:bold; border-radius:8px 0 0 8px;">Total (${currency})</td>
                  <td style="padding:15px; background-color:#e91e63; color:#fff; font-size:18px; font-weight:bold; border-radius:0 8px 8px 0; text-align:right;">${total}</td>
                </tr>
              </table>
              
              ${message ? `<div style="background-color:#f0f8ff; border:1px solid #b3d9ff; padding:15px; border-radius:8px; margin-bottom:20px;">
                <h4 style="color:#1a1b1c; margin:0 0 8px 0; font-size:14px;">Additional Message</h4>
                <p style="color:#333; margin:0; font-size:14px; line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
              </div>` : ''}
              
              <p style="color:#666; font-size:13px; line-height:1.6; margin:20px 0 0 0;">
                Thank you for your order! Our sales team will review your order and contact you shortly to confirm payment and shipping details.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1b1c; padding:20px; text-align:center;">
              <p style="color:#999; margin:0; font-size:12px;">© ${new Date().getFullYear()} ${storeName}. All rights reserved.</p>
              <p style="color:#666; margin:8px 0 0 0; font-size:11px;">This email was sent from ${storeName} website.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildContactEmailHtml(params) {
  const storeName = escapeHtml(params.store_name || 'Nebula Secret');
  const fromName = escapeHtml(params.from_name || 'N/A');
  const fromEmail = escapeHtml(params.from_email || 'N/A');
  const company = escapeHtml(params.company || 'Not provided');
  const inquiryType = escapeHtml(params.inquiry_type || 'General');
  const subject = escapeHtml(params.subject || 'New Inquiry');
  const message = escapeHtml(params.message || '');
  const date = escapeHtml(params.date || 'N/A');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1b1c; padding:30px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:24px;">New Inquiry Received</h1>
              <p style="color:#999; margin:8px 0 0 0; font-size:14px;">${storeName}</p>
            </td>
          </tr>
          <!-- Inquiry Type Badge -->
          <tr>
            <td style="padding:20px 30px 0 30px; text-align:center;">
              <span style="display:inline-block; background-color:#e91e63; color:#fff; padding:6px 18px; border-radius:20px; font-size:13px; font-weight:600;">${inquiryType}</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:25px;">
                <tr>
                  <td style="padding:10px 12px; background-color:#f5f5f5; border-radius:6px 0 0 6px; width:35%; font-weight:600; color:#1a1b1c; font-size:13px;">Name</td>
                  <td style="padding:10px 12px; background-color:#fff; border:1px solid #eee; border-radius:0 6px 6px 0; color:#333; font-size:14px;">${fromName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px; background-color:#f5f5f5; border-radius:6px 0 0 6px; font-weight:600; color:#1a1b1c; font-size:13px;">Email</td>
                  <td style="padding:10px 12px; background-color:#fff; border:1px solid #eee; border-radius:0 6px 6px 0; color:#333; font-size:14px;"><a href="mailto:${fromEmail}" style="color:#e91e63; text-decoration:none;">${fromEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding:10px 12px; background-color:#f5f5f5; border-radius:6px 0 0 6px; font-weight:600; color:#1a1b1c; font-size:13px;">Company / Brand</td>
                  <td style="padding:10px 12px; background-color:#fff; border:1px solid #eee; border-radius:0 6px 6px 0; color:#333; font-size:14px;">${company}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px; background-color:#f5f5f5; border-radius:6px 0 0 6px; font-weight:600; color:#1a1b1c; font-size:13px;">Date</td>
                  <td style="padding:10px 12px; background-color:#fff; border:1px solid #eee; border-radius:0 6px 6px 0; color:#333; font-size:14px;">${date}</td>
                </tr>
              </table>
              
              <div style="margin-bottom:25px;">
                <h3 style="color:#1a1b1c; font-size:16px; margin:0 0 12px 0; padding-bottom:8px; border-bottom:1px solid #eee;">Message</h3>
                <div style="background-color:#fafafa; border-left:4px solid #e91e63; padding:16px 18px; border-radius:0 8px 8px 0; color:#333; font-size:14px; line-height:1.7; white-space:pre-wrap;">${message}</div>
              </div>
              
              <div style="text-align:center; margin-top:30px;">
                <a href="mailto:${fromEmail}?subject=Re:%20${encodeURIComponent(inquiryType)}%20Inquiry" style="display:inline-block; background-color:#e91e63; color:#fff; padding:14px 36px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px;">Reply to ${fromName}</a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1b1c; padding:20px; text-align:center;">
              <p style="color:#999; margin:0; font-size:12px;">This inquiry was sent from the ${storeName} website contact form.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }

  // Per-IP rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateLimit.retryAfter),
        ...getCorsHeaders(req)
      },
    });
  }

  try {
    const body = await req.json();
    const { type, params } = body;

    // Validate request structure
    if (!type || !params || typeof params !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing or invalid type or params' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Validate type allowlist
    if (!['order', 'contact'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid email type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Get Resend configuration from environment variables
    const resendApiKey = process.env.RESEND_API_KEY;
    const mailFrom = process.env.MAIL_FROM || 'Nebula Secret <noreply@nebulasecret.com>';
    const mailRecipients = process.env.MAIL_RECIPIENTS || '';

    // Validate configuration
    if (!resendApiKey) {
      console.error('Resend API key missing');
      return new Response(JSON.stringify({
        ok: false,
        error: 'Email service not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Filter params to whitelist
    const allowedKeys = type === 'contact' ? ALLOWED_CONTACT_PARAMS : ALLOWED_ORDER_PARAMS;
    const filteredParams = filterParams(params, allowedKeys);

    // Build email content
    let subject, html, to;
    
    if (type === 'order') {
      subject = `Order Confirmation - ${filteredParams.order_no || 'N/A'} - ${filteredParams.store_name || 'Nebula Secret'}`;
      html = buildOrderEmailHtml(filteredParams);
      // For orders, send to customer email AND admin recipients
      const customerEmail = filteredParams.email;
      to = mailRecipients ? mailRecipients.split(',').map(e => e.trim()) : [];
      if (customerEmail && !to.includes(customerEmail)) {
        to.push(customerEmail);
      }
    } else {
      subject = filteredParams.subject || `New ${filteredParams.inquiry_type || 'Inquiry'} from ${filteredParams.from_name || 'Customer'}`;
      html = buildContactEmailHtml(filteredParams);
      // For contact, send to admin recipients only
      to = mailRecipients ? mailRecipients.split(',').map(e => e.trim()) : [];
    }

    // Ensure at least one recipient
    if (!to || to.length === 0) {
      console.error('No email recipients configured');
      return new Response(JSON.stringify({
        ok: false,
        error: 'No email recipients configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Build Resend payload
    const resendPayload = {
      from: mailFrom,
      to: to,
      subject: subject,
      html: html,
    };

    // Add reply-to for contact form
    if (type === 'contact' && filteredParams.from_email) {
      resendPayload.reply_to = filteredParams.from_email;
    }

    console.log(`[Resend] Sending ${type} email to:`, to, 'subject:', subject);

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
    });

    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      console.log(`[Resend] Email sent successfully, id:`, responseData.id);
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Email sent successfully',
        emailId: responseData.id
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          ...getCorsHeaders(req)
        },
      });
    } else {
      console.error('[Resend] Error:', response.status, responseData);
      return new Response(JSON.stringify({
        ok: false,
        error: 'Failed to send email',
        detail: responseData.message || response.statusText
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }
  } catch (error) {
    console.error('[Edge Function] Internal error:', error.message);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }
}

function getCorsHeaders(req) {
  const origin = req.headers.get('origin');
  
  // Allow all origins (rate limiting and other security measures are in place)
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
