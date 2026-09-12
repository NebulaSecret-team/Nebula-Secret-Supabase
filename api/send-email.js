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

  try {
    const body = await req.json();
    const { type, params } = body;

    // Validate request
    if (!type || !params) {
      return new Response(JSON.stringify({ error: 'Missing type or params' }), {
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
        template_params: params,
      }),
    });

    if (response.ok) {
      return new Response(JSON.stringify({ ok: true, message: 'Email sent successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    } else {
      const errorText = await response.text();
      console.error('EmailJS error:', response.status, errorText);
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send email', detail: errorText }), {
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
