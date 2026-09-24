# Nebula Secret — Supabase 版本

批發 / OEM-ODM 網站，使用 Supabase 作為後端數據庫。



***

## 文件結構



```
nebula-secret-supabase/

├── index.html      # 主網站（Supabase 版本）

├── migrate.html    # 數據遷移工具（從舊網站導入數據到 Supabase）

├── setup.sql       # 數據庫建表 SQL（在 Supabase SQL Editor 執行）

├── images/         # 產品圖片、logo、banner（82 個文件）

└── README.md       # 本說明文件
```



***

## 快速開始（3 步驟）

### Step 1：在 Supabase 創建數據表



1. 打開 Supabase Dashboard → 你的項目

2. 左側菜單 **SQL Editor → New query**

3. 打開 `setup.sql`，複製全部內容，粘貼到 SQL Editor

4. 點擊 **Run**（右下角）

5. 看到 `Success. No rows returned` 即成功

### Step 2：遷移舊數據到 Supabase



1. 用瀏覽器打開 `migrate.html`（直接雙擊或拖到瀏覽器）

2. **Step 1 — Connect**：

* Supabase URL 已預填（`https://xwhhsoppcpkijxxychjm.supabase.co`）

* 貼入你的 **anon public key**（Supabase → Project Settings → API → `anon` `public`）

* 點擊 **Test Connection**，顯示綠色成功信息

1. **Step 2 — Load Data**：

* 點擊 **Load from Old Site**（從舊 GitHub Pages 網站讀取數據）

* 或點擊 **Use Default Products**（使用默認產品）

* 或直接粘貼 JSON 數據

1. **Step 3 — Migrate**：

* 點擊 **Start Migration**

* 等待所有項目顯示綠色 ✓

### Step 3：配置網站並上傳



1. 用文本編輯器打開 `index.html`

2. 找到第～857 行：



```
const SB\_KEY = "REPLACE\_WITH\_YOUR\_ANON\_KEY";
```



1. 把 `REPLACE_WITH_YOUR_ANON_KEY` 替換為你的實際 anon public key

2. 保存文件

3. 上傳到 GitHub Pages / Netlify / 任何靜態托管：

* 上傳 `index.html`

* 上傳整個 `images/` 文件夾

1. 打開網站，所有數據現在從 Supabase 實時加載！



***

## 架構說明

### 數據存儲方式

當前版本使用 **單表 key-value 存儲**（`site_settings` 表），所有動態數據以 JSONB 格式存儲：



| Key        | 內容             | 說明                           |
| ---------- | -------------- | ---------------------------- |
| `products` | 產品列表（JSON 數組）  | 管理員在 Admin Panel 增刪改         |
| `cats`     | 產品分類（JSON 數組）  |                              |
| `theme`    | 主題設置（JSON 對象）  | 品牌色、banner、popup 等           |
| `content`  | 頁面內容（JSON 對象）  | Footer、About、Customer Care 等 |
| `orders`   | 訂單列表（JSON 數組）  | 客戶下單後自動寫入                    |
| `accounts` | 客戶賬號（JSON 數組）  |                              |
| `admins`   | 管理員賬號（JSON 數組） |                              |

### 為什麼用單表而不是多表？



* **最小化代碼改動**：現有 UI 代碼完全不需要修改，只替換數據層函數

* **快速上線**：不需要複雜的 SQL 查詢和關聯

* **未來可擴展**：`setup.sql` 已包含 `products`、`categories`、`orders`、`order_items` 等獨立表的定義，v2 版本可以遷移過去

### 內存緩存機制



* 頁面加載時，`sbLoadAll()` 從 Supabase 讀取所有數據到內存緩存 `_cache`

* `getProducts()`、`getOrders()` 等函數從內存緩存讀取（同步，性能好）

* `saveProducts()`、`saveOrders()` 等函數同時更新內存緩存和 Supabase（異步）

* 管理員修改產品後，所有設備刷新頁面即可看到最新數據



***

## Admin Panel 登錄



* 用戶名：`admin`

* 密碼：`abcd1234`

* 登錄後可在 **Admin Users** 頁面修改密碼或添加管理員



***

## 與舊版本（localStorage/GitHub）的對比



| 功能     | 舊版本               | Supabase 版本                               |
| ------ | ----------------- | ----------------------------------------- |
| 數據存儲   | 瀏覽器 localStorage  | Supabase 雲端數據庫                            |
| 多設備同步  | 需要手動 Cloud Sync   | 自動實時同步                                    |
| 客戶下單   | 只發郵件，後台看不到        | 訂單直接寫入數據庫，後台即時顯示                          |
| 管理員改產品 | 需要 Push to GitHub | 直接保存到 Supabase，即時生效                       |
| 圖片存儲   | GitHub repo       | 仍用本地 images/ 文件夾（未來可遷移到 Supabase Storage） |
| 用戶認證   | 自寫密碼驗證            | 自寫密碼驗證（未來可升級到 Supabase Auth）              |



***

## 常見問題

### Q：anon key 安全嗎？會被人看到嗎？

A：anon key 是公開的，設計上就是放在前端的。它的權限由 Supabase Row Level Security (RLS) 控制。當前設置為公開讀寫（方便批發網站使用），未來可以收緊為只有認證用戶可寫。

### Q：客戶下單後，管理員在哪裡看到訂單？

A：管理員登錄 Admin Panel → **Orders** 頁面，所有客戶訂單即時顯示。同時 Resend 郵件通知仍然生效。

### Q：如何修改產品？

A：管理員登錄 Admin Panel → **Products** → 新增 / 編輯 / 刪除產品，保存後自動同步到 Supabase，所有訪客刷新即可看到。

### Q：數據會丟失嗎？

A：Supabase 數據庫有自動備份（免費層保留 7 天）。建議定期在 Supabase Dashboard → Database → Backups 確認。

### Q：可以換成獨立表結構（products, orders 等）嗎？

A：可以。`setup.sql` 已包含獨立表定義。v2 版本需要改寫數據層函數，用 SQL 查詢替代 JSONB 讀寫。需要時可以告訴我。



***

## 技術棧



* **前端**：原生 HTML/CSS/JS（單文件，無框架）

* **後端**：Supabase（PostgreSQL + REST API）

* **郵件**：Resend（訂單確認 + 聯繫表單，經 Vercel Edge Function `/api/send-email` 代理發送）

* **PDF**：jsPDF + html2canvas（訂單 PDF 下載）

* **托管**：GitHub Pages / Netlify / 任何靜態托管



***

## 聯繫



* 公司：Nebula Secret

* 郵箱：sales@nebulasecret.com