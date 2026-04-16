if (!localStorage.getItem("userId")) {
  const uniqueId = "user_" + Date.now();
  localStorage.setItem("userId", uniqueId);
}

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { redirectWithToast, showToast } from "./ui.js";

let products = [];
let filteredProducts = [];
let currentCategory = "all";

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    products = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    filteredProducts = [...products];
    renderFeaturedProducts(products.filter((product) => product.featured));
    displayProducts(filteredProducts);
  } catch (err) {
    console.error("Error loading products:", err);
    const container = document.getElementById("products-container");
    if (container) {
      container.innerHTML = `<div class="product-empty-state">Failed to load products.</div>`;
    }
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function getProductCard(product) {
  const isFeatured = !!product.featured;
  const stock = Number(product.stock || 0);
  const image = product.images?.[0] || product.image || "";
  const outOfStock = stock <= 0 || product.status === "Out of Stock";

  return `
    <article class="product-card upgraded-product-card">
      <div class="product-image" onclick="goToDetails('${product.id}')">
        ${isFeatured ? `<span class="featured-chip">Featured</span>` : ""}
        <img src="${image}" alt="${product.name}" />
      </div>

      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-category-label">${product.category || "General"}</p>
        <p class="price">${formatCurrency(product.price)}</p>
        <p class="product-stock-label ${outOfStock ? "out" : ""}">
          ${outOfStock ? "Out of stock" : `${stock} in stock`}
        </p>

        <div class="product-card-actions">
          <button class="add-btn" onclick="addToCart('${product.id}')"
            ${outOfStock ? "disabled" : ""}>
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedProducts(featured) {
  const container = document.getElementById("featured-products-container");
  if (!container) return;

  if (!featured.length) {
    container.innerHTML = `<div class="product-empty-state">No featured products yet.</div>`;
    return;
  }

  container.innerHTML = featured.map(getProductCard).join("");
}

function displayProducts(list) {
  const container = document.getElementById("products-container");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="product-empty-state">No products found.</div>`;
    return;
  }

  container.innerHTML = list.map(getProductCard).join("");
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const stock = Number(product.stock || 0);
  if (stock <= 0 || product.status === "Out of Stock") {
    showToast("This product is out of stock.", { type: "error" });
    return;
  }

  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find((item) => item.id === productId && !item.variation);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0] || product.image || "",
      images: product.images || (product.image ? [product.image] : []),
      description: product.description || "",
      variation: null,
      quantity: 1,
      vendorId: product.vendorId || null
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  showToast("Added to cart.", { type: "success" });
  updateCartCount();
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const countElement = document.querySelector(".cart-count");
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  if (countElement) {
    countElement.innerText = totalItems;
  }
}

function applyFilters() {
  const searchValue = document.getElementById("search-input")?.value.toLowerCase().trim() || "";

  filteredProducts = products.filter((product) => {
    const matchesCategory =
      currentCategory === "all" || (product.category || "").toLowerCase() === currentCategory;

    const matchesSearch =
      !searchValue ||
      (product.name || "").toLowerCase().includes(searchValue) ||
      (product.category || "").toLowerCase().includes(searchValue);

    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

function searchProducts() {
  document.getElementById("search-input")?.addEventListener("input", applyFilters);
}

function filterCategory(category) {
  currentCategory = category.toLowerCase();
  applyFilters();
}

let currentProduct = null;
let currentImageIndex = 0;

function openLightbox(productId) {
  currentProduct = products.find((product) => product.id === productId);

  if (!currentProduct) return;

  const images = currentProduct.images?.length
    ? currentProduct.images
    : (currentProduct.image ? [currentProduct.image] : []);

  if (!images.length) return;

  currentImageIndex = 0;

  const lightbox = document.getElementById("lightbox");
  const img = document.querySelector(".lightbox-img");

  if (!lightbox || !img) return;

  lightbox.style.display = "flex";
  img.src = images[0];
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (lightbox) lightbox.style.display = "none";
}

function nextImage() {
  if (!currentProduct) return;

  const images = currentProduct.images?.length
    ? currentProduct.images
    : (currentProduct.image ? [currentProduct.image] : []);

  if (!images.length) return;

  currentImageIndex = (currentImageIndex + 1) % images.length;
  document.querySelector(".lightbox-img").src = images[currentImageIndex];
}

function prevImage() {
  if (!currentProduct) return;

  const images = currentProduct.images?.length
    ? currentProduct.images
    : (currentProduct.image ? [currentProduct.image] : []);

  if (!images.length) return;

  currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
  document.querySelector(".lightbox-img").src = images[currentImageIndex];
}

function goToDetails(productId) {
  localStorage.setItem("selectedProductId", productId);
  window.location.href = `product.html?id=${productId}`;
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "a") {
    const adminLink = document.getElementById("admin-link");
    if (adminLink) {
      adminLink.style.display = "block";
      showToast("Admin shortcut unlocked.", { type: "info" });
    }
  }
});

function logout() {
  localStorage.removeItem("user");
  redirectWithToast("login.html", "Logged out successfully.", { type: "success" });
}

loadProducts();
updateCartCount();
searchProducts();

window.addToCart = addToCart;
window.goToDetails = goToDetails;
window.filterCategory = filterCategory;
window.closeLightbox = closeLightbox;
window.nextImage = nextImage;
window.prevImage = prevImage;
window.openLightbox = openLightbox;
window.logout = logout;