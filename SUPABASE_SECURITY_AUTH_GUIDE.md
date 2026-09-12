# Supabase Security & Auth Migration Guide

## Overview

This guide covers two important security improvements for your Nebula Secret website:

1. **Row Level Security (RLS)**: Protect your database from unauthorized access
2. **Supabase Auth Migration**: Use Supabase's built-in authentication instead of custom auth

## Current State

### Database Structure
- Single table: `site_settings` with JSONB data
- Keys: `products`, `cats`, `theme`, `content`, `orders`, `accounts`, `admins`, `quotes`
- **RLS Status**: Not enabled (anyone with the public key can read/write all data)

### Authentication
- **Admin auth**: Custom implementation with usernames/passwords stored in database
- **Customer auth**: Custom implementation with usernames/passwords stored in database
- **Password storage**: Hashed with SHA-256 (not ideal, should use bcrypt/argon2)
- **Sessions**: Stored in localStorage (not secure)

## Part 1: Enable Row Level Security (RLS)

### Why RLS?

Without RLS, anyone who gets your Supabase public key can:
- Read all customer accounts and passwords
- Read all orders and customer information
- Modify or delete any data
- Access admin credentials

RLS allows you to define who can read and write which data, even if they have the public key.

### Step 1: Enable RLS on site_settings table

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (xwhhsoppcpkijxxychjm)
3. Go to **SQL Editor**
4. Create a new query and run:

```sql
-- Enable RLS on site_settings table
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Create policy: Allow public read access to products, cats, theme, content
-- These are public-facing data that anyone can view
CREATE POLICY "Public read access for storefront data"
  ON site_settings
  FOR SELECT
  USING (
    id IN ('products', 'cats', 'theme', 'content')
  );

-- Create policy: Allow authenticated users to read their own orders
-- Note: This requires Supabase Auth (see Part 2)
CREATE POLICY "Users can read their own orders"
  ON site_settings
  FOR SELECT
  USING (
    id = 'orders'
    AND auth.role() = 'authenticated'
  );

-- Create policy: Allow service role to do everything
-- This is for your backend/Edge Functions
CREATE POLICY "Service role full access"
  ON site_settings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Step 2: Create separate tables for sensitive data (Recommended)

The current single-table design is not ideal for RLS. It's better to create separate tables:

```sql
-- Create products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC,
  image TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  order_number TEXT UNIQUE,
  status TEXT DEFAULT 'New',
  total NUMERIC,
  currency TEXT DEFAULT 'EUR',
  items JSONB,
  customer_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create accounts table (for customer profiles)
CREATE TABLE customer_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admins table
CREATE TABLE admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Products: Public read access
CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT USING (true);

-- Products: Only admins can insert/update/delete
CREATE POLICY "Only admins can modify products"
  ON products FOR ALL
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Orders: Users can read their own orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid());

-- Orders: Users can create their own orders
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Orders: Admins can view and update all orders
CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Customer profiles: Users can read/update their own profile
CREATE POLICY "Users can manage their own profile"
  ON customer_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Customer profiles: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON customer_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()));

-- Admins: Only admins can view admin list
CREATE POLICY "Admins can view admin list"
  ON admins FOR SELECT
  USING (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()));
```

### Step 3: Update frontend to use new table structure

This requires significant code changes. For now, you can:
1. Keep using `site_settings` table with RLS policies
2. Gradually migrate to separate tables

## Part 2: Migrate to Supabase Auth

### Why Supabase Auth?

Current custom auth issues:
1. **Password hashing**: SHA-256 is not secure for passwords (should use bcrypt/argon2)
2. **Session management**: localStorage sessions can be stolen
3. **No password reset**: Customers cannot reset their passwords
4. **No email verification**: No way to verify customer emails
5. **Security vulnerabilities**: Custom auth is more prone to bugs

Supabase Auth provides:
1. **Secure password hashing**: Uses bcrypt by default
2. **JWT tokens**: Secure session management
3. **Password reset**: Built-in password reset flow
4. **Email verification**: Optional email verification
5. **OAuth providers**: Google, GitHub, etc.
6. **Magic links**: Passwordless login
7. **RLS integration**: Works seamlessly with RLS policies

### Step 1: Enable Email Auth in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Providers**
4. Enable **Email** provider
5. Configure:
   - **Confirm email**: Optional (recommended for production)
   - **Secure password change**: Enable
   - **Allow new users to sign up**: Enable

### Step 2: Create admin users

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter admin email and password
4. After creating, get the user's UUID
5. Add to admins table:

```sql
-- Insert admin user (replace with actual user UUID)
INSERT INTO admins (user_id, username, role)
VALUES ('USER_UUID_HERE', 'admin', 'superadmin');
```

### Step 3: Update frontend authentication code

This requires significant changes. Here's a high-level overview:

#### Current flow:
1. User enters email/password
2. Frontend hashes password with SHA-256
3. Frontend compares with stored hash in database
4. Frontend stores session in localStorage

#### New flow:
1. User enters email/password
2. Frontend calls `supabase.auth.signInWithPassword({ email, password })`
3. Supabase verifies credentials and returns JWT token
4. Supabase SDK stores token securely (in memory + localStorage)
5. All subsequent API calls include JWT token automatically

### Step 4: Customer registration

```javascript
// Current custom registration
async function acctRegister() {
  // ... custom logic ...
  accs.push({ name, email, pass: hash, created: new Date().toISOString() });
  saveAccounts(accs);
  setSession({ name, email });
}

// New Supabase Auth registration
async function acctRegister() {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: pass,
    options: {
      data: {
        name: name,
      }
    }
  });
  
  if (error) {
    showToast(error.message);
    return;
  }
  
  // Create customer profile
  await supabase.from('customer_profiles').insert({
    user_id: data.user.id,
    name: name,
    email: email,
  });
  
  showToast("Welcome, " + name.split(" ")[0] + "!");
  route();
}
```

### Step 5: Customer login

```javascript
// Current custom login
async function acctLogin() {
  const acc = getAccounts().find(a => a.email === email);
  const hash = await hashPass(pass);
  if (hash !== acc.pass) { /* error */ }
  setSession({ name: acc.name, email: acc.email });
}

// New Supabase Auth login
async function acctLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: pass,
  });
  
  if (error) {
    showToast(error.message);
    return;
  }
  
  showToast("Signed in as " + data.user.user_metadata.name);
  route();
}
```

### Step 6: Admin login

```javascript
// Current custom admin login
async function adminLogin() {
  const admins = getAdmins();
  const admin = admins.find(a => a.u === username);
  // ... custom verification ...
}

// New Supabase Auth admin login
async function adminLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  
  if (error) {
    showToast(error.message);
    return;
  }
  
  // Verify user is an admin
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('*')
    .eq('user_id', data.user.id)
    .single();
  
  if (adminError || !adminData) {
    await supabase.auth.signOut();
    showToast("You are not authorized as admin");
    return;
  }
  
  showToast("Welcome, Admin!");
  route('#/admin/dashboard');
}
```

## Part 3: Migration Plan

### Phase 1: Enable RLS (1-2 hours)
1. Enable RLS on `site_settings` table
2. Create basic RLS policies
3. Test that website still works
4. Test that unauthorized access is blocked

### Phase 2: Set up Supabase Auth (2-4 hours)
1. Enable Email Auth provider
2. Create admin users in Supabase Auth
3. Update admin login to use Supabase Auth
4. Test admin login

### Phase 3: Migrate customer auth (4-8 hours)
1. Update customer registration to use Supabase Auth
2. Update customer login to use Supabase Auth
3. Add password reset functionality
4. Migrate existing customer accounts (optional)
5. Test customer auth flows

### Phase 4: Create separate tables (8-16 hours)
1. Create separate tables for products, orders, accounts, admins
2. Write migration scripts to move data from `site_settings`
3. Update frontend to use new tables
4. Update RLS policies for new tables
5. Test all functionality

### Phase 5: Security hardening (2-4 hours)
1. Enable email verification
2. Set up rate limiting
3. Add audit logging
4. Review and tighten RLS policies
5. Security testing

## Important Considerations

### Breaking Changes
- Migrating to Supabase Auth will break existing customer sessions
- Customers will need to reset their passwords
- Admin login will change from username to email

### Data Migration
- Existing customer passwords cannot be migrated (SHA-256 vs bcrypt)
- Customers will need to use "Forgot Password" to set new passwords
- Order history can be migrated by linking orders to new user IDs

### Backward Compatibility
- Keep custom auth as fallback during migration
- Use feature flags to gradually roll out Supabase Auth
- Provide clear instructions to customers

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JavaScript SDK](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth Quickstart](https://supabase.com/docs/guides/auth/quickstart)

## Support

For help with migration:
1. Review this guide thoroughly
2. Test in a development environment first
3. Back up your database before migration
4. Contact Supabase support if needed
5. Consider hiring a developer for complex migrations
