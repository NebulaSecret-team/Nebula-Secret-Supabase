// Vercel Edge Function: Return email config status (no keys exposed)

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasKeys = !!(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY
  );

  // MAIL_ENABLED defaults to true if not set; set to "false" to disable
  const mailEnabled = process.env.MAIL_ENABLED !== 'false';

  return new Response(JSON.stringify({ configured: hasKeys, enabled: mailEnabled && hasKeys }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
