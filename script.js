if (!localStorage.getItem("userId")) {
  const uniqueId = "user_" + Date.now();
  localStorage.setItem("userId", uniqueId);
}

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { redirectWithToast, showToast } from "./ui.js";

let products = [];

async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    products = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    displayProducts(products);
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

function displayProducts(list) {
  const container = document.getElementById("products-container");
  if (!container) return;

  container.innerHTML = "";

  list.forEach((product) => {
    const div = document.createElement("div");
    div.classList.add("product");
    div.innerHTML = `
      <div class="product-card">
        <div class="product-image" onclick="goToDetails('${product.id}')">
          <img src="${product.images?.[0] || product.image || ""}" />
        </div>
        <div class="product-info">
          <h3>${product.name}</h3>
          <p class="price">GHS ${product.price}</p>
          <button class="add-btn" onclick="addToCart('${product.id}')">
            Add to Cart
          </button>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find((item) => item.id === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      images: product.images || [product.image],
      description: product.description || "",
      quantity: 1
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

function searchProducts() {
  document.getElementById("search-input")?.addEventListener("input", function () {
    const input = this.value.toLowerCase();
    const filtered = products.filter((product) =>
      product.name.toLowerCase().includes(input)
    );

    displayProducts(filtered);
  });
}

function filterCategory(category) {
  if (category === "all") {
    displayProducts(products);
  } else {
    displayProducts(products.filter((product) => product.category === category));
  }
}

let currentProduct = null;
let currentImageIndex = 0;

function openLightbox(productId) {
  currentProduct = products.find((product) => product.id === productId);

  if (!currentProduct || !currentProduct.images) return;

  currentImageIndex = 0;

  const lightbox = document.getElementById("lightbox");
  const img = document.querySelector(".lightbox-img");

  if (!lightbox || !img) return;

  lightbox.style.display = "flex";
  img.src = currentProduct.images[0];
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (lightbox) lightbox.style.display = "none";
}

function nextImage() {
  if (!currentProduct?.images) return;

  currentImageIndex = (currentImageIndex + 1) % currentProduct.images.length;
  document.querySelector(".lightbox-img").src = currentProduct.images[currentImageIndex];
}

function prevImage() {
  if (!currentProduct?.images) return;

  currentImageIndex =
    (currentImageIndex - 1 + currentProduct.images.length) % currentProduct.images.length;

  document.querySelector(".lightbox-img").src = currentProduct.images[currentImageIndex];
}

function goToDetails(productId) {
  localStorage.setItem("selectedProductId", productId);
  window.location.href = "product.html";
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
window.searchProducts = searchProducts;
window.filterCategory = filterCategory;
window.closeLightbox = closeLightbox;
window.nextImage = nextImage;
window.prevImage = prevImage;
window.openLightbox = openLightbox;
window.logout = logout;
