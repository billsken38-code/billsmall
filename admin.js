import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";
import { showToast } from "./ui.js";
import {
  defaultDeliveryConfig,
  normalizeDeliveryConfig,
  slugifyLocationValue,
  getUniqueZones
} from "./delivery-config.js";

const SETTINGS_KEY = "bills_mall_admin_settings_v1";

const defaultSettings = {
  commissionRate: 5,
  categories: ["Fashion", "Electronics", "Beauty", "Home", "Groceries"],
  delivery: defaultDeliveryConfig,
  adminProfile: {
    name: "Bills Mall Admin",
    email: "admin@billsmall.com",
    role: "platform_admin"
  }
};

const state = {
  data: {
    auth: {
      currentUser: {
        uid: "",
        name: "Admin User",
        email: "",
        role: "platform_admin"
      }
    },
    settings: loadSettings(),
    vendors: [],
    products: [],
    customers: [],
    orders: []
  },
  section: "dashboard",
  chartRange: "monthly",
  chart: null,
  unsubscribeVendors: null,
  unsubscribeProducts: null,
  unsubscribeOrders: null,
  unsubscribePlatformSettings: null
};

const elements = {
  pageTitle: document.getElementById("pageTitle"),
  navButtons: [...document.querySelectorAll(".nav-btn")],
  sections: [...document.querySelectorAll(".section")],
  statsGrid: document.getElementById("statsGrid"),
  alertList: document.getElementById("alertList"),
  topVendorsList: document.getElementById("topVendorsList"),
  topProductsList: document.getElementById("topProductsList"),
  vendorList: document.getElementById("vendorList"),
  productList: document.getElementById("productList"),
  orderList: document.getElementById("orderList"),
  customerList: document.getElementById("customerList"),
  payoutList: document.getElementById("payoutList"),
  reportSummary: document.getElementById("reportSummary"),
  insightList: document.getElementById("insightList"),
  categoryList: document.getElementById("categoryList"),
  productVendorFilter: document.getElementById("productVendorFilter"),
  productCategoryFilter: document.getElementById("productCategoryFilter"),
  vendorSearch: document.getElementById("vendorSearch"),
  vendorStatusFilter: document.getElementById("vendorStatusFilter"),
  productSearch: document.getElementById("productSearch"),
  productStatusFilter: document.getElementById("productStatusFilter"),
  orderSearch: document.getElementById("orderSearch"),
  orderStatusFilter: document.getElementById("orderStatusFilter"),
  customerSearch: document.getElementById("customerSearch"),
  chartRangeSelect: document.getElementById("chartRangeSelect"),
  commissionRateInput: document.getElementById("commissionRateInput"),
  saveCommissionBtn: document.getElementById("saveCommissionBtn"),
  newCategoryInput: document.getElementById("newCategoryInput"),
  addCategoryBtn: document.getElementById("addCategoryBtn"),
  sameLocationFeeInput: document.getElementById("sameLocationFeeInput"),
  sameZoneFeeInput: document.getElementById("sameZoneFeeInput"),
  defaultCrossZoneFeeInput: document.getElementById("defaultCrossZoneFeeInput"),
  saveDeliveryFeesBtn: document.getElementById("saveDeliveryFeesBtn"),
  newLocationLabelInput: document.getElementById("newLocationLabelInput"),
  newLocationValueInput: document.getElementById("newLocationValueInput"),
  newLocationZoneInput: document.getElementById("newLocationZoneInput"),
  addLocationBtn: document.getElementById("addLocationBtn"),
  locationList: document.getElementById("locationList"),
  routeZoneAInput: document.getElementById("routeZoneAInput"),
  routeZoneBInput: document.getElementById("routeZoneBInput"),
  routeFeeInput: document.getElementById("routeFeeInput"),
  addRouteFeeBtn: document.getElementById("addRouteFeeBtn"),
  routeFeeList: document.getElementById("routeFeeList"),
  adminName: document.getElementById("adminName"),
  adminRole: document.getElementById("adminRole"),
  adminNameInput: document.getElementById("adminNameInput"),
  adminEmailInput: document.getElementById("adminEmailInput"),
  adminRoleInput: document.getElementById("adminRoleInput"),
  saveAdminSettingsBtn: document.getElementById("saveAdminSettingsBtn"),
  rbacStatus: document.getElementById("rbacStatus"),
  exportBtn: document.getElementById("exportBtn"),
  seedDataBtn: document.getElementById("seedDataBtn")
};

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return {
      ...structuredClone(defaultSettings),
      delivery: normalizeDeliveryConfig(defaultSettings.delivery)
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultSettings),
      ...parsed,
      delivery: normalizeDeliveryConfig(parsed.delivery || defaultSettings.delivery)
    };
  } catch (error) {
    console.error("Failed to parse admin settings:", error);
    return {
      ...structuredClone(defaultSettings),
      delivery: normalizeDeliveryConfig(defaultSettings.delivery)
    };
  }
}

function saveSettingsLocal() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.data.settings));
}

function getNormalizedDeliverySettings() {
  return normalizeDeliveryConfig(state.data.settings.delivery);
}

async function savePlatformSettings(partialSettings) {
  await setDoc(doc(db, "platform_settings", "main"), partialSettings, { merge: true });
}

async function ensurePlatformSettingsDoc() {
  const settingsRef = doc(db, "platform_settings", "main");
  const snap = await getDoc(settingsRef);

  if (!snap.exists()) {
    await setDoc(settingsRef, {
      commissionRate: defaultSettings.commissionRate,
      categories: defaultSettings.categories,
      delivery: defaultDeliveryConfig
    });
  }
}

function subscribePlatformSettings() {
  if (state.unsubscribePlatformSettings) state.unsubscribePlatformSettings();

  state.unsubscribePlatformSettings = onSnapshot(
    doc(db, "platform_settings", "main"),
    (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      state.data.settings = {
        ...state.data.settings,
        commissionRate: Number(data.commissionRate ?? 5),
        categories: Array.isArray(data.categories) ? data.categories : state.data.settings.categories,
        delivery: normalizeDeliveryConfig(data.delivery || state.data.settings.delivery)
      };

      saveSettingsLocal();
      renderAll();
    },
    (error) => {
      console.error("Failed to load platform settings:", error);
      showToast(`Failed to load platform settings: ${error.message}`, { type: "error" });
    }
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function statusClass(status) {
  return `status-${String(status || "").toLowerCase().replace(/\s+/g, "-")}`;
}

function getVendorName(vendorId) {
  if (!vendorId) return "Unknown Vendor";
  const vendor = state.data.vendors.find((item) => item.id === vendorId);
  return vendor?.storeName || vendor?.name || vendor?.contactEmail || "Unknown Vendor";
}

function getVendorEmail(vendor) {
  return vendor?.contactEmail || vendor?.email || "No email";
}

function getVendorPhone(vendor) {
  return vendor?.contactPhone || vendor?.phone || "No phone";
}

function deriveCustomersFromOrders() {
  const map = new Map();

  state.data.orders.forEach((order) => {
    const customerId = order.userId || order.customerEmail || order.customerPhone || order.id;
    if (!customerId) return;

    if (!map.has(customerId)) {
      map.set(customerId, {
        id: customerId,
        name: order.customerName || "Unknown Customer",
        email: order.customerEmail || "No email",
        phone: order.customerPhone || "No phone",
        complaints: 0
      });
    }
  });

  state.data.customers = [...map.values()];
}

function getOverview() {
  const orders = state.data.orders;
  const vendors = state.data.vendors;
  const products = state.data.products;

  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = orders.filter((order) => String(order.status || "").toLowerCase() === "pending").length;
  const activeVendors = vendors.filter((vendor) => vendor.status === "approved").length;

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

  state.data.products
    .filter((product) => Number(product.stock || 0) <= 3)
    .forEach((product) => {
      alerts.push({
        type: "warning",
        title: "Low stock alert",
        text: `${product.name} has only ${product.stock || 0} item(s) left.`
      });
    });

  state.data.vendors
    .filter((vendor) => vendor.status === "pending")
    .forEach((vendor) => {
      alerts.push({
        type: "success",
        title: "Vendor approval needed",
        text: `${vendor.storeName || vendor.name || "Vendor"} is waiting for approval.`
      });
    });

  state.data.orders
    .filter((order) => order.dispute || String(order.status || "").toLowerCase() === "dispute")
    .forEach((order) => {
      alerts.push({
        type: "danger",
        title: "Dispute raised",
        text: `${order.id} requires admin review.`
      });
    });

  return alerts;
}

function getTopVendors() {
  return state.data.vendors
    .map((vendor) => {
      const vendorOrders = state.data.orders.filter((order) => order.vendorId === vendor.id);
      const totalSales = vendorOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const totalProducts = state.data.products.filter((product) => product.vendorId === vendor.id).length;

      return {
        ...vendor,
        totalSales,
        totalProducts,
        rating: Number(vendor.rating || 0).toFixed(1)
      };
    })
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

  elements.statsGrid.innerHTML = [
    { label: "Total Revenue", value: formatCurrency(overview.revenue), note: "Platform-wide sales volume" },
    { label: "Total Orders", value: overview.totalOrders, note: "All orders across all vendors" },
    { label: "Total Vendors", value: overview.totalVendors, note: `${overview.activeVendors} currently approved` },
    { label: "Total Products", value: overview.totalProducts, note: "All catalog listings" },
    { label: "Pending Orders", value: overview.pendingOrders, note: "Orders requiring action" }
  ].map((card) => `
    <article class="stat-card">
      <div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.value}</div>
      <div class="stat-note">${card.note}</div>
    </article>
  `).join("");
}

function parseOrderDate(order) {
  if (order.createdAt?.seconds) {
    return new Date(order.createdAt.seconds * 1000);
  }
  if (typeof order.createdAt === "string") {
    return new Date(order.createdAt);
  }
  return null;
}

function aggregateOrders(range) {
  const buckets = {};

  state.data.orders.forEach((order) => {
    const date = parseOrderDate(order);
    if (!date || Number.isNaN(date.getTime())) return;

    let key = "";
    if (range === "daily") {
      key = date.toISOString().slice(0, 10);
    } else if (range === "weekly") {
      const firstDay = new Date(date);
      firstDay.setDate(date.getDate() - date.getDay());
      key = `Week of ${firstDay.toISOString().slice(0, 10)}`;
    } else {
      key = date.toLocaleString("default", { month: "short", year: "numeric" });
    }

    if (!buckets[key]) buckets[key] = 0;
    buckets[key] += Number(order.total || 0);
  });

  return buckets;
}

function renderChart() {
  const canvas = document.getElementById("salesChart");
  const bucketMap = aggregateOrders(state.chartRange);
  const labels = Object.keys(bucketMap);
  const values = Object.values(bucketMap);

  if (state.chart) state.chart.destroy();

  const parent = canvas.parentElement;
  const oldEmpty = parent.querySelector(".chart-empty-state");
  if (oldEmpty) oldEmpty.remove();

  if (!labels.length) {
    canvas.style.display = "none";
    const empty = document.createElement("div");
    empty.className = "empty-state chart-empty-state";
    empty.textContent = "No sales data yet. Analytics will appear once orders start coming in.";
    parent.appendChild(empty);
    return;
  }

  canvas.style.display = "block";
  state.chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `Revenue (${state.chartRange})`,
        data: values,
        borderColor: "#b5651d",
        backgroundColor: "rgba(181,101,29,0.16)",
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

  elements.alertList.innerHTML = alerts.length
    ? alerts.map((alert) => `
        <div class="alert-item ${alert.type}">
          <strong>${alert.title}</strong>
          <div>${alert.text}</div>
        </div>
      `).join("")
    : '<div class="empty-state">No alerts right now.</div>';
}

function renderTopLists() {
  const vendors = getTopVendors();
  const products = getTopProducts();

  elements.topVendorsList.innerHTML = vendors.length
    ? vendors.map((vendor) => `
        <div class="mini-item">
          <div>
            <strong>${vendor.storeName || vendor.name || "Vendor"}</strong>
            <div class="eyebrow">${vendor.totalProducts} products • Rating ${vendor.rating}</div>
          </div>
          <strong>${formatCurrency(vendor.totalSales)}</strong>
        </div>
      `).join("")
    : '<div class="empty-state">No vendors yet.</div>';

  elements.topProductsList.innerHTML = products.length
    ? products.map((product) => `
        <div class="mini-item">
          <div>
            <strong>${product.name}</strong>
            <div class="eyebrow">${getVendorName(product.vendorId)}</div>
          </div>
          <strong>${product.sold || 0} sold</strong>
        </div>
      `).join("")
    : '<div class="empty-state">No products yet.</div>';
}

function renderVendorFilters() {
  const categories = [...new Set(state.data.products.map((item) => item.category).filter(Boolean))];

  elements.productVendorFilter.innerHTML = ['<option value="all">All vendors</option>']
    .concat(
      state.data.vendors.map(
        (vendor) => `<option value="${vendor.id}">${vendor.storeName || vendor.name || vendor.id}</option>`
      )
    )
    .join("");

  elements.productCategoryFilter.innerHTML = ['<option value="all">All categories</option>']
    .concat(categories.map((category) => `<option value="${category}">${category}</option>`))
    .join("");
}

async function updateVendorStatus(vendorId, status) {
  try {
    await updateDoc(doc(db, "vendors", vendorId), { status });
    showToast(`Vendor marked ${status}.`, { type: "success" });
  } catch (error) {
    console.error("Failed to update vendor status:", error);
    showToast(`Failed to update vendor: ${error.message}`, { type: "error" });
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await updateDoc(doc(db, "orders", orderId), { status });
    showToast(`Order updated to ${status}.`, { type: "success" });
  } catch (error) {
    console.error("Failed to update order status:", error);
    showToast(`Failed to update order: ${error.message}`, { type: "error" });
  }
}

function renderVendors() {
  const search = elements.vendorSearch.value.trim().toLowerCase();
  const status = elements.vendorStatusFilter.value;

  const vendors = state.data.vendors.filter((vendor) => {
    const name = String(vendor.storeName || vendor.name || "").toLowerCase();
    const email = String(getVendorEmail(vendor)).toLowerCase();

    const matchesSearch = !search || name.includes(search) || email.includes(search);
    const matchesStatus = status === "all" || vendor.status === status;

    return matchesSearch && matchesStatus;
  });

  elements.vendorList.innerHTML = vendors.length
    ? vendors.map((vendor) => {
        const vendorOrders = state.data.orders.filter((order) => order.vendorId === vendor.id);
        const totalSales = vendorOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const totalProducts = state.data.products.filter((product) => product.vendorId === vendor.id).length;

        return `
          <article class="table-card">
            <div class="table-top">
              <div>
                <strong>${vendor.storeName || vendor.name || "Vendor"}</strong>
                <div class="eyebrow">${getVendorEmail(vendor)}</div>
              </div>
              <span class="badge ${statusClass(vendor.status || "pending")}">${vendor.status || "pending"}</span>
            </div>
            <div class="table-details">
              <div class="detail-box"><span>Phone</span><strong>${getVendorPhone(vendor)}</strong></div>
              <div class="detail-box"><span>Sales</span><strong>${formatCurrency(totalSales)}</strong></div>
              <div class="detail-box"><span>Products</span><strong>${totalProducts}</strong></div>
              <div class="detail-box"><span>Vendor ID</span><strong>${vendor.id}</strong></div>
            </div>
            <div class="table-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" data-vendor-approve="${vendor.id}">Approve</button>
              <button class="btn-outline" data-vendor-suspend="${vendor.id}">Suspend</button>
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">No vendors found.</div>';
}

function renderProducts() {
  const search = elements.productSearch.value.trim().toLowerCase();
  const vendorId = elements.productVendorFilter.value;
  const status = elements.productStatusFilter.value;
  const category = elements.productCategoryFilter.value;

  const products = state.data.products.filter((product) => {
    const matchSearch = !search || String(product.name || "").toLowerCase().includes(search);
    const matchVendor = vendorId === "all" || product.vendorId === vendorId;
    const matchStatus = status === "all" || String(product.status || "").toLowerCase() === status.toLowerCase();
    const matchCategory = category === "all" || product.category === category;
    return matchSearch && matchVendor && matchStatus && matchCategory;
  });

  elements.productList.innerHTML = products.length
    ? products.map((product) => `
        <article class="table-card">
          <div class="table-top">
            <div>
              <strong>${product.name}</strong>
              <div class="eyebrow">${getVendorName(product.vendorId)} • ${product.category || "General"}</div>
            </div>
            <span class="badge ${statusClass(product.status || "active")}">${product.status || "active"}</span>
          </div>
          <div class="table-details">
            <div class="detail-box"><span>Price</span><strong>${formatCurrency(product.price)}</strong></div>
            <div class="detail-box"><span>Stock</span><strong>${product.stock || 0}</strong></div>
            <div class="detail-box"><span>Sold</span><strong>${product.sold || 0}</strong></div>
            <div class="detail-box"><span>Vendor</span><strong>${getVendorName(product.vendorId)}</strong></div>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">No products found.</div>';
}

function renderOrders() {
  const search = elements.orderSearch.value.trim().toLowerCase();
  const status = elements.orderStatusFilter.value;

  const orders = state.data.orders.filter((order) => {
    const id = String(order.id || "").toLowerCase();
    const customerName = String(order.customerName || "").toLowerCase();
    const orderStatus = String(order.status || "").toLowerCase();

    const matchSearch = !search || id.includes(search) || customerName.includes(search);
    const matchStatus = status === "all" || orderStatus === status.toLowerCase();
    return matchSearch && matchStatus;
  });

  elements.orderList.innerHTML = orders.length
    ? orders.map((order) => {
        const createdDate = parseOrderDate(order);
        const formattedDate = createdDate && !Number.isNaN(createdDate.getTime())
          ? createdDate.toLocaleString()
          : "N/A";

        return `
          <article class="table-card">
            <div class="table-top">
              <div>
                <strong>${order.id}</strong>
                <div class="eyebrow">${order.customerName || "Customer"} • ${getVendorName(order.vendorId)}</div>
              </div>
              <span class="badge ${statusClass(order.status || "pending")}">${order.status || "pending"}</span>
            </div>
            <div class="table-details">
              <div class="detail-box"><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
              <div class="detail-box"><span>Date</span><strong>${formattedDate}</strong></div>
              <div class="detail-box"><span>Items</span><strong>${Array.isArray(order.items) ? order.items.length : 0}</strong></div>
              <div class="detail-box"><span>Issue</span><strong>${order.dispute ? "Dispute" : order.refundRequested ? "Refund" : "None"}</strong></div>
            </div>

            <div class="table-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" data-order-update="${order.id}" data-status="pending">Pending</button>
              <button class="btn" data-order-update="${order.id}" data-status="paid">Paid</button>
              <button class="btn" data-order-update="${order.id}" data-status="shipped">Shipped</button>
              <button class="btn" data-order-update="${order.id}" data-status="delivered">Delivered</button>
              <button class="btn-outline" data-order-update="${order.id}" data-status="refunded">Refunded</button>
              <button class="btn-danger" data-order-update="${order.id}" data-status="dispute">Dispute</button>
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">No orders found.</div>';
}

function renderCustomers() {
  const search = elements.customerSearch.value.trim().toLowerCase();

  const customers = state.data.customers.filter((customer) => {
    return (
      !search ||
      String(customer.name || "").toLowerCase().includes(search) ||
      String(customer.email || "").toLowerCase().includes(search)
    );
  });

  elements.customerList.innerHTML = customers.length
    ? customers.map((customer) => {
        const orderHistory = state.data.orders.filter((order) => {
          return (
            order.userId === customer.id ||
            order.customerEmail === customer.email
          );
        });

        const spent = orderHistory.reduce((sum, order) => sum + Number(order.total || 0), 0);

        return `
          <article class="table-card">
            <div class="table-top">
              <div>
                <strong>${customer.name}</strong>
                <div class="eyebrow">${customer.email}</div>
              </div>
              <span class="badge ${customer.complaints ? "status-pending" : "status-approved"}">${customer.complaints} complaints</span>
            </div>
            <div class="table-details">
              <div class="detail-box"><span>Phone</span><strong>${customer.phone}</strong></div>
              <div class="detail-box"><span>Total Orders</span><strong>${orderHistory.length}</strong></div>
              <div class="detail-box"><span>Total Spent</span><strong>${formatCurrency(spent)}</strong></div>
              <div class="detail-box"><span>Latest Order</span><strong>${orderHistory.at(-1)?.id || "None"}</strong></div>
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">No customers yet.</div>';
}

function calculatePayouts() {
  const commissionRate = Number(state.data.settings.commissionRate || 0) / 100;

  return state.data.vendors.map((vendor) => {
    const vendorOrders = state.data.orders.filter((order) => {
      const status = String(order.status || "").toLowerCase();
      return order.vendorId === vendor.id && ["paid", "delivered"].includes(status);
    });

    const gross = vendorOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const commission = gross * commissionRate;
    const net = gross - commission;

    return {
      vendorId: vendor.id,
      vendorName: vendor.storeName || vendor.name || "Vendor",
      gross,
      commission,
      net,
      payoutStatus: net > 0 ? "pending" : "paid"
    };
  });
}

function renderPayments() {
  const payouts = calculatePayouts();
  elements.commissionRateInput.value = state.data.settings.commissionRate;

  elements.payoutList.innerHTML = payouts.length
    ? payouts.map((payout) => `
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
      `).join("")
    : '<div class="empty-state">No payouts yet.</div>';
}

function renderAnalytics() {
  const overview = getOverview();
  const payouts = calculatePayouts();
  const topVendor = getTopVendors()[0];
  const topProduct = getTopProducts()[0];
  const avgOrderValue = overview.totalOrders ? overview.revenue / overview.totalOrders : 0;

  elements.reportSummary.innerHTML = [
    ["Revenue", formatCurrency(overview.revenue)],
    ["Average order value", formatCurrency(avgOrderValue)],
    ["Pending payouts", payouts.filter((item) => item.payoutStatus === "pending").length],
    ["Vendor approvals waiting", state.data.vendors.filter((vendor) => vendor.status === "pending").length]
  ].map(([label, value]) => `
    <div class="mini-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  elements.insightList.innerHTML = `
    <div class="mini-item"><span>Top vendor</span><strong>${topVendor ? (topVendor.storeName || topVendor.name) : "N/A"}</strong></div>
    <div class="mini-item"><span>Top product</span><strong>${topProduct ? topProduct.name : "N/A"}</strong></div>
    <div class="mini-item"><span>Dispute cases</span><strong>${state.data.orders.filter((order) => order.dispute || String(order.status || "").toLowerCase() === "dispute").length}</strong></div>
    <div class="mini-item"><span>Refund requests</span><strong>${state.data.orders.filter((order) => order.refundRequested).length}</strong></div>
  `;
}

function renderSettings() {
  const categories = state.data.settings.categories;
  const currentUser = state.data.auth.currentUser;
  const delivery = getNormalizedDeliverySettings();
  const zones = getUniqueZones(delivery);

  elements.categoryList.innerHTML = categories.map((category, index) => `
    <div class="mini-item">
      <span>${category}</span>
      <button class="btn-danger" data-category-remove="${index}">Remove</button>
    </div>
  `).join("");

  elements.sameLocationFeeInput.value = delivery.fees.sameLocation;
  elements.sameZoneFeeInput.value = delivery.fees.sameZone;
  elements.defaultCrossZoneFeeInput.value = delivery.fees.defaultCrossZone;

  elements.locationList.innerHTML = delivery.locations.length
    ? delivery.locations.map((location, index) => `
        <div class="mini-item">
          <span>${location.label} (${location.value}) - Zone: ${location.zone}</span>
          <button class="btn-danger" data-location-remove="${index}">Remove</button>
        </div>
      `).join("")
    : '<div class="empty-state">No delivery locations yet.</div>';

  const zoneOptions = ['<option value="">Select zone</option>']
    .concat(zones.map((zone) => `<option value="${zone}">${zone}</option>`))
    .join("");

  elements.routeZoneAInput.innerHTML = zoneOptions;
  elements.routeZoneBInput.innerHTML = zoneOptions;

  elements.routeFeeList.innerHTML = delivery.zoneRoutes.length
    ? delivery.zoneRoutes.map((route, index) => `
        <div class="mini-item">
          <span>${route.zoneA} to ${route.zoneB} - ${formatCurrency(route.fee)}</span>
          <button class="btn-danger" data-route-remove="${index}">Remove</button>
        </div>
      `).join("")
    : '<div class="empty-state">No special route fees yet.</div>';

  elements.adminName.textContent = currentUser.name || "Admin User";
  elements.adminRole.textContent = `Role: ${currentUser.role || "platform_admin"}`;
  elements.adminNameInput.value = currentUser.name || "";
  elements.adminEmailInput.value = currentUser.email || "";
  elements.adminRoleInput.value = currentUser.role || "platform_admin";
  elements.rbacStatus.textContent = `RBAC: ${currentUser.role || "platform_admin"}`;
}

function setSection(section) {
  state.section = section;
  elements.pageTitle.textContent = section.replace(/(^\w)|(-\w)/g, (match) =>
    match.replace("-", "").toUpperCase()
  );

  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  elements.sections.forEach((sectionEl) => {
    sectionEl.classList.toggle("active", sectionEl.id === `section-${section}`);
  });
}

function renderAll() {
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
  elements.newCategoryInput.value = "";
  saveSettingsLocal();
  renderAll();
}

async function saveDeliveryFees() {
  const delivery = getNormalizedDeliverySettings();

  state.data.settings.delivery = normalizeDeliveryConfig({
    ...delivery,
    fees: {
      sameLocation: Number(elements.sameLocationFeeInput.value || 0),
      sameZone: Number(elements.sameZoneFeeInput.value || 0),
      defaultCrossZone: Number(elements.defaultCrossZoneFeeInput.value || 0)
    }
  });

  saveSettingsLocal();

  await savePlatformSettings({
    delivery: state.data.settings.delivery
  });

  renderAll();
}

async function addDeliveryLocation() {
  const label = elements.newLocationLabelInput.value.trim();
  const customValue = elements.newLocationValueInput.value.trim();
  const zone = elements.newLocationZoneInput.value.trim().toLowerCase();
  const value = slugifyLocationValue(customValue || label);

  if (!label || !zone || !value) {
    showToast("Enter a location name and zone.", { type: "error" });
    return;
  }

  const delivery = getNormalizedDeliverySettings();
  const alreadyExists = delivery.locations.some((location) => location.value === value);

  if (alreadyExists) {
    showToast("That location already exists.", { type: "error" });
    return;
  }

  state.data.settings.delivery = normalizeDeliveryConfig({
    ...delivery,
    locations: delivery.locations.concat([{ label, value, zone }])
  });

  elements.newLocationLabelInput.value = "";
  elements.newLocationValueInput.value = "";
  elements.newLocationZoneInput.value = "";
  saveSettingsLocal();

  await savePlatformSettings({
    delivery: state.data.settings.delivery
  });

  renderAll();
}

async function addRouteFee() {
  const zoneA = elements.routeZoneAInput.value.trim().toLowerCase();
  const zoneB = elements.routeZoneBInput.value.trim().toLowerCase();
  const fee = Number(elements.routeFeeInput.value || 0);

  if (!zoneA || !zoneB) {
    showToast("Select both zones for the route.", { type: "error" });
    return;
  }

  if (zoneA === zoneB) {
    showToast("Use the same-zone fee for matching zones.", { type: "error" });
    return;
  }

  const delivery = getNormalizedDeliverySettings();
  const nextRoutes = delivery.zoneRoutes.filter((route) => {
    const sameDirection = route.zoneA === zoneA && route.zoneB === zoneB;
    const reverseDirection = route.zoneA === zoneB && route.zoneB === zoneA;
    return !(sameDirection || reverseDirection);
  });

  nextRoutes.push({ zoneA, zoneB, fee });

  state.data.settings.delivery = normalizeDeliveryConfig({
    ...delivery,
    zoneRoutes: nextRoutes
  });

  elements.routeFeeInput.value = "";
  saveSettingsLocal();

  await savePlatformSettings({
    delivery: state.data.settings.delivery
  });

  renderAll();
}

function subscribeVendors() {
  if (state.unsubscribeVendors) state.unsubscribeVendors();

  state.unsubscribeVendors = onSnapshot(
    collection(db, "vendors"),
    (snapshot) => {
      state.data.vendors = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderAll();
    },
    (error) => {
      console.error("Failed to load vendors:", error);
      showToast(`Failed to load vendors: ${error.message}`, { type: "error" });
    }
  );
}

function subscribeProducts() {
  if (state.unsubscribeProducts) state.unsubscribeProducts();

  state.unsubscribeProducts = onSnapshot(
    collection(db, "products"),
    (snapshot) => {
      state.data.products = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderAll();
    },
    (error) => {
      console.error("Failed to load products:", error);
      showToast(`Failed to load products: ${error.message}`, { type: "error" });
    }
  );
}

function subscribeOrders() {
  if (state.unsubscribeOrders) state.unsubscribeOrders();

  state.unsubscribeOrders = onSnapshot(
    collection(db, "orders"),
    (snapshot) => {
      state.data.orders = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      deriveCustomersFromOrders();
      renderAll();
    },
    (error) => {
      console.error("Failed to load orders:", error);
      showToast(`Failed to load orders: ${error.message}`, { type: "error" });
    }
  );
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  elements.chartRangeSelect.addEventListener("change", (event) => {
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
    input?.addEventListener("input", renderAll);
    input?.addEventListener("change", renderAll);
  });

  elements.saveCommissionBtn.addEventListener("click", async () => {
    const nextRate = Number(elements.commissionRateInput.value || 0);

    try {
      await savePlatformSettings({
        commissionRate: nextRate,
        categories: state.data.settings.categories
      });

      showToast("Commission updated platform-wide.", { type: "success" });
    } catch (error) {
      console.error("Failed to save commission:", error);
      showToast(`Failed to save commission: ${error.message}`, { type: "error" });
    }
  });

  elements.addCategoryBtn.addEventListener("click", addCategory);
  elements.saveDeliveryFeesBtn.addEventListener("click", async () => {
    try {
      await saveDeliveryFees();
      showToast("Delivery fees saved.", { type: "success" });
    } catch (error) {
      console.error("Failed to save delivery fees:", error);
      showToast(`Failed to save delivery fees: ${error.message}`, { type: "error" });
    }
  });
  elements.addLocationBtn.addEventListener("click", async () => {
    try {
      await addDeliveryLocation();
      showToast("Location added.", { type: "success" });
    } catch (error) {
      console.error("Failed to add location:", error);
      showToast(`Failed to add location: ${error.message}`, { type: "error" });
    }
  });
  elements.addRouteFeeBtn.addEventListener("click", async () => {
    try {
      await addRouteFee();
      showToast("Route fee saved.", { type: "success" });
    } catch (error) {
      console.error("Failed to save route fee:", error);
      showToast(`Failed to save route fee: ${error.message}`, { type: "error" });
    }
  });

  elements.newCategoryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCategory();
    }
  });

  elements.categoryList.addEventListener("click", async (event) => {
    const index = event.target.dataset.categoryRemove;
    if (index === undefined) return;

    state.data.settings.categories.splice(Number(index), 1);
    saveSettingsLocal();

    try {
      await savePlatformSettings({
        commissionRate: state.data.settings.commissionRate,
        categories: state.data.settings.categories
      });

      renderAll();
    } catch (error) {
      console.error("Failed to save categories:", error);
      showToast(`Failed to save categories: ${error.message}`, { type: "error" });
    }
  });

  elements.locationList.addEventListener("click", async (event) => {
    const index = event.target.dataset.locationRemove;
    if (index === undefined) return;

    const delivery = getNormalizedDeliverySettings();
    const nextLocations = delivery.locations.filter((_, itemIndex) => itemIndex !== Number(index));
    const allowedZones = new Set(nextLocations.map((location) => location.zone));
    const nextRoutes = delivery.zoneRoutes.filter((route) => {
      return allowedZones.has(route.zoneA) && allowedZones.has(route.zoneB);
    });

    state.data.settings.delivery = normalizeDeliveryConfig({
      ...delivery,
      locations: nextLocations,
      zoneRoutes: nextRoutes
    });

    saveSettingsLocal();

    try {
      await savePlatformSettings({
        delivery: state.data.settings.delivery
      });

      renderAll();
      showToast("Location removed.", { type: "success" });
    } catch (error) {
      console.error("Failed to remove location:", error);
      showToast(`Failed to remove location: ${error.message}`, { type: "error" });
    }
  });

  elements.routeFeeList.addEventListener("click", async (event) => {
    const index = event.target.dataset.routeRemove;
    if (index === undefined) return;

    const delivery = getNormalizedDeliverySettings();
    state.data.settings.delivery = normalizeDeliveryConfig({
      ...delivery,
      zoneRoutes: delivery.zoneRoutes.filter((_, itemIndex) => itemIndex !== Number(index))
    });

    saveSettingsLocal();

    try {
      await savePlatformSettings({
        delivery: state.data.settings.delivery
      });

      renderAll();
      showToast("Route fee removed.", { type: "success" });
    } catch (error) {
      console.error("Failed to remove route fee:", error);
      showToast(`Failed to remove route fee: ${error.message}`, { type: "error" });
    }
  });

  elements.saveAdminSettingsBtn.addEventListener("click", () => {
    state.data.auth.currentUser = {
      ...state.data.auth.currentUser,
      name: elements.adminNameInput.value.trim() || "Bills Mall Admin",
      email: elements.adminEmailInput.value.trim() || "",
      role: elements.adminRoleInput.value
    };

    state.data.settings.adminProfile = {
      ...state.data.auth.currentUser
    };

    saveSettingsLocal();
    renderAll();
    showToast("Admin settings saved.", { type: "success" });
  });

  elements.exportBtn.addEventListener("click", () => {
    const exportData = {
      vendors: state.data.vendors,
      products: state.data.products,
      orders: state.data.orders,
      customers: state.data.customers,
      settings: state.data.settings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bills-mall-admin-report.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  elements.seedDataBtn.addEventListener("click", () => {
    showToast("This dashboard now uses live Firebase data. Demo reset was removed.", {
      type: "info"
    });
  });

  elements.vendorList.addEventListener("click", async (event) => {
    const approveId = event.target.getAttribute("data-vendor-approve");
    const suspendId = event.target.getAttribute("data-vendor-suspend");

    if (approveId) {
      await updateVendorStatus(approveId, "approved");
    }

    if (suspendId) {
      await updateVendorStatus(suspendId, "suspended");
    }
  });

  elements.orderList.addEventListener("click", async (event) => {
    const orderId = event.target.getAttribute("data-order-update");
    const status = event.target.getAttribute("data-status");

    if (!orderId || !status) return;

    await updateOrderStatus(orderId, status);
  });
}

async function init() {
  bindEvents();

  try {
    const user = await requireAdmin();

    state.data.auth.currentUser = {
      uid: user.uid,
      name: user.displayName || state.data.settings.adminProfile.name || "Bills Mall Admin",
      email: user.email || state.data.settings.adminProfile.email || "",
      role: state.data.settings.adminProfile.role || "platform_admin"
    };

    await ensurePlatformSettingsDoc();

    renderAll();
    subscribePlatformSettings();
    subscribeVendors();
    subscribeProducts();
    subscribeOrders();
  } catch (error) {
    console.error("Admin init failed:", error);
  }
}

init();
