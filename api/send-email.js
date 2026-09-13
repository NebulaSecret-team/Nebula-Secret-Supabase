// Vercel Edge Function: Send email via EmailJS REST API
// This protects EmailJS credentials by keeping them on the server side
// Environment variables required:
// - EMAILJS_SERVICE_ID: Your EmailJS service ID
// - EMAILJS_TEMPLATE_ID: Your EmailJS template ID (order confirmation)
// - EMAILJS_CONTACT_TEMPLATE_ID: Your EmailJS contact form template ID
// - EMAILJS_PUBLIC_KEY: Your EmailJS public key
// - EMAILJS_PRIVATE_KEY: Your EmailJS private key (secret, never expose to client)
// - ALLOWED_ORIGINS: Comma-separated list of allowed origins (CORS)

export const config = {
  runtime: 'edge',
};

// Best-effort per-instance rate limit (edge isolates don't share state:
// 10 requests/min per IP here; pair with Vercel Firewall/WAF for strict limits)
const _rl = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const win = 60 * 1000;
  const max = 10;
  let rec = _rl.get(ip);
  if (!rec || now - rec.t > win) rec = { n: 0, t: now };
  rec.n += 1;
  _rl.set(ip, rec);
  if (_rl.size > 5000) _rl.delete(_rl.keys().next().value);
  return rec.n <= max ? 0 : Math.ceil((win - (now - rec.t)) / 1000);
}

function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim();
}

// Allowlist + sanitize template params (max 30 fields, strings capped at 2000 chars)
function cleanParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  const clean = {};
  for (const [k, v] of Object.entries(params).slice(0, 30)) {
    if (typeof k !== 'string' || k.length > 64) continue;
    if (typeof v === 'string') clean[k] = v.slice(0, 2000);
    else if (typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
  }
  return clean;
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
  const wait = checkRateLimit(clientIp(req));
  if (wait > 0) {
    return new Response(JSON.stringify({ error: 'Too many requests, try again later' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }

  try {
    const body = await req.json();
    const { type, params } = body;

    // Strict allowlist validation
    if (!['order', 'contact'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }
    const clean = cleanParams(params);
    if (!clean) {
      return new Response(JSON.stringify({ error: 'Invalid params' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Get EmailJS configuration from environment variables
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    let templateId;
    if (type === 'contact') {
      templateId = process.env.EMAILJS_CONTACT_TEMPLATE_ID;
    } else {
      templateId = process.env.EMAILJS_TEMPLATE_ID;
    }

    // Validate configuration
    if (!serviceId || !templateId || !publicKey || !privateKey) {
      console.error('EmailJS configuration missing');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Send email via EmailJS REST API
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': req.headers.get('origin') || 'https://nebula-secret-supabase.vercel.app',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: clean,
      }),
    });

    if (response.ok) {
      return new Response(JSON.stringify({ ok: true, message: 'Email sent successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    } else {
      // Log upstream detail server-side only; never proxy it to the client
      const errorText = await response.text();
      console.error('EmailJS error:', response.status, errorText);
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }
}

function getCorsHeaders(req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://nebula-secret-supabase.vercel.app').split(',');
  const origin = req.headers.get('origin');
  
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
