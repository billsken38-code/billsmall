import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { showToast } from "./ui.js";
import { WHATSAPP_POOL } from "./whatsapp-pool.js";
import { initReviews } from "./reviews.js";

let product = null;
let selectedVariation = null;
let currentImage = "";
let currentUser = null;
let relatedProducts = [];

function isLoggedIn() {
  return !!(currentUser || localStorage.getItem("userId"));
}


async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const productId =
    params.get("id") || localStorage.getItem("selectedProductId");

  if (!productId) {
    document.getElementById("product-details").innerHTML =
      `<div class="product-page-empty">No product selected.</div>`;
    return;
  }

  try {
    const docRef = doc(db, "products", productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      document.getElementById("product-details").innerHTML =
        `<div class="product-page-empty">Product not found.</div>`;
      return;
    }

    product = { id: docSnap.id, ...docSnap.data() };
    const images = getProductImages(product);

    currentImage = images[0] || "";
    renderProduct();
    bindProductEvents();
    await loadRelatedProducts();

    // Initialize reviews for this product
    initReviews(product.id, currentUser);
  } catch (error) {
    console.error(error);
    document.getElementById("product-details").innerHTML =
      `<div class="product-page-empty">Failed to load product.</div>`;
  }
}

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

function getProductImages(item) {
  if (Array.isArray(item?.images) && item.images.length) {
    return item.images;
  }

  if (item?.image) {
    return [item.image];
  }

  return [];
}

function getPrimaryImage(item) {
  return getProductImages(item)[0] || "";
}

function renderProduct() {
  const container = document.getElementById("product-details");
  const images = getProductImages(product);
  const variations = Array.isArray(product.variations) ? product.variations : [];
  const stock = Number(product.stock || 0);
  const isOutOfStock = stock <= 0 || product.status === "Out of Stock";
  const category = product.category || "General";

  container.innerHTML = `
    <div class="details-container">
      <div class="details-left">
        <img id="main-image" src="${currentImage}" alt="${product.name}" />

        <div class="thumb-row">
          ${images
            .map(
              (img, index) => `
                <button type="button" class="thumb-btn ${index === 0 ? "active" : ""}" data-image="${img}">
                  <img src="${img}" class="thumb" alt="Thumbnail ${index + 1}">
                </button>
              `
            )
            .join("")}
        </div>
      </div>

      <div class="details-right">
        ${product.featured ? `<div class="notice">Featured Product</div>` : ""}
        <p class="product-page-kicker">${escapeHtml(category)}</p>
        <h2>${product.name}</h2>
        <p class="product-page-price">${formatCurrency(product.price)}</p>
        <div class="product-meta-grid">
          <div>
            <span>Availability</span>
            <strong>${isOutOfStock ? "Out of stock" : `${stock} available`}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>MoMo / Delivery</strong>
          </div>
          <div>
            <span>Delivery</span>
            <strong>Campus & local routes</strong>
          </div>
          <div>
            <span>Support</span>
            <strong>WhatsApp assistance</strong>
          </div>
        </div>
        <p class="product-description">${product.description || "No product description yet."}</p>

        ${
          variations.length
            ? `
              <div class="variation-box variation-section">
                <h4>Choose an option</h4>
                ${variations
                  .map(
                    (v) => `
                      <button type="button" data-variation="${escapeHtml(v)}" class="variation-option">
                        ${escapeHtml(v)}
                      </button>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        <div class="product-trust-panel">
          <div class="product-trust-item">
            <strong>Buyer confidence</strong>
            <span>Tracked orders, managed vendor access, and admin support all in one marketplace.</span>
          </div>
          <div class="product-trust-item">
            <strong>Before you buy</strong>
            <span>Use chat support to confirm stock, sizing, delivery route, and payment details.</span>
          </div>
        </div>

        <div class="product-action-row">
          <button class="add-btn" id="add-to-cart-btn" ${isOutOfStock ? "disabled" : ""}>
            Add to Cart
          </button>
          <button class="buy-now-btn" id="buy-now-btn" ${isOutOfStock ? "disabled" : ""}>
            Buy Now
          </button>
          <a href="${WHATSAPP_POOL.getChatUrl(`Hi, I'm interested in: ${product.name} - ${formatCurrency(product.price)}`)}" 
             class="whatsapp-inquire-btn" 
             target="_blank" 
             rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Ask on WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;
}

function bindProductEvents() {
  document.querySelectorAll("[data-image]").forEach((button) => {
    button.addEventListener("click", () => {
      currentImage = button.dataset.image;
      document.getElementById("main-image").src = currentImage;

      document.querySelectorAll(".thumb-btn").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.querySelectorAll("[data-variation]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedVariation = button.dataset.variation;

      document
        .querySelectorAll("[data-variation]")
        .forEach((btn) => btn.classList.remove("active"));

      button.classList.add("active");
    });
  });

  document.getElementById("add-to-cart-btn")?.addEventListener("click", addToCart);
  document.getElementById("buy-now-btn")?.addEventListener("click", buyNow);
}

function renderRelatedProducts() {
  const container = document.getElementById("related-products");
  if (!container) return;

  if (!relatedProducts.length) {
    container.innerHTML = `<div class="product-page-empty">More products from this category will appear here.</div>`;
    return;
  }

  container.innerHTML = relatedProducts.map((item) => {
    const outOfStock = Number(item.stock || 0) <= 0 || item.status === "Out of Stock";

    return `
      <article class="product-card upgraded-product-card">
        <div class="product-image" onclick="goToProductDetails('${item.id}')">
          ${item.featured ? `<span class="featured-chip">Featured</span>` : ""}
          <img src="${getPrimaryImage(item)}" alt="${escapeHtml(item.name || "Product")}" />
        </div>
        <div class="product-info">
          <h3>${escapeHtml(item.name || "Unnamed Product")}</h3>
          <p class="product-category-label">${escapeHtml(item.category || "General")}</p>
          <p class="price">${formatCurrency(item.price)}</p>
          <p class="product-stock-label ${outOfStock ? "out" : ""}">
            ${outOfStock ? "Out of stock" : `${Number(item.stock || 0)} in stock`}
          </p>
          <div class="product-card-actions">
            <button type="button" class="quick-view-btn" onclick="goToProductDetails('${item.id}')">View</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadRelatedProducts() {
  if (!product?.category) {
    relatedProducts = [];
    renderRelatedProducts();
    return;
  }

  try {
    const snap = await getDocs(collection(db, "products"));
    relatedProducts = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .filter((item) => item.id !== product.id)
      .filter((item) => String(item.category || "").toLowerCase() === String(product.category || "").toLowerCase())
      .slice(0, 4);
  } catch (error) {
    console.error("Failed to load related products:", error);
    relatedProducts = [];
  }

  renderRelatedProducts();
}

function addToCart() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (product.variations?.length && !selectedVariation) {
    showToast("Select a variation.", { type: "error" });
    return;
  }

  const stock = Number(product.stock || 0);
  if (stock <= 0 || product.status === "Out of Stock") {
    showToast("This product is out of stock.", { type: "error" });
    return;
  }

  const existing = cart.find(
    (i) => i.id === product.id && i.variation === selectedVariation
  );

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: currentImage || product.images?.[0] || product.image || "",
      images: product.images || [],
      variation: selectedVariation,
      quantity: 1,
      vendorId: product.vendorId || null,
      vendorLocation: product.vendorLocation || ""
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  showToast("Added to cart!", { type: "success" });
}

function buyNow() {
  if (product.variations?.length && !selectedVariation) {
    showToast("Select a variation.", { type: "error" });
    return;
  }

  const stock = Number(product.stock || 0);
  if (stock <= 0 || product.status === "Out of Stock") {
    showToast("This product is out of stock.", { type: "error" });
    return;
  }

  addToCart();
  window.location.href = "cart.html";
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});
loadProduct();

window.goToProductDetails = function (productId) {
  if (!productId) return;
  localStorage.setItem("selectedProductId", productId);
  window.location.href = `product.html?id=${productId}`;
};
