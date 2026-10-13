// Agnes AI Chat Proxy - Vercel Edge Function
// 保護 API 密鑰，不暴露在前端
// Agnes AI 是 OpenAI 兼容格式的 API，完全免費

export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are Nebula Secret's AI customer service assistant. Nebula Secret is a professional skincare wholesale and OEM/ODM manufacturer.

About Nebula Secret:
- Specializes in skincare wholesale, OEM/ODM custom manufacturing
- Product categories: body scrubs, bath salts, perfumes, hand creams, essential oils, face masks, incense, etc.
- Supports private label and custom formulation
- Serves wholesale customers worldwide

Answer rules:
1. Answer in English (customers are mainly international wholesale clients)
2. Be professional, concise, and polite
3. If you don't know the answer, suggest the customer leave their contact info and we'll have someone reply
4. Never invent specific numbers (prices, MOQ, lead times, etc.) - if asked, suggest they submit a quote request
5. For MOQ, pricing, shipping time questions, explain we offer customized solutions and need to quote based on specific requirements
6. Encourage customers to use the "Request Quote" feature for formal quotes
7. If customers want to learn about products, suggest they browse the product pages or use the search function

Common question answer directions:
- MOQ: We offer flexible MOQ, different products have different minimum order quantities, suggest submitting a quote request for specific info
- Pricing: Wholesale prices depend on order quantity, product type, and customization requirements; bulk orders have volume discounts
- Shipping time: Depends on product and order quantity; in-stock products usually ship faster, custom products require production time
- OEM/ODM: We provide complete OEM/ODM services including formulation development, packaging design, private label, etc.
- Samples: We offer sample services, please contact us for details
- Payment methods: We support multiple international payment methods, negotiable`;

export default async function handler(req) {
  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { message, history = [] } = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.AGNES_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'AI service not configured. Please set AGNES_API_KEY environment variable.',
        fallback: true 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 構建 OpenAI 兼容格式的 messages
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    
    // 添加歷史對話（最近10條）
    for (const msg of history.slice(-10)) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }
    
    // 添加當前消息
    messages.push({ role: 'user', content: message });

    // 模型降級鏈：Agnes AI 模型
    const models = [
      process.env.AGNES_MODEL || 'agnes-2.5-flash',
      'agnes-2.0-flash',
    ];

    // Agnes API 端點（國際站）
    const apiBase = process.env.AGNES_API_BASE || 'https://api.agnes.ai/v1';

    let lastError = 'AI service error';
    let lastStatus = 503;

    for (const model of models) {
      let response, data;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        response = await fetch(
          `${apiBase}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              temperature: 0.7,
              max_tokens: 1024,
              top_p: 0.95,
            }),
            signal: controller.signal,
          }
        ).finally(() => clearTimeout(timeoutId));
        data = await response.json();
      } catch (err) {
        lastError = err.name === 'AbortError' ? `Model ${model} timed out` : `Model ${model} error: ${err.message}`;
        console.error(lastError);
        continue;
      }

      if (!response.ok) {
        lastError = data.error?.message || data.error || 'AI service error';
        lastStatus = response.status;
        console.error(`Agnes API error (${model}):`, data);
        // 僅在模型不可用 / 流量過高等可降級錯誤時嘗試下一個模型
        const canFallback = /high demand|no longer available|not found|unavailable|quota|rate limit|RESOURCE_EXHAUSTED|model_not_found/i.test(lastError) || [404, 429, 500, 502, 503].includes(response.status);
        if (canFallback) continue;
        return new Response(JSON.stringify({ 
          error: lastError,
          fallback: true 
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Agnes AI (OpenAI 兼容格式) 的響應結構
      const aiReply = data.choices?.[0]?.message?.content || 
                      'I apologize, but I could not generate a response. Please try again or contact us directly.';

      return new Response(JSON.stringify({ 
        reply: aiReply,
        usage: data.usage,
        model: model
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
      });
    }

    // 所有模型都失敗，返回最後一個錯誤
    return new Response(JSON.stringify({ 
      error: lastError,
      fallback: true 
    }), {
      status: lastStatus,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      fallback: true 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
