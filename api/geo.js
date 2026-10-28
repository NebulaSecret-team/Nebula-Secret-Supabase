// Vercel Edge Function: 获取用户地理位置
// 透過 Vercel 請求頭 x-vercel-ip-country 取得使用者國家代碼
export default function handler(request) {
  // Vercel 自動添加的地理位置請求頭
  const country = request.headers.get('x-vercel-ip-country') || '';
  const countryRegion = request.headers.get('x-vercel-ip-country-region') || '';
  const city = request.headers.get('x-vercel-ip-city') || '';
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
  
  return new Response(JSON.stringify({
    country: country,
    country_code: country,
    region: countryRegion,
    city: city,
    ip: ip,
    source: 'vercel-edge'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export const config = {
  runtime: 'edge',
};
