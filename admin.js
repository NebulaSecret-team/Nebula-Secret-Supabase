/* ============================================================
 * Nebula Secret - Admin Panel Module
 * ============================================================
 * This file contains all admin panel functionality.
 * It is lazy-loaded only when a user navigates to #/admin.
 * 
 * Dependencies (global variables from index.html):
 * - $, $$, esc, escJs, slugify, fmt, fmtD, imgUrl, imgFallback
 * - getProducts, getCats, getOrders, getAccounts, getAdmins, getTheme, getContent, getMailCfg
 * - saveProducts, saveCats, saveOrders, saveAccounts, saveAdmins, saveTheme, saveContent, saveMailCfg
 * - supabase, _cache, sbSave, sbLoadAll
 * - IC (icons), LS (localStorage keys), PLACEHOLDER, CURRENCIES
 * - showToast, closeCart, closeCheckout, closeAdminModal, closeMegaMenu
 * - isAdmin, getAdminSession, setAdminSession, validateAdminSession, adminLoginUser
 * - hashPass, verifyPass, sanitizeHTML
 * - sendOrderEmail, exportOrdersCSV
 * ============================================================ */

/* ============ Supabase Auth State Management ============ */
let _currentAdminUser = null;

/* Listen for auth state changes */
if(typeof supabase !== 'undefined' && supabase.auth) {
  supabase.auth.onAuthStateChange((event, session) => {
    if(session && session.user) {
      _currentAdminUser = session.user;
    } else {
      _currentAdminUser = null;
    }
  });
  /* Get initial session */
  supabase.auth.getSession().then(({ data: { session } }) => {
    if(session && session.user) {
      _currentAdminUser = session.user;
    }
  });
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
        '<a href="#/admin/theme" data-av="theme">' + IC.palette + ' Theme</a>' +
        '<a href="#/admin/emails" data-av="emails">' + IC.mail + ' Order Emails</a>' +
        '<a href="#/admin/content" data-av="content">' + IC.edit + ' Site Content</a>' +
        '<div class="sep"></div>' +
        '<a href="#/admin/users" data-av="users">' + IC.shield + ' Admin Users</a>' +
        '<a href="architecture.html" target="_blank">' + IC.chart + ' System Architecture</a>' +
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
  const totalValue = products.reduce((s,p) => s + Number(p.p || 0), 0);
  const avg = products.length ? totalValue / products.length : 0;
  const revenue = orders.filter(o => o.status !== "Cancelled").reduce((s,o) => s + Number(o.total || 0), 0);
  const recentOrders = orders.slice(0, 6);
  const content =
    '<div class="stat-grid">' +
      '<div class="stat-card"><span class="s-icon">' + IC.box + '</span><div class="s-label">Total Products</div><div class="s-value">' + products.length + '</div><div class="s-sub">' + (products.length - DEFAULT_PRODUCTS.length >= 0 ? "Including " + (products.length - DEFAULT_PRODUCTS.length) + " custom" : "Original catalog") + '</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.tag + '</span><div class="s-label">Categories</div><div class="s-value">' + cats.length + '</div><div class="s-sub">Manageable in Categories</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.orders + '</span><div class="s-label">Orders</div><div class="s-value">' + orders.length + '</div><div class="s-sub"><a href="#/admin/orders" style="color:var(--accent)">View orders &amp; export Excel</a></div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.chart + '</span><div class="s-label">Revenue</div><div class="s-value">' + fmt(revenue) + '</div><div class="s-sub">From ' + orders.filter(o => o.status !== "Cancelled").length + ' active orders</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.palette + '</span><div class="s-label">Avg. Price</div><div class="s-value">' + fmt(avg) + '</div><div class="s-sub">per item</div></div>' +
      '<div class="stat-card"><span class="s-icon">' + IC.sparkle + '</span><div class="s-label">Catalog Value</div><div class="s-value">' + fmt(totalValue) + '</div><div class="s-sub">Sum of all products</div></div>' +
    '</div>' +
    '<div class="admin-panel"><div class="panel-head"><div><h3>Recent Products</h3><div class="ph-sub">Latest additions to your store</div></div><a class="btn sm" href="#/admin/products">Manage Products</a></div>' +
    '<div class="panel-body" style="padding:0"><table class="admin-table"><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Status</th></tr></thead><tbody>' +
    products.slice(-6).reverse().map(p => '<tr><td><img class="td-img" src="' + imgUrl(p.i, 100) + '" alt="" data-pid="' + p.id + '" onerror="imgFallback(this)"></td><td style="font-weight:600">' + esc(p.n) + '</td><td><span class="pill">' + esc(catName(p.cs)) + '</span></td><td>' + fmt(p.p) + '</td><td><span class="pill green">Visible</span></td></tr>').join("") +
    '</tbody></table></div></div>' +
    '<div class="admin-panel"><div class="panel-head"><div><h3>Recent Orders</h3><div class="ph-sub">Latest customer orders</div></div><a class="btn sm" href="#/admin/orders">All Orders</a></div>' +
    (recentOrders.length
      ? '<div class="panel-body" style="padding:0"><table class="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
        recentOrders.map(o => '<tr><td style="font-weight:600">' + esc(o.id) + '</td><td style="white-space:nowrap">' + new Date(o.date).toLocaleDateString() + '</td><td>' + esc(custName(o)) + '</td><td>' + o.items.reduce((s,i) => s + i.qty, 0) + '</td><td>' + fmt(o.total) + '</td><td><span class="pill ' + orderStatusColor(o.status) + '">' + esc(o.status) + '</span></td></tr>').join("") +
        '</tbody></table></div>'
      : '<div class="panel-body"><div style="font-size:13.5px;color:var(--ink-soft);padding:8px 0">No orders yet. Place an order on the storefront and it will appear here.</div></div>') +
    '</div>' +
    '<div class="admin-panel"><div class="panel-head"><div><h3>Quick Actions</h3><div class="ph-sub">Common admin tasks</div></div></div>' +
    '<div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn sm" onclick="location.hash=\'#/admin/products\'">' + IC.plus + ' Add Product</button>' +
      '<button class="btn sm ghost" onclick="location.hash=\'#/admin/orders\'">' + IC.orders + ' View Orders</button>' +
      '<button class="btn sm ghost" onclick="location.hash=\'#/admin/categories\'">Manage Categories</button>' +
      '<button class="btn sm ghost" onclick="location.hash=\'#/admin/theme\'">Customize Theme</button>' +
      '<button class="btn sm ghost" style="color:#c0392b;border-color:#e5b4ad" onclick="resetStoreData()">Reset Store Data</button>' +
    '</div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Dashboard";
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
          '<td><a href="mailto:' + esc(custEmail(o)) + '" style="color:var(--accent)">' + esc(custEmail(o)) + '</a></td>' +
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
  if(cloudReady()){
    cloudPushKey("orders", orders).catch(() => {});
  }
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
  if(cloudReady()){
    cloudPushKey("orders", orders).catch(() => {});
  }
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
      '<button class="btn sm ghost" onclick="copyOrderSummary(lastOrder)">Copy Summary</button>' +
      '<button class="btn sm ghost" onclick="downloadOrderPDF(\'' + escJs(o.id) + '\')">' + IC.down + ' Download PDF</button>' +
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
      '<button class="btn sm ghost" onclick="mailQuote(\'' + escJs(q.id) + '\')">' + IC.mail + ' Email Customer</button>' +
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
  saveQuotes(quotes);
  showToast("Quote " + id + " sent!");
  if(cloudReady()){ cloudPushKey("quotes", quotes).catch(() => {}); }
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
  saveQuotes(quotes);
  showToast("Quote status updated to " + status);
  if(cloudReady()){ cloudPushKey("quotes", quotes).catch(() => {}); }
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
  saveQuotes(quotes);
  showToast("Customer target price accepted! Quote sent.");
  if(cloudReady()){ cloudPushKey("quotes", quotes).catch(() => {}); }
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
  saveQuotes(quotes);
  showToast("Customer target price rejected.");
  if(cloudReady()){ cloudPushKey("quotes", quotes).catch(() => {}); }
  $("#adminModal").classList.remove("open");
  adminQuotes();
}
function deleteQuote(id){
  if(!confirm("Delete quote " + id + "?")) return;
  saveQuotes(getQuotes().filter(q => q.id !== id));
  showToast("Quote deleted");
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
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Products</h3><div class="ph-sub">' + products.length + ' products · add, edit or remove items</div></div><button class="btn sm" onclick="openProductForm()">' + IC.plus + ' Add Product</button></div>' +
    '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table"><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Rating</th><th>Actions</th></tr></thead><tbody>' +
    products.slice().reverse().map(p => {
      const rt = productRating(p);
      return '<tr><td><img class="td-img" src="' + imgUrl(p.i, 100) + '" alt="" data-pid="' + p.id + '" onerror="imgFallback(this)"></td>' +
        '<td style="font-weight:600">' + esc(p.n) + '</td>' +
        '<td><span class="pill">' + esc(catName(p.cs)) + '</span></td>' +
        '<td>' + fmt(p.p) + '</td>' +
        '<td><span class="stars" style="color:#f5a623;font-size:12px">' + stars(rt.r) + '</span> <span style="font-size:12px;color:var(--ink-soft)">' + rt.r.toFixed(1) + '</span></td>' +
        '<td><div class="table-actions">' +
          '<button onclick="openProductForm(\'' + p.id + '\')" title="Edit">' + IC.edit + '</button>' +
          '<button class="del" onclick="deleteProduct(\'' + p.id + '\')" title="Delete">' + IC.del + '</button>' +
        '</div></td></tr>';
    }).join("") +
    '</tbody></table></div></div>' +
    '<div class="admin-panel"><div class="panel-body"><div style="font-size:13px;color:var(--ink-soft)">Changes are saved to this browser (localStorage) and appear on the storefront immediately.</div></div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Products";
}

function openProductForm(id){
  const p = id ? findProduct(id) : null;
  const cats = getCats();
  const tiers = p && p.priceTiers && p.priceTiers.length ? p.priceTiers : [{ minQty: 1, price: p ? p.p : 1.00 }];
  $("#amTitle").textContent = p ? "Edit product" : "Add product";
  $("#amSub").textContent = p ? "Editing: " + p.n : "Fill in the details to add a new product";
  $("#amBody").innerHTML =
    '<div class="form-grid">' +
      '<div class="field full"><label>Product name *</label><input id="pfName" value="' + (p ? esc(p.n) : "") + '" placeholder="e.g. Rose Body Scrub"></div>' +
      '<div class="field"><label>Category *</label><select id="pfCat">' + cats.map(c => '<option value="' + c.cs + '"' + (p && p.cs === c.cs ? " selected" : "") + '>' + esc(c.c) + '</option>').join("") + '</select></div>' +
      '<div class="field"><label>Base Price (EUR) *</label><input id="pfPrice" type="number" step="0.01" min="0" value="' + (p ? p.p : "1.00") + '"><div class="form-hint">Default price for 1 unit</div></div>' +
      '<div class="field full"><label>Image URL</label><input id="pfImg" value="' + (p ? esc(p.i) : "") + '" placeholder="https://… (leave empty for placeholder)" oninput="pfPreview(this.value)"></div>' +
      '<div class="field full"><label>Image preview</label><div class="pf-prev"><img id="pfImgPrev" src="' + (p ? imgUrl(p.i, 200) : PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>' +
      '<div class="field full"><label>Or upload from your computer</label><label class="upload-btn" for="pfUpload">' + IC.up + ' Choose image file</label><input type="file" id="pfUpload" accept="image/*" style="display:none" onchange="uploadImageTo(\'pfUpload\',\'pfImg\',800)"><div class="form-hint">The image is compressed and stored with this product — no hosting needed. Tip: you can also paste any image URL directly.</div></div>' +
      '<div class="field full"><label>Description (one attribute per line)</label><textarea id="pfDesc" rows="5" placeholder="Country of Origin: China&#10;Scent: Rose&#10;Volume: 100ml">' + (p ? esc((p.d || []).join("\n")) : "") + '</textarea></div>' +
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
    l: ORIGIN
  };
  if(existing){ Object.assign(existing, rec); }
  else { products.push(rec); }
  saveProducts(products);
  closeAdminModal();
  adminProducts();
  if(cloudReady()){
    showToast("Saving & syncing to cloud…");
    cloudPushKey("products", products).then(r => {
      showToast(r && r.ok ? ((existing ? "Product updated" : "Product added") + " & synced to cloud") : ((existing ? "Product updated" : "Product added") + " locally — cloud sync failed: " + (r && r.reason || "unknown")));
    });
  } else {
    showToast(existing ? "Product updated" : "Product added");
  }
}

function deleteProduct(id){
  if(!confirm("Delete this product? This cannot be undone.")) return;
  const products = getProducts().filter(p => String(p.id) !== String(id));
  saveProducts(products);
  showToast("Product deleted");
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
  saveCats(cats);
  /* Force re-render navigation bar with updated category order */
  setTimeout(() => {
    try{ renderCatNav(); }catch(e){ console.warn("renderCatNav error:", e); }
  }, 50);
  showToast("Category reordered");
  adminCategories();
}

function openCatForm(cs){
  const cats = getCats();
  const c = cs ? cats.find(x => x.cs === cs) : null;
  $("#amTitle").textContent = c ? "Edit category" : "Add category";
  $("#amSub").textContent = c ? "Editing: " + c.c : "Create a new product category";
  $("#amBody").innerHTML =
    '<div class="form-grid">' +
      '<div class="field full"><label>Category name *</label><input id="cfName" value="' + (c ? esc(c.c) : "") + '" placeholder="e.g. Body Lotion"></div>' +
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
  const img = $("#cfImg").value.trim();
  if(!name){ showToast("Please enter a category name"); return; }
  const cats = getCats();
  const existing = cs ? cats.find(x => x.cs === cs) : null;
  const newCs = cs || slugify(name);
  if(existing){
    existing.c = name;
    if(img) existing.i = img;
    // update products that reference this category name/slug
    const products = getProducts();
    products.forEach(p => { if(p.cs === existing.cs) p.c = name; });
    saveProducts(products);
  } else {
    if(cats.some(x => x.cs === newCs)){ showToast("Category already exists"); return; }
    cats.push({ c: name, cs: newCs, i: img || PLACEHOLDER });
  }
  saveCats(cats);
  closeAdminModal();
  showToast(existing ? "Category updated" : "Category added");
  adminCategories();
}

function deleteCategory(cs){
  if(!confirm("Delete this category? Its products stay in the catalog.")) return;
  const cats = getCats().filter(c => c.cs !== cs);
  saveCats(cats);
  showToast("Category deleted");
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

function adminCustomers(){
  const accs = getAccounts();
  const rows = accs.length ? accs.map(a =>
    '<tr>' +
      '<td><b>' + esc(a.name) + '</b></td>' +
      '<td>' + esc(a.email) + '</td>' +
      '<td>' + fmtD(a.created) + '</td>' +
      '<td>' + myOrders(a.email).length + '</td>' +
      '<td style="text-align:right"><button class="btn sm ghost" onclick="adminResetCustomerPass(\'' + escJs(a.email) + '\')">Reset password</button></td>' +
    '</tr>'
  ).join("") : '<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);padding:24px">No customer accounts yet — accounts appear here when customers create one on the Account page.</td></tr>';
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Customer Accounts</h3><div class="ph-sub">Everyone who created an account on the storefront</div></div><button class="btn sm ghost" onclick="location.hash=\'#/account\'">Open Account page</button></div>' +
    '<div class="panel-body" style="padding:0;overflow-x:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Orders</th><th style="text-align:right">Action</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="form-hint" style="margin-top:8px">Use <b>Reset password</b> to set a new password for a customer when they have forgotten theirs. Changes apply immediately.</div>';
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
  saveAdmins(admins);
  showToast("Admin " + u + " added");
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
  saveAdmins(admins);
  showToast("Password updated for " + user);
}
function adminDeleteAdmin(user){
  const admins = getAdmins();
  if(admins.length <= 1){ showToast("Cannot remove the last admin account"); return; }
  if(!confirm("Remove admin \"" + user + "\"? They will no longer be able to sign in.")) return;
  saveAdmins(admins.filter(a => a.user !== user));
  showToast("Admin " + user + " removed");
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
        '<div class="field full"><label>Hero title</label><input id="thTitle" value="' + esc(th.heroTitle) + '"></div>' +
        '<div class="field full"><label>Hero subtitle</label><textarea id="thSub" rows="2">' + esc(th.heroSub) + '</textarea></div>' +
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
  const mc = getMailCfg();
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Order Emails</h3><div class="ph-sub">Auto-send every new order to your inbox — works on GitHub Pages (no server needed)</div></div></div>' +
    '<div class="panel-body">' +
      '<div class="form-grid">' +
        '<div class="field full"><label>Email provider</label><select id="mailProvider"><option value="emailjs"' + (mc.provider === "emailjs" ? " selected" : "") + '>EmailJS (recommended — reliable, no ads, multiple recipients)</option><option value="formsubmit"' + (mc.provider !== "emailjs" ? " selected" : "") + '>FormSubmit (free — single inbox, needs one-time activation)</option></select></div>' +
        '<div class="field full" id="mailToWrap"><label>Recipients (separate multiple emails with comma)</label><input id="mailTo" type="text" value="' + esc(mc.mailTo || "") + '" placeholder="sales@yourcompany.com, manager@yourcompany.com"></div>' +
        '<div class="field full" id="emailjsWrap">' +
          '<div class="form-hint" style="margin-bottom:8px"><b>EmailJS setup (5 min, free):</b> 1) Sign up at <b>emailjs.com</b> → 2) Add your email service → 3) Create an Email Template with To Email <code>{{to_email}}</code> → 4) Paste the three keys below.</div>' +
          '<div class="form-hint" style="margin-bottom:12px;padding:12px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px"><b>⚠️ SECURITY: Configure Domain Whitelist</b><br>To prevent others from abusing your EmailJS quota, you MUST add your domain to the whitelist:<br>1. Go to <a href="https://dashboard.emailjs.com/admin/account" target="_blank" style="color:#0066cc;text-decoration:underline">EmailJS Dashboard → Account Settings</a><br>2. Find <b>Domains</b> section → Click <b>Add Domain</b><br>3. Add: <code>nebula-secret-supabase.vercel.app</code> (and your custom domain if any)<br>4. Click <b>Save</b><br><b>Current domain:</b> <code>' + esc(window.location.hostname) + '</code></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Service ID</label><input id="mailSvc" type="text" value="' + esc(mc.serviceId || "") + '" placeholder="service_xxxxxxx"></div>' +
            '<div class="field"><label>Order Template ID</label><input id="mailTpl" type="text" value="' + esc(mc.templateId || "") + '" placeholder="template_xxxxxxx"></div>' +
            '<div class="field"><label>Contact Form Template ID</label><input id="mailContactTpl" type="text" value="' + esc(mc.contactTemplateId || "") + '" placeholder="template_xxxxxxx (leave empty to use order template)"></div>' +
            '<div class="field full"><label>Public Key</label><input id="mailKey" type="text" value="' + esc(mc.publicKey || "") + '" placeholder="xxxxxxx"></div>' +
          '</div>' +
        '</div>' +
        '<div class="field full" id="formsubmitWrap" style="display:none"><label>FormSubmit inbox (single email)</label><input id="mailEmail" type="email" value="' + esc(mc.email || "") + '" placeholder="you@yourstore.com"></div>' +
        '<div class="field full"><label>Enable auto email</label><select id="mailEnabled"><option value="1"' + (mc.enabled ? " selected" : "") + '>On — send order emails automatically</option><option value="0"' + (!mc.enabled ? " selected" : "") + '>Off — keep manual email button only</option></select></div>' +
        '<div class="field full"><div class="form-hint" id="mailHelp"><b>EmailJS:</b> after saving, click <b>Send Test Email</b> — it sends straight to the recipients above, no activation step. <b>FormSubmit:</b> you must first confirm the one-time verification email FormSubmit sends to your inbox (check spam).</div></div>' +
      '</div>' +
      '<button class="btn" style="margin-top:4px" onclick="saveMailForm()">Save Email Settings</button>' +
      '<button class="btn ghost" style="margin-top:4px;margin-left:8px" onclick="sendTestOrderEmail()">Send Test Email</button>' +
      '<div class="form-hint" style="margin-top:10px"><b>Still not receiving order emails?</b> (1) Save settings, keep <b>Enable auto email</b> On; (2) click <b>Send Test Email</b>; (3) EmailJS users: watch for the toast error message and check your template/service keys. FormSubmit users: check spam folder for the verification link and click it once. Orders are always saved in Admin → Orders and downloadable as Excel/CSV regardless of email.</div>' +
    '</div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Order Emails";
  toggleMailProvider();
  const mp = $("#mailProvider");
  if(mp) mp.onchange = toggleMailProvider;
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
          '<div class="field full"><label>Brand description</label><textarea id="ctFooterDesc" rows="3">' + esc(fo.desc || DEF.footerDesc) + '</textarea></div>' +
          '<div class="field full"><label>Copyright line</label><input id="ctFooterCopy" value="' + esc(fo.copyright || DEF.footerCopy) + '"></div>' +
        '</div></details>' +
      '<details class="ct-block" open><summary><b>About — Our Story</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Section title</label><input id="ctStoryT" value="' + esc((ab.story||{}).t || DEF.storyT) + '"></div>' +
          '<div class="field full"><label>Body (HTML)</label><textarea id="ctStoryB" rows="6">' + esc((ab.story||{}).b || DEF.storyB) + '</textarea></div>' +
        '</div></details>' +
      '<details class="ct-block"><summary><b>About — Our Mission</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Section title</label><input id="ctMissionT" value="' + esc((ab.mission||{}).t || DEF.missionT) + '"></div>' +
          '<div class="field"><label>Lead line</label><input id="ctMissionLead" value="' + esc((ab.mission||{}).lead || DEF.missionLead) + '"></div>' +
          '<div class="field full"><label>Body (HTML)</label><textarea id="ctMissionB" rows="6">' + esc((ab.mission||{}).b || DEF.missionB) + '</textarea></div>' +
        '</div></details>' +
      '<details class="ct-block"><summary><b>About — Our Promise</b></summary>' +
        '<div class="form-grid">' +
          '<div class="field"><label>Section title</label><input id="ctPromiseT" value="' + esc((ab.promise||{}).t || DEF.promiseT) + '"></div>' +
          '<div class="field full"><label>Lead line</label><input id="ctPromiseLead" value="' + esc((ab.promise||{}).lead || DEF.promiseLead) + '"></div>' +
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
  saveContent(c);
  applyFooterContent();
  showToast("Site content saved");
  if(cloudReady()){
    cloudPushKey("content", c).then(r => {
      if(r && r.ok) showToast("Site content saved & synced to cloud");
      else showToast("Saved locally — cloud sync failed: " + (r && r.reason || "unknown"));
    });
  }
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
function adminCloudSync(){
  const cc = getCloudCfg();
  const content =
    '<div class="admin-panel"><div class="panel-head"><div><h3>Cloud Sync</h3><div class="ph-sub">Use your GitHub repo as a shared store — orders, accounts, products, categories, theme and admins stay in sync across all your devices</div></div></div>' +
    '<div class="panel-body">' +
      '<div class="form-hint" style="margin-bottom:12px"><b>How it works:</b> once enabled, every change is saved locally <b>and</b> pushed to <code>data/*.json</code> in your repo. On startup, this browser pulls the latest from the repo. Sign in on another device and enable the same settings there to keep everything in sync.<br><b>Your token stays in this browser only</b> — it is never written into the repo or the website source.</div>' +
      '<div class="form-grid">' +
        '<div class="field"><label>GitHub username (owner)</label><input id="csOwner" value="' + esc(cc.owner || "") + '" placeholder="your-github-name"></div>' +
        '<div class="field"><label>Repository name</label><input id="csRepo" value="' + esc(cc.repo || "") + '" placeholder="nebula-secret"></div>' +
        '<div class="field full"><label>Fine-grained token (Contents: read &amp; write)</label><input id="csToken" type="password" value="' + esc(cc.token || "") + '" placeholder="github_pat_..."><button type="button" class="btn sm ghost" style="margin-top:6px" onclick="toggleCsToken()">Show / Hide token</button></div>' +
        '<div class="field full"><label>Enable cloud sync</label><select id="csEnabled"><option value="1"' + (cc.enabled ? " selected" : "") + '>On — sync to GitHub on every change</option><option value="0"' + (!cc.enabled ? " selected" : "") + '>Off — local-only mode</option></select></div>' +
      '</div>' +
      '<div style="margin-top:6px"><button class="btn" onclick="saveCloudForm()">Save Cloud Settings</button>' +
      '<button class="btn ghost" style="margin-left:8px" onclick="testCloudConn()">Test Connection</button>' +
      '<button class="btn ghost" style="margin-left:8px" onclick="pushCloudNow()">Push All Now</button>' +
      '<button class="btn ghost" style="margin-left:8px" onclick="pullCloudNow()">Pull All Now</button></div>' +
      '<div id="csStatus" style="margin-top:12px"></div>' +
    '</div></div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Cloud Sync";
}
function toggleCsToken(){
  const inp = $("#csToken"); if(!inp) return;
  inp.type = inp.type === "password" ? "text" : "password";
}
function csStatus(html, ok){
  const el = $("#csStatus"); if(!el) return;
  el.innerHTML = '<div class="form-hint" style="padding:10px 12px;border-radius:10px;background:' + (ok === false ? 'rgba(234,102,104,.12)' : 'rgba(82,196,26,.10)') + '">' + html + '</div>';
}
function readCloudForm(){
  return { owner: $("#csOwner").value.trim(), repo: $("#csRepo").value.trim(), token: $("#csToken").value.trim(), enabled: $("#csEnabled").value === "1" };
}
async function saveCloudForm(){
  const cfg = readCloudForm();
  if(cfg.enabled && (!cfg.owner || !cfg.repo || !cfg.token)){ showToast("Please fill GitHub username, repo and token first"); return; }
  saveCloudCfg(cfg);
  if(cfg.enabled){
    csStatus("Saving and pushing all data to GitHub…");
    try{
      await cloudPushAll();
      csStatus("Cloud sync enabled and all data pushed to <code>data/*.json</code> in <b>" + esc(cfg.owner) + "/" + esc(cfg.repo) + "</b>. Now enable the same settings on your other devices (same username, repo and token) and they will share everything.");
    }catch(e){ csStatus("Push failed: " + esc(String(e && e.message || e)), false); }
  } else {
    csStatus("Cloud sync is off. Your data stays local to this browser only.");
  }
  showToast("Cloud settings saved");
}
async function testCloudConn(){
  const cfg = readCloudForm();
  if(!cfg.owner || !cfg.repo || !cfg.token){ csStatus("Fill in username, repo and token first.", false); return; }
  saveCloudCfg(cfg);
  csStatus("Testing connection to <b>" + esc(cfg.owner) + "/" + esc(cfg.repo) + "</b>…");
  try{
    const got = await ghGetFile(cfg, "data/products.json");
    csStatus("Connection OK. " + (got ? "Found existing cloud data." : "Connected — no cloud data yet. Press <b>Push All Now</b> or <b>Save Cloud Settings</b> to upload."));
  }catch(e){
    const msg = String(e && e.message || e);
    if(msg.indexOf("401") >= 0) csStatus("401 — token is invalid or expired. Check the token in GitHub → Settings → Developer settings.", false);
    else if(msg.indexOf("403") >= 0) csStatus("403 — token lacks access to this repo, or rate limit reached. Make sure the token grants <b>Contents: read and write</b> on this repository.", false);
    else if(msg.indexOf("404") >= 0) csStatus("404 — repo not found, or token cannot see it. Check owner/repo and that the token is scoped to this repo.", false);
    else csStatus("Connection failed: " + esc(msg), false);
  }
}
async function pushCloudNow(){
  const cfg = readCloudForm();
  if(!cfg.enabled || !cfg.owner || !cfg.repo || !cfg.token){ csStatus("Enable cloud sync and fill in the settings first.", false); return; }
  saveCloudCfg(cfg);
  csStatus("Pushing all data to GitHub…");
  try{ await cloudPushAll(); csStatus("All data pushed to GitHub successfully."); }
  catch(e){ csStatus("Push failed: " + esc(String(e && e.message || e)), false); }
}
async function pullCloudNow(){
  const cfg = readCloudForm();
  if(!cfg.enabled || !cfg.owner || !cfg.repo || !cfg.token){ csStatus("Enable cloud sync and fill in the settings first.", false); return; }
  saveCloudCfg(cfg);
  csStatus("Pulling data from GitHub…");
  try{ await cloudPullAll(); csStatus("Data pulled from GitHub and applied to this browser."); route(); }
  catch(e){ csStatus("Pull failed: " + esc(String(e && e.message || e)), false); }
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
function toggleMailProvider(){
  const p = ($("#mailProvider") || {}).value || "emailjs";
  const ejw = $("#emailjsWrap"), fsw = $("#formsubmitWrap"), mtw = $("#mailToWrap");
  if(ejw) ejw.style.display = p === "emailjs" ? "" : "none";
  if(fsw) fsw.style.display = p === "formsubmit" ? "" : "none";
  if(mtw) mtw.style.display = p === "emailjs" ? "" : "none";
  const help = $("#mailHelp");
  if(help) help.innerHTML = p === "emailjs"
    ? "<b>EmailJS:</b> after saving, click <b>Send Test Email</b> — it sends straight to the recipients above, no activation step needed."
    : "<b>FormSubmit:</b> you must first click the one-time verification link FormSubmit emails to your inbox (check spam).";
}
function saveMailForm(){
  const cfg = getMailCfg();
  cfg.provider = $("#mailProvider").value;
  cfg.mailTo = ($("#mailTo") ? $("#mailTo").value : "").trim();
  cfg.serviceId = ($("#mailSvc") ? $("#mailSvc").value : "").trim();
  cfg.templateId = ($("#mailTpl") ? $("#mailTpl").value : "").trim();
  cfg.contactTemplateId = ($("#mailContactTpl") ? $("#mailContactTpl").value : "").trim();
  cfg.publicKey = ($("#mailKey") ? $("#mailKey").value : "").trim();
  const email = ($("#mailEmail") ? $("#mailEmail").value : "").trim();
  if(email && !/.+@.+\..+/.test(email)){ showToast("Please enter a valid email address"); return; }
  cfg.email = email;
  cfg.enabled = $("#mailEnabled").value === "1";
  saveMailCfg(cfg);
  if(cfg.provider === "emailjs"){
    const recipients = mailRecipients(cfg);
    showToast(cfg.enabled && recipients.length ? "EmailJS saved — click Send Test Email to verify" : "Email settings saved");
  }else{
    showToast(cfg.enabled && cfg.email ? "Email service on — place a test order to activate FormSubmit" : "Email settings saved");
  }
}
async function sendTestOrderEmail(){
  const cfg = getMailCfg();
  if(!cfg || !cfg.enabled){ showToast("Enable auto email first, then Save Email Settings"); return; }
  const recipients = mailRecipients(cfg);
  if(cfg.provider === "emailjs"){
    if(!cfg.serviceId || !cfg.templateId || !cfg.publicKey){ showToast("Fill in EmailJS Service ID, Template ID and Public Key first"); return; }
  }else{
    if(!cfg.email){ showToast("Enter your FormSubmit inbox email first"); return; }
  }
  const n = Math.floor(1000000 + Math.random() * 9000000);
  const test = {
    id: "NS-" + n,
    date: new Date().toISOString(),
    cur: curCode, rate: rateOf(curCode),
    customer: { first:"Test", last:"Order", email: cfg.provider === "emailjs" ? (recipients[0] || "") : cfg.email, address:"", country:"Hong Kong SAR", phone:"", contact:"" },
    items: [{ id:"3", name:"Sample Product", cat:"other", price: 10, qty: 1 }],
    total: 10, status:"New"
  };
  showToast("Sending test order email…");
  const r = await sendOrderEmail(test, cfg);
  if(r.ok){
    showToast(cfg.provider === "emailjs" ? "Test email sent to " + recipients.join(", ") : "Test email sent — confirm the FormSubmit activation link in your inbox");
  }else{
    const errMap = {
      "emailjs-config": "EmailJS keys incomplete — fill Service ID, Template ID and Public Key",
      "emailjs-error": "EmailJS error: " + (r.detail || "check keys & template"),
      "sdk-missing": "EmailJS library failed to load — check internet connection",
      "not-configured": "Email not enabled — enable auto email and save first",
      "network": "Network error — check your connection and try again"
    };
    showToast(errMap[r.reason] || ("Email failed — " + (r.reason || "unknown error")));
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
  saveTheme(th);
  applyTheme();
  showToast("Theme saved");
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
function viewAdminLogin(msg){
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

  /* Method 1: Try Supabase Auth first */
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: p
    });
    if(!error && data && data.user){
      /* Check if user has admin role */
      const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
      if(role === 'admin' || role === 'superadmin'){
        showToast("Welcome, " + (data.user.user_metadata?.name || data.user.email));
        location.hash = "#/admin/dashboard";
        return;
      }else{
        /* Not an admin, sign out and try legacy method */
        await supabase.auth.signOut();
      }
    }
  } catch(e) {
    console.warn("Admin login failed, trying legacy method");
  }

  /* Method 2: Try legacy admin system (stored in site_settings) */
  try {
    const admins = getAdmins();
    /* Match by login name or email */
    const admin = admins.find(a =>
      a.user.toLowerCase() === email.toLowerCase() ||
      (a.email && a.email.toLowerCase() === email.toLowerCase())
    );

    if(admin){
      /* Verify password */
      const isValid = await verifyPass(p, admin.pass);
      if(isValid){
        /* Set legacy admin session */
        setAdminSession(admin.user, admin.name || admin.user);
        showToast("Welcome, " + (admin.name || admin.user));
        location.hash = "#/admin/dashboard";
        return;
      }
    }
  } catch(e) {
    console.error("Legacy login error:", e);
  }

  /* Both methods failed */
  const err = $("#loginErr");
  err.textContent = "Invalid email or password.";
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

function adminRoute(){
  const h = location.hash || "#/";

  /* Helper function to render admin page */
  const renderAdminPage = () => {
    const page = h.split("/")[2] || "dashboard";
    if(page === "dashboard") adminDashboard();
    else if(page === "products") adminProducts();
    else if(page === "orders") adminOrders();
    else if(page === "quotes") adminQuotes();
    else if(page === "categories") adminCategories();
    else if(page === "customers") adminCustomers();
    else if(page === "users") adminAdminUsers();
    else if(page === "theme") adminTheme();
    else if(page === "emails") adminEmails();
    else if(page === "content") adminContent();
    else if(page === "cloudsync") adminCloudSync();
    else {
      /* Unknown page - show friendly 404 instead of login screen */
      const content = '<div class="admin-panel"><div class="panel-body" style="text-align:center;padding:60px 20px">' +
        '<div style="font-size:48px;margin-bottom:16px">🔍</div>' +
        '<h3 style="margin-bottom:8px">Page Not Found</h3>' +
        '<p style="color:var(--ink-soft);margin-bottom:24px">The page <strong>"' + esc(page) + '"</strong> does not exist.</p>' +
        '<a href="#/admin/dashboard" class="btn">Go to Dashboard</a>' +
      '</div></div>';
      renderAdminShell(content);
      $("#adminTitle").textContent = "Page Not Found";
    }
  };

  /* Method 1: Check Supabase Auth session */
  supabase.auth.getSession().then(({ data: { session } }) => {
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

    /* No valid session */
    if(h === "#/admin"){ viewAdminLogin(); return; }
    viewAdminLogin("Please sign in to access the admin panel.");
  }).catch(e => {
    console.error("Auth session error:", e);
    /* Fallback to legacy session check */
    try{
      if(typeof validateAdminSession === 'function' && validateAdminSession()){
        renderAdminPage();
        return;
      }
    }catch(e2){}
    viewAdminLogin("Authentication error. Please try again.");
  });
}
