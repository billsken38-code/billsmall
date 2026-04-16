import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { showToast } from "./ui.js";

const STORAGE_KEY = "vendor_dashboard_data_v2";
const COMMISSION_RATE = 0.05;
const DEFAULT_VENDOR_ID =
  localStorage.getItem("userId") || auth.currentUser?.uid || "vendor_demo_001";

const state = {
  vendorId: DEFAULT_VENDOR_ID,
  data: loadData(),
  currentSection: "dashboard"
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

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse vendor dashboard data:", err);
    }
  }

  const seeded = createSeedData(DEFAULT_VENDOR_ID);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function createSeedData(vendorId) {
  return {
    vendors: [
      {
        id: vendorId,
        storeName: "Vendor Studio",
        logoUrl: "",
        contactEmail: "",
        contactPhone: "",
        description: "Professional marketplace dashboard for your store."
      }
    ],
    products: [],
    orders: [],
    reviews: [],
    payouts: [],
    analytics: {
      salesHistory: []
    }
  };
}

async function loadProductsFromFirebase() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    state.data.products = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .filter((product) => product.vendorId === state.vendorId);

    saveData();
  } catch (err) {
    console.error("Failed to load vendor products from Firebase:", err);
    showToast(`Failed to load products: ${err.message}`, { type: "error" });
  }
}

function getAuthVendorDefaults() {
  const user = auth.currentUser;

  return {
    id: user?.uid || state.vendorId,
    storeName: user?.displayName || "Vendor Studio",
    logoUrl: user?.photoURL || "",
    contactEmail: user?.email || "",
    contactPhone: user?.phoneNumber || "",
    description: "Professional marketplace dashboard for your store."
  };
}

function getVendorProfile() {
  const authDefaults = getAuthVendorDefaults();
  let vendor = state.data.vendors.find((item) => item.id === state.vendorId);

  if (!vendor) {
    vendor = { ...authDefaults };
    state.data.vendors.push(vendor);
    saveData();
    return vendor;
  }

  const mergedVendor = {
    ...vendor,
    storeName: authDefaults.storeName || vendor.storeName,
    logoUrl: authDefaults.logoUrl || vendor.logoUrl,
    contactEmail: authDefaults.contactEmail || vendor.contactEmail,
    contactPhone: authDefaults.contactPhone || vendor.contactPhone,
    description: vendor.description || authDefaults.description
  };

  const index = state.data.vendors.findIndex((item) => item.id === state.vendorId);
  state.data.vendors[index] = mergedVendor;
  saveData();

  return mergedVendor;
}

function getVendorProducts() {
  return state.data.products.filter((item) => item.vendorId === state.vendorId);
}

function getVendorOrders() {
  return state.data.orders.filter((item) => item.vendorId === state.vendorId);
}

function getVendorReviews() {
  return state.data.reviews.filter((item) => item.vendorId === state.vendorId);
}

function getVendorPayouts() {
  return state.data.payouts.filter((item) => item.vendorId === state.vendorId);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(value || 0);
}

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

function renderStats() {
  const overview = calculateOverview();

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

  const vendor = getVendorProfile();
  elements.vendorStoreNameTop.textContent = vendor.storeName;
  elements.vendorUserIdTop.textContent = state.vendorId;
  elements.vendorUserAvatar.textContent = (vendor.storeName || "V").slice(0, 1).toUpperCase();
  elements.spotlightStoreName.textContent = vendor.storeName;
  elements.spotlightStoreDescription.textContent = vendor.description;
  elements.spotlightProducts.textContent = overview.activeProducts;
  elements.spotlightOrders.textContent = overview.openOrders;
  elements.spotlightRating.textContent = overview.averageRating.toFixed(1);
}

function renderSalesChart() {
  const history = state.data.analytics?.salesHistory || [];

  if (!history.length) {
    elements.salesChart.innerHTML = `
      <div class="empty-state">No sales chart data yet. Your chart will appear when new sales are recorded.</div>
    `;
    return;
  }

  const max = Math.max(...history.map((item) => item.sales), 1);

  elements.salesChart.innerHTML = history
    .map((item) => {
      const height = Math.max((item.sales / max) * 170, 20);
      return `
        <div class="sales-bar">
          <span class="sales-bar-value">${formatCurrency(item.sales)}</span>
          <div class="sales-bar-visual" style="height:${height}px"></div>
          <span class="sales-bar-label">${item.label}</span>
        </div>
      `;
    })
    .join("");
}

function getStatusClass(status) {
  return `status-${String(status).toLowerCase().replace(/\s+/g, "-")}`;
}

function renderProducts() {
  const products = getVendorProducts();

  if (!products.length) {
    elements.productList.innerHTML = `<div class="empty-state">No products yet. Add your first product to start selling.</div>`;
    return;
  }

  elements.productList.innerHTML = products
    .map(
      (product) => `
        <article class="vendor-table-card">
          <div class="vendor-table-top">
            <div class="vendor-table-title">
              <img class="vendor-table-image" src="${product.images?.[0] || product.image || ""}" alt="${product.name}">
              <div><h4>${product.name}</h4><p class="vendor-table-meta">${product.category}</p></div>
            </div>
            <span class="status-pill ${getStatusClass(product.status || "Draft")}">${product.status || "Draft"}</span>
          </div>
          <div class="vendor-table-details">
            <div><span>Price</span><strong>${formatCurrency(product.price)}</strong></div>
            <div><span>Stock</span><strong>${product.stock ?? 0}</strong></div>
            <div><span>Views</span><strong>${product.views || 0}</strong></div>
            <div><span>Sold</span><strong>${product.sold || 0}</strong></div>
          </div>
          <div class="vendor-table-actions">
            <button class="table-action-btn edit" data-edit-product="${product.id}">Edit</button>
            <button class="table-action-btn delete" data-delete-product="${product.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOrders() {
  const orders = getVendorOrders();

  if (!orders.length) {
    elements.orderList.innerHTML = `<div class="empty-state">No vendor orders yet. New orders will appear here.</div>`;
    return;
  }

  elements.orderList.innerHTML = orders
    .map(
      (order) => `
        <article class="vendor-table-card">
          <div class="vendor-table-top">
            <div><h4>${order.id}</h4><p class="vendor-table-meta">${order.productName}</p></div>
            <span class="status-pill ${getStatusClass(order.status)}">${order.status}</span>
          </div>
          <div class="vendor-table-details">
            <div><span>Customer</span><strong>${order.customerName}</strong></div>
            <div><span>Email</span><strong>${order.customerEmail}</strong></div>
            <div><span>Phone</span><strong>${order.customerPhone}</strong></div>
            <div><span>Date</span><strong>${order.date}</strong></div>
            <div><span>Quantity</span><strong>${order.quantity}</strong></div>
            <div><span>Total</span><strong>${formatCurrency(order.total)}</strong></div>
          </div>
          <div class="vendor-table-actions">
            <select class="table-select" data-order-status="${order.id}">
              ${["Pending", "Shipped", "Delivered"]
                .map(
                  (status) =>
                    `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`
                )
                .join("")}
            </select>
          </div>
        </article>
      `
    )
    .join("");
}

function renderEarningsHistory() {
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
            <div><h4>${payout.id}</h4><p class="vendor-table-meta">${payout.method}</p></div>
            <span class="status-pill ${getStatusClass(payout.status)}">${payout.status}</span>
          </div>
          <div class="vendor-table-details">
            <div><span>Date</span><strong>${payout.date}</strong></div>
            <div><span>Amount</span><strong>${formatCurrency(payout.amount)}</strong></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAnalytics() {
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

  document.getElementById("settings-store-name").value = vendor.storeName || "";
  document.getElementById("settings-logo-url").value = vendor.logoUrl || "";
  document.getElementById("settings-contact-email").value = vendor.contactEmail || "";
  document.getElementById("settings-contact-phone").value = vendor.contactPhone || "";
  document.getElementById("settings-description").value = vendor.description || "";

  document.getElementById("settings-store-name").readOnly = !!user?.displayName;
  document.getElementById("settings-logo-url").readOnly = !!user?.photoURL;
  document.getElementById("settings-contact-email").readOnly = !!user?.email;
  document.getElementById("settings-contact-phone").readOnly = !!user?.phoneNumber;

  elements.settingsStoreNamePreview.textContent = vendor.storeName || "Vendor Studio";
  elements.settingsDescriptionPreview.textContent =
    vendor.description || "Professional marketplace dashboard for your store.";
  elements.settingsEmailPreview.textContent = vendor.contactEmail || "No email found";
  elements.settingsPhonePreview.textContent = vendor.contactPhone || "No phone found";
  elements.settingsVendorIdPreview.textContent = state.vendorId;

  if (vendor.logoUrl) {
    elements.settingsLogoPreview.src = vendor.logoUrl;
    elements.settingsLogoPreview.style.display = "block";
  } else {
    elements.settingsLogoPreview.removeAttribute("src");
    elements.settingsLogoPreview.style.display = "none";
  }
}

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
    description: "Professional marketplace dashboard for your store."
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
        description:
          vendorData.description || "Professional marketplace dashboard for your store."
      };
    } else {
      await setDoc(vendorRef, loginProfile, { merge: true });
    }

    const existingIndex = state.data.vendors.findIndex((vendor) => vendor.id === user.uid);

    if (existingIndex >= 0) {
      state.data.vendors[existingIndex] = mergedProfile;
    } else {
      state.data.vendors.push(mergedProfile);
    }

    saveData();
  } catch (err) {
    console.error("Failed to sync vendor profile from Firebase login:", err);

    const existingIndex = state.data.vendors.findIndex((vendor) => vendor.id === user.uid);
    if (existingIndex >= 0) {
      state.data.vendors[existingIndex] = loginProfile;
    } else {
      state.data.vendors.push(loginProfile);
    }
    saveData();
  }
}

function resetProductForm() {
  elements.productForm.reset();
  document.getElementById("product-id").value = "";
  document.getElementById("product-status").value = "Active";
  elements.productFormTitle.textContent = "Add Product";
  uploadedProductImages = [];
  updateProductImagePreview([]);
}

function fillProductForm(productId) {
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
  elements.productFormTitle.textContent = "Edit Product";
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

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

async function upsertProduct(formData) {
  const payload = {
    vendorId: state.vendorId,
    name: formData.name,
    category: formData.category,
    price: formData.price,
    stock: formData.stock,
    image: formData.images[0] || "",
    images: formData.images,
    status: formData.status,
    description: formData.description,
    views: formData.views || 0,
    sold: formData.sold || 0
  };

  try {
    if (formData.id) {
      await updateDoc(doc(db, "products", formData.id), payload);
      showToast("Product updated successfully.", { type: "success" });
    } else {
      await addDoc(collection(db, "products"), payload);
      showToast("Product added successfully.", { type: "success" });
    }

    await loadProductsFromFirebase();
    resetProductForm();
    renderAll();
  } catch (err) {
    console.error("Failed to save product:", err);
    showToast(`Failed to save product: ${err.message}`, { type: "error" });
  }
}

async function deleteProduct(productId) {
  const target = getVendorProducts().find((product) => product.id === productId);
  if (!target) return;

  try {
    await deleteDoc(doc(db, "products", productId));
    await loadProductsFromFirebase();
    renderAll();
    showToast(`Removed ${target.name}.`, { type: "success" });
  } catch (err) {
    console.error("Failed to delete product:", err);
    showToast(`Failed to delete product: ${err.message}`, { type: "error" });
  }
}

function updateOrderStatus(orderId, status) {
  state.data.orders = state.data.orders.map((order) =>
    order.id === orderId ? { ...order, status } : order
  );
  saveData();
  renderAll();
  showToast(`Order ${orderId} marked ${status}.`, { type: "success" });
}

function saveSettings(payload) {
  const authDefaults = getAuthVendorDefaults();

  state.data.vendors = state.data.vendors.map((vendor) =>
    vendor.id === state.vendorId
      ? {
          ...vendor,
          ...payload,
          storeName: authDefaults.storeName || payload.storeName || vendor.storeName,
          contactEmail: authDefaults.contactEmail || payload.contactEmail || vendor.contactEmail,
          contactPhone: authDefaults.contactPhone || payload.contactPhone || vendor.contactPhone,
          logoUrl: authDefaults.logoUrl || payload.logoUrl || vendor.logoUrl
        }
      : vendor
  );

  saveData();
  renderAll();
  showToast("Vendor profile updated.", { type: "success" });
}

function renderAll() {
  renderStats();
  renderSalesChart();
  renderProducts();
  renderOrders();
  renderEarningsHistory();
  renderAnalytics();
  renderReviews();
  populateSettings();
}

function setSection(section) {
  state.currentSection = section;
  elements.pageTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);

  elements.navLinks.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  elements.sections.forEach((sectionEl) => {
    sectionEl.classList.toggle("active", sectionEl.id === `section-${section}`);
  });

  elements.sidebar.classList.remove("open");
}

function bindEvents() {
  elements.navLinks.forEach((button) => {
    button.addEventListener("click", () => setSection(button.dataset.section));
  });

  elements.menuBtn.addEventListener("click", () => {
    elements.sidebar.classList.toggle("open");
  });

  elements.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("product-name").value.trim();
    const category = document.getElementById("product-category").value.trim();
    const price = Number(document.getElementById("product-price").value);
    const stock = Number(document.getElementById("product-stock").value);
    const typedImages = elements.productImageInput.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const images = typedImages.length ? typedImages : uploadedProductImages;
    const status = document.getElementById("product-status").value;
    const description = document.getElementById("product-description").value.trim();
    const id = document.getElementById("product-id").value;
    const existing = id ? getVendorProducts().find((product) => product.id === id) : null;

    if (!name || !category || Number.isNaN(price) || Number.isNaN(stock)) {
      showToast("Name, category, price, and stock are required.", { type: "error" });
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
      views: existing?.views || 0,
      sold: existing?.sold || 0
    });
  });

  elements.resetProductFormBtn.addEventListener("click", resetProductForm);

  elements.productImageInput.addEventListener("input", (event) => {
    const values = event.target.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (values.length) {
      uploadedProductImages = values;
      updateProductImagePreview(values);
    } else if (!elements.productImageFileInput.files.length) {
      uploadedProductImages = [];
      updateProductImagePreview([]);
    }
  });

  elements.productImageFileInput.addEventListener("change", async (event) => {
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
      uploadedProductImages = await Promise.all(files.map((file) => readImageFile(file)));
      elements.productImageInput.value = "";
      updateProductImagePreview(uploadedProductImages);
      showToast(
        `${uploadedProductImages.length} image${uploadedProductImages.length > 1 ? "s" : ""} uploaded for this product.`,
        { type: "success" }
      );
    } catch (err) {
      console.error(err);
      showToast(err.message, { type: "error" });
    }
  });

  elements.productList.addEventListener("click", async (event) => {
    const editId = event.target.getAttribute("data-edit-product");
    const deleteId = event.target.getAttribute("data-delete-product");

    if (editId) fillProductForm(editId);
    if (deleteId) await deleteProduct(deleteId);
  });

  elements.orderList.addEventListener("change", (event) => {
    const orderId = event.target.getAttribute("data-order-status");
    if (!orderId) return;
    updateOrderStatus(orderId, event.target.value);
  });

  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

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

    saveSettings(payload);

    if (user) {
      try {
        await setDoc(doc(db, "vendors", user.uid), payload, { merge: true });
      } catch (err) {
        console.error("Failed to save vendor settings to Firebase:", err);
        showToast(`Failed to sync settings: ${err.message}`, { type: "error" });
      }
    }
  });
}

async function init() {
  bindEvents();
  await syncVendorProfileFromFirebaseLogin();
  await loadProductsFromFirebase();
  renderAll();
  resetProductForm();

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    await syncVendorProfileFromFirebaseLogin();
    await loadProductsFromFirebase();
    renderAll();
  });
}

init();
