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

  // Optional shared-secret gate. NOTE: Vercel Cron cannot send custom headers,
  // so setting CRON_SECRET requires moving the schedule to an external cron
  // (e.g. GitHub Actions) that calls this endpoint with
  // `Authorization: Bearer <CRON_SECRET>`. Until then it stays open by design.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== 'Bearer ' + cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Supabase credentials must come from environment variables.
    // No hard-coded fallback keys in source (the public anon key already ships
    // in the front-end bundle, but keeping it out of this file avoids stale
    // copies and keeps the repo clean of duplicated credentials).
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Keep-alive check failed',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
      // Log upstream detail server-side only; never proxy DB error text to clients
      const errorText = await response.text();
      console.error('Supabase keep-alive query failed:', response.status, errorText);
      return new Response(JSON.stringify({
        ok: false,
        error: 'Keep-alive check failed',
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
      error: 'Keep-alive check failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
