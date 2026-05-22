import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import { auth, db, storage } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";
import { showToast } from "./ui.js";
import {
  defaultDeliveryConfig,
  normalizeDeliveryConfig,
  slugifyLocationValue,
  getUniqueZones
} from "./delivery-config.js";
import {
  addMonthsToIsoDate,
  DEFAULT_ADMIN_COMMISSION_TIERS,
  DEFAULT_REFERRAL_SETTINGS,
  getAdminCommissionSummaryForOrder,
  getReferralSettingsFromDoc,
  isReferralProgramActive,
  normalizeCommissionTiers,
  updateCommissionStatus
} from "./referral-system.js";

const SETTINGS_KEY = "bills_mall_admin_settings_v1";
const PRODUCT_CATEGORY_FALLBACK = [
  "Fashion",
  "Electronics",
  "Beauty",
  "Home & Kitchen",
  "Health",
  "Shoes",
  "Bags",
  "Accessories",
  "Books",
  "Baby Products",
  "Groceries",
  "Sports",
  "Office Supplies",
  "Jewelry",
  "Other"
];

const BACKEND_BASE_URL = "https://backend-616b.onrender.com";

const defaultSettings = {
  commissionRate: 5,
  commissionTiers: DEFAULT_ADMIN_COMMISSION_TIERS,
  categoryCommissionRates: {},
  vendorCommissionRates: {},
  referrals: {
    customerRate: DEFAULT_REFERRAL_SETTINGS.customerReferralRate,
    vendorRate: DEFAULT_REFERRAL_SETTINGS.vendorReferralRate,
    minWithdrawal: DEFAULT_REFERRAL_SETTINGS.minWithdrawal,
    durationMonths: DEFAULT_REFERRAL_SETTINGS.durationMonths,
    startsAt: "",
    endsAt: ""
  },
  categories: ["Fashion", "Electronics", "Beauty", "Home", "Groceries"],
  delivery: defaultDeliveryConfig,
  adminProfile: {
    name: "Bills Campus Mall Admin",
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
    users: [],
    commissions: [],
    payouts: [],
    customers: [],
    orders: []
  },
  section: "dashboard",
  chartRange: "monthly",
  chart: null,
  unsubscribeVendors: null,
  unsubscribeProducts: null,
  unsubscribeOrders: null,
  unsubscribeUsers: null,
  unsubscribeCommissions: null,
  unsubscribePayouts: null,
  unsubscribePlatformSettings: null,
  productImages: [],
  isSavingProduct: false
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
  productForm: document.getElementById("product-form"),
  productNameInput: document.getElementById("name"),
  productPriceInput: document.getElementById("price"),
  productCategoryInput: document.getElementById("category"),
  productStockInput: document.getElementById("stock"),
  productAdminStatusInput: document.getElementById("status"),
  productFeaturedInput: document.getElementById("featured"),
  productImageInput: document.getElementById("images"),
  productImageFilesInput: document.getElementById("image-files"),
  productImagePreview: document.getElementById("admin-image-preview"),
  productDescriptionInput: document.getElementById("product-description"),
  productVariationsInput: document.getElementById("variations"),
  resetProductFormBtn: document.getElementById("reset-product-form"),
  orderList: document.getElementById("orderList"),
  customerList: document.getElementById("customerList"),
  payoutList: document.getElementById("payoutList"),
  commissionList: document.getElementById("commissionList"),
  affiliateBalanceList: document.getElementById("affiliateBalanceList"),
  reportSummary: document.getElementById("reportSummary"),
  insightList: document.getElementById("insightList"),
  topReferrersList: document.getElementById("topReferrersList"),
  referralFraudList: document.getElementById("referralFraudList"),
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
  categoryCommissionList: document.getElementById("categoryCommissionList"),
  addCategoryCommissionBtn: document.getElementById("addCategoryCommissionBtn"),
  vendorCommissionList: document.getElementById("vendorCommissionList"),
  addVendorCommissionBtn: document.getElementById("addVendorCommissionBtn"),
  customerReferralRateInput: document.getElementById("customerReferralRateInput"),
  vendorReferralRateInput: document.getElementById("vendorReferralRateInput"),
  minWithdrawalInput: document.getElementById("minWithdrawalInput"),
  referralProgramWindowNote: document.getElementById("referralProgramWindowNote"),
  saveCommissionBtn: document.getElementById("saveCommissionBtn"),
  commissionAnalyticsList: document.getElementById("commissionAnalyticsList"),
  vendorRevenueTrackingList: document.getElementById("vendorRevenueTrackingList"),
  commissionHistoryList: document.getElementById("commissionHistoryList"),
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

function isValidImagePath(value) {
  const path = String(value || "").trim();

  if (!path) return false;
  if (/^https?:\/\//i.test(path)) return true;

  return (
    path.startsWith("./") ||
    path.startsWith("../") ||
    path.startsWith("/") ||
    path.startsWith("images/") ||
    path.startsWith("./images/")
  );
}

function normalizeImageList(values = []) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => isValidImagePath(value));
}

function sanitizeFileName(fileName = "") {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
      commissionTiers: normalizeCommissionTiers(
        parsed?.commissionTiers,
        parsed?.commissionRate ?? defaultSettings.commissionRate
      ),
      categoryCommissionRates: parsed?.categoryCommissionRates && typeof parsed.categoryCommissionRates === "object"
        ? parsed.categoryCommissionRates
        : {},
      vendorCommissionRates: parsed?.vendorCommissionRates && typeof parsed.vendorCommissionRates === "object"
        ? parsed.vendorCommissionRates
        : {},
      // Ensure categories is always an array
      categories: Array.isArray(parsed?.categories) && parsed.categories.length > 0
        ? parsed.categories
        : defaultSettings.categories,
      referrals: {
        ...defaultSettings.referrals,
        ...(parsed?.referrals || {})
      },
      delivery: normalizeDeliveryConfig(parsed.delivery || defaultSettings.delivery)
    };
  } catch (error) {
    console.error("Failed to parse admin settings:", error);
    return {
      ...structuredClone(defaultSettings),
      commissionTiers: normalizeCommissionTiers(
        defaultSettings.commissionTiers,
        defaultSettings.commissionRate
      ),
      delivery: normalizeDeliveryConfig(defaultSettings.delivery)
    };
  }
}

function saveSettingsLocal() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.data.settings));
}

function getCommissionTiers() {
  return normalizeCommissionTiers(
    state.data.settings.commissionTiers,
    state.data.settings.commissionRate
  );
}

function getCommissionTierSummary() {
  return getCommissionTiers()
    .map((tier) => {
      const upper = tier.max === null ? "and above" : `to ${formatCurrency(tier.max)}`;
      return `${formatCurrency(tier.min)} ${upper}: ${tier.rate}%`;
    })
    .join(" | ");
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeCategoryKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCommissionMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((accumulator, [key, rate]) => {
    const normalizedKey = String(key || "").trim();
    const normalizedRate = Number(rate);

    if (!normalizedKey || Number.isNaN(normalizedRate)) {
      return accumulator;
    }

    accumulator[normalizedKey] = normalizedRate;
    return accumulator;
  }, {});
}

function getCategoryCommissionRates() {
  return normalizeCommissionMap(state.data.settings.categoryCommissionRates);
}

function getVendorCommissionRates() {
  return normalizeCommissionMap(state.data.settings.vendorCommissionRates);
}

function getStoredOrderEarnings(order = {}) {
  return order.earnings && typeof order.earnings === "object"
    ? order.earnings
    : null;
}

function getOrderCommissionSummary(order = {}) {
  const earnings = getStoredOrderEarnings(order);

  if (earnings) {
    const grossSales = roundCurrency(
      earnings.grossSales ?? order.totalAmount ?? order.total ?? 0
    );
    const platformEarnings = roundCurrency(
      earnings.platformGrossCommission
      ?? earnings.platformEarnings
      ?? order.adminCommissionAmount
      ?? 0
    );
    const vendorEarnings = roundCurrency(
      earnings.vendorEarnings
      ?? earnings.netPayoutAmount
      ?? grossSales - platformEarnings
    );

    return {
      grossSales,
      platformEarnings,
      vendorEarnings,
      commissionRate: grossSales > 0 ? roundCurrency((platformEarnings / grossSales) * 100) : 0,
      payoutStatus: String(
        earnings.payoutStatus
        || order.payoutStatus
        || (String(order.status || "").toLowerCase() === "delivered" ? "pending" : "not_ready")
      ).toLowerCase()
    };
  }

  const fallbackRate = Number(state.data.settings.commissionRate || 0);
  const platformEarnings = roundCurrency(
    getAdminCommissionSummaryForOrder(order, getCommissionTiers(), fallbackRate).amount
  );
  const grossSales = roundCurrency(order.totalAmount ?? order.total ?? 0);

  return {
    grossSales,
    platformEarnings,
    vendorEarnings: roundCurrency(grossSales - platformEarnings),
    commissionRate: grossSales > 0 ? roundCurrency((platformEarnings / grossSales) * 100) : fallbackRate,
    payoutStatus: String(order.payoutStatus || "not_ready").toLowerCase()
  };
}

function getVendorPendingPayouts() {
  const payoutTotals = state.data.payouts.reduce((accumulator, payout) => {
    if (String(payout.status || "").toLowerCase() !== "completed") {
      return accumulator;
    }

    accumulator[payout.vendorId] = roundCurrency(
      Number(accumulator[payout.vendorId] || 0) + Number(payout.amount || 0)
    );
    return accumulator;
  }, {});

  return state.data.vendors.map((vendor) => {
    const vendorOrders = state.data.orders.filter((order) => order.vendorId === vendor.id);
    const deliveredOrders = vendorOrders.filter((order) =>
      String(order.status || "").toLowerCase() === "delivered"
      && String(order.payoutStatus || getOrderCommissionSummary(order).payoutStatus).toLowerCase() !== "completed"
    );

    const pendingAmount = roundCurrency(
      deliveredOrders.reduce((sum, order) => sum + getOrderCommissionSummary(order).vendorEarnings, 0)
    );
    const completedAmount = roundCurrency(Number(payoutTotals[vendor.id] || 0));

    return {
      vendorId: vendor.id,
      vendorName: vendor.storeName || vendor.name || "Vendor",
      pendingAmount,
      completedAmount,
      orderIds: deliveredOrders.map((order) => order.id)
    };
  }).filter((entry) => entry.pendingAmount > 0 || entry.completedAmount > 0);
}

async function updateOrderStatusViaBackend(orderId, status) {
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    throw new Error("Admin authentication expired. Please refresh and try again.");
  }

  const response = await fetch(`${BACKEND_BASE_URL}/orders/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      orderId,
      status
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to update order status.");
  }

  return data;
}

async function markVendorPayoutCompleted(vendorId) {
  const summary = getVendorPendingPayouts().find((entry) => entry.vendorId === vendorId);

  if (!summary || summary.pendingAmount <= 0 || !summary.orderIds.length) {
    throw new Error("There is no pending payout for this vendor.");
  }

  const payoutRef = await addDoc(collection(db, "vendor_payouts"), {
    vendorId,
    vendorName: summary.vendorName,
    amount: summary.pendingAmount,
    orderIds: summary.orderIds,
    status: "Completed",
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString()
  });

  await Promise.all(summary.orderIds.map((orderId) =>
    updateDoc(doc(db, "orders", orderId), {
      payoutId: payoutRef.id,
      payoutStatus: "completed",
      "earnings.payoutStatus": "completed",
      updatedAt: new Date().toISOString()
    })
  ));
}

function formatProgramDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
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
  const defaultStartsAt = new Date().toISOString();
  const defaultEndsAt = addMonthsToIsoDate(
    defaultStartsAt,
    DEFAULT_REFERRAL_SETTINGS.durationMonths
  );

  if (!snap.exists()) {
    await setDoc(settingsRef, {
      commissionRate: defaultSettings.commissionRate,
      commissionTiers: defaultSettings.commissionTiers,
      categoryCommissionRates: defaultSettings.categoryCommissionRates,
      vendorCommissionRates: defaultSettings.vendorCommissionRates,
      referrals: {
        ...defaultSettings.referrals,
        startsAt: defaultStartsAt,
        endsAt: defaultEndsAt
      },
      categories: defaultSettings.categories,
      delivery: defaultDeliveryConfig,
      adminProfile: defaultSettings.adminProfile
    });
    return;
  }

  const existingData = snap.data() || {};
  const existingReferralSettings = getReferralSettingsFromDoc(existingData);
  const shouldUpdateCustomerRate =
    existingReferralSettings.customerReferralRate === 2
    || typeof existingData.referrals?.customerRate === "undefined";
  const shouldUpdateVendorRate =
    typeof existingData.referrals?.vendorRate === "undefined";
  const referralPatch = {};
  const platformPatch = {};

  if (!existingReferralSettings.startsAt || !existingReferralSettings.endsAt) {
    const startsAt = existingReferralSettings.startsAt || defaultStartsAt;
    referralPatch.durationMonths =
      existingReferralSettings.durationMonths || DEFAULT_REFERRAL_SETTINGS.durationMonths;
    referralPatch.startsAt = startsAt;
    referralPatch.endsAt =
      existingReferralSettings.endsAt
      || addMonthsToIsoDate(
        startsAt,
        existingReferralSettings.durationMonths || DEFAULT_REFERRAL_SETTINGS.durationMonths
      );
  }

  if (shouldUpdateCustomerRate) {
    referralPatch.customerRate = DEFAULT_REFERRAL_SETTINGS.customerReferralRate;
  }

  if (shouldUpdateVendorRate) {
    referralPatch.vendorRate = DEFAULT_REFERRAL_SETTINGS.vendorReferralRate;
  }

  if (!Array.isArray(existingData.commissionTiers) || !existingData.commissionTiers.length) {
    platformPatch.commissionTiers = normalizeCommissionTiers(
      defaultSettings.commissionTiers,
      existingData.commissionRate ?? defaultSettings.commissionRate
    );
  }

  if (!existingData.categoryCommissionRates || typeof existingData.categoryCommissionRates !== "object") {
    platformPatch.categoryCommissionRates = {};
  }

  if (!existingData.vendorCommissionRates || typeof existingData.vendorCommissionRates !== "object") {
    platformPatch.vendorCommissionRates = {};
  }

  if (!existingData.adminProfile?.email) {
    platformPatch.adminProfile = {
      ...(existingData.adminProfile || {}),
      ...defaultSettings.adminProfile
    };
  }

  if (Object.keys(referralPatch).length) {
    platformPatch.referrals = {
      ...(existingData.referrals || {}),
      ...referralPatch
    };
  }

  if (Object.keys(platformPatch).length) {
    await setDoc(settingsRef, {
      ...platformPatch
    }, { merge: true });
  }
}

function subscribePlatformSettings() {
  if (state.unsubscribePlatformSettings) state.unsubscribePlatformSettings();

  state.unsubscribePlatformSettings = onSnapshot(
    doc(db, "platform_settings", "main"),
    (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const referralSettings = getReferralSettingsFromDoc(data);
      state.data.settings = {
        ...state.data.settings,
        commissionRate: referralSettings.adminCommissionRate,
        commissionTiers: referralSettings.adminCommissionTiers,
        categoryCommissionRates:
          data.categoryCommissionRates && typeof data.categoryCommissionRates === "object"
            ? data.categoryCommissionRates
            : {},
        vendorCommissionRates:
          data.vendorCommissionRates && typeof data.vendorCommissionRates === "object"
            ? data.vendorCommissionRates
            : {},
        referrals: {
          customerRate: referralSettings.customerReferralRate,
          vendorRate: referralSettings.vendorReferralRate,
          minWithdrawal: referralSettings.minWithdrawal,
          durationMonths: referralSettings.durationMonths,
          startsAt: referralSettings.startsAt,
          endsAt: referralSettings.endsAt
        },
        categories: Array.isArray(data.categories) ? data.categories : state.data.settings.categories,
        delivery: normalizeDeliveryConfig(data.delivery || state.data.settings.delivery),
        adminProfile: {
          ...state.data.settings.adminProfile,
          ...(data.adminProfile || {})
        }
      };

      saveSettingsLocal();
      // Update the category dropdown when settings are loaded from Firebase
      populateProductCategoryDropdown();
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

function getUserName(userId) {
  if (!userId) return "Unknown User";

  const user = state.data.users.find((item) => item.id === userId);
  return user?.name || user?.email || userId;
}

function getUserProfile(userId) {
  if (!userId) return null;
  return state.data.users.find((item) => item.id === userId) || null;
}

function getReferralStats() {
  const totals = new Map();

  state.data.commissions.forEach((commission) => {
    const key = commission.referrerId || "unknown";
    const entry = totals.get(key) || {
      referrerId: key,
      name: getUserName(key),
      total: 0,
      pending: 0,
      approved: 0,
      paid: 0,
      customerCount: 0,
      vendorCount: 0
    };

    entry.total += Number(commission.amount || 0);

    if (commission.type === "customer") {
      entry.customerCount += 1;
    }

    if (commission.type === "vendor") {
      entry.vendorCount += 1;
    }

    const status = String(commission.status || "pending").toLowerCase();
    if (status === "paid") entry.paid += Number(commission.amount || 0);
    else if (status === "approved") entry.approved += Number(commission.amount || 0);
    else if (status !== "rejected") entry.pending += Number(commission.amount || 0);

    totals.set(key, entry);
  });

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      total: Number(entry.total || 0),
      pending: Number(entry.pending || 0),
      approved: Number(entry.approved || 0),
      paid: Number(entry.paid || 0)
    }))
    .sort((a, b) => b.total - a.total);
}

function renderAffiliateBalances() {
  if (!elements.affiliateBalanceList) return;

  const minWithdrawal = Number(state.data.settings.referrals?.minWithdrawal || 0);
  const referralStats = getReferralStats();

  elements.affiliateBalanceList.innerHTML = referralStats.length
    ? referralStats.map((entry) => {
      const readyForPayout = Number(entry.approved || 0) >= minWithdrawal;
      const profile = getUserProfile(entry.referrerId);
      const role = String(profile?.role || "customer").toLowerCase();
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
      const email = profile?.email || "No email";

      return `
        <article class="table-card">
          <div class="table-top">
            <div>
              <strong>${entry.name}</strong>
              <div class="eyebrow">${email}</div>
            </div>
            <span class="badge ${readyForPayout ? "status-approved" : "status-pending"}">
              ${readyForPayout ? "Ready for payout" : "Below withdrawal minimum"}
            </span>
          </div>
          <div class="table-details">
            <div class="detail-box"><span>Affiliate Type</span><strong>${roleLabel}</strong></div>
            <div class="detail-box"><span>Total Accumulated</span><strong>${formatCurrency(entry.total)}</strong></div>
            <div class="detail-box"><span>Pending</span><strong>${formatCurrency(entry.pending)}</strong></div>
            <div class="detail-box"><span>Approved</span><strong>${formatCurrency(entry.approved)}</strong></div>
            <div class="detail-box"><span>Withdrawn</span><strong>${formatCurrency(entry.paid)}</strong></div>
            <div class="detail-box"><span>Customers Referred</span><strong>${entry.customerCount}</strong></div>
            <div class="detail-box"><span>Vendors Referred</span><strong>${entry.vendorCount}</strong></div>
          </div>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">No affiliate balances yet.</div>';
}

function getSuspiciousReferralEntries() {
  const flaggedUsers = state.data.users
    .filter((user) => Array.isArray(user.flags) && user.flags.length)
    .map((user) => ({
      kind: "user",
      id: user.id,
      label: user.name || user.email || user.id,
      flags: user.flags
    }));

  const flaggedVendors = state.data.vendors
    .filter((vendor) => Array.isArray(vendor.flags) && vendor.flags.length)
    .map((vendor) => ({
      kind: "vendor",
      id: vendor.id,
      label: vendor.storeName || vendor.contactEmail || vendor.id,
      flags: vendor.flags
    }));

  return [...flaggedUsers, ...flaggedVendors];
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

  const parent = canvas.parentElement;
  const oldEmpty = parent.querySelector(".chart-empty-state");
  const oldChart = parent.querySelector(".admin-sales-chart");
  if (oldEmpty) oldEmpty.remove();
  if (oldChart) oldChart.remove();

  if (!labels.length) {
    canvas.style.display = "none";
    const empty = document.createElement("div");
    empty.className = "empty-state chart-empty-state";
    empty.textContent = "No sales data yet. Analytics will appear once orders start coming in.";
    parent.appendChild(empty);
    return;
  }

  canvas.style.display = "none";

  const chartWrap = document.createElement("div");
  chartWrap.className = "admin-sales-chart";

  const maxValue = Math.max(...values, 1);
  const width = 720;
  const height = 320;
  const paddingX = 48;
  const paddingTop = 24;
  const paddingBottom = 56;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;

  const points = values.map((value, index) => {
    const x = labels.length === 1
      ? width / 2
      : paddingX + (index * chartWidth) / (labels.length - 1);
    const y = paddingTop + chartHeight - (Number(value || 0) / maxValue) * chartHeight;
    return { x, y, value, label: labels[index] };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${paddingX},${height - paddingBottom} ${linePoints} ${width - paddingX},${height - paddingBottom}`;
  const yAxisTicks = 4;

  chartWrap.innerHTML = `
    <div class="admin-sales-chart-head">
      <strong>Revenue (${state.chartRange})</strong>
      <span>Max ${formatCurrency(maxValue)}</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="admin-sales-chart-svg" role="img" aria-label="Sales revenue chart">
      ${Array.from({ length: yAxisTicks + 1 }, (_, index) => {
        const value = maxValue - (maxValue / yAxisTicks) * index;
        const y = paddingTop + (chartHeight / yAxisTicks) * index;
        return `
          <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="admin-sales-grid-line"></line>
          <text x="${paddingX - 12}" y="${y + 4}" text-anchor="end" class="admin-sales-axis-label">${formatCurrency(value)}</text>
        `;
      }).join("")}
      <path d="M ${areaPoints}" class="admin-sales-area"></path>
      <polyline points="${linePoints}" class="admin-sales-line"></polyline>
      ${points.map((point) => `
        <circle cx="${point.x}" cy="${point.y}" r="4.5" class="admin-sales-point"></circle>
        <text x="${point.x}" y="${height - 24}" text-anchor="middle" class="admin-sales-axis-label">${point.label}</text>
      `).join("")}
    </svg>
    <div class="admin-sales-chart-legend">
      ${points.map((point) => `
        <div class="admin-sales-chart-legend-item">
          <span>${point.label}</span>
          <strong>${formatCurrency(point.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;

  parent.appendChild(chartWrap);
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

function populateProductCategoryDropdown() {
  // Merge fallback and settings categories, remove duplicates and falsy values
  let adminCategories = [];
  if (Array.isArray(state.data.settings.categories)) {
    adminCategories = [...PRODUCT_CATEGORY_FALLBACK, ...state.data.settings.categories];
  } else {
    adminCategories = PRODUCT_CATEGORY_FALLBACK;
  }
  adminCategories = Array.from(new Set(adminCategories.filter(Boolean)));

  if (elements.productCategoryInput) {
    const currentValue = elements.productCategoryInput.value;
    elements.productCategoryInput.innerHTML = ['<option value="">Select category</option>']
      .concat(adminCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`))
      .join("");

    if (currentValue && adminCategories.includes(currentValue)) {
      elements.productCategoryInput.value = currentValue;
    }
  }
}

function renderVendorFilters() {
  const categories = [...new Set(state.data.products.map((item) => item.category).filter(Boolean))];
  const adminCategories = state.data.settings.categories?.length
    ? state.data.settings.categories
    : PRODUCT_CATEGORY_FALLBACK;

  elements.productVendorFilter.innerHTML = ['<option value="all">All vendors</option>']
    .concat(
      state.data.vendors.map(
        (vendor) => `<option value="${vendor.id}">${vendor.storeName || vendor.name || vendor.id}</option>`
      )
    )
    .join("");

  elements.productCategoryFilter.innerHTML = ['<option value="all">All categories</option>']
    .concat(categories.map((category) => `<option value="${category}">${escapeHtml(category)}</option>`))
    .join("");

  if (elements.productCategoryInput) {
    const currentValue = elements.productCategoryInput.value;
    elements.productCategoryInput.innerHTML = ['<option value="">Select category</option>']
      .concat(adminCategories.map((category) => `<option value="${category}">${category}</option>`))
      .join("");

    if (currentValue && adminCategories.includes(currentValue)) {
      elements.productCategoryInput.value = currentValue;
    }
  }
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
    await updateOrderStatusViaBackend(orderId, status);
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
          ${
            product.description
              ? `<p class="admin-product-description">${escapeHtml(product.description)}</p>`
              : ""
          }
          ${
            Array.isArray(product.variations) && product.variations.length
              ? `<div class="admin-product-tags">
                  ${product.variations.map((variation) => `<span>${escapeHtml(variation)}</span>`).join("")}
                </div>`
              : ""
          }
          <div class="table-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-danger" data-delete-product="${product.id}">Delete</button>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">No products found.</div>';
}

function updateProductImagePreview(images) {
  if (!elements.productImagePreview) return;

  if (!images.length) {
    elements.productImagePreview.innerHTML = "";
    elements.productImagePreview.classList.remove("has-images");
    return;
  }

  // Resolve relative image paths to absolute URLs
  function resolveImagePath(src) {
    src = src.trim();
    // If it's already an absolute URL, return as-is
    if (/^https?:\/\//i.test(src)) {
      return src;
    }
    // Resolve relative paths (./images/..., images/..., ../...)
    const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    if (src.startsWith("./")) {
      return base + src.substring(2);
    }
    if (src.startsWith("../")) {
      // Handle ../ by going up directories
      let result = src;
      while (result.startsWith("../")) {
        result = result.substring(3);
        base = base.substring(0, base.slice(0, -1).lastIndexOf('/') + 1);
      }
      return base + result;
    }
    if (src.startsWith("images/")) {
      return base + src;
    }
    // Default: treat as relative path
    return base + src;
  }

  elements.productImagePreview.innerHTML = images
    .map((src, index) => `<img src="${resolveImagePath(src)}" alt="Preview ${index + 1}" onerror="this.style.display='none'">`)
    .join("");
  elements.productImagePreview.classList.add("has-images");
}

function resetProductForm() {
  elements.productForm?.reset();
  state.productImages = [];
  updateProductImagePreview([]);

  if (elements.productCategoryInput) {
    elements.productCategoryInput.value = "";
  }

  if (elements.productAdminStatusInput) {
    elements.productAdminStatusInput.value = "Active";
  }
}

function setProductFormEnabled(enabled) {
  const fields = elements.productForm?.querySelectorAll("input, select, textarea, button");
  fields?.forEach((field) => {
    field.disabled = !enabled;
  });
}

function getProductFormData() {
  const typedImages = normalizeImageList(
    (elements.productImageInput?.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const uploadedImages = Array.from(new Set(state.productImages.filter((value) => /^https?:\/\//i.test(value))));
  const images = [...typedImages, ...uploadedImages].filter(Boolean);
  const variationsInput = elements.productVariationsInput?.value.trim() || "";

  return {
    name: elements.productNameInput?.value.trim() || "",
    price: Number(elements.productPriceInput?.value || 0),
    category: elements.productCategoryInput?.value || "",
    stock: Number(elements.productStockInput?.value || 0),
    status: elements.productAdminStatusInput?.value || "Active",
    featured: !!elements.productFeaturedInput?.checked,
    images,
    description: elements.productDescriptionInput?.value.trim() || "",
    variations: variationsInput
      ? variationsInput.split(",").map((item) => item.trim()).filter(Boolean)
      : []
  };
}

function validateProductFormData(data) {
  if (!data.name) return "Product name is required.";
  if (Number.isNaN(data.price) || data.price <= 0) return "Enter a valid product price.";
  if (!data.category) return "Please select a category.";
  if (Number.isNaN(data.stock) || data.stock < 0) return "Stock must be 0 or more.";
  if (!data.description) return "Product description is required.";
  if (!data.images.length) return "Add at least one product image.";
  return "";
}

async function uploadAdminImageFile(file) {
  const adminId = auth.currentUser?.uid;
  if (!adminId) {
    throw new Error("You must be logged in as admin to upload images.");
  }

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const storageRef = ref(storage, `products/${adminId}/${safeName}`);

  await uploadBytes(storageRef, file, {
    contentType: file.type
  });

  return getDownloadURL(storageRef);
}

async function addProductFromAdmin() {
  if (state.isSavingProduct) return;

  state.isSavingProduct = true;
  const submitButton = elements.productForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const formData = getProductFormData();
    const validationMessage = validateProductFormData(formData);

    if (validationMessage) {
      showToast(validationMessage, { type: "error" });
      return;
    }

    await addDoc(collection(db, "products"), {
      name: formData.name,
      price: formData.price,
      category: formData.category,
      stock: formData.stock,
      status: formData.status,
      featured: formData.featured,
      image: formData.images[0],
      images: formData.images,
      description: formData.description,
      variations: formData.variations,
      vendorId: auth.currentUser?.uid || "admin",
      createdAt: new Date().toISOString(),
      sold: 0,
      views: 0
    });

    showToast("Product added successfully.", { type: "success" });
    resetProductForm();
  } catch (error) {
    console.error("Failed to add product:", error);
    showToast(`Failed to add product: ${error.message}`, { type: "error" });
  } finally {
    state.isSavingProduct = false;
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteProductFromAdmin(productId) {
  if (!productId) return;
  if (!confirm("Delete this product?")) return;

  try {
    await deleteDoc(doc(db, "products", productId));
    showToast("Product deleted.", { type: "success" });
  } catch (error) {
    console.error("Failed to delete product:", error);
    showToast(`Failed to delete product: ${error.message}`, { type: "error" });
  }
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

function renderCategoryCommissionInputs() {
  if (!elements.categoryCommissionList) return;

  const entries = Object.entries(getCategoryCommissionRates());

  elements.categoryCommissionList.innerHTML = entries.length
    ? entries.map(([categoryKey, rate], index) => `
        <div class="commission-tier-row">
          <label>
            Category
            <select data-category-commission-key="${index}">
              ${state.data.settings.categories.map((category) => {
                const selected = normalizeCategoryKey(category) === categoryKey ? "selected" : "";
                return `<option value="${escapeHtml(normalizeCategoryKey(category))}" ${selected}>${escapeHtml(category)}</option>`;
              }).join("")}
            </select>
          </label>
          <label>
            Rate (%)
            <input type="number" min="0" max="100" step="0.1" data-category-commission-rate="${index}" value="${rate}" />
          </label>
          <button type="button" class="btn-danger" data-category-commission-remove="${index}">Remove</button>
        </div>
      `).join("")
    : '<div class="empty-state">No category commission overrides yet.</div>';
}

function renderVendorCommissionInputs() {
  if (!elements.vendorCommissionList) return;

  const entries = Object.entries(getVendorCommissionRates());

  elements.vendorCommissionList.innerHTML = entries.length
    ? entries.map(([vendorId, rate], index) => `
        <div class="commission-tier-row">
          <label>
            Vendor
            <select data-vendor-commission-key="${index}">
              ${state.data.vendors.map((vendor) => {
                const selected = vendor.id === vendorId ? "selected" : "";
                return `<option value="${vendor.id}" ${selected}>${escapeHtml(vendor.storeName || vendor.name || vendor.id)}</option>`;
              }).join("")}
            </select>
          </label>
          <label>
            Rate (%)
            <input type="number" min="0" max="100" step="0.1" data-vendor-commission-rate="${index}" value="${rate}" />
          </label>
          <button type="button" class="btn-danger" data-vendor-commission-remove="${index}">Remove</button>
        </div>
      `).join("")
    : '<div class="empty-state">No vendor commission overrides yet.</div>';
}

function readCategoryCommissionRatesFromInputs() {
  if (!elements.categoryCommissionList) {
    return getCategoryCommissionRates();
  }

  const rows = [...elements.categoryCommissionList.querySelectorAll(".commission-tier-row")];
  return rows.reduce((accumulator, row) => {
    const key = row.querySelector("[data-category-commission-key]")?.value || "";
    const rate = Number(row.querySelector("[data-category-commission-rate]")?.value || 0);

    if (!key || Number.isNaN(rate)) {
      return accumulator;
    }

    accumulator[key] = rate;
    return accumulator;
  }, {});
}

function readVendorCommissionRatesFromInputs() {
  if (!elements.vendorCommissionList) {
    return getVendorCommissionRates();
  }

  const rows = [...elements.vendorCommissionList.querySelectorAll(".commission-tier-row")];
  return rows.reduce((accumulator, row) => {
    const key = row.querySelector("[data-vendor-commission-key]")?.value || "";
    const rate = Number(row.querySelector("[data-vendor-commission-rate]")?.value || 0);

    if (!key || Number.isNaN(rate)) {
      return accumulator;
    }

    accumulator[key] = rate;
    return accumulator;
  }, {});
}

function renderCommissionList() {
  const minWithdrawal = Number(state.data.settings.referrals?.minWithdrawal || 0);
  const aggregates = new Map(
    getReferralStats().map((entry) => [entry.referrerId, entry])
  );

  elements.commissionList.innerHTML = state.data.commissions.length
    ? state.data.commissions
      .slice()
      .sort((a, b) => {
        const aDate = a.createdAt?.seconds
          ? new Date(a.createdAt.seconds * 1000)
          : a.createdAt
            ? new Date(a.createdAt)
            : null;
        const bDate = b.createdAt?.seconds
          ? new Date(b.createdAt.seconds * 1000)
          : b.createdAt
            ? new Date(b.createdAt)
            : null;
        const aTime = aDate && !Number.isNaN(aDate.getTime()) ? aDate.getTime() : 0;
        const bTime = bDate && !Number.isNaN(bDate.getTime()) ? bDate.getTime() : 0;
        return bTime - aTime;
      })
      .map((commission) => {
        const aggregate = aggregates.get(commission.referrerId);
        const eligible = Number(aggregate?.approved || 0) >= minWithdrawal;
        const status = String(commission.status || "pending").toLowerCase();

        return `
          <article class="table-card">
            <div class="table-top">
              <div>
                <strong>${getUserName(commission.referrerId)}</strong>
                <div class="eyebrow">${commission.type} referral • Order ${commission.orderId}</div>
              </div>
              <span class="badge ${statusClass(status)}">${status}</span>
            </div>
            <div class="table-details">
              <div class="detail-box"><span>Amount</span><strong>${formatCurrency(commission.amount)}</strong></div>
              <div class="detail-box"><span>Rate</span><strong>${commission.percentage}%</strong></div>
              <div class="detail-box"><span>Eligible</span><strong>${eligible ? "Yes" : "No"}</strong></div>
              <div class="detail-box"><span>Approved Pool</span><strong>${formatCurrency(aggregate?.approved || 0)}</strong></div>
            </div>
            <div class="table-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" data-commission-update="${commission.id}" data-status="approved">Approve</button>
              <button class="btn-outline" data-commission-update="${commission.id}" data-status="pending">Hold</button>
              <button class="btn-outline" data-commission-update="${commission.id}" data-status="paid" ${!eligible ? "disabled" : ""}>Mark Paid</button>
              <button class="btn-danger" data-commission-update="${commission.id}" data-status="rejected">Reject</button>
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">No referral commissions yet.</div>';
}

function renderPayments() {
  elements.commissionRateInput.value = state.data.settings.commissionRate;
  renderCategoryCommissionInputs();
  renderVendorCommissionInputs();
  elements.customerReferralRateInput.value = state.data.settings.referrals?.customerRate ?? DEFAULT_REFERRAL_SETTINGS.customerReferralRate;
  elements.vendorReferralRateInput.value = state.data.settings.referrals?.vendorRate ?? DEFAULT_REFERRAL_SETTINGS.vendorReferralRate;
  elements.minWithdrawalInput.value = state.data.settings.referrals?.minWithdrawal ?? DEFAULT_REFERRAL_SETTINGS.minWithdrawal;
  const payoutSummaries = getVendorPendingPayouts();
  const orderSummaries = state.data.orders.map((order) => ({
    order,
    summary: getOrderCommissionSummary(order)
  }));
  const totalGrossSales = roundCurrency(orderSummaries.reduce((sum, entry) => sum + entry.summary.grossSales, 0));
  const totalCommissionEarned = roundCurrency(orderSummaries.reduce((sum, entry) => sum + entry.summary.platformEarnings, 0));
  const totalVendorRevenue = roundCurrency(orderSummaries.reduce((sum, entry) => sum + entry.summary.vendorEarnings, 0));

  if (elements.referralProgramWindowNote) {
    const startsAt = state.data.settings.referrals?.startsAt || "";
    const endsAt = state.data.settings.referrals?.endsAt || "";
    const active = isReferralProgramActive(state.data.settings.referrals || {});

    if (startsAt && endsAt) {
      elements.referralProgramWindowNote.textContent =
        `Program window: ${formatProgramDate(startsAt)} to ${formatProgramDate(endsAt)} (${active ? "active" : "ended"}).`;
    } else {
      elements.referralProgramWindowNote.textContent = "Runs for 2 months from activation.";
    }
  }

  elements.payoutList.innerHTML = payoutSummaries.length
    ? payoutSummaries.map((payout) => `
        <article class="table-card">
          <div class="table-top">
            <div>
              <strong>${payout.vendorName}</strong>
              <div class="eyebrow">Vendor payout readiness</div>
            </div>
            <span class="badge ${statusClass(payout.pendingAmount > 0 ? "pending" : "completed")}">${payout.pendingAmount > 0 ? "pending" : "completed"}</span>
          </div>
          <div class="table-details">
            <div class="detail-box"><span>Pending Payout</span><strong>${formatCurrency(payout.pendingAmount)}</strong></div>
            <div class="detail-box"><span>Completed Payouts</span><strong>${formatCurrency(payout.completedAmount)}</strong></div>
            <div class="detail-box"><span>Orders Ready</span><strong>${payout.orderIds.length}</strong></div>
            <div class="detail-box"><span>Vendor ID</span><strong>${payout.vendorId}</strong></div>
          </div>
          <div class="table-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" data-payout-complete="${payout.vendorId}" ${payout.pendingAmount <= 0 ? "disabled" : ""}>Mark Payout Completed</button>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">No payouts yet.</div>';

  if (elements.commissionAnalyticsList) {
    elements.commissionAnalyticsList.innerHTML = `
      <article class="table-card">
        <div class="table-top">
          <div>
            <strong>Total commission earned</strong>
            <div class="eyebrow">Trusted from backend-created order earnings records</div>
          </div>
        </div>
        <div class="table-details">
          <div class="detail-box"><span>Gross Sales</span><strong>${formatCurrency(totalGrossSales)}</strong></div>
          <div class="detail-box"><span>Platform Earnings</span><strong>${formatCurrency(totalCommissionEarned)}</strong></div>
          <div class="detail-box"><span>Vendor Revenue</span><strong>${formatCurrency(totalVendorRevenue)}</strong></div>
          <div class="detail-box"><span>Orders</span><strong>${state.data.orders.length}</strong></div>
        </div>
      </article>
    `;
  }

  if (elements.vendorRevenueTrackingList) {
    const vendorRows = state.data.vendors
      .map((vendor) => {
        const vendorOrders = state.data.orders.filter((order) => order.vendorId === vendor.id);

        return {
          vendor,
          grossSales: roundCurrency(vendorOrders.reduce((sum, order) => sum + getOrderCommissionSummary(order).grossSales, 0)),
          commission: roundCurrency(vendorOrders.reduce((sum, order) => sum + getOrderCommissionSummary(order).platformEarnings, 0)),
          earnings: roundCurrency(vendorOrders.reduce((sum, order) => sum + getOrderCommissionSummary(order).vendorEarnings, 0))
        };
      })
      .filter((entry) => entry.grossSales > 0);

    elements.vendorRevenueTrackingList.innerHTML = vendorRows.length
      ? vendorRows.map((entry) => `
          <article class="table-card">
            <div class="table-top">
              <div>
                <strong>${escapeHtml(entry.vendor.storeName || entry.vendor.name || entry.vendor.id)}</strong>
                <div class="eyebrow">${entry.vendor.id}</div>
              </div>
            </div>
            <div class="table-details">
              <div class="detail-box"><span>Total Sales</span><strong>${formatCurrency(entry.grossSales)}</strong></div>
              <div class="detail-box"><span>Commission Earned</span><strong>${formatCurrency(entry.commission)}</strong></div>
              <div class="detail-box"><span>Vendor Revenue</span><strong>${formatCurrency(entry.earnings)}</strong></div>
            </div>
          </article>
        `).join("")
      : '<div class="empty-state">Vendor revenue tracking will appear after orders are placed.</div>';
  }

  if (elements.commissionHistoryList) {
    elements.commissionHistoryList.innerHTML = orderSummaries.length
      ? orderSummaries
        .slice()
        .sort((a, b) => {
          const aTime = parseOrderDate(a.order)?.getTime?.() || 0;
          const bTime = parseOrderDate(b.order)?.getTime?.() || 0;
          return bTime - aTime;
        })
        .map(({ order, summary }) => `
          <article class="table-card">
            <div class="table-top">
              <div>
                <strong>${order.id}</strong>
                <div class="eyebrow">${escapeHtml(order.customerName || "Customer")} • ${escapeHtml(getVendorName(order.vendorId))}</div>
              </div>
              <span class="badge ${statusClass(order.status || "pending")}">${order.status || "pending"}</span>
            </div>
            <div class="table-details">
              <div class="detail-box"><span>Gross Sale</span><strong>${formatCurrency(summary.grossSales)}</strong></div>
              <div class="detail-box"><span>Commission Rate</span><strong>${summary.commissionRate.toFixed(1)}%</strong></div>
              <div class="detail-box"><span>Platform Earnings</span><strong>${formatCurrency(summary.platformEarnings)}</strong></div>
              <div class="detail-box"><span>Vendor Earnings</span><strong>${formatCurrency(summary.vendorEarnings)}</strong></div>
            </div>
          </article>
        `).join("")
      : '<div class="empty-state">Commission history will appear after orders are created.</div>';
  }

  renderCommissionList();
  renderAffiliateBalances();
}

function renderAnalytics() {
  const overview = getOverview();
  const payouts = getVendorPendingPayouts();
  const topVendor = getTopVendors()[0];
  const topProduct = getTopProducts()[0];
  const avgOrderValue = overview.totalOrders ? overview.revenue / overview.totalOrders : 0;
  const referralStats = getReferralStats();
  const suspiciousEntries = getSuspiciousReferralEntries();

  elements.reportSummary.innerHTML = [
    ["Revenue", formatCurrency(overview.revenue)],
    ["Average order value", formatCurrency(avgOrderValue)],
    ["Pending payouts", payouts.filter((item) => item.pendingAmount > 0).length],
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

  elements.topReferrersList.innerHTML = referralStats.length
    ? referralStats.slice(0, 8).map((entry) => `
        <div class="mini-item">
          <div>
            <strong>${entry.name}</strong>
            <div class="eyebrow">${entry.customerCount} customer • ${entry.vendorCount} vendor referrals</div>
          </div>
          <strong>${formatCurrency(entry.total)}</strong>
        </div>
      `).join("")
    : '<div class="empty-state">No referrers yet.</div>';

  elements.referralFraudList.innerHTML = suspiciousEntries.length
    ? suspiciousEntries.map((entry) => `
        <div class="mini-item">
          <div>
            <strong>${entry.label}</strong>
            <div class="eyebrow">${entry.kind}</div>
          </div>
          <strong>${entry.flags.join(", ")}</strong>
        </div>
      `).join("")
    : '<div class="empty-state">No suspicious referral activity flagged.</div>';
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

function subscribeUsers() {
  if (state.unsubscribeUsers) state.unsubscribeUsers();

  state.unsubscribeUsers = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      state.data.users = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderAll();
    },
    (error) => {
      console.error("Failed to load users:", error);
      showToast(`Failed to load users: ${error.message}`, { type: "error" });
    }
  );
}

function subscribeCommissions() {
  if (state.unsubscribeCommissions) state.unsubscribeCommissions();

  state.unsubscribeCommissions = onSnapshot(
    collection(db, "commissions"),
    (snapshot) => {
      state.data.commissions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderAll();
    },
    (error) => {
      console.error("Failed to load commissions:", error);
      showToast(`Failed to load commissions: ${error.message}`, { type: "error" });
    }
  );
}

function subscribePayouts() {
  if (state.unsubscribePayouts) state.unsubscribePayouts();

  state.unsubscribePayouts = onSnapshot(
    collection(db, "vendor_payouts"),
    (snapshot) => {
      state.data.payouts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      renderAll();
    },
    (error) => {
      console.error("Failed to load payouts:", error);
      showToast(`Failed to load payouts: ${error.message}`, { type: "error" });
    }
  );
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  elements.productForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addProductFromAdmin();
  });

  elements.resetProductFormBtn?.addEventListener("click", resetProductForm);

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
    const categoryCommissionRates = readCategoryCommissionRatesFromInputs();
    const vendorCommissionRates = readVendorCommissionRatesFromInputs();
    const customerRate = Number(elements.customerReferralRateInput.value || 0);
    const vendorRate = Number(elements.vendorReferralRateInput.value || 0);
    const minWithdrawal = Number(elements.minWithdrawalInput.value || 0);
    const existingStart = state.data.settings.referrals?.startsAt || "";
    const existingEnd = state.data.settings.referrals?.endsAt || "";
    const startsAt = existingStart || new Date().toISOString();
    const endsAt = existingEnd || addMonthsToIsoDate(startsAt, DEFAULT_REFERRAL_SETTINGS.durationMonths);

    state.data.settings = {
      ...state.data.settings,
      commissionRate: nextRate,
      categoryCommissionRates,
      vendorCommissionRates,
      referrals: {
        ...state.data.settings.referrals,
        customerRate,
        vendorRate,
        minWithdrawal,
        durationMonths: DEFAULT_REFERRAL_SETTINGS.durationMonths,
        startsAt,
        endsAt
      }
    };
    saveSettingsLocal();

    try {
      await savePlatformSettings({
        commissionRate: nextRate,
        categoryCommissionRates,
        vendorCommissionRates,
        categories: state.data.settings.categories,
        referrals: {
          customerRate,
          vendorRate,
          minWithdrawal,
          durationMonths: DEFAULT_REFERRAL_SETTINGS.durationMonths,
          startsAt,
          endsAt
        }
      });

      showToast("Commission and 2-month affiliate window updated.", { type: "success" });
    } catch (error) {
      console.error("Failed to save commission:", error);
      showToast(`Failed to save commission: ${error.message}`, { type: "error" });
    }
  });

  elements.addCategoryCommissionBtn?.addEventListener("click", () => {
    const categories = state.data.settings.categories || [];
    const existing = readCategoryCommissionRatesFromInputs();
    const nextCategory = categories.find((category) => !(normalizeCategoryKey(category) in existing));

    if (!nextCategory) {
      showToast("All categories already have commission overrides.", { type: "info" });
      return;
    }

    state.data.settings.categoryCommissionRates = {
      ...existing,
      [normalizeCategoryKey(nextCategory)]: Number(state.data.settings.commissionRate || 0)
    };
    renderPayments();
  });

  elements.addVendorCommissionBtn?.addEventListener("click", () => {
    const existing = readVendorCommissionRatesFromInputs();
    const nextVendor = state.data.vendors.find((vendor) => !(vendor.id in existing));

    if (!nextVendor) {
      showToast("All vendors already have commission overrides.", { type: "info" });
      return;
    }

    state.data.settings.vendorCommissionRates = {
      ...existing,
      [nextVendor.id]: Number(state.data.settings.commissionRate || 0)
    };
    renderPayments();
  });

  elements.categoryCommissionList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-category-commission-remove]");
    if (!removeButton) return;

    const index = Number(removeButton.getAttribute("data-category-commission-remove"));
    const nextEntries = Object.entries(readCategoryCommissionRatesFromInputs())
      .filter((_, entryIndex) => entryIndex !== index);
    state.data.settings.categoryCommissionRates = Object.fromEntries(nextEntries);
    renderPayments();
  });

  elements.vendorCommissionList?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-vendor-commission-remove]");
    if (!removeButton) return;

    const index = Number(removeButton.getAttribute("data-vendor-commission-remove"));
    const nextEntries = Object.entries(readVendorCommissionRatesFromInputs())
      .filter((_, entryIndex) => entryIndex !== index);
    state.data.settings.vendorCommissionRates = Object.fromEntries(nextEntries);
    renderPayments();
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

  elements.saveAdminSettingsBtn.addEventListener("click", async () => {
    state.data.auth.currentUser = {
      ...state.data.auth.currentUser,
      name: elements.adminNameInput.value.trim() || "Bills Campus Mall Admin",
      email: elements.adminEmailInput.value.trim() || "",
      role: elements.adminRoleInput.value
    };

    state.data.settings.adminProfile = {
      ...state.data.auth.currentUser
    };

    saveSettingsLocal();

    try {
      await savePlatformSettings({
        adminProfile: state.data.settings.adminProfile
      });
      renderAll();
      showToast("Admin settings saved.", { type: "success" });
    } catch (error) {
      console.error("Failed to save admin settings:", error);
      showToast(`Failed to save admin settings: ${error.message}`, { type: "error" });
    }
  });

  elements.exportBtn.addEventListener("click", () => {
    const exportData = {
      users: state.data.users,
      vendors: state.data.vendors,
      products: state.data.products,
      orders: state.data.orders,
      commissions: state.data.commissions,
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

  elements.productImageInput?.addEventListener("input", (event) => {
    const typedImages = normalizeImageList(
      event.target.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    const uploadedImages = state.productImages.filter((value) => /^https?:\/\//i.test(value));
    state.productImages = [...typedImages, ...uploadedImages];
    updateProductImagePreview(state.productImages);
  });

  elements.productImageFilesInput?.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (files.some((file) => !file.type.startsWith("image/"))) {
      showToast("Please choose image files only.", { type: "error" });
      event.target.value = "";
      return;
    }

    try {
      showToast("Uploading images...", { type: "info" });
      const uploaded = await Promise.all(files.map((file) => uploadAdminImageFile(file)));
      const typedImages = normalizeImageList(
        (elements.productImageInput?.value || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      );

      state.productImages = [...typedImages, ...uploaded];
      updateProductImagePreview(state.productImages);
      showToast(
        `${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded successfully.`,
        { type: "success" }
      );
    } catch (error) {
      console.error("Failed to upload product images:", error);
      showToast(`Image upload failed: ${error.message}`, { type: "error" });
    }
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

  elements.productList.addEventListener("click", async (event) => {
    const productId = event.target.getAttribute("data-delete-product");
    if (!productId) return;

    await deleteProductFromAdmin(productId);
  });

  elements.orderList.addEventListener("click", async (event) => {
    const orderId = event.target.getAttribute("data-order-update");
    const status = event.target.getAttribute("data-status");

    if (!orderId || !status) return;

    await updateOrderStatus(orderId, status);
  });

  elements.commissionList?.addEventListener("click", async (event) => {
    const commissionId = event.target.getAttribute("data-commission-update");
    const status = event.target.getAttribute("data-status");

    if (!commissionId || !status) return;

    try {
      await updateCommissionStatus(commissionId, status);
      showToast(`Commission marked ${status}.`, { type: "success" });
    } catch (error) {
      console.error("Failed to update commission:", error);
      showToast(`Failed to update commission: ${error.message}`, { type: "error" });
    }
  });

  elements.payoutList?.addEventListener("click", async (event) => {
    const vendorId = event.target.getAttribute("data-payout-complete");
    if (!vendorId) return;

    try {
      await markVendorPayoutCompleted(vendorId);
      showToast("Vendor payout marked as completed.", { type: "success" });
    } catch (error) {
      console.error("Failed to complete payout:", error);
      showToast(`Failed to complete payout: ${error.message}`, { type: "error" });
    }
  });
}

async function init() {
  bindEvents();
  setProductFormEnabled(false);

  try {
    const user = await requireAdmin();

    state.data.auth.currentUser = {
      uid: user.uid,
      name: user.displayName || state.data.settings.adminProfile.name || "Bills Campus Mall Admin",
      email: user.email || state.data.settings.adminProfile.email || "",
      role: state.data.settings.adminProfile.role || "platform_admin"
    };

    await ensurePlatformSettingsDoc();

    setProductFormEnabled(true);
    renderAll();
    subscribePlatformSettings();
    subscribeVendors();
    subscribeProducts();
    subscribeOrders();
    subscribeUsers();
    subscribeCommissions();
    subscribePayouts();
  } catch (error) {
    console.error("Admin init failed:", error);
  }
}

init();
