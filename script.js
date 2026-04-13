// 🔐 CREATE USER ID
if (!localStorage.getItem("userId")) {
  const uniqueId = "user_" + Date.now();
  localStorage.setItem("userId", uniqueId);
}

// 🔥 FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 GLOBAL PRODUCTS
let products = [];

// ================= LOAD PRODUCTS =================
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));

    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    displayProducts(products);

  } catch (err) {
    console.error("Error loading products:", err);
  }
}

// ================= DISPLAY PRODUCTS =================
function displayProducts(list) {
  const container = document.getElementById("products-container");
  container.innerHTML = "";

  list.forEach(product => {
    const div = document.createElement("div");
    div.classList.add("product");
div.innerHTML = `
  <div class="product-card">
    
    <div class="product-image" onclick="goToDetails('${product.id}')">
      <img src="${product.images?.[0] || product.image}" />
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

// ================= CART =================
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  const existing = cart.find(item => item.id === productId);

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

  showToast("Added to cart 🛒");
  updateCartCount();
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  // Reset first (this is the fix)
  toast.classList.remove("show");

  // Force reflow (important trick)
  void toast.offsetWidth;

  // Set new message
  toast.innerText = message;

  // Show again
  toast.classList.add("show");

  // Auto hide
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// ================= CART COUNT =================
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const countElement = document.querySelector(".cart-count");

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  if (countElement) {
    countElement.innerText = totalItems;
  }
}
// ================= SEARCH =================
function searchProducts() {
document.getElementById("search-input")
  .addEventListener("input", function () {
    const input = this.value.toLowerCase();

    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(input)
    );

    displayProducts(filtered);
  });
}

// ================= CATEGORY FILTER =================
function filterCategory(category) {
  if (category === "all") {
    displayProducts(products);
  } else {
    displayProducts(products.filter(p => p.category === category));
  }
}

// ================= LIGHTBOX =================
let currentProduct = null;
let currentImageIndex = 0;

function openLightbox(productId) {
  currentProduct = products.find(p => p.id === productId);

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

  currentImageIndex =
    (currentImageIndex + 1) % currentProduct.images.length;

  document.querySelector(".lightbox-img").src =
    currentProduct.images[currentImageIndex];
}

function prevImage() {
  if (!currentProduct?.images) return;

  currentImageIndex =
    (currentImageIndex - 1 + currentProduct.images.length) %
    currentProduct.images.length;

  document.querySelector(".lightbox-img").src =
    currentProduct.images[currentImageIndex];
}

// ================= PRODUCT DETAILS =================
function goToDetails(productId) {
  localStorage.setItem("selectedProductId", productId);
  window.location.href = "product.html";
}


// ================= ADMIN SHORTCUT =================
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "a") {
    const adminLink = document.getElementById("admin-link");
    if (adminLink) {
      adminLink.style.display = "block";
      alert("Admin unlocked!");
    }
  }
});
// ================= LOGOUT =================
function logout() {
  // Remove only user session (recommended)
  localStorage.removeItem("user");

  // Optional: clear everything
  // localStorage.clear();

  alert("Logged out successfully");

  // Redirect to login page
  window.location.href = "login.html";
}

// Make it accessible to HTML onclick


// ================= INIT =================
loadProducts();
updateCartCount();

// GLOBAL EXPORTS
window.addToCart = addToCart;
window.goToDetails = goToDetails;
window.searchProducts = searchProducts;
window.filterCategory = filterCategory;
window.closeLightbox = closeLightbox;
window.nextImage = nextImage;
window.prevImage = prevImage;
window.logout = logout;