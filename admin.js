/* ============================================================
 * Nebula Secret - Admin Panel Module
 * ============================================================
 * This file contains all admin panel functionality.
 * It is lazy-loaded only when a user navigates to #/admin.
 * 
 * Dependencies (global variables from index.html):
 * - $, $$, esc, escJs, slugify, fmt, fmtD, imgUrl, imgFallback
 * - getProducts, getCats, getOrders, getAccounts, getAdmins, getTheme, getContent
 * - saveProducts, saveCats, saveOrders, saveAccounts, saveAdmins, saveTheme, saveContent
 * - supabase, _cache, sbSave, sbLoadAll
 * - IC (icons), LS (localStorage keys), PLACEHOLDER, CURRENCIES
 * - showToast, closeCart, closeCheckout, closeAdminModal, closeMegaMenu
 * - isAdmin, getAdminSession, setAdminSession, validateAdminSession, adminLoginUser
 * - hashPass, verifyPass, sanitizeHTML
 * - sendOrderEmail, exportOrdersCSV
 * ============================================================ */

/* ============ Supabase Auth State Management ============ */
let _currentAdminUser = null;

/* ============ Activity Log System ============ */
/* Log an activity to site_settings.activity_log */
async function logActivity(type, text, color, icon) {
  try {
    const key = 'activity_log';
    let logs = [];
    // Try to load existing logs from Supabase
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase.from('site_settings').select('data').eq('id', key).single();
      if (!error && data && data.data) {
        logs = Array.isArray(data.data) ? data.data : [];
      }
    }
    // Add new activity
    logs.unshift({
      type: type,
      text: text,
      color: color || '#6b7280',
      icon: icon || IC.info,
      time: new Date().toISOString()
    });
    // Keep only last 50
    logs = logs.slice(0, 50);
    // Save
    if (typeof sbSave !== 'undefined') {
      sbSave(key, logs);
    }
    // Also update cache if available
    if (typeof _cache !== 'undefined') {
      _cache.activityLog = logs;
    }
  } catch(e) {
    console.warn('Failed to log activity:', e);
  }
}

/* Get activity log */
function getActivityLog() {
  if (typeof _cache !== 'undefined' && _cache.activityLog) {
    return _cache.activityLog;
  }
  return [];
}

/* Listen for auth state changes */
if(typeof supabase !== 'undefined' && supabaseAvailable && supabase.auth) {
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if(session && session.user) {
        _currentAdminUser = session.user;
      } else {
        _currentAdminUser = null;
      }
    });
    /* Get initial session - with error handling for CORS/domain issues */
    supabase.auth.getSession().then(({ data: { session } }) => {
      if(session && session.user) {
        _currentAdminUser = session.user;
      }
    }).catch(e => {
      console.warn("Failed to get initial Supabase Auth session (may be CORS or domain config):", e.message);
    });
  } catch(e) {
    console.warn("Supabase Auth initialization failed:", e.message);
  }
}

/* Get current admin display name */
function getAdminDisplayName() {
  if(_currentAdminUser) {
    return _currentAdminUser.user_metadata?.name || _currentAdminUser.email || 'Admin';
  }
  /* Fallback to legacy session */
  const legacy = getAdminSession();
  return (legacy && legacy.name) || 'Admin';
}

/* ============ ADMIN ============ */

function renderAdminShell(content){
  const inner = content;
  $("#app").innerHTML =
  '<div class="admin-shell">' +
    '<aside class="admin-side">' +
      '<div class="as-brand">' +
        '<img src="images/Neubla_logo_black_1729172124.png" alt="Nebula Secret">' +
        '<span class="t">Admin Panel<small>Nebula Secret</small></span>' +
      '</div>' +
      '<nav class="admin-nav">' +
        '<a href="#/admin/dashboard" data-av="dashboard" class="active">' + IC.dashboard + ' Dashboard</a>' +
        '<a href="#/admin/orders" data-av="orders">' + IC.orders + ' Orders</a>' +
        '<a href="#/admin/quotes" data-av="quotes">' + IC.mail + ' Quotes & Enquiries</a>' +
        '<a href="#/admin/products" data-av="products">' + IC.box + ' Products</a>' +
        '<a href="#/admin/categories" data-av="categories">' + IC.tag + ' Categories</a>' +
        '<a href="#/admin/customers" data-av="customers">' + IC.users + ' Customer Accounts</a>' +
        '<a href="#/admin/tiers" data-av="tiers">' + IC.tag + ' Customer Tiers</a>' +
        '<a href="#/admin/theme" data-av="theme">' + IC.palette + ' Theme</a>' +
        '<a href="#/admin/emails" data-av="emails">' + IC.mail + ' Order Emails</a>' +
        '<a href="#/admin/content" data-av="content">' + IC.edit + ' Site Content</a>' +
        '<div class="sep"></div>' +
        '<a href="#/admin/users" data-av="users">' + IC.shield + ' Admin Users</a>' +
        '<a href="#/admin/analytics" data-av="analytics">' + IC.chart + ' Analytics</a>' +
        '<a href="#/admin/architecture" data-av="architecture">' + IC.chart + ' System Architecture</a>' +
        '<a href="#/" >' + IC.store + ' View Store</a>' +
        '<a href="javascript:logout()">' + IC.logout + ' Logout</a>' +
      '</nav>' +
    '</aside>' +
    '<div class="admin-main">' +
      '<div class="admin-top"><h2 id="adminTitle"></h2><div class="at-actions"><span class="at-user" style="font-size:13px;color:var(--ink-soft);margin-right:12px">' + esc(getAdminDisplayName()) + '</span><a class="btn ghost sm" href="#/">View Store</a></div></div>' +
      '<div class="admin-body">' + inner + '</div>' +
    '</div>' +
  '</div>';
  // mark active nav
  const av = location.hash.split("/")[2] || "dashboard";
  $$("[data-av]").forEach(a => a.classList.toggle("active", a.dataset.av === av));
}

function adminDashboard(){
  const products = getProducts(); const cats = getCats(); const orders = getOrders();
  const accounts = getAccounts ? getAccounts() : [];
  const quotes = getQuotes ? getQuotes() : [];
  const revenue = orders.filter(o => o.status !== "Cancelled").reduce((s,o) => s + Number(o.total || 0), 0);
  const recentOrders = orders.slice(0, 6);
  
  // Get actual accent color for activity icons
  let accentColor = '#8b5cf6';
  try {
    const styles = getComputedStyle(document.documentElement);
    const cssAccent = styles.getPropertyValue('--accent').trim();
    if (cssAccent && cssAccent.startsWith('#')) {
      accentColor = cssAccent;
    }
  } catch(e) {}
  
  // Build recent activity feed
  const activities = [];
  
  // 0. Manual activity log (deletes, etc.)
  const activityLog = getActivityLog();
  activityLog.forEach(a => {
    activities.push({ 
      type: a.type || 'activity', 
      icon: a.icon || IC.info, 
      text: a.text, 
      time: a.time, 
      color: a.color || '#6b7280' 
    });
  });
  
  // 1. Order status changes (from statusHistory)
  orders.forEach(o => {
    if (o.statusHistory && o.statusHistory.length) {
      o.statusHistory.forEach(h => {
        const statusColor = orderStatusColor(h.status) || 'gray';
        activities.push({ 
          type: 'status', 
          icon: IC.sync, 
          text: 'Order <strong>' + esc(o.id) + '</strong> → <span class="pill ' + statusColor + '" style="font-size:10px;padding:2px 8px">' + esc(h.status) + '</span>', 
          time: h.date || o.date, 
          color: '#8b5cf6' 
        });
      });
    } else {
      // No status history - show order placed as initial status
      activities.push({ 
        type: 'order', 
        icon: IC.orders, 
        text: 'Order <strong>' + esc(o.id) + '</strong> placed by ' + esc(custName(o)), 
        time: o.date, 
        color: '#3b82f6' 
      });
    }
  });
  
  // 2. Quote status changes
  if (quotes && quotes.length) {
    quotes.forEach(q => {
      const qStatus = q.status || 'Pending';
      const qColor = qStatus === 'Accepted' ? '#10b981' : (qStatus === 'Rejected' ? '#ef4444' : '#f59e0b');
      activities.push({ 
        type: 'quote', 
        icon: IC.doc, 
        text: 'Quote <strong>' + esc(q.id || 'New') + '</strong> → <span style="color:' + qColor + ';font-weight:600">' + esc(qStatus) + '</span>' + (q.customerEmail ? ' by ' + esc(q.customerEmail) : ''), 
        time: q.updatedAt || q.date || q.createdAt || Date.now(), 
        color: qColor 
      });
    });
  }
  
  // 3. Customer logins (from lastLogin or last_login)
  if (accounts && accounts.length) {
    accounts.forEach(a => {
      const loginTime = a.lastLogin || a.last_login || a.lastSignIn;
      if (loginTime) {
        activities.push({ 
          type: 'login', 
          icon: IC.user, 
          text: 'Customer <strong>' + esc(a.name || a.email || a.u) + '</strong> signed in', 
          time: loginTime, 
          color: '#06b6d4' 
        });
      }
    });
  }
  
  // 4. Customer registrations (support multiple field names)
  if (accounts && accounts.length) {
    accounts.forEach(a => {
      const regTime = a.createdAt || a.ts || a.created || a.created_at || a.registeredAt;
      if (regTime) {
        activities.push({ 
          type: 'account', 
          icon: IC.user, 
          text: 'New customer registered: <strong>' + esc(a.name || a.email || a.u) + '</strong>', 
          time: regTime, 
          color: '#10b981' 
        });
      }
    });
  }
  
  // 5. Product additions (support multiple field names)
  products.forEach(p => {
    const prodTime = p.createdAt || p.created_at || p.created || p.addedAt || p.dateAdded;
    if (prodTime) {
      activities.push({ 
        type: 'product', 
        icon: IC.box, 
        text: 'Product added: <strong>' + esc(p.n || p.name) + '</strong>', 
        time: prodTime, 
        color: accentColor 
      });
    }
  });
  
  // Sort by time (newest first) and take top 50 for filtering
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  window._dashboardActivities = activities; // Save for filtering
  const recentActivity = activities.slice(0, 12);
  
  // Get unique activity types for filter
  const activityTypes = [...new Set(activities.map(a => a.type))].sort();
  
  const content =
    '<div class="stat-grid">' +
      '<div class="stat-card"><span class="s-icon">' + IC.box + '</span><div class="s-label">Total Products</div><div class="s-value">' + products.length + '</div><div class="s-sub">All products from catalog</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.tag + '</span><div class="s-label">Categories</div><div class="s-value">' + cats.length + '</div><div class="s-sub">Manageable in Categories</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.orders + '</span><div class="s-label">Orders</div><div class="s-value">' + orders.length + '</div><div class="s-sub"><a href="#/admin/orders" style="color:var(--accent)">View orders &amp; export Excel</a></div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.chart + '</span><div class="s-label">Revenue</div><div class="s-value">' + fmt(revenue) + '</div><div class="s-sub">From ' + orders.filter(o => o.status !== "Cancelled").length + ' active orders</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.user + '</span><div class="s-label">Customers</div><div class="s-value">' + (accounts.length || 0) + '</div><div class="s-sub"><a href="#/admin/customers" style="color:var(--accent)">Manage customers</a></div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.doc + '</span><div class="s-label">Quotes</div><div class="s-value">' + (quotes.length || 0) + '</div><div class="s-sub"><a href="#/admin/quotes" style="color:var(--accent)">View quotes &amp; enquiries</a></div></div>' +
    '</div>' +
    // AI Operational Summary
    '<div class="admin-panel"><div class="panel-head"><div><h3>🤖 AI Operations Summary</h3><div class="ph-sub">Gemini analyzes orders, revenue and pending tasks for today, then offers suggestions (for reference only — no data is modified)</div></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<button class="btn sm" onclick="aiDashboardSummary(this)">🤖 Generate Summary</button>' +
        '<button class="btn sm ghost" onclick="copyAiSummary()" style="display:none" id="aiCopyBtn">Copy</button>' +
      '</div></div>' +
    '<div class="panel-body" id="aiSummaryBox" style="display:none;font-size:13.5px;line-height:1.7;color:var(--ink);white-space:pre-wrap"></div></div>' +
    // Recent Activity
    '<div class="admin-panel"><div class="panel-head"><div><h3>Recent Activity</h3><div class="ph-sub">Latest additions and changes across your store</div></div>' +
    '<select id="activityFilter" onchange="filterDashboardActivity(this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--card);color:var(--ink);cursor:pointer">' +
      '<option value="all">All Types</option>' +
      activityTypes.map(t => '<option value="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>').join("") +
    '</select></div>' +
    '<div class="panel-body" style="padding:0" id="activityList">' +
      (recentActivity.length
        ? '<div style="display:flex;flex-direction:column;gap:0">' +
            recentActivity.map(a => {
              const timeAgo = formatTimeAgo(a.time);
              return '<div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--line);transition:background .15s" onmouseover="this.style.background=\'var(--bg-soft)\'" onmouseout="this.style.background=\'transparent\'">' +
                '<div style="width:32px;height:32px;border-radius:8px;background:' + a.color + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:' + a.color + ';stroke:' + a.color + ';font-size:14px">' + a.icon.replace('<svg', '<svg width="18" height="18"') + '</div>' +
                '<div style="flex:1;min-width:0"><div style="font-size:13px;color:var(--ink);line-height:1.35">' + a.text + '</div>' +
                '<div style="font-size:11px;color:var(--ink-soft);margin-top:1px">' + timeAgo + '</div></div>' +
                '<span class="pill ' + a.type + '" style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0;padding:3px 8px">' + a.type + '</span>' +
              '</div>';
            }).join("") +
          '</div>'
        : '<div style="padding:20px;font-size:13.5px;color:var(--ink-soft)">No recent activity yet.</div>') +
    '</div></div>' +
    // Recent Products
    '<div class="admin-panel"><div class="panel-head"><div><h3>Recent Products</h3><div class="ph-sub">Latest additions to your store</div></div><a class="btn sm" href="#/admin/products">Manage Products</a></div>' +
    '<div class="panel-body" style="padding:0"><table class="admin-table"><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Status</th></tr></thead><tbody>' +
    products.slice(-6).reverse().map(p => '<tr><td><img class="td-img" src="' + imgUrl(p.i, 100) + '" alt="" data-pid="' + p.id + '" onerror="imgFallback(this)"></td><td style="font-weight:600">' + esc(p.n) + '</td><td><span class="pill">' + esc(catName(p.cs)) + '</span></td><td>' + fmt(p.p) + '</td><td><span class="pill green">Visible</span></td></tr>').join("") +
    '</tbody></table></div></div>' +
    // Recent Orders
    '<div class="admin-panel"><div class="panel-head"><div><h3>Recent Orders</h3><div class="ph-sub">Latest customer orders</div></div><a class="btn sm" href="#/admin/orders">All Orders</a></div>' +
    (recentOrders.length
      ? '<div class="panel-body" style="padding:0"><table class="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
        recentOrders.map(o => '<tr><td style="font-weight:600">' + esc(o.id) + '</td><td style="white-space:nowrap">' + new Date(o.date).toLocaleDateString() + '</td><td>' + esc(custName(o)) + '</td><td>' + o.items.reduce((s,i) => s + i.qty, 0) + '</td><td>' + fmt(o.total) + '</td><td><span class="pill ' + orderStatusColor(o.status) + '">' + esc(o.status) + '</span></td></tr>').join("") +
        '</tbody></table></div>'
      : '<div class="panel-body"><div style="font-size:13.5px;color:var(--ink-soft);padding:8px 0">No orders yet. Place an order on the storefront and it will appear here.</div></div>') +
    '</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Dashboard";
}

// Helper: format time ago
function formatTimeAgo(timestamp){
  try {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' min ago';
    if (hours < 24) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
    if (days < 7) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    return new Date(timestamp).toLocaleDateString();
  } catch(e) {
    return 'Recently';
  }
}

/* ---- Analytics admin ---- */
async function adminAnalytics(){
  $("#adminTitle").textContent = "Site Analytics";
  
  /* Show loading state */
  renderAdminShell('<div class="admin-panel"><div class="panel-body" style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">📊</div><h3>Loading analytics...</h3><p style="color:var(--ink-soft)">Fetching visitor data from database</p></div></div>');
  
  try {
    /* Get analytics data from Supabase */
    let allRecords = [];
    if(supabase){
      /* Get all records (limit to last 10000 for performance) */
      const { data, error } = await supabase
        .from('site_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);
      
      if(error){
        console.warn("Analytics fetch error:", error);
      } else {
        allRecords = data || [];
      }
    }
    
    /* Calculate statistics */
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    /* Filter records by time period */
    const todayRecords = allRecords.filter(r => new Date(r.created_at) >= todayStart);
    const weekRecords = allRecords.filter(r => new Date(r.created_at) >= weekStart);
    const monthRecords = allRecords.filter(r => new Date(r.created_at) >= monthStart);
    
    /* Calculate unique visitors (by session_id) */
    const uniqueSessions = new Set(allRecords.map(r => r.session_id));
    const todaySessions = new Set(todayRecords.map(r => r.session_id));
    const weekSessions = new Set(weekRecords.map(r => r.session_id));
    const monthSessions = new Set(monthRecords.map(r => r.session_id));
    
    /* Calculate page views */
    const totalPageViews = allRecords.length;
    const todayPageViews = todayRecords.length;
    const weekPageViews = weekRecords.length;
    const monthPageViews = monthRecords.length;
    
    /* Calculate top pages */
    const pageCounts = {};
    allRecords.forEach(r => {
      const page = r.page || 'unknown';
      pageCounts[page] = (pageCounts[page] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    /* Calculate device breakdown */
    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    allRecords.forEach(r => {
      const device = r.device_type || 'unknown';
      if(deviceCounts[device] !== undefined) deviceCounts[device]++;
      else deviceCounts.unknown++;
    });
    
    /* Calculate last 7 days trend */
    const dailyData = [];
    for(let i = 6; i >= 0; i--){
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayRecords = allRecords.filter(r => {
        const d = new Date(r.created_at);
        return d >= dayStart && d < dayEnd;
      });
      const daySessions = new Set(dayRecords.map(r => r.session_id));
      dailyData.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        pageViews: dayRecords.length,
        visitors: daySessions.size
      });
    }
    
    /* Calculate referrer sources */
    const referrerCounts = {};
    allRecords.forEach(r => {
      let source = 'Direct';
      if(r.referrer){
        try {
          const url = new URL(r.referrer);
          source = url.hostname.replace('www.', '');
        } catch(e) {
          source = 'Other';
        }
      }
      referrerCounts[source] = (referrerCounts[source] || 0) + 1;
    });
    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    
    /* Build page name mapping for display */
    const pageDisplayNames = {
      'home': '🏠 Home Page',
      'shop': '🛍️ Shop',
      'account': '👤 My Account',
      'about': 'ℹ️ About Us',
      'why-us': '⭐ Why Us',
      'blog': '📝 Blog',
      'cart': '🛒 Shopping Cart',
      'checkout': '💳 Checkout',
      'info': '❓ Info / FAQ'
    };
    
    const getPageDisplayName = (page) => {
      if(pageDisplayNames[page]) return pageDisplayNames[page];
      if(page.startsWith('shop-')) return '🛍️ Category: ' + page.replace('shop-', '');
      if(page.startsWith('product-')) return '📦 Product #' + page.replace('product-', '');
      if(page.startsWith('quote-')) return '📄 Quote ' + page.replace('quote-', '');
      if(page.startsWith('order-')) return '📋 Order ' + page.replace('order-', '');
      return page.charAt(0).toUpperCase() + page.slice(1);
    };
    
    /* Build the analytics dashboard HTML */
    const maxDailyViews = Math.max(...dailyData.map(d => d.pageViews), 1);
    const maxPageViews = topPages.length > 0 ? topPages[0][1] : 1;
    const hasData = allRecords.length > 0;
    
    /* SVG Icons */
    const icons = {
      users: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      eye: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      trending: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
      barChart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
      award: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
      smartphone: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      monitor: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      tablet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      globe: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
    };
    
    const content = 
    '<div class="admin-panel">' +
      '<div class="panel-head">' +
        '<div><h3>Site Analytics</h3><div class="ph-sub">Track visitor traffic and page views in real-time</div></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn sm ghost" onclick="adminAnalytics()" style="display:flex;align-items:center;gap:6px">' + icons.refresh + ' Refresh</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-body">' +
        
        /* Stat Cards - Premium dark/neutral colors */
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">' +
          '<div class="stat-card" style="background:linear-gradient(135deg,#2d3748,#1a202c);position:relative;overflow:hidden;border:none">' +
            '<div style="position:absolute;top:-10px;right:-10px;opacity:0.08;color:white;transform:scale(2.5)">' + icons.users + '</div>' +
            
            '<div class="s-label" style="color:rgba(255,255,255,0.6);position:relative;z-index:1">Total Visitors</div>' +
            '<div class="s-value" style="color:white;position:relative;z-index:1">' + uniqueSessions.size + '</div>' +
            '<div class="s-sub" style="color:rgba(255,255,255,0.45);position:relative;z-index:1">Unique sessions</div>' +
          '</div>' +
          '<div class="stat-card" style="background:linear-gradient(135deg,#2c5282,#1a365d);position:relative;overflow:hidden;border:none">' +
            '<div style="position:absolute;top:-10px;right:-10px;opacity:0.08;color:white;transform:scale(2.5)">' + icons.eye + '</div>' +
            
            '<div class="s-label" style="color:rgba(255,255,255,0.6);position:relative;z-index:1">Total Page Views</div>' +
            '<div class="s-value" style="color:white;position:relative;z-index:1">' + totalPageViews + '</div>' +
            '<div class="s-sub" style="color:rgba(255,255,255,0.45);position:relative;z-index:1">All time</div>' +
          '</div>' +
          '<div class="stat-card" style="background:linear-gradient(135deg,#285e61,#1a4749);position:relative;overflow:hidden;border:none">' +
            '<div style="position:absolute;top:-10px;right:-10px;opacity:0.08;color:white;transform:scale(2.5)">' + icons.calendar + '</div>' +
            
            '<div class="s-label" style="color:rgba(255,255,255,0.6);position:relative;z-index:1">Today</div>' +
            '<div class="s-value" style="color:white;position:relative;z-index:1">' + todaySessions.size + '</div>' +
            '<div class="s-sub" style="color:rgba(255,255,255,0.45);position:relative;z-index:1">Visitors · ' + todayPageViews + ' views</div>' +
          '</div>' +
          '<div class="stat-card" style="background:linear-gradient(135deg,#553c9a,#322659);position:relative;overflow:hidden;border:none">' +
            '<div style="position:absolute;top:-10px;right:-10px;opacity:0.08;color:white;transform:scale(2.5)">' + icons.trending + '</div>' +
            
            '<div class="s-label" style="color:rgba(255,255,255,0.6);position:relative;z-index:1">This Week</div>' +
            '<div class="s-value" style="color:white;position:relative;z-index:1">' + weekSessions.size + '</div>' +
            '<div class="s-sub" style="color:rgba(255,255,255,0.45);position:relative;z-index:1">Visitors · ' + weekPageViews + ' views</div>' +
          '</div>' +
        '</div>' +
        
        /* Last 7 Days Trend */
        '<div style="background:var(--card);border:1px solid var(--border);border-left:4px solid #553c9a;border-radius:12px;padding:20px;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
            '<div style="width:44px;height:44px;background:linear-gradient(135deg,#553c9a,#322659);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#b794f4">' + icons.barChart + '</div>' +
            '<div>' +
              '<h4 style="margin:0;font-size:16px;color:var(--ink)">Last 7 Days Traffic</h4>' +
              '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Daily visitor and page view trend</div>' +
            '</div>' +
          '</div>' +
          (hasData ? 
            '<div style="display:flex;align-items:flex-end;gap:8px;height:180px;padding:10px 0">' +
              dailyData.map(d => {
                const heightPercent = (d.pageViews / maxDailyViews) * 100;
                return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">' +
                  '<div style="font-size:11px;font-weight:600;color:var(--ink)">' + d.pageViews + '</div>' +
                  '<div style="width:100%;background:linear-gradient(180deg,#553c9a,rgba(85,60,154,0.2));border-radius:6px 6px 0 0;height:' + Math.max(heightPercent, 2) + '%;min-height:4px;transition:height 0.3s ease"></div>' +
                  '<div style="font-size:10px;color:var(--ink-soft);text-align:center;white-space:nowrap">' + d.date.split(',')[0] + '</div>' +
                '</div>';
              }).join('') +
            '</div>'
          : '<div style="text-align:center;padding:40px 20px;color:var(--ink-soft);font-size:14px">📊 No traffic data yet. Visit some pages to see the trend here.</div>') +
        '</div>' +
        
        /* Two Column Layout */
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:24px">' +
          /* Top Pages */
          '<div style="background:var(--card);border:1px solid var(--border);border-left:4px solid #9b2c2c;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">' +
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
              '<div style="width:44px;height:44px;background:linear-gradient(135deg,#9b2c2c,#742a2a);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#feb2b2">' + icons.award + '</div>' +
              '<div>' +
                '<h4 style="margin:0;font-size:16px;color:var(--ink)">Top Pages</h4>' +
                '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Most visited pages on your site</div>' +
              '</div>' +
            '</div>' +
            (topPages.length ? '<div style="display:flex;flex-direction:column;gap:10px">' +
              topPages.map(([page, count], idx) => {
                const percent = (count / maxPageViews) * 100;
                const barColors = ['#f5576c', '#f093fb', '#f6a26b', '#f7b733', '#4facfe', '#43e97b', '#667eea', '#764ba2', '#00f2fe', '#38f9d7'];
                return '<div>' +
                  '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">' +
                    '<span style="color:var(--ink);font-weight:' + (idx < 3 ? '600' : '400') + '">' + (idx < 3 ? ['🥇','🥈','🥉'][idx] + ' ' : '') + getPageDisplayName(page) + '</span>' +
                    '<span style="color:var(--ink-soft);font-weight:600">' + count + ' views</span>' +
                  '</div>' +
                  '<div style="height:6px;background:var(--bg-soft);border-radius:3px;overflow:hidden">' +
                    '<div style="height:100%;background:linear-gradient(90deg,' + barColors[idx % barColors.length] + ',' + barColors[idx % barColors.length] + '88);border-radius:3px;width:' + percent + '%;transition:width 0.3s ease"></div>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' : '<div style="text-align:center;padding:30px 20px;color:var(--ink-soft);font-size:14px">🏆 No page data yet. Visit some pages to see rankings here.</div>') +
          '</div>' +
          
          /* Device Breakdown */
          '<div style="background:var(--card);border:1px solid var(--border);border-left:4px solid #2c5282;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">' +
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
              '<div style="width:44px;height:44px;background:linear-gradient(135deg,#2c5282,#1a365d);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#90cdf4">' + icons.smartphone + '</div>' +
              '<div>' +
                '<h4 style="margin:0;font-size:16px;color:var(--ink)">Device Breakdown</h4>' +
                '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Visitor device distribution</div>' +
              '</div>' +
            '</div>' +
            (Object.values(deviceCounts).some(v => v > 0) ? '<div style="display:flex;flex-direction:column;gap:12px">' +
              Object.entries(deviceCounts).filter(([k,v]) => v > 0).map(([device, count]) => {
                const total = Object.values(deviceCounts).reduce((a,b) => a + b, 0);
                const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const deviceIcons = { desktop: icons.monitor, mobile: icons.smartphone, tablet: icons.tablet, unknown: icons.info };
                const gradients = { 
                  desktop: 'linear-gradient(90deg,#667eea,#764ba2)', 
                  mobile: 'linear-gradient(90deg,#f093fb,#f5576c)', 
                  tablet: 'linear-gradient(90deg,#4facfe,#00f2fe)', 
                  unknown: 'linear-gradient(90deg,#999,#bbb)' 
                };
                return '<div>' +
                  '<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">' +
                    '<span style="color:var(--ink);font-weight:500;display:flex;align-items:center;gap:6px">' + 
                      '<span style="display:inline-flex;width:16px;height:16px;color:var(--ink-soft)">' + (deviceIcons[device] || icons.info) + '</span>' +
                      device.charAt(0).toUpperCase() + device.slice(1) + 
                    '</span>' +
                    '<span style="color:var(--ink-soft);font-weight:600">' + count + ' (' + percent + '%)</span>' +
                  '</div>' +
                  '<div style="height:8px;background:var(--bg-soft);border-radius:4px;overflow:hidden">' +
                    '<div style="height:100%;background:' + (gradients[device] || '#999') + ';border-radius:4px;width:' + percent + '%;transition:width 0.3s ease"></div>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' : '<div style="text-align:center;padding:30px 20px;color:var(--ink-soft);font-size:14px">📱 No device data yet. Visit some pages to see device distribution here.</div>') +
          '</div>' +
        '</div>' +
        
        /* Traffic Sources */
        '<div style="background:var(--card);border:1px solid var(--border);border-left:4px solid #285e61;border-radius:12px;padding:20px;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
            '<div style="width:44px;height:44px;background:linear-gradient(135deg,#285e61,#1a4749);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#81e6d9">' + icons.globe + '</div>' +
            '<div>' +
              '<h4 style="margin:0;font-size:16px;color:var(--ink)">Traffic Sources</h4>' +
              '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Where your visitors come from</div>' +
            '</div>' +
          '</div>' +
          (topReferrers.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">' +
            topReferrers.map(([source, count], idx) => {
              const total = allRecords.length;
              const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
              const cardColors = [
                'linear-gradient(135deg,rgba(67,233,123,0.1),rgba(56,249,215,0.1))',
                'linear-gradient(135deg,rgba(79,172,254,0.1),rgba(0,242,254,0.1))',
                'linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))',
                'linear-gradient(135deg,rgba(240,147,251,0.1),rgba(245,87,108,0.1))',
                'linear-gradient(135deg,rgba(247,183,51,0.1),rgba(252,107,107,0.1))',
                'linear-gradient(135deg,rgba(246,162,107,0.1),rgba(255,205,130,0.1))',
                'linear-gradient(135deg,rgba(118,75,162,0.1),rgba(102,126,234,0.1))',
                'linear-gradient(135deg,rgba(56,249,215,0.1),rgba(67,233,123,0.1))'
              ];
              const textColors = ['#43e97b', '#4facfe', '#667eea', '#f5576c', '#f7b733', '#f6a26b', '#764ba2', '#38f9d7'];
              return '<div style="background:' + cardColors[idx % cardColors.length] + ';border:1px solid ' + textColors[idx % textColors.length] + '33;padding:12px;border-radius:10px;text-align:center;transition:transform 0.2s ease">' +
                '<div style="font-size:24px;font-weight:700;color:' + textColors[idx % textColors.length] + '">' + count + '</div>' +
                '<div style="font-size:12px;color:var(--ink-soft);margin-top:4px;word-break:break-all;font-weight:500">' + source + '</div>' +
                '<div style="font-size:11px;color:var(--ink-soft);opacity:0.7;margin-top:2px">' + percent + '%</div>' +
              '</div>';
            }).join('') +
          '</div>' : '<div style="text-align:center;padding:30px 20px;color:var(--ink-soft);font-size:14px">🌐 No referrer data yet. Most traffic will show as "Direct" initially.</div>') +
        '</div>' +
        
        /* Info Box */
        '<div style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:16px;margin-top:20px">' +
          '<div style="display:flex;align-items:flex-start;gap:12px">' +
            '<div style="font-size:24px">💡</div>' +
            '<div>' +
              '<h5 style="margin:0 0 6px;font-size:14px;color:var(--ink)">About Analytics</h5>' +
              '<p style="margin:0;font-size:13px;color:var(--ink-soft);line-height:1.6">' +
                '• Visitor tracking is anonymous and privacy-friendly (no personal data collected)<br>' +
                '• Sessions are tracked per browser tab (expires when tab is closed)<br>' +
                '• Data is stored in your Supabase database and only visible to admins<br>' +
                '• Page views are throttled (same page within 2 seconds counts as one view)<br>' +
                '• Admin pages are not tracked' +
              '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    
    renderAdminShell(content);
    
  } catch(e) {
    console.error("Analytics error:", e);
    renderAdminShell('<div class="admin-panel"><div class="panel-body" style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h3>Error Loading Analytics</h3><p style="color:var(--ink-soft)">' + esc(e.message) + '</p><button class="btn" onclick="adminAnalytics()" style="margin-top:16px">Try Again</button></div></div>');
  }
}

/* ---- Reset all store data (products/categories/theme/orders) ---- */
function resetStoreData(){
  if(!confirm("Reset all store data to defaults?\n\nThis removes every product, category, theme and order change saved in this browser and restores the original 77-product catalog.")) return;
  [LS.products, LS.cats, LS.theme, LS.cart, LS.orders].forEach(k => localStorage.removeItem(k));
  showToast("Store data reset to defaults");
  adminRoute();
}

/* ---- Orders admin ---- */
function adminOrders(){
  const orders = getOrders();
  const active = orders.filter(o => o.status !== "Cancelled");
  const revenue = active.reduce((s,o) => s + Number(o.total || 0), 0);
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Orders</h3><div class="ph-sub">' + orders.length + ' orders · ' + fmt(revenue) + ' revenue · saved from checkout</div></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn sm" onclick="exportItemsCSV()">' + IC.down + ' Export Items (Excel)</button>' +
      '<button class="btn sm ghost" onclick="exportOrdersCSV()">' + IC.down + ' Export Orders</button>' +
    '</div></div>' +
    (orders.length
      ? '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Email</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        orders.map(o => { const cur = o.cur || "EUR";
          return '<tr>' +
          '<td style="font-weight:600">' + esc(o.id) + '</td>' +
          '<td style="white-space:nowrap">' + fmtDT(o.date) + '</td>' +
          '<td>' + esc(custName(o)) + '</td>' +
          '<td class="td-email"><a href="mailto:' + esc(custEmail(o)) + '" style="color:var(--accent)">' + esc(custEmail(o)) + '</a></td>' +
          '<td>' + o.items.reduce((s,i) => s + i.qty, 0) + '</td>' +
          '<td style="font-weight:700">' + fmtIn(o.total, cur, orate(o)) + ' <span style="font-weight:400;color:var(--ink-soft);font-size:11px">' + cur + '</span></td>' +
          '<td><select class="order-status ' + orderStatusColor(o.status) + '" onchange="setOrderStatus(\'' + esc(o.id) + '\', this.value)">' +
            ORDER_STATUSES.map(s => '<option ' + (o.status === s ? "selected" : "") + '>' + s + '</option>').join("") +
          '</select></td>' +
          '<td><div class="table-actions">' +
            '<button onclick="viewOrder(\'' + escJs(o.id) + '\')" title="View">' + IC.search + '</button>' +
            '<button onclick="mailOrder(lastOrderById(\'' + escJs(o.id) + '\'))" title="Email">' + IC.mail + '</button>' +
            '<button class="del" onclick="deleteOrder(\'' + escJs(o.id) + '\')" title="Delete">' + IC.del + '</button>' +
          '</div></td></tr>'; }).join("") +
        '</tbody></table></div>'
      : '<div class="panel-body"><div style="font-size:13.5px;color:var(--ink-soft);padding:10px 0">No orders yet. When a customer places an order on the storefront it is saved here automatically and can be exported to Excel.</div></div>') +
    '</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Orders";
}
const ORDER_STATUSES = ["New", "Confirmed", "In Production", "Quality Check", "Shipped", "Completed", "On Hold", "Cancelled"];
function orderStatusColor(status){
  const colors = {
    "New": "blue",
    "Confirmed": "cyan",
    "In Production": "orange",
    "Quality Check": "purple",
    "Shipped": "indigo",
    "Completed": "green",
    "On Hold": "yellow",
    "Cancelled": "red"
  };
  return colors[status] || "gray";
}
function findOrderById(id){ return getOrders().find(o => o.id === id); }
function lastOrderById(id){ const o = findOrderById(id); if(o) lastOrder = o; return o; }
function setOrderStatus(id, status, note){
  const orders = getOrders();
  const o = orders.find(x => x.id === id); if(!o) return;
  o.status = status;
  if(!o.statusHistory) o.statusHistory = [];
  o.statusHistory.push({ status: status, date: new Date().toISOString(), note: note || "Status updated by admin" });
  saveOrders(orders);
  showToast("Order " + id + " → " + status);
}
function addOrderNote(id, note, author){
  const orders = getOrders();
  const o = orders.find(x => x.id === id); if(!o) return;
  if(!o.notes) o.notes = [];
  o.notes.push({
    id: "n" + Date.now(),
    text: note,
    author: author || "Admin",
    date: new Date().toISOString(),
    type: "admin"
  });
  saveOrders(orders);
  showToast("Note added to order " + id);
}
function deleteOrder(id){
  if(!confirm("Delete order " + id + "?")) return;
  saveOrders(getOrders().filter(o => o.id !== id));
  showToast("Order deleted");
  adminOrders();
}
function viewOrder(id){
  const o = findOrderById(id); if(!o) return;
  lastOrder = o;
  const cur = o.cur || "EUR";
  const notes = o.notes || [];
  const statusHistory = o.statusHistory || [{ status: o.status, date: o.date, note: "Order placed" }];
  $("#amTitle").textContent = "Order " + o.id;
  $("#amSub").textContent = fmtDT(o.date);
  $("#amBody").innerHTML =
    '<div class="ov-grid">' +
      '<div class="ov-box"><div class="ov-k">Customer</div><div class="ov-v">' + esc(custName(o)) + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Email</div><div class="ov-v"><a href="mailto:' + esc(custEmail(o)) + '" style="color:var(--accent)">' + esc(custEmail(o)) + '</a></div></div>' +
      '<div class="ov-box"><div class="ov-k">Phone</div><div class="ov-v">' + esc(custPhone(o) || "—") + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Preferred Contact</div><div class="ov-v">' + esc(custContact(o) || "—") + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Delivery</div><div class="ov-v">' + esc(custAddr(o)) + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Status</div><div class="ov-v"><select class="order-status ' + orderStatusColor(o.status) + '" onchange="setOrderStatus(\'' + esc(o.id) + '\', this.value)">' + ORDER_STATUSES.map(s => '<option ' + (o.status === s ? "selected" : "") + '>' + s + '</option>').join("") + '</select></div></div>' +
      '<div class="ov-box"><div class="ov-k">Total (' + cur + ')</div><div class="ov-v" style="font-weight:800">' + fmtIn(o.total, cur, orate(o)) + '</div></div>' +
    '</div>' +
    '<table class="admin-table" style="margin-top:14px"><thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Unit (' + cur + ')</th><th>Line (' + cur + ')</th></tr></thead><tbody>' +
    o.items.map(it => '<tr><td style="font-weight:600">' + esc(it.name) + '</td><td><span class="pill">' + esc(catName(it.cat)) + '</span></td><td>' + it.qty + '</td><td>' + fmtIn(it.price, cur, orate(o)) + '</td><td style="font-weight:700">' + fmtIn(it.price * it.qty, cur, orate(o)) + '</td></tr>').join("") +
    '</tbody></table>' +
    '<div style="margin-top:20px">' +
      '<h4 style="font-size:15px;font-weight:600;margin-bottom:12px">Status History</h4>' +
      '<div class="status-timeline" style="position:relative;padding-left:24px">' +
        statusHistory.slice().reverse().map((h, i) => {
          const isLast = i === 0;
          return '<div class="timeline-item" style="position:relative;padding-bottom:16px">' +
            '<div style="position:absolute;left:-24px;top:2px;width:12px;height:12px;border-radius:50%;background:' + (isLast ? 'var(--brand)' : 'var(--border)') + ';border:2px solid var(--card)"></div>' +
            (i < statusHistory.length - 1 ? '<div style="position:absolute;left:-19px;top:14px;width:2px;height:calc(100% - 14px);background:var(--border)"></div>' : '') +
            '<div style="font-weight:600;font-size:13px;color:var(--ink)">' + esc(h.status) + '</div>' +
            '<div style="font-size:12px;color:var(--ink-soft)">' + fmtDT(h.date) + (h.note ? ' · ' + esc(h.note) : '') + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
    '</div>' +
    '<div style="margin-top:20px">' +
      '<h4 style="font-size:15px;font-weight:600;margin-bottom:12px">Order Notes</h4>' +
      (notes.length ? notes.map(n => '<div class="order-note" style="padding:12px;background:var(--card);border-radius:10px;margin-bottom:8px;border-left:3px solid ' + (n.type === 'customer' ? 'var(--accent)' : 'var(--brand)') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-weight:600;font-size:13px">' + esc(n.author) + '</span>' +
          '<span style="font-size:11px;color:var(--ink-soft)">' + fmtDT(n.date) + '</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--ink);line-height:1.5">' + esc(n.text) + '</div>' +
      '</div>').join("") : '<p style="font-size:13px;color:var(--ink-soft)">No notes yet.</p>') +
      '<div style="margin-top:12px;display:flex;gap:8px">' +
        '<input type="text" id="orderNoteInput" placeholder="Add a note..." style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px" onkeypress="if(event.key===\'Enter\') submitOrderNote(\'' + esc(o.id) + '\')">' +
        '<button class="btn sm" onclick="submitOrderNote(\'' + escJs(o.id) + '\')">Add Note</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">' +
      '<button class="btn sm" onclick="mailOrder(lastOrder)">' + IC.mail + ' Email Order</button>' +
      '<button class="btn sm ghost" onclick="aiOrderReplyDraft(\'' + escJs(o.id) + '\')" title="AI draft reply for customer in English">🤖 AI Reply Draft</button>' +
      '<button class="btn sm ghost" onclick="copyOrderSummary(lastOrder)">Copy Summary</button>' +
      '<button class="btn sm ghost" onclick="downloadOrderPDF(\'' + escJs(o.id) + '\')">' + IC.down + ' Download PDF</button>' +
    '</div>' +
    '<div id="aiDraftBox" style="display:none;margin-top:14px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<span style="font-weight:600;font-size:13px">🤖 AI Reply Draft (review before sending)</span>' +
        '<button class="btn sm ghost" onclick="copyAiDraft()">Copy</button>' +
      '</div>' +
      '<textarea id="aiDraftText" rows="8" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--ink);background:var(--bg-soft);resize:vertical"></textarea>' +
    '</div>';
  $("#adminModal").classList.add("open");
}

function submitOrderNote(id){
  const input = $("#orderNoteInput");
  if(!input || !input.value.trim()) return;
  addOrderNote(id, input.value.trim(), "Admin");
  input.value = "";
  viewOrder(id);
}

/* ---- Quotes / Inquiries admin ---- */
function adminQuotes(){
  const quotes = getQuotes();
  const pending = quotes.filter(q => q.status === "Pending").length;
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Quotes & Enquiries</h3><div class="ph-sub">' + quotes.length + ' quotes · ' + pending + ' pending review</div></div></div>' +
    (quotes.length
      ? '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table"><thead><tr><th>Quote ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Quoted Price</th><th>Status</th><th>Valid Until</th><th>Actions</th></tr></thead><tbody>' +
        quotes.map(q => {
          const isExpired = q.validUntil && new Date(q.validUntil) < new Date();
          const statusDisplay = isExpired && q.status === "Quoted" ? "Expired" : q.status;
          return '<tr>' +
          '<td style="font-weight:600;white-space:nowrap">' + esc(q.id) + '</td>' +
          '<td style="white-space:nowrap">' + fmtDT(q.date) + '</td>' +
          '<td>' + esc(qCustName(q)) + '<div style="font-size:11px;color:var(--ink-soft)">' + esc(qCustEmail(q)) + '</div></td>' +
          '<td style="text-align:center">' + q.items.reduce((s,i) => s + i.qty, 0) + '</td>' +
          '<td style="font-weight:700;white-space:nowrap">' + (q.quotedPrice ? fmt(q.quotedPrice) : '<span style="color:var(--ink-soft);font-weight:400">Pending</span>') + '</td>' +
          '<td><span class="pill ' + (q.status === "Pending" ? "yellow" : q.status === "Quoted" ? "blue" : q.status === "Accepted" ? "green" : "gray") + '">' + esc(statusDisplay) + '</span></td>' +
          '<td style="white-space:nowrap">' + (q.validUntil ? fmtD(q.validUntil) : "—") + '</td>' +
          '<td><div class="table-actions">' +
            '<button onclick="viewAdminQuote(\'' + escJs(q.id) + '\')" title="View">' + IC.search + '</button>' +
            '<button onclick="downloadQuotePDF(\'' + escJs(q.id) + '\')" title="Download PDF">' + IC.down + '</button>' +
            '<button class="del" onclick="deleteQuote(\'' + escJs(q.id) + '\')" title="Delete">' + IC.del + '</button>' +
          '</div></td></tr>'; }).join("") +
        '</tbody></table></div>'
      : '<div class="panel-body"><div style="font-size:13.5px;color:var(--ink-soft);padding:10px 0">No quote requests yet. When a customer requests a quote from their cart it will appear here.</div></div>') +
    '</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Quotes & Enquiries";
}
function viewAdminQuote(id){
  const q = findQuoteById(id); if(!q) return;
  const isExpired = q.validUntil && new Date(q.validUntil) < new Date();
  $("#amTitle").textContent = "Quote " + q.id;
  $("#amSub").textContent = fmtDT(q.date);
  $("#amBody").innerHTML =
    '<div class="ov-grid">' +
      '<div class="ov-box"><div class="ov-k">Customer</div><div class="ov-v">' + esc(qCustName(q)) + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Email</div><div class="ov-v"><a href="mailto:' + esc(qCustEmail(q)) + '" style="color:var(--accent)">' + esc(qCustEmail(q)) + '</a></div></div>' +
      '<div class="ov-box"><div class="ov-k">Phone</div><div class="ov-v">' + esc(qCustPhone(q) || "—") + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Company</div><div class="ov-v">' + esc(qCustCompany(q) || "—") + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Delivery</div><div class="ov-v">' + esc(qCustAddr(q)) + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Status</div><div class="ov-v"><span class="pill ' + (q.status === "Pending" ? "yellow" : q.status === "Quoted" ? "blue" : q.status === "Accepted" ? "green" : "gray") + '">' + esc(isExpired && q.status === "Quoted" ? "Expired" : q.status) + '</span></div></div>' +
      '<div class="ov-box"><div class="ov-k">Est. Total</div><div class="ov-v">' + fmt(q.subtotal) + '</div></div>' +
      (q.customerTargetPrice ? '<div class="ov-box" style="background:rgba(250,173,20,0.08);border:1px solid rgba(250,173,20,0.3)"><div class="ov-k">Customer Target Price</div><div class="ov-v" style="font-weight:800;color:#b8860b">' + fmt(q.customerTargetPrice) + '</div></div>' : '') +
      '<div class="ov-box"><div class="ov-k">Quoted Price</div><div class="ov-v" style="font-weight:800;color:var(--brand)">' + (q.quotedPrice ? fmt(q.quotedPrice) : "—") + '</div></div>' +
    '</div>' +
    '<table class="admin-table" style="margin-top:14px"><thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Unit (EUR)</th><th>Line (EUR)</th></tr></thead><tbody>' +
    q.items.map(it => '<tr><td style="font-weight:600">' + esc(it.name) + '</td><td><span class="pill">' + esc(catName(it.cat)) + '</span></td><td>' + it.qty + '</td><td>' + fmt(it.price) + '</td><td style="font-weight:700">' + fmt(it.price * it.qty) + '</td></tr>').join("") +
    '</tbody></table>' +
    (q.notes ? '<div style="margin-top:14px;padding:12px;background:var(--card);border-radius:8px"><div style="font-weight:600;font-size:13px;margin-bottom:6px">Customer Notes</div><div style="font-size:13px;color:var(--ink)">' + esc(q.notes) + '</div></div>' : '') +
    (q.customerTargetPrice ? '<div style="margin-top:20px;padding:16px;background:rgba(250,173,20,0.06);border-radius:10px;border:1px solid rgba(250,173,20,0.3)">' +
      '<h4 style="font-size:15px;font-weight:600;margin-bottom:8px;color:#b8860b">Customer Has Proposed a Target Price</h4>' +
      '<p style="font-size:13px;color:var(--ink-soft);margin:0 0 12px">Customer requested <strong style="color:#b8860b;font-size:16px">' + fmt(q.customerTargetPrice) + '</strong> (€' + Number(q.customerTargetPrice).toFixed(2) + ' EUR base). You can accept this price or send your own quote.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn" style="background:#22c55e" onclick="acceptCustomerTargetPrice(\'' + escJs(q.id) + '\')">' + IC.sparkle + ' Accept Customer Price</button>' +
        '<button class="btn ghost" style="color:#ef4444;border-color:#ef4444" onclick="rejectCustomerTargetPrice(\'' + escJs(q.id) + '\')">Reject Target Price</button>' +
      '</div>' +
    '</div>' : '') +
    '<div style="margin-top:20px;padding:16px;background:rgba(37,186,181,0.05);border-radius:10px;border:1px solid rgba(37,186,181,0.2)">' +
      '<h4 style="font-size:15px;font-weight:600;margin-bottom:12px;color:var(--ink)">Send Your Own Quote</h4>' +
      '<div class="form-grid">' +
        '<div class="field"><label>Quoted Price (' + getCur().code + ') *</label><input id="qPrice" type="number" step="0.01" min="0" value="' + (q.quotedPrice ? (q.quotedPrice * rateOf(getCur().code)).toFixed(2) : (q.subtotal * rateOf(getCur().code)).toFixed(2)) + '"></div>' +
        '<div class="field"><label>Valid Until *</label><input id="qValid" type="text" class="date-picker" placeholder="Select date" readonly value="' + (q.validUntil ? q.validUntil.substring(0, 10) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)) + '"></div>' +
        '<div class="field full"><label>Quote Notes / Terms</label><textarea id="qNotes" rows="3" placeholder="e.g. Prices include packaging, shipping quoted separately, MOQ applies...">' + esc(q.quoteNotes || "") + '</textarea></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
        '<button class="btn" onclick="submitQuoteResponse(\'' + escJs(q.id) + '\')">' + IC.mail + ' Send Quote</button>' +
        '<button class="btn ghost" onclick="setQuoteStatus(\'' + escJs(q.id) + '\', \'Rejected\')">Reject Request</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">' +
      '<button class="btn sm ghost" onclick="downloadQuotePDF(\'' + escJs(q.id) + '\')">' + IC.down + ' Download Quote PDF</button>' +
      '<button class="btn sm ghost" onclick="aiQuoteReplyDraft(\'' + escJs(q.id) + '\')" title="AI draft reply for customer in English">🤖 AI Reply Draft</button>' +
      '<button class="btn sm ghost" onclick="mailQuote(\'' + escJs(q.id) + '\')">' + IC.mail + ' Email Customer</button>' +
    '</div>' +
    '<div id="aiDraftBox" style="display:none;margin-top:14px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<span style="font-weight:600;font-size:13px">🤖 AI Reply Draft (review before sending)</span>' +
        '<button class="btn sm ghost" onclick="copyAiDraft()">Copy</button>' +
      '</div>' +
      '<textarea id="aiDraftText" rows="8" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--ink);background:var(--bg-soft);resize:vertical"></textarea>' +
    '</div>';
  $("#adminModal").classList.add("open");
  /* Initialize flatpickr date picker */
  setTimeout(function(){
    if(typeof flatpickr !== "undefined"){
      flatpickr("#qValid", {
        dateFormat: "Y-m-d",
        allowInput: true,
        locale: {
          firstDayOfWeek: 1,
          weekdays: {
            shorthand: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            longhand: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          },
          months: {
            shorthand: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            longhand: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
          }
        }
      });
    }
  }, 100);
}
function submitQuoteResponse(id){
  const priceInput = parseFloat($("#qPrice").value);
  const valid = $("#qValid").value;
  const notes = $("#qNotes").value.trim();
  if(!priceInput || priceInput <= 0){ showToast("Please enter a valid quoted price"); return; }
  if(!valid){ showToast("Please select a valid until date"); return; }
  // Convert from selected currency back to EUR (base currency)
  const price = priceInput / rateOf(getCur().code);
  const quotes = getQuotes();
  const q = quotes.find(x => x.id === id); if(!q) return;
  q.quotedPrice = price;
  q.validUntil = new Date(valid + "T23:59:59").toISOString();
  q.quoteNotes = notes;
  q.status = "Quoted";
  q.history = q.history || [];
  q.history.push({ status: "Quoted", date: new Date().toISOString(), note: "Quote sent by admin: " + fmt(price) + " EUR, valid until " + valid });
  saveQuotes(quotes).then(r => { if(r && r.ok) showToast("Quote " + id + " sent!"); });
  $("#adminModal").classList.remove("open");
  adminQuotes();
}
function setQuoteStatus(id, status){
  if(!confirm("Set quote " + id + " status to " + status + "?")) return;
  const quotes = getQuotes();
  const q = quotes.find(x => x.id === id); if(!q) return;
  q.status = status;
  q.history = q.history || [];
  q.history.push({ status: status, date: new Date().toISOString(), note: "Status updated by admin" });
  saveQuotes(quotes).then(r => { if(r && r.ok) showToast("Quote status updated to " + status); });
  adminQuotes();
}
function acceptCustomerTargetPrice(id){
  const quotes = getQuotes();
  const q = quotes.find(x => x.id === id); if(!q) return;
  if(!q.customerTargetPrice){ showToast("No customer target price found"); return; }
  if(!confirm("Accept customer's target price of " + fmt(q.customerTargetPrice) + " EUR and send quote?")) return;
  q.quotedPrice = q.customerTargetPrice;
  q.validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  q.quoteNotes = q.quoteNotes || "Price accepted as per customer's target price request.";
  q.status = "Quoted";
  q.history = q.history || [];
  q.history.push({ status: "Quoted", date: new Date().toISOString(), note: "Admin accepted customer target price: " + fmt(q.customerTargetPrice) + " EUR" });
  saveQuotes(quotes).then(r => { if(r && r.ok) showToast("Customer target price accepted! Quote sent."); });
  $("#adminModal").classList.remove("open");
  adminQuotes();
}
function rejectCustomerTargetPrice(id){
  const quotes = getQuotes();
  const q = quotes.find(x => x.id === id); if(!q) return;
  if(!confirm("Reject customer's target price? The quote request will be marked as Rejected.")) return;
  q.status = "Rejected";
  q.history = q.history || [];
  q.history.push({ status: "Rejected", date: new Date().toISOString(), note: "Admin rejected customer target price of " + (q.customerTargetPrice ? fmt(q.customerTargetPrice) : "N/A") + " EUR" });
  saveQuotes(quotes).then(r => { if(r && r.ok) showToast("Customer target price rejected."); });
  $("#adminModal").classList.remove("open");
  adminQuotes();
}
function deleteQuote(id){
  if(!confirm("Delete quote " + id + "?")) return;
  saveQuotes(getQuotes().filter(q => q.id !== id)).then(r => { if(r && r.ok) showToast("Quote deleted"); });
  adminQuotes();
}
function mailQuote(id){
  const q = findQuoteById(id); if(!q) return;
  const subject = encodeURIComponent("Your Nebula Secret Quote " + q.id);
  const body = encodeURIComponent("Dear " + qCustName(q) + ",\n\nThank you for your inquiry. Please find your formal quote below:\n\nQuote ID: " + q.id + "\n" +
    (q.quotedPrice ? "Quoted Price: " + fmt(q.quotedPrice) + " EUR\n" : "") +
    (q.validUntil ? "Valid Until: " + fmtD(q.validUntil) + "\n" : "") +
    "\nItems:\n" + q.items.map(it => "- " + it.name + " × " + it.qty + " = " + fmt(it.price * it.qty) + " EUR").join("\n") +
    (q.quoteNotes ? "\n\nNotes:\n" + q.quoteNotes : "") +
    "\n\nPlease contact us if you have any questions.\n\nBest regards,\nNebula Secret Sales Team\nsales@nebulasecret.com");
  window.location.href = "mailto:" + qCustEmail(q) + "?subject=" + subject + "&body=" + body;
}

/* ---- Excel / CSV exports (EUR base + order currency columns) ---- */
function exportOrdersCSV(){
  const orders = getOrders();
  const rows = [["Order No","Date","Customer","Email","Phone","Preferred Contact","Country","Address","Items Qty","Order Total (EUR)","Currency","Order Total (orig)","Status"]];
  orders.forEach(o => { const cur = o.cur || "EUR"; const r = orate(o); const dec = getCurDec(cur);
    rows.push([o.id, fmtDT(o.date), custName(o), custEmail(o), custPhone(o), custContact(o), custCountry(o), (o.customer && o.customer.address) || "", o.items.reduce((s,i) => s + i.qty, 0), Number(o.total).toFixed(2), cur, (Number(o.total) * r).toFixed(dec), o.status]);
  });
  if(orders.length === 0) rows.push(["No orders yet"]);
  downloadCSV("nebula-secret-orders.csv", rows);
  showToast("Orders exported — open in Excel");
}
function getCurDec(code){ return (CURRENCIES.find(c => c.code === code) || CURRENCIES[0]).dec; }
function exportItemsCSV(){
  const orders = getOrders();
  const rows = [["Order No","Date","Customer","Email","Product","Category","Qty","Unit Price (EUR)","Line Total (EUR)","Order Total (EUR)","Currency","Unit Price (orig)","Line Total (orig)","Status"]];
  orders.forEach(o => { const cur = o.cur || "EUR"; const r = orate(o); const dec = getCurDec(cur);
    o.items.forEach(it =>
      rows.push([o.id, fmtDT(o.date), custName(o), custEmail(o), it.name, catName(it.cat), it.qty, Number(it.price).toFixed(2), Number(it.price * it.qty).toFixed(2), Number(o.total).toFixed(2), cur, (it.price * r).toFixed(dec), (it.price * it.qty * r).toFixed(dec), o.status])
    );
  });
  if(rows.length === 1) rows.push(["No orders yet"]);
  downloadCSV("nebula-secret-order-items.csv", rows);
  showToast("Product order list exported — open in Excel");
}

/* ---- Products admin ---- */
function adminProducts(){
  const products = getProducts();
  const cats = getCats();
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Products</h3><div class="ph-sub">' + products.length + ' products · add, edit or remove items</div></div><button class="btn sm" onclick="openProductForm()">' + IC.plus + ' Add Product</button></div>' +
    '<div class="panel-body" style="padding:16px;border-bottom:1px solid var(--border)">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600">' +
          '<input type="checkbox" id="selectAllProducts" onchange="toggleSelectAllProducts(this)" style="width:16px;height:16px;cursor:pointer"> Select All' +
        '</label>' +
        '<span id="selectedCount" style="font-size:13px;color:var(--ink-soft)">0 selected</span>' +
        '<div style="flex:1"></div>' +
        '<select id="productCategoryFilter" onchange="filterProductsByCategory(this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--card);color:var(--ink);cursor:pointer">' +
          '<option value="all">All Categories</option>' +
          cats.map(c => '<option value="' + c.cs + '">' + esc(c.c) + ' (' + products.filter(p => p.cs === c.cs).length + ')</option>').join("") +
        '</select>' +
        '<button class="btn sm ghost" onclick="openBulkEditModal()" id="bulkEditBtn" disabled style="opacity:0.5;cursor:not-allowed">' + IC.edit + ' Bulk Edit MOQ & Price</button>' +
      '</div>' +
    '</div>' +
    '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table" id="productsTable"><thead><tr><th style="width:40px"><input type="checkbox" id="selectAllHeader" onchange="toggleSelectAllProducts(this)" style="width:16px;height:16px;cursor:pointer"></th><th></th><th>Name</th><th>Category</th><th>Price</th><th>MOQ</th><th>Rating</th><th>Actions</th></tr></thead><tbody id="productsTableBody">' +
    products.slice().reverse().map(p => renderProductRow(p)).join("") +
    '</tbody></table></div></div>' +
    '<div class="admin-panel"><div class="panel-body"><div style="font-size:13px;color:var(--ink-soft)">Changes are saved to this browser (localStorage) and appear on the storefront immediately. Use checkboxes to select products for bulk editing.</div></div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Products";
}

/* Render a single product row for the admin table */
function renderProductRow(p){
  const rt = productRating(p);
  const moq = p.priceTiers && p.priceTiers.length ? p.priceTiers[0].minQty : 1;
  return '<tr data-product-id="' + p.id + '"><td><input type="checkbox" class="product-checkbox" value="' + p.id + '" onchange="updateSelectedCount()" style="width:16px;height:16px;cursor:pointer"></td>' +
    '<td><img class="td-img" src="' + imgUrl(p.i, 100) + '" alt="" data-pid="' + p.id + '" onerror="imgFallback(this)"></td>' +
    '<td style="font-weight:600">' + esc(p.n) + '</td>' +
    '<td><span class="pill">' + esc(catName(p.cs)) + '</span></td>' +
    '<td>' + fmt(p.p) + '</td>' +
    '<td><span class="pill" style="background:#e8f8f7;color:#25bab5;font-weight:600">' + moq + '</span></td>' +
    '<td><span class="stars" style="color:#f5a623;font-size:12px">' + stars(rt.r) + '</span> <span style="font-size:12px;color:var(--ink-soft)">' + rt.r.toFixed(1) + '</span></td>' +
    '<td><div class="table-actions">' +
      '<button onclick="openProductForm(\'' + p.id + '\')" title="Edit">' + IC.edit + '</button>' +
      '<button class="del" onclick="deleteProduct(\'' + p.id + '\')" title="Delete">' + IC.del + '</button>' +
    '</div></td></tr>';
}

/* Filter products by category */
function filterProductsByCategory(cat){
  const products = getProducts();
  const filtered = cat === 'all' ? products : products.filter(p => p.cs === cat);
  const tbody = document.getElementById('productsTableBody');
  if(tbody){
    tbody.innerHTML = filtered.slice().reverse().map(p => renderProductRow(p)).join("");
  }
  updateSelectedCount();
}

function toggleSelectAllProducts(checkbox){
  const checkboxes = document.querySelectorAll('.product-checkbox');
  checkboxes.forEach(cb => cb.checked = checkbox.checked);
  const headerCheckbox = document.getElementById('selectAllHeader');
  const selectAllBtn = document.getElementById('selectAllProducts');
  if(headerCheckbox) headerCheckbox.checked = checkbox.checked;
  if(selectAllBtn) selectAllBtn.checked = checkbox.checked;
  updateSelectedCount();
}

function updateSelectedCount(){
  const checkboxes = document.querySelectorAll('.product-checkbox:checked');
  const count = checkboxes.length;
  const countEl = document.getElementById('selectedCount');
  const bulkBtn = document.getElementById('bulkEditBtn');
  if(countEl) countEl.textContent = count + ' selected';
  if(bulkBtn){
    if(count > 0){
      bulkBtn.disabled = false;
      bulkBtn.style.opacity = '1';
      bulkBtn.style.cursor = 'pointer';
    } else {
      bulkBtn.disabled = true;
      bulkBtn.style.opacity = '0.5';
      bulkBtn.style.cursor = 'not-allowed';
    }
  }
}

function getSelectedProductIds(){
  return Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => cb.value);
}

function setAllMoqTo100(){
  if(!confirm('Set MOQ (Minimum Order Quantity) to 100 for ALL ' + getProducts().length + ' products? This will update the first price tier of every product.')) return;
  const products = getProducts();
  let updated = 0;
  products.forEach(p => {
    if(!p.priceTiers || p.priceTiers.length === 0){
      p.priceTiers = [{ minQty: 100, price: p.p || 0 }];
    } else {
      p.priceTiers[0].minQty = 100;
    }
    updated++;
  });
  saveProducts(products).then(r => { if(r && r.ok) showToast('Set MOQ to 100 for ' + updated + ' products'); });
  adminProducts();
}

function openBulkEditModal(){
  const selectedIds = getSelectedProductIds();
  if(selectedIds.length === 0){ showToast('Please select at least one product'); return; }
  
  const products = getProducts().filter(p => selectedIds.includes(String(p.id)));
  
  $("#amTitle").textContent = "Bulk Edit: MOQ & Price";
  $("#amSub").textContent = "Editing " + products.length + " selected products";
  $("#amBody").innerHTML =
    '<div class="form-grid">' +
      '<div class="field full"><label>Selected Products</label>' +
        '<div style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--card)">' +
          products.map(p => '<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">' + esc(p.n) + ' (Current MOQ: ' + (p.priceTiers && p.priceTiers.length ? p.priceTiers[0].minQty : 1) + ', Price: ' + fmt(p.p) + ')</div>').join("") +
        '</div>' +
      '</div>' +
      '<div class="field"><label>Set MOQ (Min Qty)</label><input id="bulkMoq" type="number" min="1" placeholder="e.g. 100"><div class="form-hint">Leave empty to keep current MOQ</div></div>' +
      '<div class="field"><label>Set Base Price (EUR)</label><input id="bulkPrice" type="number" step="0.01" min="0" placeholder="e.g. 5.00"><div class="form-hint">Leave empty to keep current price</div></div>' +
      '<div class="field full"><label>Additional Price Tiers (Volume Discounts)</label>' +
        '<div class="form-hint">Add volume discount tiers for bulk orders. Example: 500+ units at €4.50, 1000+ units at €4.00</div>' +
        '<div id="bulkTiersContainer"></div>' +
        '<button class="btn sm ghost" style="margin-top:8px" onclick="addBulkTier()">+ Add Volume Discount Tier</button>' +
      '</div>' +
      '<div class="field full" style="background:#fff8e6;padding:12px;border-radius:8px;border:1px solid #ffe08a">' +
        '<label style="font-weight:600;color:#8a6d00">⚠️ Important</label>' +
        '<div style="font-size:13px;color:#8a6d00;margin-top:6px">This will overwrite the existing price tiers for all selected products. Make sure the first tier\'s MOQ matches the MOQ you set above.</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">' +
      '<button class="btn ghost" onclick="closeAdminModal()">Cancel</button>' +
      '<button class="btn" onclick="applyBulkEdit()">Apply to ' + products.length + ' Products</button>' +
    '</div>';
  $("#adminModal").classList.add("open");
  
  // Add default tier row
  addBulkTier();
}

function addBulkTier(){
  const container = document.getElementById("bulkTiersContainer");
  if(!container) return;
  const rows = container.querySelectorAll(".bulk-tier-row");
  const lastQty = rows.length > 0 ? parseInt(rows[rows.length - 1].querySelector(".bulk-tier-minqty").value) || 100 : 100;
  const newIndex = rows.length;
  const div = document.createElement("div");
  div.innerHTML = '<div class="bulk-tier-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px">' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--ink-soft)">Min Qty</label><input type="number" min="1" value="' + (lastQty * 2 || 200) + '" class="bulk-tier-minqty" style="width:100%"></div>' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--ink-soft)">Price (EUR)</label><input type="number" step="0.01" min="0" value="" class="bulk-tier-price" style="width:100%" placeholder="e.g. 4.50"></div>' +
    '<button class="btn sm del" style="margin-top:18px" onclick="this.parentElement.remove()" title="Remove tier">×</button>' +
  '</div>';
  container.appendChild(div.firstElementChild);
}

function applyBulkEdit(){
  const selectedIds = getSelectedProductIds();
  const bulkMoq = document.getElementById("bulkMoq") ? parseInt(document.getElementById("bulkMoq").value) : null;
  const bulkPrice = document.getElementById("bulkPrice") ? parseFloat(document.getElementById("bulkPrice").value) : null;
  
  if(!bulkMoq && !bulkPrice && document.querySelectorAll("#bulkTiersContainer .bulk-tier-row").length === 0){
    showToast('Please enter at least one value to update');
    return;
  }
  
  const products = getProducts();
  let updated = 0;
  
  products.forEach(p => {
    if(selectedIds.includes(String(p.id))){
      // Update base price if provided
      if(bulkPrice && !isNaN(bulkPrice)){
        p.p = bulkPrice;
        p.pf = "€" + Number(bulkPrice).toFixed(2);
      }
      
      // Build new price tiers
      const newTiers = [];
      
      // First tier (MOQ)
      const firstTierMoq = bulkMoq && !isNaN(bulkMoq) ? bulkMoq : (p.priceTiers && p.priceTiers.length ? p.priceTiers[0].minQty : 1);
      const firstTierPrice = bulkPrice && !isNaN(bulkPrice) ? bulkPrice : (p.priceTiers && p.priceTiers.length ? p.priceTiers[0].price : p.p);
      newTiers.push({ minQty: firstTierMoq, price: firstTierPrice });
      
      // Additional tiers from bulk edit
      const bulkTierRows = document.querySelectorAll("#bulkTiersContainer .bulk-tier-row");
      bulkTierRows.forEach(row => {
        const minQty = parseInt(row.querySelector(".bulk-tier-minqty").value);
        const price = parseFloat(row.querySelector(".bulk-tier-price").value);
        if(minQty && !isNaN(minQty) && price && !isNaN(price)){
          newTiers.push({ minQty, price });
        }
      });
      
      // Sort tiers by minQty
      newTiers.sort((a, b) => a.minQty - b.minQty);
      
      p.priceTiers = newTiers;
      updated++;
    }
  });
  
  saveProducts(products).then(r => { if(r && r.ok) showToast('Updated ' + updated + ' products'); });
  closeAdminModal();
  adminProducts();
}

function openProductForm(id){
  const p = id ? findProduct(id) : null;
  const cats = getCats();
  const tiers = p && p.priceTiers && p.priceTiers.length ? p.priceTiers : [{ minQty: 1, price: p ? p.p : 1.00 }];
  $("#amTitle").textContent = p ? "Edit product" : "Add product";
  $("#amSub").textContent = p ? "Editing: " + p.n : "Fill in the details to add a new product";
  $("#amBody").innerHTML =
    '<div class="form-grid">' +
      '<div class="field full"><label>Product name *</label><div style="display:flex;gap:8px"><input id="pfName" value="' + (p ? esc(p.n) : "") + '" placeholder="e.g. Rose Body Scrub" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenProductName(this)" title="Generate with AI">✨ AI</button></div></div>' +
      '<div class="field"><label>Category *</label><select id="pfCat">' + cats.map(c => '<option value="' + c.cs + '"' + (p && p.cs === c.cs ? " selected" : "") + '>' + esc(c.c) + '</option>').join("") + '</select></div>' +
      '<div class="field"><label>Base Price (EUR) *</label><input id="pfPrice" type="number" step="0.01" min="0" value="' + (p ? p.p : "1.00") + '"><div class="form-hint">Default price for 1 unit</div></div>' +
      '<div class="field full"><label>Image URL</label><input id="pfImg" value="' + (p ? esc(p.i) : "") + '" placeholder="https://… (leave empty for placeholder)" oninput="pfPreview(this.value)"></div>' +
      '<div class="field full"><label>Image preview</label><div class="pf-prev"><img id="pfImgPrev" src="' + (p ? imgUrl(p.i, 200) : PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>' +
      '<div class="field full"><label>Or upload from your computer</label><label class="upload-btn" for="pfUpload">' + IC.up + ' Choose image file</label><input type="file" id="pfUpload" accept="image/*" style="display:none" onchange="uploadImageTo(\'pfUpload\',\'pfImg\',800)"><div class="form-hint">The image is compressed and stored with this product — no hosting needed. Tip: you can also paste any image URL directly.</div></div>' +
      '<div class="field full"><label>Description (one attribute per line)</label><div style="display:flex;gap:8px;align-items:flex-start"><textarea id="pfDesc" rows="5" placeholder="Country of Origin: China&#10;Scent: Rose&#10;Volume: 100ml" style="flex:1">' + (p ? esc((p.d || []).join("\n")) : "") + '</textarea><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenProductDesc(this)" title="Generate with AI">✨ AI</button></div></div>' +
      '<div class="field full"><label>SEO meta description</label><div style="display:flex;gap:8px"><input id="pfMeta" value="' + (p ? esc(p.meta || "") : "") + '" placeholder="e.g. Wholesale rose body scrub supplier — OEM/ODM private label available" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenProductMeta(this)" title="Generate with AI">✨ AI</button></div><div class="form-hint">Used for Google search results &amp; structured data. 40–150 characters recommended.</div></div>' +
      '<div class="field full">' +
        '<label>Bulk Pricing Tiers (MOQ & Volume Discounts)</label>' +
        '<div class="form-hint">Set different prices for different order quantities. The first tier should start at 1 (MOQ).</div>' +
        '<div id="priceTiersContainer">' +
          tiers.map((t, i) => renderTierRow(t, i)).join("") +
        '</div>' +
        '<button class="btn sm ghost" style="margin-top:8px" onclick="addPriceTier()">+ Add Tier</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">' +
      '<button class="btn ghost" onclick="closeAdminModal()">Cancel</button>' +
      '<button class="btn" onclick="saveProductForm(\'' + (p ? p.id : "") + '\')">' + (p ? "Save changes" : "Add product") + '</button>' +
    '</div>';
  $("#adminModal").classList.add("open");
}

function renderTierRow(tier, index){
  return '<div class="tier-row" data-index="' + index + '" style="display:flex;gap:10px;align-items:center;margin-bottom:8px">' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--ink-soft)">Min Qty (MOQ)</label><input type="number" min="1" value="' + tier.minQty + '" class="tier-minqty" style="width:100%"></div>' +
    '<div style="flex:1"><label style="font-size:11px;color:var(--ink-soft)">Price (EUR)</label><input type="number" step="0.01" min="0" value="' + tier.price + '" class="tier-price" style="width:100%"></div>' +
    '<button class="btn sm del" style="margin-top:18px" onclick="removePriceTier(' + index + ')" title="Remove tier">×</button>' +
  '</div>';
}

function addPriceTier(){
  const container = $("#priceTiersContainer");
  const rows = container.querySelectorAll(".tier-row");
  const lastQty = rows.length > 0 ? parseInt(rows[rows.length - 1].querySelector(".tier-minqty").value) || 1 : 1;
  const newIndex = rows.length;
  const div = document.createElement("div");
  div.innerHTML = renderTierRow({ minQty: lastQty * 10 || 100, price: 0.00 }, newIndex);
  container.appendChild(div.firstElementChild);
}

function removePriceTier(index){
  const container = $("#priceTiersContainer");
  const rows = container.querySelectorAll(".tier-row");
  if(rows.length <= 1){ showToast("At least one tier is required"); return; }
  rows[index].remove();
}

function collectPriceTiers(){
  const container = $("#priceTiersContainer");
  if(!container) return null;
  const rows = container.querySelectorAll(".tier-row");
  const tiers = [];
  rows.forEach(row => {
    const minQty = parseInt(row.querySelector(".tier-minqty").value) || 1;
    const price = parseFloat(row.querySelector(".tier-price").value) || 0;
    tiers.push({ minQty, price });
  });
  tiers.sort((a, b) => a.minQty - b.minQty);
  return tiers;
}

function pfPreview(v){
  const el = $("#pfImgPrev"); if(!el) return;
  el.onerror = null;
  el.src = v && v.trim() ? v.trim() : PLACEHOLDER;
  el.onerror = () => { el.onerror = null; el.src = PLACEHOLDER; };
}
function saveProductForm(id){
  const name = $("#pfName").value.trim();
  const cs = $("#pfCat").value;
  const price = parseFloat($("#pfPrice").value);
  const img = $("#pfImg").value.trim();
  const desc = $("#pfDesc").value.split("\n").map(s => s.trim()).filter(Boolean);
  const meta = $("#pfMeta") ? $("#pfMeta").value.trim() : "";
  const priceTiers = collectPriceTiers();
  if(!name){ showToast("Please enter a product name"); return; }
  if(isNaN(price) || price < 0){ showToast("Please enter a valid price"); return; }
  if(!priceTiers || priceTiers.length === 0){ showToast("Please add at least one price tier"); return; }
  const products = getProducts();
  const existing = id ? products.find(x => String(x.id) === String(id)) : null;
  const rec = {
    id: existing ? existing.id : "x" + Date.now(),
    n: name,
    c: catName(cs),
    cs: cs,
    p: price,
    pf: "€" + Number(price).toFixed(2),
    priceTiers: priceTiers,
    i: img || PLACEHOLDER,
    d: desc,
    meta: meta,
    l: ORIGIN,
    createdAt: existing ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if(existing){ Object.assign(existing, rec); }
  else { products.push(rec); }
  saveProducts(products).then(r => { if(r && r.ok) showToast(existing ? "Product updated" : "Product added"); });
  closeAdminModal();
  adminProducts();
}

function deleteProduct(id){
  if(!confirm("Delete this product? This cannot be undone.")) return;
  const products = getProducts().filter(p => String(p.id) !== String(id));
  saveProducts(products).then(r => { if(r && r.ok) showToast("Product deleted"); });
  adminProducts();
}

/* ---- Categories admin ---- */
function adminCategories(){
  const cats = getCats(); const products = getProducts();
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Categories</h3><div class="ph-sub">' + cats.length + ' categories · use ↑↓ to reorder · products are grouped automatically</div></div><button class="btn sm" onclick="openCatForm()">' + IC.plus + ' Add Category</button></div>' +
    '<div class="panel-body" style="padding:0">' +
      cats.map((c, idx) => {
        const count = products.filter(p => p.cs === c.cs).length;
        const upBtn = idx > 0 ? '<button onclick="moveCategory(\'' + c.cs + '\',-1)" title="Move up">↑</button>' : '<button disabled style="opacity:0.3;cursor:not-allowed" title="Already first">↑</button>';
        const downBtn = idx < cats.length - 1 ? '<button onclick="moveCategory(\'' + c.cs + '\',1)" title="Move down">↓</button>' : '<button disabled style="opacity:0.3;cursor:not-allowed" title="Already last">↓</button>';
        return '<div class="cat-row">' +
          '<div class="c-info"><img src="' + imgUrl(c.i, 80) + '" alt="" onerror="this.onerror=null;this.src=PLACEHOLDER"><div><div style="font-weight:600">' + esc(c.c) + '</div><div class="c-count">' + count + ' products · slug: ' + esc(c.cs) + '</div></div></div>' +
          '<div class="table-actions">' +
            upBtn + downBtn +
            '<button onclick="openCatForm(\'' + c.cs + '\')" title="Edit">' + IC.edit + '</button>' +
            '<button class="del" onclick="deleteCategory(\'' + c.cs + '\')" title="Delete">' + IC.del + '</button>' +
          '</div></div>';
      }).join("") +
    '</div></div>' +
    '<div class="admin-panel"><div class="panel-body"><div style="font-size:13px;color:var(--ink-soft)">Deleting a category does not delete its products — products move to the category you choose (or stay listed under their current slug).</div></div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Categories";
}
function moveCategory(cs, dir){
  const cats = getCats();
  const idx = cats.findIndex(c => c.cs === cs);
  if(idx < 0) return;
  const newIdx = idx + dir;
  if(newIdx < 0 || newIdx >= cats.length) return;
  const [item] = cats.splice(idx, 1);
  cats.splice(newIdx, 0, item);
  saveCats(cats).then(r => { if(r && r.ok) showToast("Category reordered"); });
  /* Force re-render navigation bar with updated category order */
  setTimeout(() => {
    try{ renderCatNav(); }catch(e){ console.warn("renderCatNav error:", e); }
  }, 50);
  adminCategories();
}

function openCatForm(cs){
  const cats = getCats();
  const c = cs ? cats.find(x => x.cs === cs) : null;
  $("#amTitle").textContent = c ? "Edit category" : "Add category";
  $("#amSub").textContent = c ? "Editing: " + c.c : "Create a new product category";
  $("#amBody").innerHTML =
    '<div class="form-grid">' +
      '<div class="field full"><label>Category name *</label><div style="display:flex;gap:8px"><input id="cfName" value="' + (c ? esc(c.c) : "") + '" placeholder="e.g. Body Lotion" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenCatDesc(this)" title="Generate description with AI">✨ AI</button></div></div>' +
      '<div class="field full"><label>Description</label><textarea id="cfDesc" rows="2" placeholder="e.g. Wholesale body lotions for brands, retailers & distributors — OEM/ODM available">' + (c ? esc(c.desc || "") : "") + '</textarea></div>' +
      '<div class="field full"><label>Cover image URL</label><input id="cfImg" value="' + (c ? esc(c.i) : "") + '" placeholder="https://… (leave empty for placeholder)" oninput="cfPreview(this.value)"></div>' +
      '<div class="field full"><label>Image preview</label><div class="pf-prev"><img id="cfImgPrev" src="' + (c ? imgUrl(c.i, 200) : PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=PLACEHOLDER"></div></div>' +
      '<div class="field full"><label>Or upload from your computer</label><label class="upload-btn" for="cfUpload">' + IC.up + ' Choose image file</label><input type="file" id="cfUpload" accept="image/*" style="display:none" onchange="uploadImageTo(\'cfUpload\',\'cfImg\',800)"><div class="form-hint">The image is compressed and stored with this category — no hosting needed. Tip: you can also paste any image URL directly.</div></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">' +
      '<button class="btn ghost" onclick="closeAdminModal()">Cancel</button>' +
      '<button class="btn" onclick="saveCatForm(\'' + (c ? c.cs : "") + '\')">' + (c ? "Save changes" : "Add category") + '</button>' +
    '</div>';
  $("#adminModal").classList.add("open");
}
function cfPreview(v){
  const el = $("#cfImgPrev"); if(!el) return;
  el.onerror = null;
  el.src = v && v.trim() ? v.trim() : PLACEHOLDER;
  el.onerror = () => { el.onerror = null; el.src = PLACEHOLDER; };
}

function saveCatForm(cs){
  const name = $("#cfName").value.trim();
  const desc = $("#cfDesc") ? $("#cfDesc").value.trim() : "";
  const img = $("#cfImg").value.trim();
  if(!name){ showToast("Please enter a category name"); return; }
  const cats = getCats();
  const existing = cs ? cats.find(x => x.cs === cs) : null;
  const newCs = cs || slugify(name);
  const toSave = [];
  if(existing){
    existing.c = name;
    if(desc) existing.desc = desc;
    if(img) existing.i = img;
    // update products that reference this category name/slug
    const products = getProducts();
    products.forEach(p => { if(p.cs === existing.cs) p.c = name; });
    toSave.push(saveProducts(products));
  } else {
    if(cats.some(x => x.cs === newCs)){ showToast("Category already exists"); return; }
    cats.push({ c: name, cs: newCs, desc: desc || "", i: img || PLACEHOLDER });
  }
  toSave.push(saveCats(cats));
  closeAdminModal();
  Promise.all(toSave).then(rs => { if(rs.length && rs.every(r => r && r.ok)) showToast(existing ? "Category updated" : "Category added"); });
  adminCategories();
}

function deleteCategory(cs){
  if(!confirm("Delete this category? Its products stay in the catalog.")) return;
  const cats = getCats().filter(c => c.cs !== cs);
  saveCats(cats).then(r => { if(r && r.ok) showToast("Category deleted"); });
  adminCategories();
}

/* ---- Theme admin ---- */
const THEME_PRESETS = [
  {name:"Nebula Pink", brand:"#ff5983", accent:"#25bab5"},
  {name:"Ocean Teal", brand:"#0e9f9c", accent:"#ff8fb3"},
  {name:"Royal Purple", brand:"#7c5cbf", accent:"#f2a65a"},
  {name:"Deep Green", brand:"#2e9e63", accent:"#ffb84d"},
  {name:"Classic Black", brand:"#1f1e23", accent:"#ff5983"}
];

async function adminCustomers(){
  /* Always reload accounts from Supabase to show the latest data */
  try {
    _cache.loaded = false;
    await sbLoadAll();
  } catch(e) {
    console.warn("Failed to reload accounts:", e);
  }
  const accs = getAccounts();
  const tiers = getTiers();
  const rows = accs.length ? accs.map(a => {
    const currentTier = a.tier || 'new';
    const tierOptions = tiers.map(t => 
      '<option value="' + t.id + '"' + (t.id === currentTier ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.discount + '%)</option>'
    ).join("");
    return '<tr>' +
      '<td><b>' + esc(a.name) + '</b></td>' +
      '<td>' + esc(a.email) + '</td>' +
      '<td>' + fmtD(a.created) + '</td>' +
      '<td>' + myOrders(a.email).length + '</td>' +
      '<td><select onchange="setCustomerTier(\'' + escJs(a.email) + '\', this.value)" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--card);color:var(--ink);cursor:pointer">' + tierOptions + '</select></td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        '<button class="btn sm ghost" onclick="adminResetCustomerPass(\'' + escJs(a.email) + '\')">Reset password</button> ' +
        '<button class="btn sm ghost" style="color:#c0392b;border-color:#e0b4b0" onclick="deleteCustomerAccount(\'' + escJs(a.email) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }).join("") : '<tr><td colspan="6" style="text-align:center;color:var(--ink-soft);padding:24px">No customer accounts yet — accounts appear here when customers create one on the Account page.</td></tr>';
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Customer Accounts</h3><div class="ph-sub">Everyone who created an account on the storefront</div></div><div style="display:flex;gap:8px"><button class="btn sm ghost" onclick="adminCustomers()">Refresh</button><button class="btn sm ghost" onclick="location.hash=\'#/admin/tiers\'">Manage Tiers</button><button class="btn sm ghost" onclick="location.hash=\'#/account\'">Open Account page</button></div></div>' +
    '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Orders</th><th>Tier</th><th style="text-align:right">Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="form-hint" style="margin-top:8px">Use <b>Tier</b> dropdown to assign a customer tier (discount applies automatically when they log in). Use <b>Reset password</b> to set a new password for a customer when they have forgotten theirs. Use <b>Delete</b> to remove a customer account (their orders will remain in the system). Changes apply immediately. Click <b>Refresh</b> to see the latest accounts.</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Customer Accounts";
}
function adminResetCustomerPass(email){
  const accs = getAccounts();
  const acc = accs.find(a => a.email === email);
  if(!acc){ showToast("Account not found"); return; }
  const np = prompt("Enter a new password for " + acc.email + " (min 6 characters):");
  if(np === null) return;
  if(np.trim().length < 6){ showToast("Password must be at least 6 characters"); return; }
  hashPass(np.trim()).then(hash => {
    acc.pass = hash;
    saveAccounts(accs);
    showToast("Password updated for " + acc.email);
  });
}

/* Delete a customer account */
function deleteCustomerAccount(email){
  const accs = getAccounts();
  const acc = accs.find(a => a.email === email);
  if(!acc){ showToast("Account not found"); return; }
  const orderCount = myOrders(email).length;
  const confirmMsg = "Delete customer account '" + acc.name + "' (" + email + ")?" +
    (orderCount > 0 ? "\n\nThis customer has " + orderCount + " order(s). Their orders will remain in the system, but the account will be removed." : "") +
    "\n\nThis action cannot be undone.";
  if(!confirm(confirmMsg)) return;
  const newAccs = accs.filter(a => a.email !== email);
  saveAccounts(newAccs);
  // Log the activity
  logActivity('delete', 'Customer account deleted: <strong>' + esc(acc.name || email) + '</strong> (' + esc(email) + ')', '#ef4444', IC.del);
  showToast("Customer account " + email + " deleted");
  adminCustomers();
}

/* ============ Customer Tiers Management ============ */
function adminTiers(){
  const tiers = getTiers();
  const accounts = getAccounts();
  
  /* Count customers per tier */
  const tierCounts = {};
  tiers.forEach(t => tierCounts[t.id] = 0);
  accounts.forEach(a => {
    const tierId = a.tier || 'new';
    if(tierCounts[tierId] !== undefined) tierCounts[tierId]++;
  });
  
  const rows = tiers.map((t, i) =>
    '<tr>' +
      '<td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + t.color + ';margin-right:8px;vertical-align:middle"></span><b>' + esc(t.name) + '</b></td>' +
      '<td>' + t.discount + '%</td>' +
      '<td>' + tierCounts[t.id] + ' customers</td>' +
      '<td>' + esc(t.description) + '</td>' +
      '<td style="text-align:right">' +
        '<button class="btn sm ghost" onclick="editTier(\'' + t.id + '\')">Edit</button> ' +
        (tiers.length > 1 ? '<button class="btn sm ghost" style="color:#c0392b;border-color:#e0b4b0" onclick="deleteTier(\'' + t.id + '\')">Delete</button>' : '') +
      '</td>' +
    '</tr>'
  ).join("");
  
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Customer Tiers</h3><div class="ph-sub">Set discount levels for different customer groups</div></div><div style="display:flex;gap:8px"><button class="btn sm ghost" onclick="adminTiers()">Refresh</button></div></div>' +
    '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table"><thead><tr><th>Tier Name</th><th>Discount</th><th>Customers</th><th>Description</th><th style="text-align:right">Action</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="panel-body" style="border-top:1px solid var(--border);padding-top:16px">' +
      '<h4 style="margin:0 0 12px">Add New Tier</h4>' +
      '<div class="form-grid">' +
        '<div class="field"><label>Tier Name</label><input id="newTierName" type="text" placeholder="e.g. Gold Customer"></div>' +
        '<div class="field"><label>Discount (%)</label><input id="newTierDiscount" type="number" min="0" max="100" placeholder="e.g. 15"></div>' +
        '<div class="field"><label>Color</label><input id="newTierColor" type="color" value="#8b5cf6"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>Description</label><input id="newTierDesc" type="text" placeholder="e.g. Gold customers get 15% discount"></div>' +
      '</div>' +
      '<button class="btn" onclick="addTier()">Add Tier</button>' +
    '</div>' +
    '<div class="form-hint" style="margin-top:8px">Customer tiers automatically apply discounts when customers are logged in. Assign tiers to customers in the <a href="#/admin/customers">Customer Accounts</a> page.</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Customer Tiers";
}

function addTier(){
  const name = ($("#newTierName").value || "").trim();
  const discount = Number($("#newTierDiscount").value || 0);
  const color = $("#newTierColor").value || "#8b5cf6";
  const desc = ($("#newTierDesc").value || "").trim();
  if(!name){ showToast("Enter a tier name"); return; }
  if(discount < 0 || discount > 100){ showToast("Discount must be 0-100"); return; }
  const tiers = getTiers();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if(tiers.some(t => t.id === id)){ showToast("This tier already exists"); return; }
  tiers.push({ id, name, discount, color, description: desc || name + ' - ' + discount + '% discount' });
  saveTiers(tiers);
  showToast("Tier " + name + " added");
  adminTiers();
}

function editTier(tierId){
  const tiers = getTiers();
  const tier = tiers.find(t => t.id === tierId);
  if(!tier){ showToast("Tier not found"); return; }
  const name = prompt("Tier name:", tier.name);
  if(name === null) return;
  const discount = prompt("Discount (%):", tier.discount);
  if(discount === null) return;
  const desc = prompt("Description:", tier.description);
  if(desc === null) return;
  tier.name = name.trim() || tier.name;
  tier.discount = Math.max(0, Math.min(100, Number(discount) || 0));
  tier.description = desc.trim() || tier.description;
  saveTiers(tiers);
  showToast("Tier updated");
  adminTiers();
}

function deleteTier(tierId){
  const tiers = getTiers();
  if(tiers.length <= 1){ showToast("Cannot delete the last tier"); return; }
  const tier = tiers.find(t => t.id === tierId);
  if(!tier){ showToast("Tier not found"); return; }
  if(!confirm("Delete tier '" + tier.name + "'? Customers in this tier will be moved to 'New Customer'.")) return;
  /* Move customers in this tier to 'new' */
  const accounts = getAccounts();
  accounts.forEach(a => {
    if(a.tier === tierId) a.tier = 'new';
  });
  saveAccounts(accounts);
  /* Remove the tier */
  const newTiers = tiers.filter(t => t.id !== tierId);
  saveTiers(newTiers);
  showToast("Tier deleted");
  adminTiers();
}

/* Set customer tier */
function setCustomerTier(email, tierId){
  const accounts = getAccounts();
  const acc = accounts.find(a => a.email === email);
  if(!acc){ showToast("Account not found"); return; }
  acc.tier = tierId;
  saveAccounts(accounts);
  showToast("Tier updated for " + email);
  adminCustomers();
}
function adminAdminUsers(){
  const admins = getAdmins();
  const rows = admins.map(a =>
    '<tr>' +
      '<td><b>' + esc(a.user) + '</b></td>' +
      '<td>' + esc(a.name || a.user) + '</td>' +
      '<td>' + fmtD(a.created) + '</td>' +
      '<td style="text-align:right">' +
        '<button class="btn sm ghost" onclick="adminChangeAdminPass(\'' + escJs(a.user) + '\')">Change password</button> ' +
        (admins.length > 1 ? '<button class="btn sm ghost" style="color:#c0392b;border-color:#e0b4b0" onclick="adminDeleteAdmin(\'' + escJs(a.user) + '\')">Remove</button>' : '') +
      '</td>' +
    '</tr>'
  ).join("");
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Admin Users</h3><div class="ph-sub">People allowed to sign in to this Admin Panel</div></div></div>' +
    '<div class="panel-body">' +
      '<table class="admin-table"><thead><tr><th>Login name</th><th>Display name</th><th>Created</th><th style="text-align:right">Action</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="margin-top:18px;border-top:1px solid var(--line);padding-top:16px">' +
        '<h4 style="margin:0 0 10px">Add admin account</h4>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Login name</label><input id="auUser" type="text" placeholder="e.g. sales"></div>' +
          '<div class="field"><label>Password (min 6 chars)</label><input id="auPass" type="password" placeholder="••••••••"></div>' +
          '<div class="field"><label>Display name</label><input id="auName" type="text" placeholder="e.g. Sales Team"></div>' +
        '</div>' +
        '<button class="btn" onclick="adminAddAdmin()">Add Admin</button>' +
      '</div>' +
    '</div></div>' +
    '<div class="form-hint" style="margin-top:8px">You can change any admin password and add more admin accounts here. The last remaining admin account cannot be removed.</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Admin Users";
}
async function adminAddAdmin(){
  const u = ($("#auUser").value || "").trim();
  const p = $("#auPass").value || "";
  const n = ($("#auName").value || "").trim();
  if(!u){ showToast("Enter a login name"); return; }
  if(p.length < 6){ showToast("Password must be at least 6 characters"); return; }
  const admins = getAdmins();
  if(admins.some(a => a.user.toLowerCase() === u.toLowerCase())){ showToast("This login name already exists"); return; }
  /* Hash password before storing */
  const hashedPass = await hashPass(p);
  admins.push({ user: u, pass: hashedPass, name: n || u, created: new Date().toISOString() });
  saveAdmins(admins).then(r => { if(r && r.ok) showToast("Admin " + u + " added"); });
  adminAdminUsers();
}
async function adminChangeAdminPass(user){
  const admins = getAdmins();
  const a = admins.find(x => x.user === user);
  if(!a){ showToast("Admin not found"); return; }
  const np = prompt("Enter a new password for \"" + a.user + "\" (min 6 characters):");
  if(np === null) return;
  if(np.trim().length < 6){ showToast("Password must be at least 6 characters"); return; }
  /* Hash password before storing */
  a.pass = await hashPass(np.trim());
  saveAdmins(admins).then(r => { if(r && r.ok) showToast("Password updated for " + user); });
}
function adminDeleteAdmin(user){
  const admins = getAdmins();
  if(admins.length <= 1){ showToast("Cannot remove the last admin account"); return; }
  if(!confirm("Remove admin \"" + user + "\"? They will no longer be able to sign in.")) return;
  saveAdmins(admins.filter(a => a.user !== user)).then(r => { if(r && r.ok) showToast("Admin " + user + " removed"); });
  adminAdminUsers();
}

function adminTheme(){
  const th = getTheme();
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Store Theme</h3><div class="ph-sub">Brand identity, hero banner and homepage popup</div></div><button class="btn sm ghost" onclick="resetTheme()">Reset to default</button></div>' +
    '<div class="panel-body">' +
      '<div class="form-grid">' +
        '<div class="field full"><label>Store name</label><input id="thName" value="' + esc(th.storeName) + '"></div>' +
        '<div class="field full"><label>Tagline (small text under logo)</label><input id="thTag" value="' + esc(th.tagline) + '"></div>' +
        '<div class="field"><label>Brand color</label><input id="thBrand" type="color" value="' + th.brandColor + '" style="height:46px;padding:4px"></div>' +
        '<div class="field"><label>Accent color</label><input id="thAccent" type="color" value="' + th.accentColor + '" style="height:46px;padding:4px"></div>' +
        '<div class="field full"><label>Color presets</label><div class="theme-swatches" id="thSwatches">' +
          THEME_PRESETS.map((p,i) => '<button class="swatch" style="background:' + p.brand + '" title="' + p.name + '" onclick="applyPreset(' + i + ')"></button>').join("") +
        '</div></div>' +
        '<div class="field"><label>Hero kicker</label><input id="thKicker" value="' + esc(th.heroKicker) + '"></div>' +
        '<div class="field full"><label>Hero title</label><div style="display:flex;gap:8px"><input id="thTitle" value="' + esc(th.heroTitle) + '" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'thTitle\', this)" title="Generate with AI">✨ AI</button></div></div>' +
        '<div class="field full"><label>Hero subtitle</label><div style="display:flex;gap:8px;align-items:flex-start"><textarea id="thSub" rows="2" style="flex:1">' + esc(th.heroSub) + '</textarea><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'thSub\', this)" title="Generate with AI">✨ AI</button></div></div>' +
        '<div class="field full"><label>Hero banner image (URL or upload)</label><div style="display:flex;gap:8px;align-items:center"><input id="thBanner" value="' + esc(th.banner) + '" style="flex:1" placeholder="Paste image URL or click Upload"><button type="button" class="btn sm" style="flex-shrink:0" onclick="document.getElementById(\'thBannerFile\').click()">Upload Image</button></div><input type="file" id="thBannerFile" accept="image/*" style="display:none" onchange="handleBannerUpload(this)"><div id="thBannerPreview" style="margin-top:8px"></div></div>' +
      '</div>' +
    '</div></div>' +
    '<div class="admin-panel"><div class="panel-head"><div><h3>Homepage Popup</h3><div class="ph-sub">A promotional popup shown once per session on the homepage</div></div></div>' +
    '<div class="panel-body">' +
      '<div class="form-grid">' +
        '<div class="field"><label>Enable popup</label><select id="thPopupEnabled"><option value="1"' + (th.popupEnabled ? " selected" : "") + '>On — show on homepage</option><option value="0"' + (!th.popupEnabled ? " selected" : "") + '>Off — hidden</option></select></div>' +
        '<div class="field full"><label>Popup title</label><input id="thPopupTitle" value="' + esc(th.popupTitle) + '"></div>' +
        '<div class="field full"><label>Popup content (HTML)</label><textarea id="thPopupBody" rows="4">' + esc(th.popupBody) + '</textarea></div>' +
        '<div class="field full"><label>Popup image (URL or upload)</label><div style="display:flex;gap:8px;align-items:center"><input id="thPopupImg" value="' + esc(th.popupImage) + '" style="flex:1" placeholder="Paste image URL or click Upload"><button type="button" class="btn sm" style="flex-shrink:0" onclick="document.getElementById(\'thPopupImgFile\').click()">Upload Image</button></div><input type="file" id="thPopupImgFile" accept="image/*" style="display:none" onchange="handlePopupImgUpload(this)"><div id="thPopupImgPreview" style="margin-top:8px"></div></div>' +
        '<div class="field"><label>Button text</label><input id="thPopupBtnText" value="' + esc(th.popupBtnText) + '"></div>' +
        '<div class="field"><label>Button link</label><input id="thPopupBtnLink" value="' + esc(th.popupBtnLink) + '" placeholder="mailto: or https://"></div>' +
      '</div>' +
    '</div></div>' +
    '<div class="save-bar"><span class="sb-note">Changes apply to the storefront immediately after saving.</span><button class="btn" onclick="saveThemeForm()">Save Theme</button></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Theme";
}
function adminEmails(){
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Order Emails</h3><div class="ph-sub">Auto-send every new order to your inbox — Resend via Vercel Edge Function</div></div></div>' +
    '<div class="panel-body">' +
      '<div class="form-grid">' +
        '<div class="field full" id="emailStatus"><label>Server Status (Vercel Edge Function)</label><div style="padding:10px;border-radius:8px;background:#f0f0f0;color:#666" id="emailStatusText">Checking...</div></div>' +
        '<div class="field full" id="emailParams"><label>Vercel Environment Variables</label><div style="padding:10px;border-radius:8px;background:#f8f9fa;font-family:monospace;font-size:12px" id="emailParamsList">Loading...</div></div>' +
      '</div>' +
      '<div class="form-hint" style="margin-top:12px">Emails are sent server-side through <code>/api/send-email</code> (Resend). Keys live only in Vercel env vars — nothing to configure here.</div>' +
      '<button class="btn ghost" style="margin-top:12px" onclick="sendTestOrderEmail()">Send Test Email</button>' +
      '<div class="form-hint" style="margin-top:10px"><b>Still not receiving order emails?</b> (1) click <b>Send Test Email</b>; (2) check spam folder; (3) verify env vars above are all ✅ in Vercel. Orders are always saved in Admin → Orders and downloadable as Excel/CSV regardless of email.</div>' +
    '</div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Order Emails";
  /* Check server config status */
  fetch("/api/email-config").then(r => r.json()).then(cfg => {
    const el = $("#emailStatusText");
    if(!el) return;
    if(cfg.enabled){
      el.style.background = "#d4edda"; el.style.color = "#155724";
      el.innerHTML = "<b>Email is enabled.</b> Orders and contact forms are sent automatically via Vercel Edge Function.";
    }else if(cfg.configured){
      el.style.background = "#fff3cd"; el.style.color = "#856404";
      el.innerHTML = "<b>Email keys are set but MAIL_ENABLED is false.</b> Set MAIL_ENABLED=true in Vercel env vars to enable.";
    }else{
      el.style.background = "#f8d7da"; el.style.color = "#721c24";
      el.innerHTML = "<b>Email not configured.</b> Set RESEND_API_KEY, MAIL_FROM, MAIL_RECIPIENTS and MAIL_ENABLED in the Vercel dashboard.";
    }
    /* Show parameter status */
    const pl = $("#emailParamsList");
    if(pl && cfg.params){
      const rows = Object.entries(cfg.params).map(([k,v]) => {
        const icon = v ? "✅" : "❌";
        const val = v ? "set" : "not set";
        return '<div style="padding:3px 0;display:flex;align-items:center;gap:8px"><span>' + icon + '</span><code style="flex:1">' + k + '</code><span style="color:' + (v ? '#155724' : '#721c24') + '">' + val + '</span></div>';
      });
      pl.innerHTML = rows.join("");
    }
  }).catch(() => {
    const el = $("#emailStatusText");
    if(el){ el.style.background = "#f8d7da"; el.style.color = "#721c24"; el.innerHTML = "Could not check email config."; }
  });
}
function adminContent(){
  const c = getContent();
  const tb = c.topbar || {};
  const fo = c.footer || {};
  const ab = c.about || {};
  // Default content (shown in editor when no custom override exists)
  const DEF = {
    topbarWelcome: "Welcome to Nebula Secret",
    footerDesc: "We supply everyday products you find in department stores — skincare, body care, home wellness and much more — tailored to your requirements through wholesale and OEM/ODM.",
    footerCopy: "© 2026 Nebula Secret. All rights reserved.",
    storyT: "Our Story",
    storyB: '<p>Founded in the United Kingdom, <strong>Nebula Secret</strong> is the wholesale and OEM/ODM home of <strong>Nebula Corporate Limited</strong>. With offices in London, Hong Kong and mainland China, and a trusted network of manufacturers across China and the Asia-Pacific region, we bring together global expertise, craftsmanship and a genuine passion for quality.</p><p>What began as a sourcing house with a passion for quality has grown into a brand dedicated to making everyday products a little more special. Every product in our collection is carefully curated to combine on-trend design, superior quality and honest pricing — so your customers can enjoy a little everyday luxury without compromise.</p><p>From body scrubs and facial masks to essential oils, incense and other everyday essentials found in department stores, each item is chosen with care, tested with attention, and delivered with the promise that it deserves a place in your home.</p>',
    missionT: "Our Mission",
    missionLead: "We believe self-care should be simple, joyful and accessible to everyone.",
    missionB: '<p>From the first concept to the final product, we oversee every step — sourcing, formulation, packaging and quality control — to deliver products that feel good and do good. We bridge global markets so that the finest ingredients, trends and craftsmanship can reach your doorstep, wherever you are.</p><p>We build everything on <strong>trust, integrity and transparency</strong>. We work closely with our manufacturing partners to ensure every batch meets our strict standards, and we are always honest about what goes into our products — because you deserve to know exactly what you are bringing into your home.</p>',
    promiseT: "Our Promise to You",
    promiseLead: "Five principles that guide everything we make and do."
  };
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Site Content</h3><div class="ph-sub">Edit the text of the top bar, footer and About page. Fields show the current live text (default or custom).</div></div><button class="btn sm ghost" onclick="if(confirm(\'Reset all site content to defaults?\')){ resetContent(); applyFooterContent(); showToast(\'Site content reset to defaults\'); adminContent(); }">Reset all</button></div>' +
    '<div class="panel-body">' +
      '<details class="ct-block" open><summary><b>Top bar (black bar at the very top)</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field full"><label>Welcome text</label><input id="ctTopbarWelcome" value="' + esc(tb.welcome || DEF.topbarWelcome) + '"></div>' +
        '</div></details>' +
      '<details class="ct-block" open><summary><b>Footer</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field full"><label>Brand description</label><div style="display:flex;gap:8px;align-items:flex-start"><textarea id="ctFooterDesc" rows="3" style="flex:1">' + esc(fo.desc || DEF.footerDesc) + '</textarea><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctFooterDesc\', this)" title="Generate with AI">✨ AI</button></div></div>' +
          '<div class="field full"><label>Copyright line</label><input id="ctFooterCopy" value="' + esc(fo.copyright || DEF.footerCopy) + '"></div>' +
        '</div></details>' +
      '<details class="ct-block" open><summary><b>About — Our Story</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Section title</label><div style="display:flex;gap:8px"><input id="ctStoryT" value="' + esc((ab.story||{}).t || DEF.storyT) + '" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctStoryT\', this)" title="Generate with AI">✨ AI</button></div></div>' +
          '<div class="field full"><label>Body (HTML)</label><div style="display:flex;gap:8px;align-items:flex-start"><textarea id="ctStoryB" rows="6" style="flex:1">' + esc((ab.story||{}).b || DEF.storyB) + '</textarea><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctStoryB\', this)" title="Generate with AI">✨ AI</button></div></div>' +
        '</div></details>' +
      '<details class="ct-block"><summary><b>About — Our Mission</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Section title</label><div style="display:flex;gap:8px"><input id="ctMissionT" value="' + esc((ab.mission||{}).t || DEF.missionT) + '" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctMissionT\', this)" title="Generate with AI">✨ AI</button></div></div>' +
          '<div class="field"><label>Lead line</label><div style="display:flex;gap:8px"><input id="ctMissionLead" value="' + esc((ab.mission||{}).lead || DEF.missionLead) + '" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctMissionLead\', this)" title="Generate with AI">✨ AI</button></div></div>' +
          '<div class="field full"><label>Body (HTML)</label><div style="display:flex;gap:8px;align-items:flex-start"><textarea id="ctMissionB" rows="6" style="flex:1">' + esc((ab.mission||{}).b || DEF.missionB) + '</textarea><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctMissionB\', this)" title="Generate with AI">✨ AI</button></div></div>' +
        '</div></details>' +
      '<details class="ct-block"><summary><b>About — Our Promise</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Section title</label><div style="display:flex;gap:8px"><input id="ctPromiseT" value="' + esc((ab.promise||{}).t || DEF.promiseT) + '" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctPromiseT\', this)" title="Generate with AI">✨ AI</button></div></div>' +
          '<div class="field full"><label>Lead line</label><div style="display:flex;gap:8px"><input id="ctPromiseLead" value="' + esc((ab.promise||{}).lead || DEF.promiseLead) + '" style="flex:1"><button type="button" class="btn sm ghost" style="flex-shrink:0" onclick="aiGenerateCopy(\'ctPromiseLead\', this)" title="Generate with AI">✨ AI</button></div></div>' +
        '</div></details>' +
    '</div></div>' +
    '<div class="save-bar"><span class="sb-note">Edit any field above and click Save. Empty fields are not saved (keeps current content).</span><button class="btn" onclick="saveContentForm()">Save Content</button></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Site Content";
}
function saveContentForm(){
  const val = id => { const el = document.getElementById(id); return el ? el.value : ""; };
  const c = {
    topbar: { welcome: val("ctTopbarWelcome").trim() },
    footer: { desc: val("ctFooterDesc").trim(), copyright: val("ctFooterCopy").trim() },
    about: {
      story: { t: val("ctStoryT").trim(), b: val("ctStoryB") },
      mission: { t: val("ctMissionT").trim(), lead: val("ctMissionLead").trim(), b: val("ctMissionB") },
      promise: { t: val("ctPromiseT").trim(), lead: val("ctPromiseLead").trim() }
    }
  };
  cleanContentObj(c);
  saveContent(c).then(r => { if(r && r.ok) showToast("Site content saved"); });
  applyFooterContent();
}
function cleanContentObj(obj){
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    if(v && typeof v === "object" && !Array.isArray(v)){
      cleanContentObj(v);
      if(Object.keys(v).length === 0) delete obj[k];
    } else if(typeof v === "string" && !v.trim()){
      delete obj[k];
    }
  });
}


function handleBannerUpload(input){
  const file = input.files[0];
  if(!file) return;
  if(!file.type.startsWith("image/")){ showToast("Please select an image file"); return; }
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const canvas = document.createElement("canvas");
      const maxW = 1600;
      let w = img.width, h = img.height;
      if(w > maxW){ h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const inp = document.getElementById("thBanner");
      if(inp) inp.value = dataUrl;
      const prev = document.getElementById("thBannerPreview");
      if(prev) prev.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;max-height:140px;border-radius:8px;border:1px solid var(--line)">';
      showToast("Banner image uploaded — click Save to apply");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function handlePopupImgUpload(input){
  const file = input.files[0];
  if(!file) return;
  if(!file.type.startsWith("image/")){ showToast("Please select an image file"); return; }
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const canvas = document.createElement("canvas");
      const maxW = 1200;
      let w = img.width, h = img.height;
      if(w > maxW){ h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const inp = document.getElementById("thPopupImg");
      if(inp) inp.value = dataUrl;
      const prev = document.getElementById("thPopupImgPreview");
      if(prev) prev.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;max-height:140px;border-radius:8px;border:1px solid var(--line)">';
      showToast("Popup image uploaded — click Save to apply");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function applyPreset(i){
  const p = THEME_PRESETS[i];
  $("#thBrand").value = p.brand;
  $("#thAccent").value = p.accent;
}
async function sendTestOrderEmail(){
  const cfg = await fetch("/api/email-config").then(r => r.json()).catch(() => ({}));
  if(!cfg.enabled){ showToast("Email not enabled — set MAIL_ENABLED=true and RESEND env vars in Vercel"); return; }
  const n = Math.floor(1000000 + Math.random() * 9000000);
  const test = {
    id: "TEST-" + n,
    date: new Date().toISOString(),
    cur: curCode, rate: rateOf(curCode),
    customer: { first:"Test", last:"Order", email:"", address:"", country:"Hong Kong SAR", phone:"", contact:"" },
    items: [{ id:"0", name:"Test Product", cat:"other", price: 10, qty: 1 }],
    total: 10, status:"New"
  };
  showToast("Sending test email…");
  const r = await sendOrderEmail(test);
  if(r.ok){
    showToast("Test email sent — check inbox");
  }else{
    showToast("Failed: " + (r.detail || r.reason || "unknown error"));
  }
}
function saveThemeForm(){
  const th = getTheme();
  th.storeName = $("#thName").value.trim() || "Nebula Secret";
  th.tagline = $("#thTag").value.trim();
  th.brandColor = $("#thBrand").value;
  th.accentColor = $("#thAccent").value;
  th.heroKicker = $("#thKicker").value.trim();
  th.heroTitle = $("#thTitle").value.trim();
  th.heroSub = $("#thSub").value.trim();
  th.banner = $("#thBanner").value.trim() || BANNER;
  th.popupEnabled = $("#thPopupEnabled").value === "1";
  th.popupTitle = $("#thPopupTitle").value.trim();
  th.popupBody = $("#thPopupBody").value.trim();
  th.popupImage = $("#thPopupImg").value.trim();
  th.popupBtnText = $("#thPopupBtnText").value.trim();
  th.popupBtnLink = $("#thPopupBtnLink").value.trim();
  saveTheme(th).then(r => { if(r && r.ok) showToast("Theme saved"); });
  applyTheme();
}
function resetTheme(){
  if(!confirm("Reset theme to defaults?")) return;
  localStorage.removeItem(LS.theme);
  applyTheme();
  showToast("Theme reset");
  adminTheme();
}

function applyTheme(){
  const th = getTheme();
  const r = document.documentElement.style;
  r.setProperty("--brand", th.brandColor);
  r.setProperty("--brand-dark", shade(th.brandColor, -12));
  r.setProperty("--brand-soft", shade(th.brandColor, 92, true));
  r.setProperty("--accent", th.accentColor);
  r.setProperty("--accent-soft", shade(th.accentColor, 90, true));
  $("#brandName").innerHTML = esc(th.storeName) + "<small>" + esc(th.tagline) + "</small>";
  document.title = th.storeName + " — Wholesale Supplier & OEM/ODM Manufacturer";
}

/* simple color shade util */
function shade(hex, pct, soft){
  const h = hex.replace("#","");
  const num = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const amt = Math.round(255 * Math.abs(pct) / 100);
  if(soft){ r = Math.round(r + (255 - r) * (pct / 100)); g = Math.round(g + (255 - g) * (pct / 100)); b = Math.round(b + (255 - b) * (pct / 100)); }
  else if(pct < 0){ r -= amt; g -= amt; b -= amt; } else { r += amt; g += amt; b += amt; }
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "rgb(" + r + "," + g + "," + b + ")";
}

/* ---- Admin auth & route ---- */
async function viewAdminLogin(msg){
  const admins = getAdmins();
  let hasAdmins = admins && admins.length > 0;
  
  /* Also check the server-side admin count via privileged RPC (RLS-safe —
     the raw admins row is admin-only, so getAdmins() is empty pre-login) */
  if(!hasAdmins && typeof supabase !== 'undefined'){
    try{
      const { data, error } = await supabase.rpc('admin_count');
      if(!error && data > 0){
        hasAdmins = true;
      }
    }catch(e){
      console.log("Failed to check admin count:", e.message);
    }
  }
  
  if(!hasAdmins){
    /* No admins exist — show initialization page */
    $("#app").innerHTML =
    '<div class="admin-login">' +
      '<div class="login-card">' +
        '<img class="l-logo" src="images/Neubla_logo_black_1729172124.png" alt="Nebula Secret">' +
        '<h1>Initialize Admin</h1>' +
        '<p class="l-sub">Create your first admin account to get started</p>' +
        '<div class="login-err" id="initErr"></div>' +
        '<div class="field"><label>Admin Name</label><input id="initName" type="text" placeholder="Admin User" autocomplete="off"></div>' +
        '<div class="field"><label>Email</label><input id="initEmail" type="email" placeholder="admin@example.com" autocomplete="off"></div>' +
        '<div class="field"><label>Password</label><input id="initPass" type="password" placeholder="Min 8 characters" autocomplete="new-password"></div>' +
        '<div class="field"><label>Confirm Password</label><input id="initPass2" type="password" placeholder="Confirm password" autocomplete="new-password"></div>' +
        '<button class="btn full" style="margin-top:8px" onclick="doInitAdmin()">Create Admin Account</button>' +
        '<p style="text-align:center;font-size:12px;color:var(--ink-soft);margin-top:16px">This account will have full admin access</p>' +
      '</div>' +
    '</div>';
    return;
  }
  
  $("#app").innerHTML =
  '<div class="admin-login">' +
    '<div class="login-card">' +
      '<img class="l-logo" src="images/Neubla_logo_black_1729172124.png" alt="Nebula Secret">' +
      '<h1>Admin Login</h1>' +
      '<p class="l-sub">Nebula Secret management console</p>' +
      '<div class="login-err' + (msg ? " show" : "") + '" id="loginErr">' + (msg ? esc(msg) : "") + '</div>' +
      '<div class="field"><label>Email</label><input id="loginEmail" name="ns-login-id" type="email" placeholder="Enter your email" autocomplete="off" readonly onfocus="this.removeAttribute(\'readonly\')"></div>' +
      '<div class="field"><label>Password</label><input id="loginPass" name="ns-login-key" type="password" placeholder="••••••••" autocomplete="new-password" readonly onfocus="this.removeAttribute(\'readonly\')" onkeydown="if(event.key===\'Enter\')doLogin()"></div>' +
      '<button class="btn full" style="margin-top:8px" onclick="doLogin()">Sign in</button>' +
      '<p style="text-align:center;font-size:12px;color:var(--ink-soft);margin-top:16px">Secure login powered by Supabase Auth</p>' +
    '</div>' +
  '</div>';
}

/* Initialize first admin account */
async function doInitAdmin(){
  const name = $("#initName").value.trim();
  const email = $("#initEmail").value.trim().toLowerCase();
  const pass = $("#initPass").value;
  const pass2 = $("#initPass2").value;
  const err = $("#initErr");
  
  if(!name || !email || !pass){
    err.textContent = "Please fill in all fields.";
    err.classList.add("show");
    return;
  }
  if(pass.length < 8){
    err.textContent = "Password must be at least 8 characters.";
    err.classList.add("show");
    return;
  }
  if(pass !== pass2){
    err.textContent = "Passwords do not match.";
    err.classList.add("show");
    return;
  }
  
  const btn = document.querySelector(".admin-login .btn.full");
  if(btn){ btn.disabled = true; btn.textContent = "Creating..."; }
  
  try{
    /* Hash password */
    const hashedPass = await hashPass(pass);
    
    /* Create admin account */
    const newAdmin = {
      user: email,
      pass: hashedPass,
      name: name,
      email: email,
      role: "superadmin",
      created: new Date().toISOString()
    };
    
    /* Create admin via privileged bootstrap RPC (only works while the admins
       list is empty; the raw row is admin-only) */
    const rpcRes = await supabase.rpc('bootstrap_admin', { u: email, pass_hash: hashedPass, n: name });
    if(rpcRes.error || !rpcRes.data){
      if(err) err.textContent = "An admin account already exists — please sign in.";
      if(err && err.classList) err.classList.add("show");
      if(btn){ btn.disabled = false; btn.textContent = "Create Admin Account"; }
      return;
    }
    showToast("Admin account created successfully");
    
    /* Also try to create Supabase Auth user */
    try{
      await supabase.auth.signUp({
        email: email,
        password: pass,
        options: {
          data: { name: name, role: "superadmin" }
        }
      });
    }catch(e){
      console.log("Supabase Auth signup failed, using legacy admin only:", e.message);
    }
    
    viewAdminLogin("Account created. Please sign in.");
  }catch(e){
    err.textContent = "Failed to create admin account: " + e.message;
    err.classList.add("show");
    if(btn){ btn.disabled = false; btn.textContent = "Create Admin Account"; }
  }
}

async function doLogin(){
  const email = $("#loginEmail").value.trim();
  const p = $("#loginPass").value;
  const btn = document.querySelector(".admin-login .btn.full");
  if(!email || !p){
    const err = $("#loginErr");
    err.textContent = "Please enter both email and password.";
    err.classList.add("show");
    return;
  }
  if(btn){ btn.disabled = true; btn.textContent = "Signing in..."; }

  let supabaseLoginFailed = false;
  let supabaseErrorMsg = "";

  /* Method 1: Try Supabase Auth first (only if Supabase is available) */
  if(supabase && supabaseAvailable){
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: p
      });
      if(error){
        supabaseLoginFailed = true;
        supabaseErrorMsg = error.message || "Unknown error";
        console.warn("Supabase Auth login failed:", supabaseErrorMsg);
      } else if(!error && data && data.user){
        /* Check if user has admin role: JWT user_metadata first (authoritative),
           then the site's own admin list (getAdmins). A successful Supabase
           Auth already proved the password. */
        let roleOK = false;
        try{
          const meta = data.user.user_metadata || {};
          if(meta.role === 'admin' || meta.role === 'superadmin') roleOK = true;
        }catch(metaErr){}
        const siteAdmins = getAdmins();
        const matchesSiteAdmin = siteAdmins.some(a =>
          String(a.user || a.email || "").toLowerCase() === String(data.user.email || "").toLowerCase()
        );
        if(roleOK || matchesSiteAdmin){
          /* User is an admin, keep Supabase Auth session active */
          showToast("Welcome, " + (data.user.email) + " — loading admin data...");
          /* Reload all data with admin permissions (orders, accounts, quotes, etc.) */
          try {
            _cache.loaded = false;
            await sbLoadAll();
          } catch(e) {
            console.warn("Failed to reload admin data:", e);
          }
          location.hash = "#/admin/dashboard";
          return;
        }else{
          /* Not an admin, sign out and try legacy method */
          await supabase.auth.signOut();
          supabaseLoginFailed = true;
          supabaseErrorMsg = "User does not have admin role";
        }
      }
    } catch(e) {
      supabaseLoginFailed = true;
      supabaseErrorMsg = e.message || "Network or CORS error";
      console.warn("Supabase Auth login exception, trying legacy method:", supabaseErrorMsg);
    }
  } else {
    console.warn("Supabase not available, skipping Supabase Auth login");
  }

  /* Method 2: Legacy admin system via privileged RPC (the admins row is not
     publicly readable; verified server-side) */
  try {
    if(supabase){
      const hashed = await hashPass(p);
      const { data, error } = await supabase.rpc('admin_login', { e: email, h: hashed });
      if(!error && data && data.ok){
        /* Set legacy admin session */
        setAdminSession(data.user, data.name || data.user);
        showToast("Welcome, " + (data.name || data.user) + " — loading admin data...");
        /* Reload all data with admin permissions */
        try {
          _cache.loaded = false;
          await sbLoadAll();
        } catch(e) {
          console.warn("Failed to reload admin data:", e);
        }
        location.hash = "#/admin/dashboard";
        return;
      }
    }
  } catch(e) {
    console.error("Legacy login error:", e);
  }

  /* Both methods failed - provide detailed error message */
  const err = $("#loginErr");
  let errorMsg = "Invalid email or password.";
  
  /* If Supabase login failed, provide more helpful error message */
  if(supabaseLoginFailed && supabaseErrorMsg){
    if(supabaseErrorMsg.includes("Invalid login credentials") || 
       supabaseErrorMsg.includes("Invalid password") ||
       supabaseErrorMsg.includes("Email not confirmed")){
      errorMsg = "Invalid email or password. Please check your credentials.";
    } else if(supabaseErrorMsg.includes("CORS") || 
              supabaseErrorMsg.includes("Network") ||
              supabaseErrorMsg.includes("Failed to fetch")){
      errorMsg = "Connection error. Please check your internet connection or try again later.";
    } else {
      errorMsg = "Login failed: " + supabaseErrorMsg;
    }
  }
  
  /* Add hint about custom domain configuration */
  const currentDomain = window.location.hostname;
  if(currentDomain !== 'localhost' && !currentDomain.includes('vercel.app')){
    errorMsg += " If you are using a custom domain, please ensure it is configured in Supabase Auth settings (Redirect URLs and CORS Origins).";
  }
  
  err.textContent = errorMsg;
  err.classList.add("show");
  if(btn){ btn.disabled = false; btn.textContent = "Sign in"; }
}

async function logout(){
  try {
    await supabase.auth.signOut();
  } catch(e) {
    console.error("Logout error:", e);
  }
  /* Clear any legacy session data */
  setAdmin(false);
  try{ localStorage.removeItem(LS.asession); }catch(e){}
  window._adminToken = null;
  showToast("Logged out");
  location.hash = "#/";
}

/* System Architecture — embedded into Admin Panel (no more separate page) */
async function adminArchitecture(){
  $("#adminTitle").textContent = "System Architecture";
  renderAdminShell('<div class="admin-panel"><div class="panel-body" style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">🏗️</div><h3>Loading architecture…</h3></div></div>');
  try{
    if(!document.getElementById("archAdmCss")){
      const link = document.createElement("link");
      link.id = "archAdmCss"; link.rel = "stylesheet"; link.href = "architecture-admin.css";
      document.head.appendChild(link);
    }
    const res = await fetch("architecture-admin.html", { cache: "no-store" });
    const frag = await res.text();
    renderAdminShell(
      '<div class="admin-panel"><div class="panel-head"><div><h3>🏗️ System Architecture</h3><div class="ph-sub">完整系統架構圖 — 系統層級、用戶角色、頁面與外部服務的關係</div></div></div>' +
      '<div class="panel-body" style="padding:6px 14px 20px"><div class="arch-adm">' + frag + '</div></div></div>'
    );
  }catch(e){
    renderAdminShell('<div class="admin-panel"><div class="panel-body" style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">⚠️</div><h3>Failed to load architecture</h3><p style="color:var(--ink-soft)">' + esc(e.message) + '</p><button class="btn" onclick="adminArchitecture()" style="margin-top:16px">Try Again</button></div></div>');
  }
}

function adminRoute(){
  const h = location.hash || "#/";

  /* Helper function to render admin page */
  const renderAdminPage = () => {
    /* Ensure admin shell (with #adminTitle) exists before page functions run,
       so direct loads of admin subpages (e.g. #/admin/analytics) don't crash */
    if(!document.querySelector(".admin-shell")) renderAdminShell("");
    const page = h.split("/")[2] || "dashboard";
    if(page === "dashboard") adminDashboard();
    else if(page === "analytics") adminAnalytics();
    else if(page === "products") adminProducts();
    else if(page === "orders") adminOrders();
    else if(page === "quotes") adminQuotes();
    else if(page === "categories") adminCategories();
    else if(page === "customers") adminCustomers();
    else if(page === "tiers") adminTiers();
    else if(page === "users") adminAdminUsers();
    else if(page === "theme") adminTheme();
    else if(page === "emails") adminEmails();
    else if(page === "content") adminContent();
    else if(page === "architecture") adminArchitecture();

    else {
      /* Unknown page - show friendly 404 with quick links and auto-redirect */
      const content = '<div class="admin-panel"><div class="panel-body" style="text-align:center;padding:60px 20px">' +
        '<div style="font-size:72px;margin-bottom:20px">🔍</div>' +
        '<h2 style="margin-bottom:12px;font-size:28px">Page Not Found</h2>' +
        '<p style="color:var(--ink-soft);margin-bottom:8px;font-size:15px">The page <strong style="color:var(--accent)">"' + esc(page) + '"</strong> does not exist.</p>' +
        '<p style="color:var(--ink-soft);margin-bottom:32px;font-size:13px">You will be automatically redirected to Dashboard in <span id="redirectCountdown" style="font-weight:600;color:var(--accent)">5</span> seconds.</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:40px">' +
          '<a href="#/admin/dashboard" class="btn" onclick="stopRedirect()">🏠 Dashboard</a>' +
          '<a href="#/admin/products" class="btn ghost" onclick="stopRedirect()">📦 Products</a>' +
          '<a href="#/admin/orders" class="btn ghost" onclick="stopRedirect()">📋 Orders</a>' +
          '<a href="#/admin/customers" class="btn ghost" onclick="stopRedirect()">👥 Customers</a>' +
        '</div>' +
        '<div style="border-top:1px solid var(--line);padding-top:24px;margin-top:24px">' +
          '<p style="font-size:12px;color:var(--ink-soft)">Quick Links:</p>' +
          '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:12px">' +
            '<a href="#/admin/categories" style="color:var(--accent);font-size:13px;text-decoration:none">Categories</a>' +
            '<a href="#/admin/quotes" style="color:var(--accent);font-size:13px;text-decoration:none">Quotes & Enquiries</a>' +
            '<a href="#/admin/theme" style="color:var(--accent);font-size:13px;text-decoration:none">Theme</a>' +
            '<a href="#/admin/content" style="color:var(--accent);font-size:13px;text-decoration:none">Site Content</a>' +
            '<a href="#/admin/emails" style="color:var(--accent);font-size:13px;text-decoration:none">Order Emails</a>' +
          '</div>' +
        '</div>' +
      '</div></div>' +
      '<script>' +
        'var redirectTimer = null;' +
        'var countdown = 5;' +
        'function startRedirect(){' +
          'redirectTimer = setInterval(function(){' +
            'countdown--;' +
            'var el = document.getElementById("redirectCountdown");' +
            'if(el) el.textContent = countdown;' +
            'if(countdown <= 0){' +
              'clearInterval(redirectTimer);' +
              'window.location.hash = "#/admin/dashboard";' +
            '}' +
          '}, 1000);' +
        '}' +
        'function stopRedirect(){' +
          'if(redirectTimer) clearInterval(redirectTimer);' +
          'var el = document.getElementById("redirectCountdown");' +
          'if(el) el.parentElement.innerHTML = "Redirect cancelled.";' +
        '}' +
        'startRedirect();' +
      '</script>';
      renderAdminShell(content);
      $("#adminTitle").textContent = "Page Not Found";
    }
  };

  /* Method 1: Check Supabase Auth session */
  const checkSupabaseSession = () => {
    if(!supabase || !supabaseAvailable){
      console.warn("Supabase not available, skipping auth session check");
      return Promise.resolve({ data: { session: null } });
    }
    return supabase.auth.getSession().catch(e => {
      console.warn("Auth session check failed (may be CORS or domain config):", e.message);
      return { data: { session: null } };
    });
  };

  checkSupabaseSession().then(({ data: { session } }) => {
    if(session){
      /* Check if user has admin role */
      const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
      if(role === 'admin' || role === 'superadmin'){
        renderAdminPage();
        return;
      }
    }

    /* Method 2: Check legacy admin session */
    try{
      if(typeof validateAdminSession === 'function' && validateAdminSession()){
        renderAdminPage();
        return;
      }
    }catch(e){
      console.error("Legacy session check error:", e);
    }

    /* No valid session - show login page without error */
    if(h === "#/admin"){ viewAdminLogin(); return; }
    viewAdminLogin("Please sign in to access the admin panel.");
  });
}

/* Filter dashboard activity by type */
function filterDashboardActivity(type){
  const activities = window._dashboardActivities || [];
  const filtered = type === 'all' ? activities : activities.filter(a => a.type === type);
  const listEl = document.getElementById('activityList');
  if(!listEl) return;
  
  if(filtered.length){
    listEl.innerHTML = '<div style="display:flex;flex-direction:column;gap:0">' +
      filtered.slice(0, 20).map(a => {
        const timeAgo = formatTimeAgo(a.time);
        return '<div style="display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--line);transition:background .15s" onmouseover="this.style.background=\'var(--bg-soft)\'" onmouseout="this.style.background=\'transparent\'">' +
          '<div style="width:32px;height:32px;border-radius:8px;background:' + a.color + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:' + a.color + ';stroke:' + a.color + ';font-size:14px">' + a.icon.replace('<svg', '<svg width="18" height="18"') + '</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:13px;color:var(--ink);line-height:1.35">' + a.text + '</div>' +
          '<div style="font-size:11px;color:var(--ink-soft);margin-top:1px">' + timeAgo + '</div></div>' +
          '<span class="pill ' + a.type + '" style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0;padding:3px 8px">' + a.type + '</span>' +
        '</div>';
      }).join("") +
    '</div>';
  }else{
    listEl.innerHTML = '<div style="padding:20px;font-size:13.5px;color:var(--ink-soft)">No activity of this type yet.</div>';
  }
}


/* ============ AI content assistant: Gemini drafts copy, admin reviews before saving ============ */
const AI_COPY_PROMPTS = {
  thTitle: "a short, powerful B2B hero headline (maximum 8 words) for a skincare wholesale & OEM/ODM manufacturer. Professional, confident, international. Output only the headline.",
  thSub: "a 1-2 sentence hero subtitle for a B2B skincare wholesale & OEM/ODM manufacturer website, mentioning wholesale supply, private label / OEM-ODM and global sourcing. Output only the subtitle.",
  ctFooterDesc: "a 2-3 sentence brand description for the footer of a B2B skincare wholesale & OEM/ODM manufacturer website. Output only the description.",
  ctStoryT: "a short section title (maximum 6 words) about the brand story of a skincare wholesale manufacturer. Output only the title.",
  ctStoryB: "a 4-5 sentence brand story for a B2B skincare wholesale & OEM/ODM manufacturer with UK headquarters, offices in Hong Kong and mainland China, and Asia-Pacific sourcing. Do not invent years, certifications, client names or numbers. Output plain text without HTML.",
  ctMissionT: "a short section title (maximum 6 words) about the company mission of a skincare wholesale manufacturer. Output only the title.",
  ctMissionLead: "a single-sentence lead line about the company mission (self-care, quality, accessibility). Output only the sentence.",
  ctMissionB: "a 3-4 sentence mission statement for a B2B skincare wholesale & OEM/ODM manufacturer, covering sourcing, formulation, packaging, quality control and trust. Do not invent facts. Output plain text without HTML.",
  ctPromiseT: "a short section title (maximum 6 words) about the brand promise of a skincare wholesale manufacturer. Output only the title.",
  ctPromiseLead: "a single-sentence brand promise about quality, integrity and partnership. Output only the sentence."
};
async function aiGenerateCopy(target, btn){
  const prompt = AI_COPY_PROMPTS[target];
  if(!prompt){ showToast("Unknown field"); return; }
  const el = document.getElementById(target);
  if(!el){ showToast("Field not found"); return; }
  const oldLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "…";
  try{
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "You are a professional B2B e-commerce copywriter. Write " + prompt, history: [] })
    });
    const data = await res.json();
    if(data.reply){
      let txt = data.reply.replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s*\n\s*/g, " ").trim();
      if(target === "ctStoryB" || target === "ctMissionB"){ txt = "<p>" + txt + "</p>"; }
      el.value = txt;
      showToast("AI draft ready — review before saving");
    } else {
      showToast("AI service busy — try again later");
    }
  }catch(e){
    console.error("AI copy error:", e);
    showToast("AI service error");
  }finally{
    btn.disabled = false; btn.textContent = oldLabel;
  }
}

/* ============ AI advanced assistant: ops summary / reply drafts / product & category copy ============ */

/* Unified AI endpoint call, returns plain text (null when no reply) */
async function aiGenerate(prompt){
  const res = await fetch("/api/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, history: [] })
  });
  const data = await res.json();
  if(data.reply) return String(data.reply).replace(/^["'\s]+|["'\s]+$/g, "").trim();
  return null;
}
/* 包裝按鈕狀態：執行期間禁用並顯示 … */
async function _aiBtnRun(btn, fn){
  const old = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "…"; }
  try{ await fn(); }
  catch(e){ console.error("AI error:", e); showToast("AI service error"); }
  finally{ if(btn){ btn.disabled = false; btn.textContent = old; } }
}
/* 複製文字（剪貼簿，失敗時回退選取提示） */
function copyText(txt){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(() => showToast("Copied")).catch(() => showToast("Please copy manually"));
  } else {
    showToast("Please copy manually");
  }
}

/* ---- 1. Dashboard：AI 每日營運摘要（繁體中文） ---- */
async function aiDashboardSummary(btn){
  _aiBtnRun(btn, async () => {
    const orders = getOrders();
    const quotes = getQuotes ? getQuotes() : [];
    const accounts = getAccounts ? getAccounts() : [];
    const products = getProducts();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayOrders = orders.filter(o => { const t = new Date(o.date).getTime(); return !isNaN(t) && t >= startToday; });
    const todayRevenue = todayOrders.filter(o => o.status !== "Cancelled").reduce((s,o) => s + Number(o.total || 0), 0);
    const totalRevenue = orders.filter(o => o.status !== "Cancelled").reduce((s,o) => s + Number(o.total || 0), 0);
    const qtyMap = {};
    orders.forEach(o => (o.items || []).forEach(it => { qtyMap[it.name] = (qtyMap[it.name] || 0) + (Number(it.qty) || 0); }));
    const topProducts = Object.entries(qtyMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([n,q]) => n + " (" + q + " pcs)");
    const statusCount = {};
    orders.forEach(o => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
    const pendingQuotes = quotes.filter(q => (q.status || "Pending") === "Pending").length;
    const newCustToday = accounts.filter(a => {
      const t = new Date(a.createdAt || a.ts || a.created || a.created_at || a.registeredAt).getTime();
      return !isNaN(t) && t >= startToday;
    }).length;
    const context = {
      date: now.toISOString().slice(0,10),
      totalProducts: products.length,
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      todayRevenue: todayRevenue.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      topProducts: topProducts,
      orderStatusCounts: statusCount,
      pendingQuotes: pendingQuotes,
      newCustomersToday: newCustToday,
      totalCustomers: accounts.length
    };
    const prompt = "You are an e-commerce operations analyst. Based on the following operational data for today, output a concise operations summary in English (4-6 paragraphs): first summarize today's orders and revenue, then list top-selling products, pending quotes and new customers, and finally give 2-3 concrete actionable suggestions. Do not invent data, do not restate raw data item by item. Data: " + JSON.stringify(context);
    const txt = await aiGenerate(prompt);
    const box = document.getElementById("aiSummaryBox");
    if(!box) return;
    if(txt){
      box.textContent = txt;
      box.style.display = "block";
      const copyBtn = document.getElementById("aiCopyBtn");
      if(copyBtn) copyBtn.style.display = "";
      showToast("AI summary generated");
    } else {
      box.textContent = "AI service is busy, please try again later.";
      box.style.display = "block";
    }
  });
}
function copyAiSummary(){
  const el = document.getElementById("aiSummaryBox");
  if(!el || !el.textContent) return;
  copyText(el.textContent);
}

/* ---- 2a. 訂單：AI 回覆客戶草稿（英文） ---- */
async function aiOrderReplyDraft(id){
  const o = findOrderById(id); if(!o) return;
  const btn = event && event.target;
  _aiBtnRun(btn, async () => {
    const cur = o.cur || "EUR";
    const itemsTxt = (o.items || []).map(it => it.name + " x" + it.qty + " (" + Number(it.price).toFixed(2) + " " + cur + "/件）").join("；");
    const context = {
      orderId: o.id,
      date: o.date,
      status: o.status,
      customer: {
        name: custName(o),
        email: custEmail(o),
        phone: custPhone(o) || "",
        address: custAddr(o) || "",
        preferredContact: custContact(o) || ""
      },
      items: itemsTxt,
      total: Number(o.total || 0).toFixed(2) + " " + cur,
      notes: (o.notes || []).map(n => n.text).join(" | ")
    };
    const prompt = "你是 Nebula Secret（B2B 護膚品批發與 OEM/ODM 製造商）的專業客戶服務代表。請根據以下訂單資料，用禮貌、專業的英文寫一封回覆客戶的郵件草稿：確認訂單內容、說明目前處理狀態，並回覆客戶可能的詢問。不要編造折扣、運費、交期或資料中沒有的資訊；若無交期資訊，請寫明會盡快與客戶確認。開頭以客戶名字稱呼（若有），結尾署名 Nebula Secret Customer Service Team。訂單資料：" + JSON.stringify(context);
    const txt = await aiGenerate(prompt);
    const box = document.getElementById("aiDraftBox");
    const ta = document.getElementById("aiDraftText");
    if(txt && box && ta){
      ta.value = txt;
      box.style.display = "block";
      showToast("AI reply draft generated — review before sending");
    } else if(box){
      box.style.display = "block";
      ta.value = "AI service is busy, please try again later.";
    }
  });
}
function copyAiDraft(){
  const el = document.getElementById("aiDraftText");
  if(!el || !el.value) return;
  copyText(el.value);
}

/* ---- 2b. 報價：AI 回覆詢盤草稿（英文） ---- */
async function aiQuoteReplyDraft(id){
  const q = findQuoteById(id); if(!q) return;
  const btn = event && event.target;
  _aiBtnRun(btn, async () => {
    const itemsTxt = (q.items || []).map(it => it.name + " x" + it.qty + " (" + Number(it.price).toFixed(2) + " EUR/件）").join("；");
    const context = {
      quoteId: q.id,
      date: q.date,
      status: q.status,
      customer: {
        name: qCustName(q),
        email: qCustEmail(q),
        phone: qCustPhone(q) || "",
        company: qCustCompany(q) || "",
        address: qCustAddr(q) || ""
      },
      items: itemsTxt,
      subtotal: Number(q.subtotal || 0).toFixed(2),
      customerTargetPrice: q.customerTargetPrice ? Number(q.customerTargetPrice).toFixed(2) : null,
      quotedPrice: q.quotedPrice ? Number(q.quotedPrice).toFixed(2) : null,
      notes: q.notes || ""
    };
    const pricePart = q.customerTargetPrice
      ? "（客戶提出了目標價格，請禮貌回應議價：可接受、提出還價並簡短說明理由，或婉拒並建議替代方案）"
      : "（提供報價並說明條款，引導客戶確認下一步）";
    const prompt = "你是 Nebula Secret（B2B 護膚品批發與 OEM/ODM 製造商）的銷售代表。請根據以下詢盤資料，用禮貌、專業的英文寫一封回覆客戶的郵件草稿" + pricePart + "。數量與價格以資料為準，不要編造折扣、運費或交期；結尾署名 Nebula Secret Sales Team。報價資料：" + JSON.stringify(context);
    const txt = await aiGenerate(prompt);
    const box = document.getElementById("aiDraftBox");
    const ta = document.getElementById("aiDraftText");
    if(txt && box && ta){
      ta.value = txt;
      box.style.display = "block";
      showToast("AI reply draft generated — review before sending");
    } else if(box){
      box.style.display = "block";
      ta.value = "AI service is busy, please try again later.";
    }
  });
}

/* ---- 3a. Product: AI name ---- */
async function aiGenProductName(btn){
  _aiBtnRun(btn, async () => {
    const catEl = document.getElementById("pfCat");
    const catStr = catEl && catEl.value ? catName(catEl.value) : "";
    const descEl = document.getElementById("pfDesc");
    const desc = descEl ? descEl.value.trim() : "";
    const prompt = "你是 B2B 護膚品批發選品專家。請為分類「" + catStr + "」" + (desc ? "、屬性「" + desc.replace(/\n/g, ", ") + "」" : "") + "提出一個適合國際 B2B 批發市場的英文產品名稱（不超過 6 個單字，清晰具體，符合專業品牌調性）。只輸出產品名稱。";
    const txt = await aiGenerate(prompt);
    const el = document.getElementById("pfName");
    if(txt && el){ el.value = txt; showToast("AI name draft filled — review before saving"); }
  });
}
/* ---- 3b. Product: AI attribute list (one "attribute: value" per line) ---- */
async function aiGenProductDesc(btn){
  _aiBtnRun(btn, async () => {
    const nameEl = document.getElementById("pfName");
    const name = nameEl ? nameEl.value.trim() : "";
    const catEl = document.getElementById("pfCat");
    const catStr = catEl && catEl.value ? catName(catEl.value) : "";
    const prompt = "你是產品資料專員。請為產品「" + name + "」（分類：" + catStr + "）撰寫 4-6 行屬性清單，每行格式「屬性: 值」（例如 Country of Origin: China、Scent: Rose、Volume: 100ml）。只輸出屬性行，不要編造品牌認證、具體成分濃度或數值，不確定的項目不要寫。";
    const txt = await aiGenerate(prompt);
    const el = document.getElementById("pfDesc");
    if(txt && el){ el.value = txt; showToast("AI description draft filled — review before saving"); }
  });
}
/* ---- 3c. Product: AI SEO meta description ---- */
async function aiGenProductMeta(btn){
  _aiBtnRun(btn, async () => {
    const nameEl = document.getElementById("pfName");
    const name = nameEl ? nameEl.value.trim() : "";
    const catEl = document.getElementById("pfCat");
    const catStr = catEl && catEl.value ? catName(catEl.value) : "";
    const descEl = document.getElementById("pfDesc");
    const desc = descEl ? descEl.value.trim().slice(0, 300) : "";
    const prompt = "請為 B2B 批發網站上的產品「" + name + "」（分類 " + catStr + (desc ? "，屬性 " + desc.replace(/\n/g, ", ") : "") + "）寫一句英文 SEO meta description（40-150 字元，自然包含 wholesale supplier、OEM/ODM 等關鍵字，吸引專業買家）。只輸出描述本身。";
    const txt = await aiGenerate(prompt);
    const el = document.getElementById("pfMeta");
    if(txt && el){ el.value = txt; showToast("AI SEO meta draft filled — review before saving"); }
  });
}
/* ---- 3d. 分類：AI 描述 ---- */
async function aiGenCatDesc(btn){
  _aiBtnRun(btn, async () => {
    const nameEl = document.getElementById("cfName");
    const name = nameEl ? nameEl.value.trim() : "";
    const prompt = "用英文為 B2B 護膚品批發網站的分類「" + name + "」寫 1-2 句描述（含 wholesale 與 OEM/ODM 相關字眼，適合採購商閱讀）。只輸出描述本身。";
    const txt = await aiGenerate(prompt);
    const el = document.getElementById("cfDesc");
    if(txt && el){ el.value = txt; showToast("AI category description draft filled — review before saving"); }
  });
}
