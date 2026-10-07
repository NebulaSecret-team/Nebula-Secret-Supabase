// Google Gemini AI Chat Proxy - Vercel Edge Function
// 保護 API 密鑰，不暴露在前端

export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `你是 Nebula Secret 的 AI 客戶服務助手。Nebula Secret 是一家專業的護膚品批發和 OEM/ODM 製造商。

關於 Nebula Secret：
- 專營護膚品批發、OEM/ODM 定制生產
- 產品類別：身體磨砂、沐浴鹽、香水、護手霜、精油、面膜、線香等
- 支持私人標籤（Private Label）和定制配方
- 服務全球批發客戶

回答規則：
1. 用英文回答（因為客戶主要是國際批發客戶）
2. 回答要專業、簡潔、有禮貌
3. 如果不知道答案，請建議客戶留下聯繫方式，我們會有專人回覆
4. 不要編造具體數字（如價格、MOQ、交貨時間等），如果客戶問到，請建議他們提交報價請求
5. 對於 MOQ、價格、發貨時間等問題，解釋我們提供定制方案，需要根據具體需求報價
6. 鼓勵客戶使用 "Request Quote" 功能獲取正式報價
7. 如果客戶想了解產品，建議他們瀏覽產品頁面或使用搜索功能

常見問題回答方向：
- MOQ：我們提供靈活的 MOQ，不同產品有不同的最低訂購量，建議提交報價請求獲取具體信息
- 價格：批發價格根據訂購數量、產品類型和定制要求而定，批量訂購有價格優惠
- 發貨時間：取決於產品和訂購量，現貨產品通常發貨較快，定制產品需要生產時間
- OEM/ODM：我們提供完整的 OEM/ODM 服務，包括配方開發、包裝設計、私人標籤等
- 樣品：我們提供樣品服務，具體請聯繫我們
- 付款方式：我們支持多種國際付款方式，具體可商議`;

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.',
        fallback: true 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 構建 Gemini API 請求
    const contents = [];
    
    // 添加歷史對話
    for (const msg of history.slice(-10)) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }
    
    // 添加當前消息
    contents.push({ role: 'user', parts: [{ text: message }] });

    // 模型降級鏈：新模型流量過高或停用時，自動切換到穩定備選模型
    const models = [
      process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
    ];

    let lastError = 'AI service error';
    let lastStatus = 503;

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: contents,
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        lastError = data.error?.message || 'AI service error';
        lastStatus = response.status;
        console.error(`Gemini API error (${model}):`, data);
        // 僅在模型不可用 / 流量過高等可降級錯誤時嘗試下一個模型
        const canFallback = /high demand|no longer available|not found|unavailable|quota|RESOURCE_EXHAUSTED/i.test(lastError) || [404, 429, 500, 502, 503].includes(response.status);
        if (canFallback) continue;
        return new Response(JSON.stringify({ 
          error: lastError,
          fallback: true 
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                      'I apologize, but I could not generate a response. Please try again or contact us directly.';

      return new Response(JSON.stringify({ 
        reply: aiReply,
        usage: data.usageMetadata
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
