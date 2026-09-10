# Supabase Auth + RLS 設置指南

## 概述

本指南將幫助你在 Supabase 中啟用身份驗證（Auth）和行級安全（RLS），使你的網站更加安全。

完成設置後：
- 管理員登錄將使用 Supabase Auth（郵箱+密碼）
- 數據庫將啟用 RLS，限制匿名用戶的權限
- 發布在前端的 API key 將變得安全

---

## 第一步：啟用 Email 身份驗證提供者

1. 登錄 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的項目（Nebula Secret）
3. 在左側菜單中，點擊 **Authentication** → **Providers**
4. 找到 **Email** 提供者，點擊進入
5. 確保 **Enable Email provider** 已開啟（藍色開關）
6. **測試階段**：可以關閉 **Confirm email**（不需要郵箱驗證）
7. **生產環境**：建議開啟 **Confirm email**
8. 點擊 **Save** 保存

---

## 第二步：創建管理員用戶

1. 在左側菜單中，點擊 **Authentication** → **Users**
2. 點擊右上角的 **Add user** → **Add user with email**
3. 填寫以下信息：
   - **Email**: `admin@nebulasecret.com`（或你自己的郵箱）
   - **Password**: 設置一個強密碼（至少6位，建議12位以上）
   - **Email confirmed**: 勾選（測試階段）
4. 點擊 **Create user** 創建用戶

---

## 第三步：運行 SQL 腳本啟用 RLS

1. 在左側菜單中，點擊 **SQL Editor**
2. 點擊 **New query** 創建新查詢
3. 打開項目文件夾中的 `supabase_auth_rls_setup.sql` 文件
4. 複製整個文件的內容
5. 粘貼到 SQL Editor 中
6. 點擊 **Run**（或按 Ctrl+Enter）執行
7. 等待執行完成，應該顯示 **Success**

### 驗證 RLS 是否已啟用

在 SQL Editor 中運行以下查詢：

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'site_settings';
```

如果 `rowsecurity` 顯示 `true`，表示 RLS 已啟用。

---

## 第四步：設置管理員角色

1. 在 SQL Editor 中，創建新查詢
2. 運行以下 SQL（將 `admin@nebulasecret.com` 替換為你在第二步創建的管理員郵箱）：

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb
)
WHERE email = 'admin@nebulasecret.com';
```

3. 點擊 **Run** 執行
4. 驗證是否成功：

```sql
SELECT email, raw_app_meta_data 
FROM auth.users 
WHERE email = 'admin@nebulasecret.com';
```

如果 `raw_app_meta_data` 顯示 `{"role": "admin"}`，表示設置成功。

---

## 第五步：測試管理員登錄

1. 打開你的網站（本地或 Vercel 部署的版本）
2. 訪問 `#/admin`（例如 `http://localhost:8080/#/admin`）
3. 你應該看到新的登錄頁面，包含：
   - Email 輸入框（原來是 Login name）
   - Password 輸入框
   - "Secure login powered by Supabase Auth" 提示
4. 輸入你在第二步創建的管理員郵箱和密碼
5. 點擊 **Sign in**
6. 如果登錄成功，你應該被重定向到管理員儀表盤

---

## 常見問題

### Q: 登錄時顯示 "Invalid login credentials"
A: 檢查以下幾點：
1. 郵箱和密碼是否正確
2. 用戶是否已在 Authentication → Users 中創建
3. 用戶的 email 是否已確認（如果開啟了 Confirm email）

### Q: 登錄成功但顯示 "You do not have admin access"
A: 管理員角色未設置正確。重新執行第四步的 SQL，確保郵箱地址正確。

### Q: 啟用 RLS 後，前台頁面無法加載產品
A: 檢查 RLS 策略是否正確設置。運行以下 SQL 查看所有策略：

```sql
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'site_settings';
```

確保存在 "Public read access to public data" 策略。

### Q: 客戶無法下單
A: 檢查是否存在 "Public write access to orders" 策略。如果沒有，重新運行 `supabase_auth_rls_setup.sql`。

### Q: 忘記管理員密碼怎麼辦？
A: 
1. 到 Supabase Dashboard → Authentication → Users
2. 找到管理員用戶，點擊右側的 `...` 菜單
3. 選擇 **Send password recovery** 或 **Reset password**
4. 按照郵箱中的提示重置密碼

---

## 安全建議

### 生產環境建議

1. **開啟 Email 確認**：Authentication → Providers → Email → Confirm email
2. **使用強密碼**：管理員密碼至少12位，包含大小寫字母、數字和特殊字符
3. **啟用 2FA**：Supabase Auth 支持雙因素認證（需要企業版）
4. **定期更換密碼**：建議每3-6個月更換一次管理員密碼
5. **監控異常登錄**：定期檢查 Authentication → Audit logs

### RLS 策略說明

啟用 RLS 後，不同用戶的權限如下：

| 數據類型 | 匿名用戶（讀取） | 匿名用戶（寫入） | 管理員（讀取） | 管理員（寫入） |
|---------|-----------------|-----------------|---------------|---------------|
| products | ✅ | ❌ | ✅ | ✅ |
| cats | ✅ | ❌ | ✅ | ✅ |
| theme | ✅ | ❌ | ✅ | ✅ |
| content | ✅ | ❌ | ✅ | ✅ |
| orders | ✅ | ✅ | ✅ | ✅ |
| accounts | ✅ | ✅ | ✅ | ✅ |
| admins | ❌ | ❌ | ✅ | ✅ |

---

## 回滾方案

如果啟用 RLS 後出現問題，可以暫時禁用 RLS：

```sql
ALTER TABLE site_settings DISABLE ROW LEVEL SECURITY;
```

然後排查問題，解決後再重新啟用：

```sql
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
```

---

## 下一步

完成以上設置後，你的網站將變得更加安全。建議：

1. 測試所有前台功能（產品瀏覽、購物車、下單）
2. 測試所有管理員功能（產品管理、訂單管理、主題設置）
3. 測試客戶註冊和登錄
4. 定期檢查 Supabase Dashboard 中的日志和監控

如有任何問題，請參考常見問題部分，或聯繫技術支持。
