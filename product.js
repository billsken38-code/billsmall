import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { showToast } from "./ui.js";

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
