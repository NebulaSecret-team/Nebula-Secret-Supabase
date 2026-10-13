// Vercel Edge Function: 获取用户地理位置
// 通过 Vercel 请求头 x-vercel-ip-country 获取用户国家代码
export default function handler(request) {
  // Vercel 自动添加的地理位置请求头
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
