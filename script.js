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

    products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });

    displayProducts(products);

  } catch (err) {
    console.error("Error loading products:", err);
  }
}

// ================= DISPLAY =================
function displayProducts(list) {
  const container = document.getElementById("products-container");
  container.innerHTML = "";

  list.forEach(product => {
    let div = document.createElement("div");
    div.classList.add("product");

    div.innerHTML = `
      <div onclick="goToDetails('${product.id}')" style="cursor:pointer;">
        <img src="${product.images ? product.images[0] : product.image}">
        <h4>${product.name}</h4>
        <p>GHS ${product.price}</p>
        <p>${product.description || ""}</p>
      </div>

      <button onclick="addToCart('${product.id}')">Add to Cart</button>
    `;

    container.appendChild(div);
  });
}

// ================= CART =================
function addToCart(productId) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  let product = products.find(p => p.id === productId);

  let existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      id: productId,
      name: product.name,
      price: product.price,
      images: product.images || [product.image],
      description: product.description || "",
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  alert("Added to cart!");
  updateCartCount();
}

// ================= CART COUNT =================
function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartBtn = document.querySelector(".cart-btn");

  let totalItems = cart.reduce((sum, item) => {
    return sum + (item.quantity || 1);
  }, 0);

  if (cartBtn) {
    cartBtn.innerText = `Cart 🛒 (${totalItems})`;
  }
}

updateCartCount();

// ================= SEARCH =================
function searchProducts() {
  const input = document.getElementById("search-input").value.toLowerCase();

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(input) ||
    (p.category && p.category.toLowerCase().includes(input))
  );

  displayProducts(filtered);
}

// ================= CATEGORY =================
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
  currentImageIndex = 0;

  document.getElementById("lightbox").style.display = "flex";
  document.querySelector(".lightbox-img").src = currentProduct.images[0];
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

function nextImage() {
  if (!currentProduct.images) return;

  currentImageIndex = (currentImageIndex + 1) % currentProduct.images.length;
  document.querySelector(".lightbox-img").src = currentProduct.images[currentImageIndex];
}

function prevImage() {
  if (!currentProduct.images) return;

  currentImageIndex =
    (currentImageIndex - 1 + currentProduct.images.length) %
    currentProduct.images.length;

  document.querySelector(".lightbox-img").src = currentProduct.images[currentImageIndex];
}

// ================= DETAILS =================
function goToDetails(productId) {
  localStorage.setItem("selectedProduct", productId);
  window.location.href = "product.html";
}

// ================= ADMIN SHORTCUT =================
document.addEventListener("keydown", function(e) {
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
  localStorage.removeItem("userId");
  window.location.href = "login.html";
}

// ================= INIT =================
loadProducts();

// GLOBAL
window.addToCart = addToCart;
window.goToDetails = goToDetails;
window.searchProducts = searchProducts;
window.filterCategory = filterCategory;
window.closeLightbox = closeLightbox;
window.nextImage = nextImage;
window.prevImage = prevImage;