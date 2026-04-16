const STORAGE_KEY = 'bills_mall_admin_dashboard_v2';

const defaultData = {
  auth: {
    currentUser: {
      uid: 'admin_001',
      name: 'Bills Mall Admin',
      email: 'admin@billsmall.com',
      role: 'platform_admin'
    }
  },
  settings: {
    commissionRate: 10,
    categories: ['Fashion', 'Electronics', 'Beauty', 'Home', 'Groceries']
  },
  vendors: [],
  products: [],
  customers: [],
  orders: []
};

const state = {
  data: loadData(),
  section: 'dashboard',
  chartRange: 'monthly',
  chart: null
};

const elements = {
  pageTitle: document.getElementById('pageTitle'),
  navButtons: [...document.querySelectorAll('.nav-btn')],
  sections: [...document.querySelectorAll('.section')],
  statsGrid: document.getElementById('statsGrid'),
  alertList: document.getElementById('alertList'),
  topVendorsList: document.getElementById('topVendorsList'),
  topProductsList: document.getElementById('topProductsList'),
  vendorList: document.getElementById('vendorList'),
  productList: document.getElementById('productList'),
  orderList: document.getElementById('orderList'),
  customerList: document.getElementById('customerList'),
  payoutList: document.getElementById('payoutList'),
  reportSummary: document.getElementById('reportSummary'),
  insightList: document.getElementById('insightList'),
  categoryList: document.getElementById('categoryList'),
  productVendorFilter: document.getElementById('productVendorFilter'),
  productCategoryFilter: document.getElementById('productCategoryFilter'),
  vendorSearch: document.getElementById('vendorSearch'),
  vendorStatusFilter: document.getElementById('vendorStatusFilter'),
  productSearch: document.getElementById('productSearch'),
  productStatusFilter: document.getElementById('productStatusFilter'),
  orderSearch: document.getElementById('orderSearch'),
  orderStatusFilter: document.getElementById('orderStatusFilter'),
  customerSearch: document.getElementById('customerSearch'),
  chartRangeSelect: document.getElementById('chartRangeSelect'),
  commissionRateInput: document.getElementById('commissionRateInput'),
  saveCommissionBtn: document.getElementById('saveCommissionBtn'),
  newCategoryInput: document.getElementById('newCategoryInput'),
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  adminName: document.getElementById('adminName'),
  adminRole: document.getElementById('adminRole'),
  adminNameInput: document.getElementById('adminNameInput'),
  adminEmailInput: document.getElementById('adminEmailInput'),
  adminRoleInput: document.getElementById('adminRoleInput'),
  saveAdminSettingsBtn: document.getElementById('saveAdminSettingsBtn'),
  rbacStatus: document.getElementById('rbacStatus'),
  exportBtn: document.getElementById('exportBtn'),
  seedDataBtn: document.getElementById('seedDataBtn')
};

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error('Failed to parse admin data', error);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
  return structuredClone(defaultData);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function canAccessAdmin() {
  const role = state.data.auth?.currentUser?.role;
  return ['platform_admin', 'super_admin', 'support_admin'].includes(role);
}

function getVendorName(vendorId) {
  return state.data.vendors.find((vendor) => vendor.id === vendorId)?.name || 'Unknown Vendor';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function statusClass(status) {
  return `status-${String(status).toLowerCase().replace(/\s+/g, '-')}`;
}

function getOverview() {
  const orders = state.data.orders;
  const vendors = state.data.vendors;
  const products = state.data.products;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending').length;
  const activeVendors = vendors.filter((vendor) => vendor.status === 'approved').length;

  return {
    revenue,
    totalOrders: orders.length,
    totalVendors: vendors.length,
    activeVendors,
    totalProducts: products.length,
    pendingOrders
  };
}

function buildAlerts() {
  const alerts = [];

  state.data.products.filter((product) => Number(product.stock) <= 3).forEach((product) => {
    alerts.push({
      type: 'warning',
      title: 'Low stock alert',
      text: `${product.name} has only ${product.stock} item(s) left.`
    });
  });

  state.data.vendors.filter((vendor) => vendor.status === 'pending').forEach((vendor) => {
    alerts.push({
      type: 'success',
      title: 'Vendor approval needed',
      text: `${vendor.name} is waiting for approval.`
    });
  });

  state.data.orders.filter((order) => order.dispute || order.status === 'dispute').forEach((order) => {
    alerts.push({
      type: 'danger',
      title: 'Dispute raised',
      text: `${order.id} requires admin review.`
    });
  });

  return alerts;
}

function getTopVendors() {
  return [...state.data.vendors]
    .sort((a, b) => Number(b.totalSales || 0) - Number(a.totalSales || 0))
    .slice(0, 5);
}

function getTopProducts() {
  return [...state.data.products]
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0))
    .slice(0, 5);
}

function renderStats() {
  const overview = getOverview();
  const cards = [
    { label: 'Total Revenue', value: formatCurrency(overview.revenue), note: 'Platform-wide sales volume' },
    { label: 'Total Orders', value: overview.totalOrders, note: 'All orders across all vendors' },
    { label: 'Total Vendors', value: overview.totalVendors, note: `${overview.activeVendors} currently approved` },
    { label: 'Total Products', value: overview.totalProducts, note: 'All catalog listings' },
    { label: 'Pending Orders', value: overview.pendingOrders, note: 'Orders requiring action' }
  ];

  elements.statsGrid.innerHTML = cards.map((card) => `
    <article class="stat-card">
      <div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.value}</div>
      <div class="stat-note">${card.note}</div>
    </article>
  `).join('');
}

function aggregateOrders(range) {
  const buckets = {};

  state.data.orders.forEach((order) => {
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;

    let key = '';
    if (range === 'daily') {
      key = date.toISOString().slice(0, 10);
    } else if (range === 'weekly') {
      const firstDay = new Date(date);
      firstDay.setDate(date.getDate() - date.getDay());
      key = `Week of ${firstDay.toISOString().slice(0, 10)}`;
    } else {
      key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    }

    if (!buckets[key]) buckets[key] = 0;
    buckets[key] += Number(order.total || 0);
  });

  return buckets;
}

function renderChart() {
  const canvas = document.getElementById('salesChart');
  const bucketMap = aggregateOrders(state.chartRange);
  const labels = Object.keys(bucketMap);
  const values = Object.values(bucketMap);

  if (state.chart) state.chart.destroy();

  const parent = canvas.parentElement;
  const oldEmpty = parent.querySelector('.chart-empty-state');
  if (oldEmpty) oldEmpty.remove();

  if (!labels.length) {
    canvas.style.display = 'none';
    const empty = document.createElement('div');
    empty.className = 'empty-state chart-empty-state';
    empty.textContent = 'No sales data yet. Analytics will appear once orders start coming in.';
    parent.appendChild(empty);
    return;
  }

  canvas.style.display = 'block';
  state.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Revenue (${state.chartRange})`,
        data: values,
        borderColor: '#b5651d',
        backgroundColor: 'rgba(181,101,29,0.16)',
        fill: true,
        tension: 0.32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } }
    }
  });
}

function renderAlerts() {
  const alerts = buildAlerts();
  if (!alerts.length) {
    elements.alertList.innerHTML = '<div class="empty-state">No alerts right now.</div>';
    return;
  }

  elements.alertList.innerHTML = alerts.map((alert) => `
    <div class="alert-item ${alert.type}">
      <strong>${alert.title}</strong>
      <div>${alert.text}</div>
    </div>
  `).join('');
}

function renderTopLists() {
  const vendors = getTopVendors();
  const products = getTopProducts();

  elements.topVendorsList.innerHTML = vendors.length
    ? vendors.map((vendor) => `
        <div class="mini-item">
          <div>
            <strong>${vendor.name}</strong>
            <div class="eyebrow">${vendor.totalProducts} products • Rating ${vendor.rating}</div>
          </div>
          <strong>${formatCurrency(vendor.totalSales)}</strong>
        </div>
      `).join('')
    : '<div class="empty-state">No vendors yet. The platform is brand new.</div>';

  elements.topProductsList.innerHTML = products.length
    ? products.map((product) => `
        <div class="mini-item">
          <div>
            <strong>${product.name}</strong>
            <div class="eyebrow">${getVendorName(product.vendorId)}</div>
          </div>
          <strong>${product.sold} sold</strong>
        </div>
      `).join('')
    : '<div class="empty-state">No products yet. Listings will appear here.</div>';
}

function renderVendorFilters() {
  const vendors = state.data.vendors;
  const categories = [...new Set(state.data.products.map((item) => item.category))];

  elements.productVendorFilter.innerHTML = ['<option value="all">All vendors</option>']
    .concat(vendors.map((vendor) => `<option value="${vendor.id}">${vendor.name}</option>`))
    .join('');

  elements.productCategoryFilter.innerHTML = ['<option value="all">All categories</option>']
    .concat(categories.map((category) => `<option value="${category}">${category}</option>`))
    .join('');
}

function renderVendors() {
  const query = elements.vendorSearch.value.trim().toLowerCase();
  const status = elements.vendorStatusFilter.value;

  const vendors = state.data.vendors.filter((vendor) => {
    const matchesQuery = !query || vendor.name.toLowerCase().includes(query) || vendor.email.toLowerCase().includes(query);
    const matchesStatus = status === 'all' || vendor.status === status;
    return matchesQuery && matchesStatus;
  });

  if (!vendors.length) {
    elements.vendorList.innerHTML = '<div class="empty-state">No vendors yet. This admin panel is fresh and unused.</div>';
    return;
  }

  elements.vendorList.innerHTML = vendors.map((vendor) => `
    <article class="table-card">
      <div class="table-top">
        <div>
          <strong>${vendor.name}</strong>
          <div class="eyebrow">${vendor.email}</div>
        </div>
        <span class="badge ${statusClass(vendor.status)}">${vendor.status}</span>
      </div>
      <div class="table-details">
        <div class="detail-box"><span>Phone</span><strong>${vendor.phone}</strong></div>
        <div class="detail-box"><span>Sales</span><strong>${formatCurrency(vendor.totalSales)}</strong></div>
        <div class="detail-box"><span>Products</span><strong>${vendor.totalProducts}</strong></div>
        <div class="detail-box"><span>Rating</span><strong>${vendor.rating}</strong></div>
      </div>
    </article>
  `).join('');
}

function renderProducts() {
  const search = elements.productSearch.value.trim().toLowerCase();
  const vendorId = elements.productVendorFilter.value;
  const status = elements.productStatusFilter.value;
  const category = elements.productCategoryFilter.value;

  const products = state.data.products.filter((product) => {
    const matchSearch = !search || product.name.toLowerCase().includes(search);
    const matchVendor = vendorId === 'all' || product.vendorId === vendorId;
    const matchStatus = status === 'all' || product.status === status;
    const matchCategory = category === 'all' || product.category === category;
    return matchSearch && matchVendor && matchStatus && matchCategory;
  });

  if (!products.length) {
    elements.productList.innerHTML = '<div class="empty-state">No products found. The catalog is empty for now.</div>';
    return;
  }

  elements.productList.innerHTML = products.map((product) => `
    <article class="table-card">
      <div class="table-top">
        <div>
          <strong>${product.name}</strong>
          <div class="eyebrow">${getVendorName(product.vendorId)} • ${product.category}</div>
        </div>
        <span class="badge ${statusClass(product.status)}">${product.status}</span>
      </div>
      <div class="table-details">
        <div class="detail-box"><span>Price</span><strong>${formatCurrency(product.price)}</strong></div>
        <div class="detail-box"><span>Stock</span><strong>${product.stock}</strong></div>
        <div class="detail-box"><span>Sold</span><strong>${product.sold}</strong></div>
        <div class="detail-box"><span>Vendor</span><strong>${getVendorName(product.vendorId)}</strong></div>
      </div>
    </article>
  `).join('');
}

function renderOrders() {
  const search = elements.orderSearch.value.trim().toLowerCase();
  const status = elements.orderStatusFilter.value;

  const orders = state.data.orders.filter((order) => {
    const matchSearch = !search || order.id.toLowerCase().includes(search) || order.customerName.toLowerCase().includes(search);
    const matchStatus = status === 'all' || order.status === status;
    return matchSearch && matchStatus;
  });

  if (!orders.length) {
    elements.orderList.innerHTML = '<div class="empty-state">No orders found. New orders will appear here later.</div>';
    return;
  }

  elements.orderList.innerHTML = orders.map((order) => `
    <article class="table-card">
      <div class="table-top">
        <div>
          <strong>${order.id}</strong>
          <div class="eyebrow">${order.customerName} • ${getVendorName(order.vendorId)}</div>
        </div>
        <span class="badge ${statusClass(order.status)}">${order.status}</span>
      </div>
      <div class="table-details">
        <div class="detail-box"><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
        <div class="detail-box"><span>Date</span><strong>${order.createdAt}</strong></div>
        <div class="detail-box"><span>Items</span><strong>${order.items.length}</strong></div>
        <div class="detail-box"><span>Issue</span><strong>${order.dispute ? 'Dispute' : order.refundRequested ? 'Refund' : 'None'}</strong></div>
      </div>
    </article>
  `).join('');
}

function renderCustomers() {
  const query = elements.customerSearch.value.trim().toLowerCase();

  const customers = state.data.customers.filter((customer) => {
    return !query || customer.name.toLowerCase().includes(query) || customer.email.toLowerCase().includes(query);
  });

  if (!customers.length) {
    elements.customerList.innerHTML = '<div class="empty-state">No customers yet. Customer profiles will appear here.</div>';
    return;
  }

  elements.customerList.innerHTML = customers.map((customer) => {
    const orderHistory = state.data.orders.filter((order) => order.customerId === customer.id);
    const spent = orderHistory.reduce((sum, order) => sum + Number(order.total || 0), 0);

    return `
      <article class="table-card">
        <div class="table-top">
          <div>
            <strong>${customer.name}</strong>
            <div class="eyebrow">${customer.email}</div>
          </div>
          <span class="badge ${customer.complaints ? 'status-pending' : 'status-approved'}">${customer.complaints} complaints</span>
        </div>
        <div class="table-details">
          <div class="detail-box"><span>Phone</span><strong>${customer.phone}</strong></div>
          <div class="detail-box"><span>Total Orders</span><strong>${orderHistory.length}</strong></div>
          <div class="detail-box"><span>Total Spent</span><strong>${formatCurrency(spent)}</strong></div>
          <div class="detail-box"><span>Latest Order</span><strong>${orderHistory.at(-1)?.id || 'None'}</strong></div>
        </div>
      </article>
    `;
  }).join('');
}

function calculatePayouts() {
  const commissionRate = Number(state.data.settings.commissionRate || 0) / 100;

  return state.data.vendors.map((vendor) => {
    const vendorOrders = state.data.orders.filter((order) => {
      return order.vendorId === vendor.id && ['paid', 'delivered'].includes(order.status);
    });

    const gross = vendorOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const commission = gross * commissionRate;
    const net = gross - commission;

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      gross,
      commission,
      net,
      payoutStatus: net > 0 ? 'pending' : 'paid'
    };
  });
}

function renderPayments() {
  const payouts = calculatePayouts();
  elements.commissionRateInput.value = state.data.settings.commissionRate;

  if (!payouts.length) {
    elements.payoutList.innerHTML = '<div class="empty-state">No payouts yet. Vendor earnings will show here later.</div>';
    return;
  }

  elements.payoutList.innerHTML = payouts.map((payout) => `
    <article class="table-card">
      <div class="table-top">
        <div>
          <strong>${payout.vendorName}</strong>
          <div class="eyebrow">Vendor payout calculation</div>
        </div>
        <span class="badge ${statusClass(payout.payoutStatus)}">${payout.payoutStatus}</span>
      </div>
      <div class="table-details">
        <div class="detail-box"><span>Gross Sales</span><strong>${formatCurrency(payout.gross)}</strong></div>
        <div class="detail-box"><span>Commission</span><strong>${formatCurrency(payout.commission)}</strong></div>
        <div class="detail-box"><span>Vendor Earnings</span><strong>${formatCurrency(payout.net)}</strong></div>
        <div class="detail-box"><span>Rate</span><strong>${state.data.settings.commissionRate}%</strong></div>
      </div>
    </article>
  `).join('');
}

function renderAnalytics() {
  const overview = getOverview();
  const payouts = calculatePayouts();
  const topVendor = getTopVendors()[0];
  const topProduct = getTopProducts()[0];
  const avgOrderValue = overview.totalOrders ? overview.revenue / overview.totalOrders : 0;

  elements.reportSummary.innerHTML = [
    ['Revenue', formatCurrency(overview.revenue)],
    ['Average order value', formatCurrency(avgOrderValue)],
    ['Pending payouts', payouts.filter((item) => item.payoutStatus === 'pending').length],
    ['Vendor approvals waiting', state.data.vendors.filter((vendor) => vendor.status === 'pending').length]
  ].map(([label, value]) => `
    <div class="mini-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join('');

  elements.insightList.innerHTML = `
    <div class="mini-item"><span>Top vendor</span><strong>${topVendor ? topVendor.name : 'N/A'}</strong></div>
    <div class="mini-item"><span>Top product</span><strong>${topProduct ? topProduct.name : 'N/A'}</strong></div>
    <div class="mini-item"><span>Dispute cases</span><strong>${state.data.orders.filter((order) => order.dispute || order.status === 'dispute').length}</strong></div>
    <div class="mini-item"><span>Refund requests</span><strong>${state.data.orders.filter((order) => order.refundRequested).length}</strong></div>
  `;
}

function renderSettings() {
  const categories = state.data.settings.categories;
  const currentUser = state.data.auth.currentUser;

  elements.categoryList.innerHTML = categories.map((category, index) => `
    <div class="mini-item">
      <span>${category}</span>
      <button class="btn-danger" data-category-remove="${index}">Remove</button>
    </div>
  `).join('');

  elements.adminName.textContent = currentUser.name;
  elements.adminRole.textContent = `Role: ${currentUser.role}`;
  elements.adminNameInput.value = currentUser.name;
  elements.adminEmailInput.value = currentUser.email;
  elements.adminRoleInput.value = currentUser.role;
  elements.rbacStatus.textContent = `RBAC: ${currentUser.role}`;
}

function setSection(section) {
  state.section = section;
  elements.pageTitle.textContent = section.replace(/(^\w)|(-\w)/g, (match) => match.replace('-', '').toUpperCase());

  elements.navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.section === section);
  });

  elements.sections.forEach((sectionEl) => {
    sectionEl.classList.toggle('active', sectionEl.id === `section-${section}`);
  });
}

function renderAll() {
  if (!canAccessAdmin()) {
    document.body.innerHTML = '<div style="padding:40px;font-family:Arial,sans-serif;">Access denied. This dashboard is only for admins.</div>';
    return;
  }

  renderStats();
  renderChart();
  renderAlerts();
  renderTopLists();
  renderVendorFilters();
  renderVendors();
  renderProducts();
  renderOrders();
  renderCustomers();
  renderPayments();
  renderAnalytics();
  renderSettings();
}

function addCategory() {
  const value = elements.newCategoryInput.value.trim();
  if (!value) return;
  if (state.data.settings.categories.includes(value)) return;
  state.data.settings.categories.push(value);
  elements.newCategoryInput.value = '';
  saveData();
  renderAll();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => setSection(button.dataset.section));
  });

  elements.chartRangeSelect.addEventListener('change', (event) => {
    state.chartRange = event.target.value;
    renderChart();
  });

  [
    elements.vendorSearch,
    elements.vendorStatusFilter,
    elements.productSearch,
    elements.productVendorFilter,
    elements.productStatusFilter,
    elements.productCategoryFilter,
    elements.orderSearch,
    elements.orderStatusFilter,
    elements.customerSearch
  ].forEach((input) => {
    input.addEventListener('input', renderAll);
    input.addEventListener('change', renderAll);
  });

  elements.saveCommissionBtn.addEventListener('click', () => {
    state.data.settings.commissionRate = Number(elements.commissionRateInput.value || 0);
    saveData();
    renderAll();
  });

  elements.addCategoryBtn.addEventListener('click', addCategory);

  elements.newCategoryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCategory();
    }
  });

  elements.categoryList.addEventListener('click', (event) => {
    const index = event.target.dataset.categoryRemove;
    if (index === undefined) return;
    state.data.settings.categories.splice(Number(index), 1);
    saveData();
    renderAll();
  });

  elements.saveAdminSettingsBtn.addEventListener('click', () => {
    state.data.auth.currentUser = {
      ...state.data.auth.currentUser,
      name: elements.adminNameInput.value.trim() || 'Bills Mall Admin',
      email: elements.adminEmailInput.value.trim() || 'admin@billsmall.com',
      role: elements.adminRoleInput.value
    };
    saveData();
    renderAll();
  });

  elements.exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(state.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bills-mall-admin-report.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  elements.seedDataBtn.addEventListener('click', () => {
    state.data = structuredClone(defaultData);
    saveData();
    renderAll();
  });
}

bindEvents();
renderAll();
