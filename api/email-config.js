// Vercel Edge Function: Return email config status (no keys exposed)

export const config = {
  runtime: 'edge',
};

function getCorsHeaders(req) {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }

  const params = {
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    MAIL_FROM: !!process.env.MAIL_FROM,
    MAIL_RECIPIENTS: !!process.env.MAIL_RECIPIENTS,
    MAIL_ENABLED: process.env.MAIL_ENABLED !== 'false',
    ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
  };

  const hasKeys = params.RESEND_API_KEY && params.MAIL_FROM;

  return new Response(JSON.stringify({ configured: hasKeys, enabled: params.MAIL_ENABLED && hasKeys, params }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
  });
}
