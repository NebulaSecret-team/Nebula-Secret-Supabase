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
        recentOrders.map(o => '<tr><td style="font-weight:600">' + esc(o.id) + '</td><td style="white-space:nowrap">' + new Date(o.date).toLocaleDateString() + '</td><td>' + esc(o.customer.first + " " + o.customer.last) + '</td><td>' + o.items.reduce((s,i) => s + i.qty, 0) + '</td><td>' + fmt(o.total) + '</td><td><span class="pill ' + orderStatusColor(o.status) + '">' + esc(o.status) + '</span></td></tr>').join("") +
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
          '<td>' + esc(o.customer.first + " " + o.customer.last) + '</td>' +
          '<td><a href="mailto:' + esc(o.customer.email) + '" style="color:var(--accent)">' + esc(o.customer.email) + '</a></td>' +
          '<td>' + o.items.reduce((s,i) => s + i.qty, 0) + '</td>' +
          '<td style="font-weight:700">' + fmtIn(o.total, cur, orate(o)) + ' <span style="font-weight:400;color:var(--ink-soft);font-size:11px">' + cur + '</span></td>' +
          '<td><select class="order-status ' + orderStatusColor(o.status) + '" onchange="setOrderStatus(\'' + esc(o.id) + '\', this.value)">' +
            ["New","Processing","Shipped","Completed","Cancelled"].map(s => '<option ' + (o.status === s ? "selected" : "") + '>' + s + '</option>').join("") +
          '</select></td>' +
          '<td><div class="table-actions">' +
            '<button onclick="viewOrder(\'' + esc(o.id) + '\')" title="View">' + IC.search + '</button>' +
            '<button onclick="mailOrder(lastOrderById(\'' + esc(o.id) + '\'))" title="Email">' + IC.mail + '</button>' +
            '<button class="del" onclick="deleteOrder(\'' + esc(o.id) + '\')" title="Delete">' + IC.del + '</button>' +
          '</div></td></tr>'; }).join("") +
        '</tbody></table></div>'
      : '<div class="panel-body"><div style="font-size:13.5px;color:var(--ink-soft);padding:10px 0">No orders yet. When a customer places an order on the storefront it is saved here automatically and can be exported to Excel.</div></div>') +
    '</div>';
  renderAdminShell(content);
  $("#adminTitle").textContent = "Orders";
}
function findOrderById(id){ return getOrders().find(o => o.id === id); }
function lastOrderById(id){ const o = findOrderById(id); if(o) lastOrder = o; return o; }
function setOrderStatus(id, status){
  const orders = getOrders();
  const o = orders.find(x => x.id === id); if(!o) return;
  o.status = status; saveOrders(orders);
  showToast("Order " + id + " → " + status);
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
  $("#amTitle").textContent = "Order " + o.id;
  $("#amSub").textContent = fmtDT(o.date);
  $("#amBody").innerHTML =
    '<div class="ov-grid">' +
      '<div class="ov-box"><div class="ov-k">Customer</div><div class="ov-v">' + esc(o.customer.first + " " + o.customer.last) + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Email</div><div class="ov-v"><a href="mailto:' + esc(o.customer.email) + '" style="color:var(--accent)">' + esc(o.customer.email) + '</a></div></div>' +
      '<div class="ov-box"><div class="ov-k">Phone</div><div class="ov-v">' + esc(o.customer.phone || "—") + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Preferred Contact</div><div class="ov-v">' + esc(o.customer.contact || "—") + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Delivery</div><div class="ov-v">' + esc((o.customer.address || "Not provided") + ", " + o.customer.country) + '</div></div>' +
      '<div class="ov-box"><div class="ov-k">Status</div><div class="ov-v"><select class="order-status ' + orderStatusColor(o.status) + '" onchange="setOrderStatus(\'' + esc(o.id) + '\', this.value)">' + ["New","Processing","Shipped","Completed","Cancelled"].map(s => '<option ' + (o.status === s ? "selected" : "") + '>' + s + '</option>').join("") + '</select></div></div>' +
      '<div class="ov-box"><div class="ov-k">Total (' + cur + ')</div><div class="ov-v" style="font-weight:800">' + fmtIn(o.total, cur, orate(o)) + '</div></div>' +
    '</div>' +
    '<table class="admin-table" style="margin-top:14px"><thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Unit (' + cur + ')</th><th>Line (' + cur + ')</th></tr></thead><tbody>' +
    o.items.map(it => '<tr><td style="font-weight:600">' + esc(it.name) + '</td><td><span class="pill">' + esc(catName(it.cat)) + '</span></td><td>' + it.qty + '</td><td>' + fmtIn(it.price, cur, orate(o)) + '</td><td style="font-weight:700">' + fmtIn(it.price * it.qty, cur, orate(o)) + '</td></tr>').join("") +
    '</tbody></table>' +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button class="btn sm" onclick="mailOrder(lastOrder)">' + IC.mail + ' Email Order</button>' +
      '<button class="btn sm ghost" onclick="copyOrderSummary(lastOrder)">Copy Summary</button>' +
    '</div>';
  $("#adminModal").classList.add("open");
}

/* ---- Excel / CSV exports (EUR base + order currency columns) ---- */
function exportOrdersCSV(){
  const orders = getOrders();
  const rows = [["Order No","Date","Customer","Email","Phone","Preferred Contact","Country","Address","Items Qty","Order Total (EUR)","Currency","Order Total (orig)","Status"]];
  orders.forEach(o => { const cur = o.cur || "EUR"; const r = orate(o); const dec = getCurDec(cur);
    rows.push([o.id, fmtDT(o.date), o.customer.first + " " + o.customer.last, o.customer.email, o.customer.phone || "", o.customer.contact || "", o.customer.country, o.customer.address, o.items.reduce((s,i) => s + i.qty, 0), Number(o.total).toFixed(2), cur, (Number(o.total) * r).toFixed(dec), o.status]);
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
      rows.push([o.id, fmtDT(o.date), o.customer.first + " " + o.customer.last, o.customer.email, it.name, catName(it.cat), it.qty, Number(it.price).toFixed(2), Number(it.price * it.qty).toFixed(2), Number(o.total).toFixed(2), cur, (it.price * r).toFixed(dec), (it.price * it.qty * r).toFixed(dec), o.status])
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
  $("#amTitle").textContent = p ? "Edit product" : "Add product";
  $("#amSub").textContent = p ? "Editing: " + p.n : "Fill in the details to add a new product";
  $("#amBody").innerHTML =
    '<div class="form-grid">' +
      '<div class="field full"><label>Product name *</label><input id="pfName" value="' + (p ? esc(p.n) : "") + '" placeholder="e.g. Rose Body Scrub"></div>' +
      '<div class="field"><label>Category *</label><select id="pfCat">' + cats.map(c => '<option value="' + c.cs + '"' + (p && p.cs === c.cs ? " selected" : "") + '>' + esc(c.c) + '</option>').join("") + '</select></div>' +
      '<div class="field"><label>Price (EUR) *</label><input id="pfPrice" type="number" step="0.01" min="0" value="' + (p ? p.p : "1.00") + '"></div>' +
      '<div class="field full"><label>Image URL</label><input id="pfImg" value="' + (p ? esc(p.i) : "") + '" placeholder="https://… (leave empty for placeholder)" oninput="pfPreview(this.value)"></div>' +
      '<div class="field full"><label>Image preview</label><div class="pf-prev"><img id="pfImgPrev" src="' + (p ? imgUrl(p.i, 200) : PLACEHOLDER) + '" alt="" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>' +
      '<div class="field full"><label>Or upload from your computer</label><label class="upload-btn" for="pfUpload">' + IC.up + ' Choose image file</label><input type="file" id="pfUpload" accept="image/*" style="display:none" onchange="uploadImageTo(\'pfUpload\',\'pfImg\',800)"><div class="form-hint">The image is compressed and stored with this product — no hosting needed. Tip: you can also paste any image URL directly.</div></div>' +
      '<div class="field full"><label>Description (one attribute per line)</label><textarea id="pfDesc" rows="5" placeholder="Country of Origin: China&#10;Scent: Rose&#10;Volume: 100ml">' + (p ? esc((p.d || []).join("\n")) : "") + '</textarea></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">' +
      '<button class="btn ghost" onclick="closeAdminModal()">Cancel</button>' +
      '<button class="btn" onclick="saveProductForm(\'' + (p ? p.id : "") + '\')">' + (p ? "Save changes" : "Add product") + '</button>' +
    '</div>';
  $("#adminModal").classList.add("open");
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
  if(!name){ showToast("Please enter a product name"); return; }
  if(isNaN(price) || price < 0){ showToast("Please enter a valid price"); return; }
  const products = getProducts();
  const existing = id ? products.find(x => String(x.id) === String(id)) : null;
  const rec = {
    id: existing ? existing.id : "x" + Date.now(),
    n: name,
    c: catName(cs),
    cs: cs,
    p: price,
    pf: "€" + Number(price).toFixed(2),
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
  renderCatNav();
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

  /* Convert login name to email format for Supabase Auth */
  const email = u.includes('@') ? u : u + '@nebulasecret.com';

  try{
    /* Save current admin session to restore later */
    const { data: currentSession } = await supabase.auth.getSession();
    const currentAdminEmail = currentSession?.session?.user?.email;
    const currentAdminPassword = null; /* We can't get the password, so we'll need to re-login differently */

    /* Create user via Supabase Auth */
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: p,
      options: {
        data: { name: n || u }
      }
    });

    if(signUpError){
      if(signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')){
        showToast("This login name already exists");
      }else{
        showToast("Error creating admin: " + signUpError.message);
      }
      return;
    }

    /* Set admin role via RPC function */
    const { error: roleError } = await supabase.rpc('set_admin_role', {
      p_user_email: email
    });

    if(roleError){
      console.warn("Role setting error:", roleError);
      showToast("Admin created, but role setting failed. Please run SQL manually.");
    }else{
      showToast("Admin " + u + " added successfully");
    }

    /* Sign out the new user and restore admin session */
    await supabase.auth.signOut();

    /* If we have current admin credentials, re-login */
    /* Note: We can't restore session without password, so admin will need to re-login */
    showToast("Please re-login with your admin account");

    /* Refresh the admin users list */
    adminAdminUsers();

  }catch(e){
    console.error("Add admin error:", e);
    showToast("An error occurred: " + e.message);
  }
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
      '<div class="field"><label>Email</label><input id="loginEmail" type="email" placeholder="admin@nebulasecret.com" autocomplete="email"></div>' +
      '<div class="field"><label>Password</label><input id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')doLogin()"></div>' +
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
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: p
    });
    if(error){
      const err = $("#loginErr");
      err.textContent = error.message || "Invalid email or password.";
      err.classList.add("show");
      if(btn){ btn.disabled = false; btn.textContent = "Sign in"; }
      return;
    }
    if(data && data.user){
      /* Check if user has admin role */
      const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
      if(role !== 'admin' && role !== 'superadmin'){
        /* Not an admin, sign out and show error */
        await supabase.auth.signOut();
        const err = $("#loginErr");
        err.textContent = "You do not have admin access. Please contact the administrator.";
        err.classList.add("show");
        if(btn){ btn.disabled = false; btn.textContent = "Sign in"; }
        return;
      }
      showToast("Welcome, " + (data.user.user_metadata?.name || data.user.email));
      location.hash = "#/admin/dashboard";
    }
  } catch(e) {
    console.error("Login error:", e);
    const err = $("#loginErr");
    err.textContent = "An error occurred during login. Please try again.";
    err.classList.add("show");
    if(btn){ btn.disabled = false; btn.textContent = "Sign in"; }
  }
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
  /* Check Supabase Auth session asynchronously */
  supabase.auth.getSession().then(({ data: { session } }) => {
    if(!session){
      if(h === "#/admin"){ viewAdminLogin(); return; }
      viewAdminLogin("Please sign in to access the admin panel.");
      return;
    }
    /* Check if user has admin role */
    const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
    if(role !== 'admin' && role !== 'superadmin'){
      viewAdminLogin("You do not have admin access. Please contact the administrator.");
      return;
    }
    const page = h.split("/")[2] || "dashboard";
    if(page === "dashboard") adminDashboard();
    else if(page === "products") adminProducts();
    else if(page === "orders") adminOrders();
    else if(page === "categories") adminCategories();
    else if(page === "customers") adminCustomers();
    else if(page === "users") adminAdminUsers();
    else if(page === "theme") adminTheme();
    else if(page === "emails") adminEmails();
    else if(page === "content") adminContent();
    else if(page === "cloudsync") adminCloudSync();
    else viewAdminLogin();
  }).catch(e => {
    console.error("Auth session error:", e);
    viewAdminLogin("Authentication error. Please try again.");
  });
}
