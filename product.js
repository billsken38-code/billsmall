import {
  doc,
  getDoc
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
let loginPromptTimeoutId = null;

const elements = {
  loginCtaButton: document.getElementById("login-cta-button"),
  loginCallout: document.getElementById("login-callout")
};

function isLoggedIn() {
  return !!(currentUser || localStorage.getItem("userId"));
}

function updateGuestAccessUi() {
  if (elements.loginCtaButton) {
    elements.loginCtaButton.hidden = isLoggedIn();
  }
}

function hideLoginPrompt() {
  if (!elements.loginCallout) return;

  elements.loginCallout.hidden = true;
  elements.loginCallout.classList.remove("show");

  if (loginPromptTimeoutId) {
    window.clearTimeout(loginPromptTimeoutId);
    loginPromptTimeoutId = null;
  }
}

function showLoginPrompt() {
  if (!elements.loginCallout || !elements.loginCtaButton) {
    showToast("Please log in first to add products.", { type: "info" });
    return;
  }

  const buttonRect = elements.loginCtaButton.getBoundingClientRect();
  const calloutWidth = Math.min(320, Math.max(220, window.innerWidth - 24));
  const left = Math.min(
    window.innerWidth - calloutWidth - 12,
    Math.max(12, buttonRect.right - calloutWidth)
  );
  const top = buttonRect.bottom + 14;
  const arrowLeft = Math.min(
    calloutWidth - 28,
    Math.max(28, buttonRect.left + buttonRect.width / 2 - left)
  );

  elements.loginCallout.style.width = `${calloutWidth}px`;
  elements.loginCallout.style.left = `${left}px`;
  elements.loginCallout.style.top = `${top}px`;
  elements.loginCallout.style.setProperty("--login-callout-arrow-left", `${arrowLeft}px`);
  elements.loginCallout.hidden = false;

  window.requestAnimationFrame(() => {
    elements.loginCallout.classList.add("show");
  });

  elements.loginCtaButton.classList.add("login-cta-highlight");
  window.setTimeout(() => {
    elements.loginCtaButton?.classList.remove("login-cta-highlight");
  }, 1800);

  if (loginPromptTimeoutId) {
    window.clearTimeout(loginPromptTimeoutId);
  }

  loginPromptTimeoutId = window.setTimeout(() => {
    hideLoginPrompt();
  }, 3800);
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
    const images = product.images?.length
      ? product.images
      : (product.image ? [product.image] : []);

    currentImage = images[0] || "";
    renderProduct();
    bindProductEvents();
    
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

function renderProduct() {
  const container = document.getElementById("product-details");
  const images = product.images?.length
    ? product.images
    : (product.image ? [product.image] : []);
  const variations = Array.isArray(product.variations) ? product.variations : [];
  const stock = Number(product.stock || 0);
  const isOutOfStock = stock <= 0 || product.status === "Out of Stock";

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
        <h2>${product.name}</h2>
        <p><b>${formatCurrency(product.price)}</b></p>
        <p>${product.description || ""}</p>
        <p><b>Stock:</b> ${stock}</p>

        ${
          variations.length
            ? `
              <div class="variation-box">
                ${variations
                  .map(
                    (v) => `
                      <button type="button" data-variation="${v}">
                        ${v}
                      </button>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }

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
  elements.loginCtaButton?.addEventListener("click", hideLoginPrompt);

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

function addToCart() {
  if (!isLoggedIn()) {
    showLoginPrompt();
    return;
  }

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
      vendorId: product.vendorId || null
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  showToast("Added to cart!", { type: "success" });
}

function buyNow() {
  if (!isLoggedIn()) {
    showLoginPrompt();
    return;
  }

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
  hideLoginPrompt();
  updateGuestAccessUi();
});

window.addEventListener("resize", hideLoginPrompt);
window.addEventListener("scroll", hideLoginPrompt, { passive: true });

updateGuestAccessUi();
loadProduct();
