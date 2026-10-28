# Google Gemini AI 集成設置指南

## 已完成的工作

✅ 已創建 Google Gemini API 密鑰
- 名稱：Nebula Secret Website
- 後4位：KYpQ
- 套餐：Free tier（免費）

✅ 已創建 Vercel Edge Function (`/api/ai-chat.js`)
- 保護 API 密鑰，不暴露在前端
- 自動降級到關鍵詞匹配（如果 AI 不可用）
- 支持聊天歷史記錄

✅ 已升級前端聊天機器人
- 從「關鍵詞匹配」升級為真正的 AI 對話
- 支持自然語言提問
- 保留留言表單功能
- AI 不可用時自動降級

---

## 你需要完成的最後一步

### 在 Vercel 後台設置環境變量

1. 登錄 Vercel：https://vercel.com/dashboard
2. 進入你的項目（nebula-secret-supabase）
3. 點擊 **Settings** → **Environment Variables**
4. 添加新的環境變量：

| 變量名 | 值 | 環境 |
|--------|-----|------|
| `GEMINI_API_KEY` | 你的 Gemini API 密鑰 | Production, Preview, Development |

### 如何獲取 API 密鑰

1. 打開 Google AI Studio：https://aistudio.google.com/app/api-keys
2. 找到名為 **Nebula Secret Website** 的密鑰
3. 點擊右邊的 **複製圖標**（Copy API key）
4. 複製完整的密鑰（格式：`AIzaSy...`）

### 重新部署

設置環境變量後，需要重新部署才能生效：

1. 在 Vercel 項目頁面，點擊 **Deployments**
2. 找到最新的部署，點擊右邊的 **...**
3. 選擇 **Redeploy**
4. 等待部署完成

---

## 功能說明

### AI 聊天機器人

客戶可以用自然語言提問，例如：
- "What is your minimum order quantity?"
- "How much for wholesale pricing?"
- "Do you offer private label services?"
- "How long does shipping take?"
- "Can I order samples first?"

AI 會根據網站內容自動回答，並且：
- 用英文回答（國際客戶）
- 不編造具體數字（價格、MOQ等）
- 建議客戶提交報價請求
- 支持上下文對話（記住之前的問題）

### 降級機制

如果 AI 服務不可用（例如 API 密鑰未設置、配額用完），聊天機器人會自動降級到：
- 關鍵詞匹配模式
- 預設的 FAQ 回答
- 營業時間內建議留言回撥

---

## 免費額度說明

Google Gemini Free tier：
- 每分鐘：15 次請求
- 每天：1500 次請求
- 不需要綁定信用卡
- 足夠個人和小型企業使用

如果需要更多配額，可以在 Google AI Studio 中升級到付費計劃。

---

## 測試方法

部署完成後：
1. 打開網站
2. 點擊右下角的聊天機器人圖標
3. 輸入問題，例如 "What is MOQ?"
4. 應該會收到 AI 的智能回答

如果顯示的是預設答案，說明 AI 服務未生效，請檢查：
- 環境變量是否正確設置
- 是否重新部署
- API 密鑰是否正確
