// Vercel Cron Job: Supabase Keep-Alive
// This endpoint is called automatically by Vercel Cron Job every day
// to prevent Supabase Free plan from pausing after 7 days of inactivity.
// It makes a lightweight query to Supabase REST API to keep the project active.
// No dependencies required — uses native fetch.

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Supabase credentials — use environment variables if available,
    // otherwise fall back to the public credentials from the website
    const supabaseUrl = process.env.SUPABASE_URL || 'https://xwhhsoppcpkijxxychjm.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_2GnjItYkv_TRex8Z9YKTag_oUdiyHEk';

    // Make a lightweight query to Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/site_settings?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase keep-alive query failed:', response.status, errorText);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: `Supabase returned ${response.status}`,
        detail: errorText,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('Supabase keep-alive ping successful at', new Date().toISOString());
    
    return new Response(JSON.stringify({ 
      ok: true, 
      message: 'Supabase keep-alive ping successful',
      timestamp: new Date().toISOString(),
      rowsReturned: data.length
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
    });
  } catch (error) {
    console.error('Keep-alive endpoint error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
