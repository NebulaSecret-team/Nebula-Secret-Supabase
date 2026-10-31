// Vercel Edge Function: 获取用户地理位置
// 透過 Vercel 請求頭 x-vercel-ip-country 取得使用者國家代碼
// Security: 不返回客戶 IP；CORS 限白名單來源，避免任意網站竊取訪客粗略位置
export default function handler(request) {
  // Vercel 自動添加的地理位置請求頭
  const country = request.headers.get('x-vercel-ip-country') || '';
  const countryRegion = request.headers.get('x-vercel-ip-country-region') || '';
  const city = request.headers.get('x-vercel-ip-city') || '';

  const origin = request.headers.get('origin');
  const allowed = (process.env.ALLOWED_ORIGINS ||
    'https://uat.nebulasecret.com,https://nebulasecret.com,https://www.nebulasecret.com,http://localhost:4173')
    .split(',').map(s => s.trim()).filter(Boolean);
  const corsHeaders = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  if (origin && allowed.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }

  return new Response(JSON.stringify({
    country: country,
    country_code: country,
    region: countryRegion,
    city: city,
    source: 'vercel-edge'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders
    }
  });
}

export const config = {
  runtime: 'edge',
};
