import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db, storage } from "./firebase.js";
import { showToast } from "./ui.js";

/* =========================
   CONFIG
========================= */
const COMMISSION_RATE = 0.05;

// Replace these with your real links
const WHATSAPP_ADMIN_URL =
  "https://wa.me/233599480662?text=Hello%20I%20want%20help%20with%20my%20Bills%20Mall%20vendor%20account";

const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/CBRwEltZ3WoEccEzaohWUY?mode=gi_t";

const CATEGORY_OPTIONS = [
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

/* =========================
   STATE
========================= */
const state = {
  vendorId: null,
  currentSection: "dashboard",
  vendorProfile: null,
  vendorProducts: [],
  vendorOrders: [],
  vendorReviews: [],
  vendorPayouts: [],
  unsubscribeProducts: null,
  unsubscribeOrders: null,
  authReady: false,
  eventsBound: false
};

const elements = {
  pageTitle: document.getElementById("page-title"),
  sidebar: document.getElementById("vendor-sidebar"),
  menuBtn: document.getElementById("vendor-menu-btn"),
  navLinks: Array.from(document.querySelectorAll(".vendor-nav-link")),
  sections: Array.from(document.querySelectorAll(".vendor-section")),

  statsGrid: document.getElementById("stats-grid"),
  earningsStatsGrid: document.getElementById("earnings-stats-grid"),
  salesChart: document.getElementById("sales-chart"),

  productList: document.getElementById("product-list"),
  orderList: document.getElementById("order-list"),
  analyticsList: document.getElementById("analytics-list"),
  reviewList: document.getElementById("review-list"),
  paymentHistory: document.getElementById("payment-history"),

  productForm: document.getElementById("product-form"),
  resetProductFormBtn: document.getElementById("reset-product-form"),
  productFormTitle: document.getElementById("product-form-title"),
  productImageInput: document.getElementById("product-image"),
  productImageFileInput: document.getElementById("product-image-file"),
  productImagePreview: document.getElementById("product-image-preview"),

  settingsForm: document.getElementById("settings-form"),
  vendorStoreNameTop: document.getElementById("vendor-store-name-top"),
  vendorUserIdTop: document.getElementById("vendor-user-id-top"),
  vendorUserAvatar: document.getElementById("vendor-user-avatar"),
  spotlightStoreName: document.getElementById("spotlight-store-name"),
  spotlightStoreDescription: document.getElementById("spotlight-store-description"),
  spotlightProducts: document.getElementById("spotlight-products"),
  spotlightOrders: document.getElementById("spotlight-orders"),
  spotlightRating: document.getElementById("spotlight-rating"),

  settingsStoreNamePreview: document.getElementById("settings-store-name-preview"),
  settingsDescriptionPreview: document.getElementById("settings-description-preview"),
  settingsEmailPreview: document.getElementById("settings-email-preview"),
  settingsPhonePreview: document.getElementById("settings-phone-preview"),
  settingsVendorIdPreview: document.getElementById("settings-vendor-id-preview"),
  settingsLogoPreview: document.getElementById("settings-logo-preview")
};

let uploadedProductImages = [];
let isSavingProduct = false;

/* =========================
   HELPERS
========================= */
function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function getStatusClass(status) {
  return `status-${String(status || "").toLowerCase().replace(/\s+/g, "-")}`;
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function normalizeImageList(values = []) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => isAbsoluteUrl(value));
}

function sanitizeFileName(name = "") {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function redirectToLogin() {
  window.location.href = "./login.html";
}

function requireAuth() {
  if (!auth.currentUser) {
    showToast("Please log in to access the vendor dashboard.", { type: "error" });
    redirectToLogin();
    return false;
  }
  return true;
}

function getVendorProducts() {
  return state.vendorProducts;
}

function getVendorOrders() {
  return state.vendorOrders;
}

function getVendorReviews() {
  return state.vendorReviews;
}

function getVendorPayouts() {
  return state.vendorPayouts;
}

function getVendorProfileDefaults() {
  const user = auth.currentUser;
  return {
    id: user?.uid || "",
    storeName: user?.displayName || "Vendor Studio",
    logoUrl: user?.photoURL || "",
    contactEmail: user?.email || "",
    contactPhone: user?.phoneNumber || "",
    description: "Professional marketplace dashboard for your store.",
    status: "pending"
  };
}

function getVendorProfile() {
  return state.vendorProfile || getVendorProfileDefaults();
}

function isVendorApproved() {
  return state.vendorProfile?.status === "approved";
}

function canVendorSell() {
  return isVendorApproved();
}

async function uploadToFirebaseStorage(file) {
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("You must be logged in to upload images.");
  }

  const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const storageRef = ref(storage, `products/${userId}/${fileName}`);

  await uploadBytes(storageRef, file, {
    contentType: file.type
  });

  return await getDownloadURL(storageRef);
}

function clearVendorState() {
  state.vendorId = null;
  state.vendorProfile = null;
  state.vendorProducts = [];
  state.vendorOrders = [];
  state.vendorReviews = [];
  state.vendorPayouts = [];

  if (state.unsubscribeProducts) {
    state.unsubscribeProducts();
    state.unsubscribeProducts = null;
  }

  if (state.unsubscribeOrders) {
    state.unsubscribeOrders();
    state.unsubscribeOrders = null;
  }
}

/* =========================
   UI HELPERS
========================= */
function initializeCategoryDropdown() {
  const categorySelect = document.getElementById("product-category");
  if (!categorySelect) return;

  categorySelect.innerHTML = [
    '<option value="">Select a category</option>',
    ...CATEGORY_OPTIONS.map(
      (category) => `<option value="${category}">${category}</option>`
    )
  ].join("");
}

function removeApprovalNotice() {
  document.querySelectorAll(".vendor-approval-notice").forEach((el) => el.remove());
}

function renderApprovalNotice() {
  removeApprovalNotice();

  if (isVendorApproved()) return;

  const banner = document.createElement("div");
  banner.className = "vendor-approval-notice empty-state";
  banner.innerHTML = `
    <strong>Vendor approval pending</strong><br>
    Your account is waiting for approval. You can view your dashboard, but you cannot add, edit, or delete products yet.
  `;

  const dashboardSection = document.getElementById("section-dashboard");
  if (dashboardSection) {
    dashboardSection.insertBefore(banner, dashboardSection.firstChild);
  }
}

function updateVendorAccessUI() {
  const approved = isVendorApproved();

  const fields = elements.productForm?.querySelectorAll("input, select, textarea, button");
  fields?.forEach((field) => {
    if (field.id === "reset-product-form") return;
    field.disabled = !approved;
  });

  if (elements.productFormTitle && !approved) {
    elements.productFormTitle.textContent = "Add Product (Approval Required)";
  } else if (elements.productFormTitle && approved) {
    elements.productFormTitle.textContent = "Add Product";
  }

  renderApprovalNotice();
}

function insertVendorSupportLinks() {
  const footer = document.querySelector(".vendor-sidebar-footer");
  if (!footer) return;

  if (document.getElementById("vendor-support-links")) return;

  const box = document.createElement("div");
  box.id = "vendor-support-links";
  box.className = "vendor-support-links";
  box.innerHTML = `
    <div style="margin-top:16px;">
      <p style="margin:0 0 8px 0; font-size:14px;">Need help or want to join the vendor group?</p>
      <a href="${WHATSAPP_ADMIN_URL}" target="_blank" rel="noopener noreferrer" class="vendor-back-link" style="display:block; margin-bottom:8px;">
        Chat with Admin on WhatsApp
      </a>
      <a href="${WHATSAPP_GROUP_URL}" target="_blank" rel="noopener noreferrer" class="vendor-back-link" style="display:block;">
        Join Vendor WhatsApp Group
      </a>
    </div>
  `;

  footer.appendChild(box);
}

/* =========================
   FIREBASE PROFILE
========================= */
async function syncVendorProfileFromFirebaseLogin() {
  const user = auth.currentUser;
  if (!user) return;

  state.vendorId = user.uid;

  const loginProfile = {
    id: user.uid,
    storeName: user.displayName || "Vendor Studio",
    logoUrl: user.photoURL || "",
    contactEmail: user.email || "",
    contactPhone: user.phoneNumber || "",
    description: "Professional marketplace dashboard for your store.",
    status: "pending"
  };

  try {
    const vendorRef = doc(db, "vendors", user.uid);
    const vendorSnap = await getDoc(vendorRef);

    let mergedProfile = loginProfile;

    if (vendorSnap.exists()) {
      const vendorData = vendorSnap.data();
      mergedProfile = {
        ...vendorData,
        id: user.uid,
        storeName: user.displayName || vendorData.storeName || "Vendor Studio",
        logoUrl: user.photoURL || vendorData.logoUrl || "",
        contactEmail: user.email || vendorData.contactEmail || "",
        contactPhone: user.phoneNumber || vendorData.contactPhone || "",
        description: vendorData.description || "Professional marketplace dashboard for your store.",
        status: vendorData.status || "pending"
      };
    } else {
      await setDoc(vendorRef, loginProfile, { merge: true });
    }

    state.vendorProfile = mergedProfile;
  } catch (err) {
    console.error("Failed to sync vendor profile:", err);
    showToast(`Failed to load vendor profile: ${err.message}`, { type: "error" });
  }
}

/* =========================
   FIREBASE SUBSCRIPTIONS
========================= */
function subscribeProductsFromFirebase() {
  if (!state.vendorId) return;

  if (state.unsubscribeProducts) {
    state.unsubscribeProducts();
  }

  const productsQuery = query(
    collection(db, "products"),
    where("vendorId", "==", state.vendorId)
  );

  state.unsubscribeProducts = onSnapshot(
    productsQuery,
    (snapshot) => {
      state.vendorProducts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      renderAll();
    },
    (err) => {
      console.error("Failed to subscribe to vendor products:", err);
      showToast(`Failed to load products: ${err.message}`, { type: "error" });
    }
  );
}

function subscribeOrdersFromFirebase() {
  if (!state.vendorId) return;

  if (state.unsubscribeOrders) {
    state.unsubscribeOrders();
  }

  const ordersQuery = query(
    collection(db, "orders"),
    where("vendorId", "==", state.vendorId)
  );

  state.unsubscribeOrders = onSnapshot(
    ordersQuery,
    (snapshot) => {
      state.vendorOrders = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      renderAll();
    },
    (err) => {
      console.error("Failed to subscribe to vendor orders:", err);
      showToast(`Failed to load orders: ${err.message}`, { type: "error" });
    }
  );
}

/* =========================
   CALCULATIONS
========================= */
function calculateOverview() {
  const products = getVendorProducts();
  const orders = getVendorOrders();
  const reviews = getVendorReviews();
  const payouts = getVendorPayouts();

  const grossSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const totalSalesCount = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  const earnings = grossSales * (1 - COMMISSION_RATE);

  const deliveredRevenue = orders
    .filter((order) => order.status === "Delivered")
    .reduce((sum, order) => sum + Number(order.total || 0) * (1 - COMMISSION_RATE), 0);

  const processingRevenue = orders
    .filter((order) => order.status !== "Delivered")
    .reduce((sum, order) => sum + Number(order.total || 0) * (1 - COMMISSION_RATE), 0);

  const paidOut = payouts
    .filter((payout) => payout.status === "Completed")
    .reduce((sum, payout) => sum + Number(payout.amount || 0), 0);

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  return {
    grossSales,
    orderCount: orders.length,
    totalSalesCount,
    earnings,
    withdrawable: Math.max(deliveredRevenue - paidOut, 0),
    pendingBalance: processingRevenue,
    averageRating,
    activeProducts: products.filter((product) => product.status === "Active").length,
    openOrders: orders.filter((order) => order.status !== "Delivered").length
  };
}

/* =========================
   RENDER
========================= */
function renderStats() {
  const overview = calculateOverview();

  if (elements.statsGrid) {
    const cards = [
      { label: "Total Sales", value: formatCurrency(overview.grossSales), note: "Gross marketplace value" },
      { label: "Orders", value: overview.orderCount, note: "Vendor orders received" },
      { label: "Products Sold", value: overview.totalSalesCount, note: "Units sold" },
      { label: "Earnings", value: formatCurrency(overview.earnings), note: "After commission" }
    ];

    elements.statsGrid.innerHTML = cards
      .map(
        (card) =>
          `<div class="stat-card-vendor"><span>${card.label}</span><strong>${card.value}</strong><small>${card.note}</small></div>`
      )
      .join("");
  }

  if (elements.earningsStatsGrid) {
    const earningsCards = [
      { label: "Total Earnings", value: formatCurrency(overview.earnings), note: "Net sales after commission" },
      { label: "Pending Balance", value: formatCurrency(overview.pendingBalance), note: "Orders not yet delivered" },
      { label: "Withdrawable", value: formatCurrency(overview.withdrawable), note: "Ready for payout" },
      { label: "Commission Rate", value: `${Math.round(COMMISSION_RATE * 100)}%`, note: "Marketplace fee" }
    ];

    elements.earningsStatsGrid.innerHTML = earningsCards
      .map(
        (card) =>
          `<div class="stat-card-vendor"><span>${card.label}</span><strong>${card.value}</strong><small>${card.note}</small></div>`
      )
      .join("");
  }

  const vendor = getVendorProfile();

  if (elements.vendorStoreNameTop) elements.vendorStoreNameTop.textContent = vendor.storeName;
  if (elements.vendorUserIdTop) elements.vendorUserIdTop.textContent = state.vendorId || "";
  if (elements.vendorUserAvatar) {
    elements.vendorUserAvatar.textContent = (vendor.storeName || "V").slice(0, 1).toUpperCase();
  }
  if (elements.spotlightStoreName) elements.spotlightStoreName.textContent = vendor.storeName;
  if (elements.spotlightStoreDescription) {
    elements.spotlightStoreDescription.textContent = isVendorApproved()
      ? vendor.description
      : "Your vendor account is pending approval.";
  }
  if (elements.spotlightProducts) elements.spotlightProducts.textContent = overview.activeProducts;
  if (elements.spotlightOrders) elements.spotlightOrders.textContent = overview.openOrders;
  if (elements.spotlightRating) elements.spotlightRating.textContent = overview.averageRating.toFixed(1);
}

function renderSalesChart() {
  if (!elements.salesChart) return;

  const orders = getVendorOrders();
  if (!orders.length) {
    elements.salesChart.innerHTML = `
      <div class="empty-state">No sales chart data yet. Your chart will appear when orders are recorded.</div>
    `;
    return;
  }

  const monthMap = {};
  orders.forEach((order) => {
    let key = "Unknown";
    const rawDate = order.createdAt?.seconds
      ? new Date(order.createdAt.seconds * 1000)
      : order.createdAt
        ? new Date(order.createdAt)
        : null;

    if (rawDate && !Number.isNaN(rawDate.getTime())) {
      key = rawDate.toLocaleString("en-US", { month: "short" });
    }

    if (!monthMap[key]) monthMap[key] = 0;
    monthMap[key] += Number(order.total || 0);
  });

  const entries = Object.entries(monthMap);
  const max = Math.max(...entries.map(([, sales]) => sales), 1);

  elements.salesChart.innerHTML = entries
    .map(([label, sales]) => {
      const height = Math.max((sales / max) * 170, 20);
      return `
        <div class="sales-bar">
          <span class="sales-bar-value">${formatCurrency(sales)}</span>
          <div class="sales-bar-visual" style="height:${height}px"></div>
          <span class="sales-bar-label">${label}</span>
        </div>
      `;
    })
    .join("");
}

function renderProducts() {
  if (!elements.productList) return;

  const products = getVendorProducts();

  if (!products.length) {
    elements.productList.innerHTML = `
      <div class="empty-state">
        ${isVendorApproved()
          ? "No products yet. Add your first product to start selling."
          : "No products yet. Product actions will unlock after approval."}
      </div>
    `;
    return;
  }

  elements.productList.innerHTML = products
    .map(
      (product) => `
        <article class="vendor-table-card">
          <div class="vendor-table-top">
            <div class="vendor-table-title">
              <img class="vendor-table-image" src="${product.images?.[0] || product.image || ""}" alt="${product.name}">
              <div>
                <h4>${product.name}</h4>
                <p class="vendor-table-meta">${product.category || "General"}</p>
              </div>
            </div>
            <span class="status-pill ${getStatusClass(product.status || "Draft")}">${product.status || "Draft"}</span>
          </div>

          <div class="vendor-table-details">
            <div><span>Price</span><strong>${formatCurrency(product.price)}</strong></div>
            <div><span>Stock</span><strong>${product.stock ?? 0}</strong></div>
            <div><span>Views</span><strong>${product.views || 0}</strong></div>
            <div><span>Sold</span><strong>${product.sold || 0}</strong></div>
          </div>

          ${
            Array.isArray(product.variations) && product.variations.length
              ? `<div class="vendor-table-meta">Variations: ${product.variations.join(", ")}</div>`
              : ""
          }

          <div class="vendor-table-actions">
            <button class="table-action-btn edit" data-edit-product="${product.id}" ${!isVendorApproved() ? "disabled" : ""}>Edit</button>
            <button class="table-action-btn delete" data-delete-product="${product.id}" ${!isVendorApproved() ? "disabled" : ""}>Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOrders() {
  if (!elements.orderList) return;

  const orders = getVendorOrders();

  if (!orders.length) {
    elements.orderList.innerHTML = `
      <div class="empty-state">No vendor orders yet. New orders will appear here.</div>
    `;
    return;
  }

  elements.orderList.innerHTML = orders
    .map((order) => {
      const itemNames = Array.isArray(order.items)
        ? order.items.map((item) => item.name).filter(Boolean).join(", ")
        : (order.productName || "Order");

      return `
        <article class="vendor-table-card">
          <div class="vendor-table-top">
            <div>
              <h4>${order.id}</h4>
              <p class="vendor-table-meta">${itemNames}</p>
            </div>
            <span class="status-pill ${getStatusClass(order.status || "Pending")}">${order.status || "Pending"}</span>
          </div>

          <div class="vendor-table-details">
            <div><span>Customer</span><strong>${order.customerName || "N/A"}</strong></div>
            <div><span>Email</span><strong>${order.customerEmail || "N/A"}</strong></div>
            <div><span>Phone</span><strong>${order.customerPhone || "N/A"}</strong></div>
            <div><span>Location</span><strong>${order.location || "N/A"}</strong></div>
            <div><span>Quantity</span><strong>${order.quantity || 0}</strong></div>
            <div><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEarningsHistory() {
  if (!elements.paymentHistory) return;

  const payouts = getVendorPayouts();

  if (!payouts.length) {
    elements.paymentHistory.innerHTML = `<div class="empty-state">No payout history yet.</div>`;
    return;
  }

  elements.paymentHistory.innerHTML = payouts
    .map(
      (payout) => `
        <article class="vendor-table-card">
          <div class="vendor-table-top">
            <div><h4>${payout.id}</h4><p class="vendor-table-meta">${payout.method || "Payout"}</p></div>
            <span class="status-pill ${getStatusClass(payout.status || "Pending")}">${payout.status || "Pending"}</span>
          </div>
          <div class="vendor-table-details">
            <div><span>Date</span><strong>${payout.date || "N/A"}</strong></div>
            <div><span>Amount</span><strong>${formatCurrency(payout.amount)}</strong></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAnalytics() {
  if (!elements.analyticsList) return;

  const products = getVendorProducts();

  if (!products.length) {
    elements.analyticsList.innerHTML = `<div class="empty-state">Add products to start tracking analytics.</div>`;
    return;
  }

  elements.analyticsList.innerHTML = products
    .map((product) => {
      const views = Number(product.views || 0);
      const sold = Number(product.sold || 0);
      const conversion = views ? ((sold / views) * 100).toFixed(2) : "0.00";

      return `
        <article class="vendor-table-card">
          <div class="vendor-table-top">
            <div class="vendor-table-title">
              <img class="vendor-table-image" src="${product.images?.[0] || product.image || ""}" alt="${product.name}">
              <div><h4>${product.name}</h4><p class="vendor-table-meta">${product.category}</p></div>
            </div>
            <span class="status-pill ${getStatusClass(product.status || "Draft")}">${product.status || "Draft"}</span>
          </div>
          <div class="vendor-table-details">
            <div><span>Views</span><strong>${views}</strong></div>
            <div><span>Units Sold</span><strong>${sold}</strong></div>
            <div><span>Conversion</span><strong>${conversion}%</strong></div>
            <div><span>Revenue</span><strong>${formatCurrency(sold * Number(product.price || 0))}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderReviews() {
  if (!elements.reviewList) return;

  const reviews = getVendorReviews();

  if (!reviews.length) {
    elements.reviewList.innerHTML = `<div class="empty-state">No reviews yet. Customer feedback will appear here.</div>`;
    return;
  }

  elements.reviewList.innerHTML = reviews
    .map(
      (review) => `
        <article class="review-card">
          <div class="review-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
          <h4>${review.productName}</h4>
          <p><strong>${review.customerName}</strong></p>
          <p>${review.comment}</p>
        </article>
      `
    )
    .join("");
}

function populateSettings() {
  const vendor = getVendorProfile();
  const user = auth.currentUser;

  const storeNameInput = document.getElementById("settings-store-name");
  const logoUrlInput = document.getElementById("settings-logo-url");
  const contactEmailInput = document.getElementById("settings-contact-email");
  const contactPhoneInput = document.getElementById("settings-contact-phone");
  const descriptionInput = document.getElementById("settings-description");

  if (storeNameInput) storeNameInput.value = vendor.storeName || "";
  if (logoUrlInput) logoUrlInput.value = vendor.logoUrl || "";
  if (contactEmailInput) contactEmailInput.value = vendor.contactEmail || "";
  if (contactPhoneInput) contactPhoneInput.value = vendor.contactPhone || "";
  if (descriptionInput) descriptionInput.value = vendor.description || "";

  if (storeNameInput) storeNameInput.readOnly = !!user?.displayName;
  if (logoUrlInput) logoUrlInput.readOnly = !!user?.photoURL;
  if (contactEmailInput) contactEmailInput.readOnly = !!user?.email;
  if (contactPhoneInput) contactPhoneInput.readOnly = !!user?.phoneNumber;

  if (elements.settingsStoreNamePreview) {
    elements.settingsStoreNamePreview.textContent = vendor.storeName || "Vendor Studio";
  }
  if (elements.settingsDescriptionPreview) {
    elements.settingsDescriptionPreview.textContent =
      vendor.description || "Professional marketplace dashboard for your store.";
  }
  if (elements.settingsEmailPreview) {
    elements.settingsEmailPreview.textContent = vendor.contactEmail || "No email found";
  }
  if (elements.settingsPhonePreview) {
    elements.settingsPhonePreview.textContent = vendor.contactPhone || "No phone found";
  }
  if (elements.settingsVendorIdPreview) {
    elements.settingsVendorIdPreview.textContent = state.vendorId || "";
  }

  if (elements.settingsLogoPreview) {
    if (vendor.logoUrl) {
      elements.settingsLogoPreview.src = vendor.logoUrl;
      elements.settingsLogoPreview.style.display = "block";
    } else {
      elements.settingsLogoPreview.removeAttribute("src");
      elements.settingsLogoPreview.style.display = "none";
    }
  }
}

/* =========================
   PRODUCT FORM
========================= */
function resetProductForm() {
  if (!elements.productForm) return;

  elements.productForm.reset();

  const productIdInput = document.getElementById("product-id");
  const productStatusInput = document.getElementById("product-status");
  const productVariationsInput = document.getElementById("product-variations");

  if (productIdInput) productIdInput.value = "";
  if (productStatusInput) productStatusInput.value = "Active";
  if (productVariationsInput) productVariationsInput.value = "";

  if (elements.productFormTitle) {
    elements.productFormTitle.textContent = isVendorApproved()
      ? "Add Product"
      : "Add Product (Approval Required)";
  }

  uploadedProductImages = [];

  if (elements.productImageFileInput) {
    elements.productImageFileInput.value = "";
  }

  updateProductImagePreview([]);
}

function fillProductForm(productId) {
  if (!canVendorSell()) {
    showToast("Your vendor account is awaiting approval.", { type: "error" });
    return;
  }

  const product = getVendorProducts().find((item) => item.id === productId);
  if (!product) return;

  document.getElementById("product-id").value = product.id;
  document.getElementById("product-name").value = product.name || "";
  document.getElementById("product-category").value = product.category || "";
  document.getElementById("product-price").value = product.price ?? "";
  document.getElementById("product-stock").value = product.stock ?? "";

  const productImages = product.images?.length
    ? product.images
    : product.image
      ? [product.image]
      : [];

  document.getElementById("product-image").value = productImages.join(", ");
  uploadedProductImages = [...productImages];

  if (elements.productImageFileInput) {
    elements.productImageFileInput.value = "";
  }

  updateProductImagePreview(productImages);
  document.getElementById("product-status").value = product.status || "Active";
  document.getElementById("product-description").value = product.description || "";
  document.getElementById("product-variations").value = Array.isArray(product.variations)
    ? product.variations.join(", ")
    : "";

  if (elements.productFormTitle) {
    elements.productFormTitle.textContent = "Edit Product";
  }

  setSection("products");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateProductImagePreview(images) {
  if (!elements.productImagePreview) return;

  if (images.length) {
    elements.productImagePreview.innerHTML = images
      .map(
        (src, index) =>
          `<img src="${src}" alt="Product preview ${index + 1}" class="vendor-image-thumb">`
      )
      .join("");

    elements.productImagePreview.classList.add("has-images");
  } else {
    elements.productImagePreview.innerHTML = "";
    elements.productImagePreview.classList.remove("has-images");
  }
}

async function upsertProduct(formData) {
  if (!requireAuth()) return;
  if (!canVendorSell()) {
    showToast("Your vendor account is awaiting approval.", { type: "error" });
    return;
  }
  if (isSavingProduct) return;

  isSavingProduct = true;

  const submitButton = elements.productForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  const payload = {
    vendorId: state.vendorId,
    name: formData.name,
    category: formData.category,
    price: Number(formData.price || 0),
    stock: Number(formData.stock || 0),
    image: formData.images[0] || "",
    images: formData.images,
    status: formData.status,
    description: formData.description,
    variations: formData.variations,
    views: formData.views || 0,
    sold: formData.sold || 0
  };

  try {
    if (formData.id) {
      const existingProduct = getVendorProducts().find((item) => item.id === formData.id);

      if (!existingProduct) {
        throw new Error("You can only edit your own products.");
      }

      await updateDoc(doc(db, "products", formData.id), payload);
      showToast("Product updated successfully.", { type: "success" });
    } else {
      await addDoc(collection(db, "products"), payload);
      showToast("Product added successfully.", { type: "success" });
    }

    resetProductForm();
  } catch (err) {
    console.error("Failed to save product:", err);
    showToast(`Failed to save product: ${err.message}`, { type: "error" });
  } finally {
    isSavingProduct = false;
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteProduct(productId) {
  if (!requireAuth()) return;
  if (!canVendorSell()) {
    showToast("Your vendor account is awaiting approval.", { type: "error" });
    return;
  }

  const target = getVendorProducts().find((product) => product.id === productId);
  if (!target) {
    showToast("You can only delete your own products.", { type: "error" });
    return;
  }

  try {
    await deleteDoc(doc(db, "products", productId));
    showToast(`Removed ${target.name}.`, { type: "success" });
  } catch (err) {
    console.error("Failed to delete product:", err);
    showToast(`Failed to delete product: ${err.message}`, { type: "error" });
  }
}

/* =========================
   SETTINGS
========================= */
async function saveSettings(payload) {
  if (!state.vendorId) return;

  const authDefaults = getVendorProfileDefaults();

  const merged = {
    ...getVendorProfile(),
    ...payload,
    id: state.vendorId,
    storeName: authDefaults.storeName || payload.storeName || "Vendor Studio",
    logoUrl: authDefaults.logoUrl || payload.logoUrl || "",
    contactEmail: authDefaults.contactEmail || payload.contactEmail || "",
    contactPhone: authDefaults.contactPhone || payload.contactPhone || "",
    description: payload.description || "Professional marketplace dashboard for your store.",
    status: state.vendorProfile?.status || "pending"
  };

  state.vendorProfile = merged;
  populateSettings();
  renderStats();
  updateVendorAccessUI();

  try {
    await setDoc(doc(db, "vendors", state.vendorId), merged, { merge: true });
    showToast("Vendor profile updated.", { type: "success" });
  } catch (err) {
    console.error("Failed to save vendor settings:", err);
    showToast(`Failed to sync settings: ${err.message}`, { type: "error" });
  }
}

/* =========================
   SECTION SWITCH
========================= */
function renderAll() {
  renderStats();
  renderSalesChart();
  renderProducts();
  renderOrders();
  renderEarningsHistory();
  renderAnalytics();
  renderReviews();
  populateSettings();
  updateVendorAccessUI();
  insertVendorSupportLinks();
}

function setSection(section) {
  state.currentSection = section;

  if (elements.pageTitle) {
    elements.pageTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);
  }

  elements.navLinks.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  elements.sections.forEach((sectionEl) => {
    sectionEl.classList.toggle("active", sectionEl.id === `section-${section}`);
  });

  elements.sidebar?.classList.remove("open");
}

/* =========================
   EVENTS
========================= */
function bindEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;

  elements.navLinks.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  elements.menuBtn?.addEventListener("click", () => {
    elements.sidebar?.classList.toggle("open");
  });

  elements.productForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireAuth()) return;
    if (!canVendorSell()) {
      showToast("Your vendor account is awaiting approval.", { type: "error" });
      return;
    }

    const name = document.getElementById("product-name").value.trim();
    const category = document.getElementById("product-category").value.trim();
    const price = Number(document.getElementById("product-price").value);
    const stock = Number(document.getElementById("product-stock").value);

    const typedImages = normalizeImageList(
      elements.productImageInput.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    const images = typedImages.length ? typedImages : uploadedProductImages;
    const status = document.getElementById("product-status").value;
    const description = document.getElementById("product-description").value.trim();
    const variationsInput = document.getElementById("product-variations").value.trim();
    const variations = variationsInput
      ? variationsInput.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    const id = document.getElementById("product-id").value;
    const existing = id ? getVendorProducts().find((product) => product.id === id) : null;

    if (!name || !category || Number.isNaN(price) || Number.isNaN(stock)) {
      showToast("Name, category, price, and stock are required.", { type: "error" });
      return;
    }

    if (!images.length) {
      showToast("Please add at least one product image.", { type: "error" });
      return;
    }

    await upsertProduct({
      id,
      name,
      category,
      price,
      stock,
      images,
      status,
      description,
      variations,
      views: existing?.views || 0,
      sold: existing?.sold || 0
    });
  });

  elements.resetProductFormBtn?.addEventListener("click", resetProductForm);

  elements.productImageInput?.addEventListener("input", (event) => {
    const values = normalizeImageList(
      event.target.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    if (values.length) {
      uploadedProductImages = values;
      updateProductImagePreview(values);
    } else if (!elements.productImageFileInput?.files.length) {
      uploadedProductImages = [];
      updateProductImagePreview([]);
    }
  });

  elements.productImageFileInput?.addEventListener("change", async (event) => {
    if (!requireAuth()) return;

    const files = Array.from(event.target.files || []);

    if (!files.length) {
      if (!elements.productImageInput.value.trim()) {
        uploadedProductImages = [];
        updateProductImagePreview([]);
      }
      return;
    }

    if (files.some((file) => !file.type.startsWith("image/"))) {
      showToast("Please choose image files only.", { type: "error" });
      event.target.value = "";
      return;
    }

    try {
      showToast("Uploading images to Firebase Storage...", { type: "info" });

      uploadedProductImages = await Promise.all(
        files.map((file) => uploadToFirebaseStorage(file))
      );

      elements.productImageInput.value = "";
      updateProductImagePreview(uploadedProductImages);

      showToast(
        `${uploadedProductImages.length} image${uploadedProductImages.length > 1 ? "s" : ""} uploaded successfully.`,
        { type: "success" }
      );
    } catch (err) {
      console.error(err);
      showToast(`Image upload failed: ${err.message}`, { type: "error" });
    }
  });

  elements.productList?.addEventListener("click", async (event) => {
    const editId = event.target.getAttribute("data-edit-product");
    const deleteId = event.target.getAttribute("data-delete-product");

    if (editId) fillProductForm(editId);
    if (deleteId) await deleteProduct(deleteId);
  });

  elements.settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireAuth()) return;

    const user = auth.currentUser;
    const payload = {
      storeName: user?.displayName || document.getElementById("settings-store-name").value.trim() || "Vendor Studio",
      logoUrl: user?.photoURL || document.getElementById("settings-logo-url").value.trim(),
      contactEmail: user?.email || document.getElementById("settings-contact-email").value.trim(),
      contactPhone: user?.phoneNumber || document.getElementById("settings-contact-phone").value.trim(),
      description:
        document.getElementById("settings-description").value.trim() ||
        "Professional marketplace dashboard for your store."
    };

    await saveSettings(payload);
  });
}

/* =========================
   INIT
========================= */
function init() {
  initializeCategoryDropdown();
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    state.authReady = true;

    if (!user) {
      clearVendorState();
      redirectToLogin();
      return;
    }

    if (!user.emailVerified) {
      showToast("Please verify your email before using the vendor dashboard.", { type: "error" });
      redirectToLogin();
      return;
    }

    state.vendorId = user.uid;

    await syncVendorProfileFromFirebaseLogin();
    subscribeProductsFromFirebase();
    subscribeOrdersFromFirebase();

    renderAll();
    resetProductForm();
  });
}

init();