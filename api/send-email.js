// Vercel Edge Function: Send email via EmailJS REST API
// This protects EmailJS credentials by keeping them on the server side
// Environment variables required:
// - EMAILJS_SERVICE_ID: Your EmailJS service ID
// - EMAILJS_TEMPLATE_ID: Your EmailJS template ID (order confirmation)
// - EMAILJS_CONTACT_TEMPLATE_ID: Your EmailJS contact form template ID
// - EMAILJS_PUBLIC_KEY: Your EmailJS public key
// - EMAILJS_PRIVATE_KEY: Your EmailJS private key (secret, never expose to client)
// - ALLOWED_ORIGINS: Comma-separated list of allowed origins (CORS)
// - MAIL_RECIPIENTS: Comma-separated list of email recipients (overrides client-provided to_email)

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
// Prevents clients from controlling sensitive fields like to_email
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

    // Get EmailJS configuration from environment variables
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    const mailRecipients = process.env.MAIL_RECIPIENTS || '';

    let templateId;
    if (type === 'contact') {
      templateId = process.env.EMAILJS_CONTACT_TEMPLATE_ID;
    } else {
      templateId = process.env.EMAILJS_TEMPLATE_ID;
    }

    // Validate configuration
    if (!serviceId || !templateId || !publicKey || !privateKey) {
      console.error('EmailJS configuration missing');
      return new Response(JSON.stringify({
        ok: false,
        error: 'Email service not configured'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Filter params to whitelist (prevents client from controlling to_email etc.)
    const allowedKeys = type === 'contact' ? ALLOWED_CONTACT_PARAMS : ALLOWED_ORDER_PARAMS;
    const filteredParams = filterParams(params, allowedKeys);

    // Override to_email with server-configured recipients (security)
    if (mailRecipients) {
      filteredParams.to_email = mailRecipients;
    }

    // Build EmailJS payload
    const emailjsPayload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: filteredParams,
    };
    if (privateKey) {
      emailjsPayload.accessToken = privateKey;
    }

    // Send email via EmailJS REST API
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailjsPayload),
    });

    if (response.ok) {
      return new Response(JSON.stringify({ ok: true, message: 'Email sent successfully' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          ...getCorsHeaders(req)
        },
      });
    } else {
      // Don't leak internal error details to client
      const errorText = await response.text();
      console.error('[Edge Function] EmailJS error:', response.status, errorText.substring(0, 500));
      return new Response(JSON.stringify({
        ok: false,
        error: 'Failed to send email'
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
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://nebula-secret-supabase.vercel.app').split(',').map(s => s.trim());
  const origin = req.headers.get('origin');

  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }

  return {
    'Content-Type': 'application/json',
  };
}
