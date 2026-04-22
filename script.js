import {
  collection,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { redirectWithToast, showToast } from "./ui.js";

const CATEGORY_OPTIONS = [
  "All",
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

const state = {
  products: [],
  filteredProducts: [],
  currentCategory: "All",
  unsubscribeProducts: null,
  currentProduct: null,
  currentImageIndex: 0,
  authReady: false
};

const elements = {
  searchInput: document.getElementById("search-input"),
  productsContainer: document.getElementById("products-container"),
  featuredProductsContainer: document.getElementById("featured-products-container"),
  cartCount: document.querySelector(".cart-count"),
  adminLink: document.getElementById("admin-link"),
  lightbox: document.getElementById("lightbox"),
  lightboxImage: document.querySelector(".lightbox-img"),
  categoryBar: document.querySelector(".category-bar")
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function getProductImages(product) {
  if (Array.isArray(product.images) && product.images.length) {
    return product.images;
  }

  if (product.image) {
    return [product.image];
  }

  return [];
}

function getPrimaryImage(product) {
  return getProductImages(product)[0] || "";
}

function isOutOfStock(product) {
  const stock = Number(product.stock || 0);
  return stock <= 0 || product.status === "Out of Stock";
}

function renderCategoryBar() {
  if (!elements.categoryBar) return;

  elements.categoryBar.innerHTML = CATEGORY_OPTIONS.map((category) => {
    const isActive = category === state.currentCategory;
    const filterValue = category === "All" ? "all" : category;

    return `
      <button
        type="button"
        class="category-card ${isActive ? "active" : ""}"
        data-category="${escapeHtml(filterValue)}"
      >
        ${escapeHtml(category)}
      </button>
    `;
  }).join("");
}

function getProductCard(product) {
  const image = getPrimaryImage(product);
  const stock = Number(product.stock || 0);
  const outOfStock = isOutOfStock(product);
  const isFeatured = !!product.featured;

  return `
    <article class="product-card upgraded-product-card">
      <div class="product-image" onclick="goToDetails('${product.id}')">
        ${isFeatured ? `<span class="featured-chip">Featured</span>` : ""}
        <img src="${image}" alt="${escapeHtml(product.name || "Product")}" />
      </div>

      <div class="product-info">
        <h3>${escapeHtml(product.name || "Unnamed Product")}</h3>
        <p class="product-category-label">${escapeHtml(product.category || "General")}</p>
        <p class="price">${formatCurrency(product.price)}</p>
        <p class="product-stock-label ${outOfStock ? "out" : ""}">
          ${outOfStock ? "Out of stock" : `${stock} in stock`}
        </p>

        <div class="product-card-actions">
          <button class="add-btn" onclick="addToCart('${product.id}')" ${outOfStock ? "disabled" : ""}>
            Add to Cart
          </button>
          <button class="quick-view-btn" onclick="goToDetails('${product.id}')">
            View
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedProducts() {
  if (!elements.featuredProductsContainer) return;

  const featured = state.products.filter(
    (product) => product.featured && !isOutOfStock(product)
  );

  if (!featured.length) {
    elements.featuredProductsContainer.innerHTML = `
      <div class="product-empty-state">No featured products yet.</div>
    `;
    return;
  }

  elements.featuredProductsContainer.innerHTML = featured.map(getProductCard).join("");
}

function displayProducts(list) {
  if (!elements.productsContainer) return;

  if (!list.length) {
    elements.productsContainer.innerHTML = `
      <div class="product-empty-state">No products found.</div>
    `;
    return;
  }

  elements.productsContainer.innerHTML = list.map(getProductCard).join("");
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  if (elements.cartCount) {
    elements.cartCount.textContent = totalItems;
  }
}

function applyFilters() {
  const searchValue = String(elements.searchInput?.value || "").trim().toLowerCase();

  state.filteredProducts = state.products.filter((product) => {
    const productCategory = product.category || "";
    const matchesCategory =
      state.currentCategory === "All" ||
      normalizeCategory(productCategory) === normalizeCategory(state.currentCategory);

    const matchesSearch =
      !searchValue ||
      String(product.name || "").toLowerCase().includes(searchValue) ||
      String(productCategory).toLowerCase().includes(searchValue) ||
      String(product.description || "").toLowerCase().includes(searchValue);

    return matchesCategory && matchesSearch;
  });

  displayProducts(state.filteredProducts);
  renderCategoryBar();
}

function filterCategory(category) {
  state.currentCategory = category === "all" ? "All" : String(category || "All");
  applyFilters();
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  if (isOutOfStock(product)) {
    showToast("This product is out of stock.", { type: "error" });
    return;
  }

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const existing = cart.find((item) => item.id === productId && !item.variation);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: getPrimaryImage(product),
      images: getProductImages(product),
      description: product.description || "",
      variation: null,
      quantity: 1,
      vendorId: product.vendorId || null,
      stock: Number(product.stock || 0),
      category: product.category || ""
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  showToast("Added to cart.", { type: "success" });
  updateCartCount();
}

function goToDetails(productId) {
  localStorage.setItem("selectedProductId", productId);
  window.location.href = `product.html?id=${productId}`;
}

function openLightbox(productId) {
  state.currentProduct = state.products.find((product) => product.id === productId) || null;
  if (!state.currentProduct) return;

  const images = getProductImages(state.currentProduct);
  if (!images.length || !elements.lightbox || !elements.lightboxImage) return;

  state.currentImageIndex = 0;
  elements.lightbox.style.display = "flex";
  elements.lightboxImage.src = images[0];
}

function closeLightbox() {
  if (elements.lightbox) {
    elements.lightbox.style.display = "none";
  }
}

function nextImage() {
  if (!state.currentProduct || !elements.lightboxImage) return;

  const images = getProductImages(state.currentProduct);
  if (!images.length) return;

  state.currentImageIndex = (state.currentImageIndex + 1) % images.length;
  elements.lightboxImage.src = images[state.currentImageIndex];
}

function prevImage() {
  if (!state.currentProduct || !elements.lightboxImage) return;

  const images = getProductImages(state.currentProduct);
  if (!images.length) return;

  state.currentImageIndex = (state.currentImageIndex - 1 + images.length) % images.length;
  elements.lightboxImage.src = images[state.currentImageIndex];
}

function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  redirectWithToast("login.html", "Logged out successfully.", { type: "success" });
}

function revealAdminLink() {
  if (elements.adminLink) {
    elements.adminLink.style.display = "block";
  }
}

function bindEvents() {
  elements.searchInput?.addEventListener("input", applyFilters);

  elements.categoryBar?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    const category = button.getAttribute("data-category");
    filterCategory(category || "all");
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "a") {
      revealAdminLink();
      showToast("Admin shortcut unlocked.", { type: "info" });
    }
  });
}

function subscribeProducts() {
  if (state.unsubscribeProducts) {
    state.unsubscribeProducts();
  }

  const productsQuery = query(
    collection(db, "products"),
    where("status", "in", ["Active", "Out of Stock"])
  );

  state.unsubscribeProducts = onSnapshot(
    productsQuery,
    (snapshot) => {
      state.products = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      renderFeaturedProducts();
      applyFilters();
      updateCartCount();
    },
    (err) => {
      console.error("Error loading products:", err);
      if (elements.productsContainer) {
        elements.productsContainer.innerHTML = `
          <div class="product-empty-state">Failed to load products.</div>
        `;
      }
    }
  );
}

function initAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    state.authReady = true;

    if (!user && !localStorage.getItem("userId")) {
      window.location.href = "login.html";
      return;
    }

    if (user?.email) {
      const adminEmails = [
        "admin@billsmall.com"
      ];

      if (adminEmails.includes(user.email.toLowerCase())) {
        revealAdminLink();
      }
    }
  });
}

function setupCategoryMobileToggle() {
  const toggleBtn = document.getElementById("category-toggle-btn");
  const categoryBar = document.getElementById("category-bar");

  if (!toggleBtn || !categoryBar) return;

  toggleBtn.addEventListener("click", () => {
    categoryBar.classList.toggle("open");
  });

  categoryBar.addEventListener("click", (event) => {
    const clickedCategory = event.target.closest(".category-card");
    if (!clickedCategory) return;

    if (window.innerWidth <= 768) {
      categoryBar.classList.remove("open");
    }
  });
}

function init() {
  renderCategoryBar();
  bindEvents();
  subscribeProducts();
  updateCartCount();
  initAuthGuard();
  setupCategoryMobileToggle();
}

init();

window.addToCart = addToCart;
window.goToDetails = goToDetails;
window.filterCategory = filterCategory;
window.closeLightbox = closeLightbox;
window.nextImage = nextImage;
window.prevImage = prevImage;
window.openLightbox = openLightbox;
window.logout = logout;
