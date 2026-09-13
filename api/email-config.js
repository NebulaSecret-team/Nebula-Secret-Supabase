// Vercel Edge Function: Return only whether email is configured (no keys exposed)

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

  const configured = !!(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY
  );

  return new Response(JSON.stringify({ configured }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
