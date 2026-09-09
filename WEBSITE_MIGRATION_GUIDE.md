# Nebula Secret 網站架構與數據遷移指南

> 本文檔供網頁管理者參考，包含網站的完整架構、數據存儲位置、服務配置，以及轉移到自定義域名的詳細步驟。

---

## 一、網站架構概覽

### 1.1 技術棧

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端 | 原生 HTML/CSS/JavaScript（單文件） | 無框架，單文件 `index.html` |
| 後端數據庫 | Supabase（PostgreSQL） | 雲端數據庫，REST API 訪問 |
| 托管平台 | Vercel | 前端靜態托管，自動部署 |
| 代碼托管 | GitHub | 源代碼版本控制 |
| 郵件服務 | EmailJS | 訂單和聯繫表單郵件發送 |
| 匯率 API | @fawazahmed0/currency-api | 實時匯率（通過 jsDelivr CDN） |
| 定時任務 | cron-job.org | 防止 Supabase 冬眠 |

### 1.2 網站訪問地址

| 環境 | URL |
|------|-----|
| 生產環境（Vercel） | https://nebula-secret-supabase.vercel.app |
| 源代碼倉庫 | https://github.com/nebulaspider/Nebula-Secret-Supabase |
| Supabase 後台 | https://supabase.com/dashboard/project/xwhhsoppcpkijxxychjm |

---

## 二、數據存儲位置詳情

### 2.1 Supabase 數據庫

**項目信息：**
- Project URL: `https://xwhhsoppcpkijxxychjm.supabase.co`
- Project Reference ID: `xwhhsoppcpkijxxychjm`
- 數據庫名稱: `nebula-db`
- 區域: Singapore（新加坡）
- 計劃: Free Tier（免費層）

**數據庫表結構：**

#### 主要表：`site_settings`

使用 jsonb 字段作為 key-value 存儲，所有動態數據都存在這張表中。

| id (key) | 存儲內容 | 說明 |
|-----------|----------|------|
| `products` | 所有產品數據（77+ 個） | 包含產品名稱、價格、分類、圖片（base64）、描述等 |
| `cats` | 所有產品分類（9+ 個） | 包含分類名稱、slug、圖片（base64）、排序 |
| `theme` | 網站主題配置 | 品牌顏色、標題、Banner 圖片（base64）、彈窗配置等 |
| `content` | 網站文字內容 | 頂部歡迎語、Footer 描述、About 頁面內容等 |
| `orders` | 所有客戶訂單 | 訂單編號、客戶信息、訂單商品、總金額、狀態等 |
| `accounts` | 客戶賬戶 | 用戶名、郵箱、密碼、註冊時間、訂單數等 |
| `admins` | 管理員賬戶 | 用戶名、密碼、角色、創建時間 |

**RLS（Row Level Security）策略：**
- 當前設置為公開讀寫（過渡期簡化配置）
- 建議長遠收緊策略，只允許寫入 orders，不允許隨意修改 products

**Supabase 認證密鑰：**
- Publishable Key（前端使用）: `sb_publishable_2GnjItYkv_TRex8Z9YKTag_oUdiyHEk`
- 此密鑰已寫入 `index.html` 第 880 行

### 2.2 GitHub 倉庫

**倉庫地址：** https://github.com/nebulaspider/Nebula-Secret-Supabase

**倉庫所有者：** nebulaspider

**倉庫內容：**

| 文件/文件夾 | 說明 |
|-------------|------|
| `index.html` | 網站主文件（約 300KB，包含所有 HTML/CSS/JS） |
| `images/` | 靜態圖片文件夾（82 個文件，包含 logo、placeholder、banner 等） |
| `.gitignore` | Git 忽略配置 |
| `setup.sql` | 數據庫初始化 SQL（已執行，可忽略） |
| `import_data.sql` | 數據導入 SQL（已執行，可忽略） |
| `README.md` | 項目說明文檔 |
| `DEPLOYMENT_GUIDE.md` | 部署指南 |

**注意：** 產品圖片、分類圖片、Banner 圖片等動態圖片以 base64 編碼存儲在 Supabase 數據庫中，**不是**存在 GitHub 倉庫的 images/ 文件夾中。images/ 文件夾只存儲靜態圖片（logo、placeholder 等）。

### 2.3 Vercel 部署

**項目信息：**
- Vercel 項目名稱: `Nebula Secret Wholesale`
- Vercel 賬號: `cyruschow-1317`
- 計劃: Hobby（免費層）
- 框架預設: Other（無構建命令，純靜態站點）
- 生產域名: `https://nebula-secret-supabase.vercel.app`

**自動部署：**
- 每當 GitHub 倉庫的 `main` 分支有新的 commit，Vercel 會自動重新部署
- 部署時間通常 1-2 分鐘

### 2.4 EmailJS 郵件服務

**賬號信息：**
- 服務平台: EmailJS（https://www.emailjs.com）
- 計劃: Free Tier（免費層，每月 200 封郵件）

**已配置的郵件模板：**

| 模板名稱 | Template ID | 用途 |
|----------|-------------|------|
| 訂單郵件模板 | （需在 EmailJS 後台查看） | 客戶下單後自動發送訂單確認郵件 |
| Contact Form Inquiry | `template_o5u18d6` | 客戶通過聯繫表單發送查詢郵件 |

**收件人郵箱：**
- `sales@nebulasecret.com`
- `bong8686@gmail.com`

**EmailJS 配置存儲位置：**
- EmailJS 的 Service ID、Template ID、Public Key 等配置**不存儲在數據庫中**，而是存儲在瀏覽器的 localStorage 中
- 管理員在 Admin Panel → Order Emails 頁面配置後，配置保存在該瀏覽器的 localStorage 中
- **重要：** 如果更換瀏覽器或清除瀏覽器數據，需要重新配置 EmailJS 設置

### 2.5 cron-job.org 定時任務

**任務信息：**
- 服務平台: cron-job.org（https://cron-job.org）
- 任務名稱: `Supabase Keep Alive`
- 執行時間: 每天 20:00（Asia/Hong_Kong 時區）
- 目的: 防止 Supabase 免費層項目因 7 天無數據庫請求而進入冬眠狀態

**調用的 API：**
- URL: `https://xwhhsoppcpkijxxychjm.supabase.co/rest/v1/site_settings?select=id&limit=1`
- Method: GET
- Header: `apikey: <Supabase anon key>`

### 2.6 本地瀏覽器數據（localStorage）

以下數據存儲在用戶/管理員的瀏覽器 localStorage 中，**不存儲在雲端**：

| Key | 存儲內容 | 說明 |
|-----|----------|------|
| `ns_mail` | EmailJS 配置 | Service ID、Template ID、Public Key、收件人等 |
| `ns_currency` | 用戶選擇的貨幣 | 例如 "EUR"、"USD" 等 |
| `ns_cart` | 購物車數據 | 當前用戶的購物車商品 |
| `ns_admin` | 管理員登錄狀態 | 當前登錄的管理員用戶名 |
| `ns_user` | 客戶登錄狀態 | 當前登錄的客戶用戶名 |
| `ns_subscribers` | Newsletter 訂閱者 | （已停用，改為聯繫表單） |

**重要：** EmailJS 配置只存在管理員的瀏覽器中。如果管理員更換電腦或瀏覽器，需要重新在 Admin Panel → Order Emails 中配置。

---

## 三、轉移到自定義域名的步驟

### 3.1 前提條件

1. 已經註冊了自定義域名（例如 `www.nebulasecret.com` 或 `nebulasecret.com`）
2. 有域名 DNS 管理權限
3. 有 Vercel 賬號管理權限
4. 有 Supabase 賬號管理權限

### 3.2 步驟一：在 Vercel 添加自定義域名

1. 登錄 Vercel Dashboard: https://vercel.com/dashboard
2. 進入項目 **Nebula Secret Wholesale**
3. 點擊頂部的 **Settings** 標籤
4. 左側菜單點擊 **Domains**
5. 在輸入框中輸入你的域名（例如 `www.nebulasecret.com`）
6. 點擊 **Add** 按鈕
7. Vercel 會顯示需要配置的 DNS 記錄

### 3.3 步驟二：配置域名 DNS

根據 Vercel 顯示的 DNS 配置，在你的域名註冊商處添加 DNS 記錄：

**如果使用 `www` 子域名（推薦）：**
- Type: `CNAME`
- Name: `www`
- Value: `cname.vercel-dns.com`
- TTL: Auto 或 300

**如果使用根域名（apex domain，例如 `nebulasecret.com`）：**
- Type: `A`
- Name: `@`
- Value: `76.76.21.21`（Vercel 的 Anycast IP）
- TTL: Auto 或 300

**同時建議添加根域名到 www 的重定向：**
- 在 Vercel Domains 頁面，添加根域名（例如 `nebulasecret.com`）
- Vercel 會自動將根域名重定向到 `www` 域名（或反之）

### 3.4 步驟三：等待 DNS 生效

- DNS 生效時間通常為幾分鐘到 24 小時（取決於域名註冊商和 TTL 設置）
- 在 Vercel Domains 頁面可以查看域名狀態，顯示 **Valid Configuration** 表示成功
- 生效後，訪問你的自定義域名就能看到網站

### 3.5 步驟四：更新 Supabase 配置（可選）

如果需要在 Supabase 中配置自定義域名的 URL 限制：

1. 登錄 Supabase Dashboard
2. 進入項目 **Nebula Secret**
3. 左側菜單 → **Authentication** → **URL Configuration**
4. 在 **Site URL** 中填入你的自定義域名
5. 在 **Redirect URLs** 中添加你的自定義域名

**注意：** 當前網站沒有使用 Supabase Authentication（用戶認證），所以此步驟可選。

### 3.6 步驟五：更新 EmailJS 配置（可選）

如果 EmailJS 模板中設置了域名白名單：

1. 登錄 EmailJS Dashboard
2. 進入 **Account** → **API Settings** 或 **Security**
3. 檢查是否有域名白名單設置
4. 如果有，添加你的自定義域名

**注意：** 多數情況下 EmailJS 不需要配置域名白名單，此步驟可選。

### 3.7 步驟六：測試

1. 訪問你的自定義域名，確認網站正常顯示
2. 測試產品瀏覽、購物車、結賬流程
3. 測試管理員登錄（Admin Panel）
4. 測試下單流程，確認收到訂單郵件
5. 測試聯繫表單，確認收到查詢郵件
6. 測試貨幣切換功能
7. 在手機上測試響應式布局

---

## 四、轉移所有權的步驟（如果需要）

如果網頁管理者需要完全接管網站的所有權，需要轉移以下服務的所有權：

### 4.1 轉移 GitHub 倉庫所有權

1. 登錄 GitHub
2. 進入倉庫 **Settings** → **General**
3. 滾動到底部 **Danger Zone**
4. 點擊 **Transfer ownership**
5. 輸入新所有者的 GitHub 用戶名
6. 確認轉移

### 4.2 轉移 Vercel 項目所有權

1. 登錄 Vercel
2. 進入項目 **Settings** → **General**
3. 滾動到底部 **Danger Zone**
4. 點擊 **Transfer Project**
5. 選擇新的團隊或賬號
6. 確認轉移

### 4.3 轉移 Supabase 項目所有權

1. 登錄 Supabase Dashboard
2. 進入項目 **Settings** → **General**
3. 找到 **Transfer Project** 選項
4. 輸入新所有者的郵箱
5. 確認轉移

**注意：** Supabase 免費層可能不支持項目轉移，可能需要升級到付費計劃。

### 4.4 轉移 EmailJS 賬號

EmailJS 不支持直接轉移賬號所有權。建議：
1. 在新管理者的 EmailJS 賬號中重新創建郵件服務和模板
2. 更新網站中的 EmailJS 配置（Admin Panel → Order Emails）

### 4.5 轉移域名所有權

1. 登錄域名註冊商（例如 GoDaddy、Namecheap、Cloudflare 等）
2. 找到域名轉移（Transfer）選項
3. 按照註冊商的指引完成轉移

---

## 五、管理員登錄信息

### 5.1 Admin Panel 登錄

- 登錄頁面: `https://你的域名/#/admin`
- 默認管理員用戶名: `admin`
- 默認密碼: `abcd1234`

**重要：** 建議首次登錄後立即修改密碼（Admin Panel → Admin Users → Change Password）。

### 5.2 Supabase 後台登錄

- 網址: https://supabase.com/dashboard
- 使用註冊時的郵箱和密碼登錄
- 項目名稱: **Nebula Secret**

### 5.3 Vercel 後台登錄

- 網址: https://vercel.com/login
- 使用 GitHub 賬號（cyruschow-1317）登錄
- 項目名稱: **Nebula Secret Wholesale**

### 5.4 GitHub 倉庫訪問

- 網址: https://github.com/nebulaspider/Nebula-Secret-Supabase
- 倉庫所有者: nebulaspider

### 5.5 EmailJS 後台登錄

- 網址: https://dashboard.emailjs.com
- 使用註冊時的郵箱和密碼登錄

---

## 六、常見問題排查

### 6.1 網站打不開

1. 檢查 Vercel 項目狀態是否正常
2. 檢查 GitHub 倉庫是否存在
3. 檢查 DNS 配置是否正確
4. 查看 Vercel 部署日誌

### 6.2 數據不顯示（產品、分類等）

1. 檢查 Supabase 項目是否正常運行（可能進入冬眠狀態）
2. 檢查 Supabase 數據庫中 `site_settings` 表是否有數據
3. 打開瀏覽器 Console（F12），查看是否有 Supabase 相關錯誤
4. 如果 Supabase 進入冬眠，登錄 Supabase Dashboard 點擊 **Restore Project**

### 6.3 收不到訂單郵件

1. 檢查 EmailJS 配置是否正確（Admin Panel → Order Emails）
2. 點擊 **Send Test Email** 測試郵件發送
3. 檢查垃圾郵件文件夾
4. 檢查 EmailJS 賬號的月度郵件配額是否用完（免費層每月 200 封）

### 6.4 管理員登錄失敗

1. 確認用戶名和密碼正確
2. 檢查 Supabase 數據庫中 `site_settings` 表的 `admins` 記錄是否存在
3. 清除瀏覽器緩存後重試

### 6.5 貨幣匯率不更新

1. 檢查網絡連接是否正常
2. 打開瀏覽器 Console，查看是否有匯率 API 相關錯誤
3. 匯率 API 為免費公共服務，偶爾可能不穩定，會自動回退到靜態匯率

---

## 七、聯繫信息

如有技術問題，可聯繫：
- 網站開發者：（請填寫）
- 域名註冊商客服：（請填寫）
- Vercel 支持：https://vercel.com/help
- Supabase 支持：https://supabase.com/contact
- EmailJS 支持：https://www.emailjs.com/contact/

---

**文檔版本：** v1.0
**最後更新：** 2026-09-09
