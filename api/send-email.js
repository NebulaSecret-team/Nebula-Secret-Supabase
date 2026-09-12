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
  console.log('[Edge Function] Request received:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[Edge Function] CORS preflight');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[Edge Function] Method not allowed:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }

  try {
    const body = await req.json();
    console.log('[Edge Function] Request body:', JSON.stringify(body).substring(0, 500));
    
    const { type, params } = body;

    // Validate request
    if (!type || !params) {
      console.log('[Edge Function] Missing type or params');
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

    console.log('[Edge Function] Config:', {
      serviceId: serviceId ? 'set' : 'MISSING',
      templateId: templateId ? 'set' : 'MISSING',
      publicKey: publicKey ? 'set' : 'MISSING',
      privateKey: privateKey ? 'set' : 'MISSING',
      type: type
    });

    // Validate configuration
    if (!serviceId || !templateId || !publicKey || !privateKey) {
      console.error('[Edge Function] EmailJS configuration missing');
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Email service not configured',
        detail: 'Missing environment variables. Please configure EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY in Vercel dashboard.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }

    // Send email via EmailJS REST API
    console.log('[Edge Function] Sending email via EmailJS REST API...');
    
    // 使用標準的 EmailJS REST API 認證方式（只使用 user_id，不使用 accessToken）
    const emailjsPayload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: params,
    };
    
    // 如果有 Private Key，添加 accessToken 參數（可選，用於更高的安全性）
    if (privateKey) {
      emailjsPayload.accessToken = privateKey;
      console.log('[Edge Function] Using accessToken for authentication');
    } else {
      console.log('[Edge Function] Using user_id only for authentication');
    }

    console.log('[Edge Function] EmailJS payload:', JSON.stringify(emailjsPayload).substring(0, 500));

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailjsPayload),
    });

    console.log('[Edge Function] EmailJS response status:', response.status);

    if (response.ok) {
      console.log('[Edge Function] Email sent successfully');
      return new Response(JSON.stringify({ ok: true, message: 'Email sent successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    } else {
      const errorText = await response.text();
      console.error('[Edge Function] EmailJS error:', response.status, errorText);
      console.error('[Edge Function] Request payload:', JSON.stringify(emailjsPayload).substring(0, 1000));
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Failed to send email', 
        detail: `EmailJS returned ${response.status}: ${errorText}`,
        debug: {
          serviceId: serviceId ? 'set' : 'missing',
          templateId: templateId ? 'set' : 'missing',
          publicKey: publicKey ? 'set' : 'missing',
          privateKey: privateKey ? 'set' : 'missing',
          emailjsStatus: response.status,
          emailjsError: errorText
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      });
    }
  } catch (error) {
    console.error('[Edge Function] Internal error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      detail: error.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    });
  }
}

function getCorsHeaders(req) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://nebula-secret-supabase.vercel.app').split(',').map(s => s.trim());
  const origin = req.headers.get('origin');
  
  console.log('[Edge Function] CORS check:', { origin, allowedOrigins });
  
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
  }
  
  // For development, allow all origins (but in production, restrict to your domain)
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
