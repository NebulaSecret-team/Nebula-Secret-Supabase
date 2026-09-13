# Nebula Secret - Supabase 安全配置指南

## 📋 概述

本文檔詳細說明如何配置 Supabase RLS（行級安全）策略和遷移到 Supabase Auth 認證系統。

---

## 📁 文件清單

| 文件 | 說明 |
|------|------|
| `sql/01_setup_rls.sql` | RLS 策略配置腳本 |
| `sql/02_setup_supabase_auth.sql` | Supabase Auth 遷移腳本 |

---

## 🔒 第一部分：RLS（行級安全）策略配置

### 執行步驟

#### 步驟 1：登入 Supabase Dashboard
1. 訪問 https://supabase.com/dashboard
2. 選擇你的項目（項目 ID: `xwhhsoppcpkijxxychjm`）

#### 步驟 2：打開 SQL Editor
1. 在左側菜單中點擊 **SQL Editor**
2. 點擊 **New query** 創建新查詢

#### 步驟 3：執行 RLS 配置腳本
1. 打開 `sql/01_setup_rls.sql` 文件
2. 複製全部內容
3. 粘貼到 SQL Editor 中
4. 點擊 **Run** 按鈕執行

#### 步驟 4：驗證 RLS 配置
執行以下 SQL 查詢驗證配置：

```sql
-- 查看已啟用 RLS 的表
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
ORDER BY tablename;

-- 查看所有 RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### RLS 策略說明

| 策略名稱 | 適用對象 | 權限 | 說明 |
|----------|----------|------|------|
| Public read access for non-sensitive data | anon, authenticated | SELECT | 公開讀取產品、分類、主題等非公開數據 |
| Authenticated users can read orders | authenticated | SELECT | 認證用戶可讀取訂單、報價、賬戶 |
| Admin can read all data | authenticated | SELECT | 管理員可讀取所有數據 |
| Admin can insert data | authenticated | INSERT | 管理員可插入數據 |
| Admin can update data | authenticated | UPDATE | 管理員可更新數據 |
| Admin can delete data | authenticated | DELETE | 管理員可刪除數據 |

### ⚠️ RLS 注意事項

1. **單表 JSONB 結構限制**：目前使用 `site_settings` 單表 JSONB 結構，RLS 無法精確控制 JSONB 內部的數據訪問。建議未來遷移到獨立的表。

2. **管理員驗證方式**：管理員驗證使用 `site_settings.admins` 中的 `user` 字段與 `auth.email()` 比對。如果使用 Supabase Auth，需要確保管理員的 email 與 `site_settings.admins` 中的 `user` 一致。

3. **測試 RLS**：建議在測試環境先測試 RLS 配置，確保不會影響正常功能。

---

## 🔐 第二部分：Supabase Auth 遷移

### 遷移前準備

#### 1. 備份數據
在執行遷移前，務必備份所有數據：
- 在 Supabase Dashboard → Settings → Database → Backups 中創建備份
- 或者導出 `site_settings` 表的所有數據

#### 2. 確認管理員郵箱
確認你要使用的管理員郵箱地址，這個郵箱將用於登錄後台。

### 執行步驟

#### 步驟 1：執行 Auth 配置腳本
1. 在 Supabase Dashboard 中打開 SQL Editor
2. 打開 `sql/02_setup_supabase_auth.sql` 文件
3. 複製全部內容
4. 粘貼到 SQL Editor 中
5. 點擊 **Run** 按鈕執行

#### 步驟 2：遷移現有客戶
執行以下 SQL 遷移現有客戶到 Supabase Auth：

```sql
-- 遷移客戶
SELECT public.migrate_customers_from_site_settings();
```

#### 步驟 3：遷移現有管理員
執行以下 SQL 遷移現有管理員到 Supabase Auth：

```sql
-- 遷移管理員
SELECT public.migrate_admins_from_site_settings();
```

#### 步驟 4：為遷移的用戶發送密碼重置郵件
由於密碼無法從舊系統遷移，需要為所有遷移的用戶發送密碼重置郵件：

1. 在 Supabase Dashboard → Authentication → Users 中
2. 找到遷移的用戶（可以通過 `migrated_from` 元數據識別）
3. 點擊用戶右側的 `...` → `Send password recovery`
4. 用戶會收到密碼重置郵件，點擊鏈接設置新密碼

#### 步驟 5：驗證遷移結果
執行以下 SQL 查詢驗證遷移結果：

```sql
-- 查看所有用戶
SELECT 
  u.id,
  u.email,
  COALESCE(p.name, split_part(u.email, '@', 1)) as name,
  COALESCE(p.role, 'customer') as role,
  u.email_confirmed_at,
  u.created_at,
  u.raw_user_meta_data->>'migrated_from' as migrated_from
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- 查看遷移的用戶
SELECT * FROM public.get_migrated_users();
```

### Supabase Auth 功能說明

| 功能 | 說明 |
|------|------|
| 用戶註冊 | 新用戶可以通過郵箱註冊，自動創建 profile |
| 用戶登錄 | 使用郵箱和密碼登錄 |
| 密碼重置 | 用戶可以通過郵件重置密碼 |
| 管理員邀請 | superadmin 可以邀請新管理員 |
| 角色管理 | 支持 customer, admin, superadmin 三種角色 |
| RLS 集成 | 可以基於用戶身份和角色控制數據訪問 |

### ⚠️ Supabase Auth 注意事項

1. **密碼無法遷移**：由於舊系統使用自定義的密碼哈希，無法直接遷移到 Supabase Auth。所有遷移的用戶需要重置密碼。

2. **管理員郵箱一致**：管理員的 email 需要與 `site_settings.admins` 中的 `user` 字段一致，否則 RLS 策略可能無法正確識別管理員。

3. **前端代碼更新**：遷移到 Supabase Auth 後，需要更新前端代碼，使用 Supabase Auth 的 API 替代自定義認證。

4. **電子郵件範本**：建議在 Supabase Dashboard → Authentication → Email Templates 中自定義郵件範本。

5. **SMTP 配置**：如果需要使用自定義 SMTP 服務器發送郵件，可以在 Supabase Dashboard → Authentication → Settings 中配置。

---

## 🧪 第三部分：測試清單

### RLS 測試清單

- [ ] 匿名用戶可以讀取產品、分類等公開數據
- [ ] 匿名用戶無法讀取訂單、用戶等敏感數據
- [ ] 認證用戶可以讀取自己的訂單
- [ ] 管理員可以讀取、插入、更新、刪除所有數據
- [ ] 非管理員無法修改產品、訂單等數據

### Supabase Auth 測試清單

- [ ] 新用戶可以註冊
- [ ] 註冊後自動創建 profile
- [ ] 用戶可以登錄
- [ ] 用戶可以重置密碼
- [ ] 管理員可以登錄後台
- [ ] superadmin 可以邀請新管理員
- [ ] 用戶只能查看自己的 profile
- [ ] 管理員可以查看所有 profile

---

## 🚨 常見問題

### Q1: 執行 RLS 腳本後，網站無法讀取數據怎麼辦？
A: 檢查 RLS 策略是否正確配置，確保匿名用戶有讀取公開數據的權限。可以暫時禁用 RLS 進行排查：
```sql
ALTER TABLE public.site_settings DISABLE ROW LEVEL SECURITY;
```

### Q2: 遷移用戶後，用戶無法登錄怎麼辦？
A: 遷移的用戶需要重置密碼。在 Supabase Dashboard → Authentication → Users 中為用戶發送密碼重置郵件。

### Q3: 管理員登錄後無法訪問後台怎麼辦？
A: 檢查管理員的 email 是否與 `site_settings.admins` 中的 `user` 字段一致。如果不一致，需要更新 `site_settings.admins` 中的數據。

### Q4: 如何回滾遷移？
A: 如果遷移出現問題，可以從備份恢復數據。建議在遷移前創建完整備份。

---

## 📞 支援

如果遇到問題，可以參考：
- Supabase 官方文檔：https://supabase.com/docs
- Supabase Auth 文檔：https://supabase.com/docs/guides/auth
- Supabase RLS 文檔：https://supabase.com/docs/guides/database/postgres/row-level-security

---

**最後更新：** 2026-09-13
**版本：** v1.0
