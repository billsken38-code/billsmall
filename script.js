// 🔥 FIREBASE IMPORTS
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const db = getFirestore();

// 🔥 GLOBAL PRODUCTS ARRAY
let products = [];

// 🔥 LOAD PRODUCTS FROM FIREBASE
async function loadProducts() {
  const snapshot = await getDocs(collection(db, "products"));

  products = [];

  snapshot.forEach(doc => {
    products.push(doc.data());
  });

  displayProducts(products);
}

// 🔥 DISPLAY PRODUCTS
function displayProducts(list) {
  const productContainer = document.getElementById("products-container");
  productContainer.innerHTML = "";

  list.forEach((product, index) => {
    let div = document.createElement("div");
    div.classList.add("product");

    div.innerHTML = `
      <div onclick="goToDetails(${index})" style="cursor:pointer;">
        <img src="${product.images ? product.images[0] : product.image}" class="main-img" alt="${product.name}">
        <h4>${product.name}</h4>
        <p>GHS ${product.price}</p>
        <p>${product.description || ""}</p>
      </div>

      <button onclick="addToCart(${index})">Add to Cart</button>
    `;

    productContainer.appendChild(div);
  });
}

// 🔥 CART SYSTEM
function addToCart(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  let product = products[index];

  let existing = cart.find(item => item.name === product.name);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      name: product.name,
      price: product.price,
      images: product.images ? product.images : [product.image],
      description: product.description || "",
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  alert("Added to cart!");
  updateCartCount();
}

// 🔥 UPDATE CART COUNT
function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartBtn = document.querySelector(".cart-btn");

  let totalItems = cart.reduce((sum, item) => {
    return sum + (item.quantity || 1);
  }, 0);

  if (cartBtn) {
    cartBtn.innerText = "Cart 🛒 (" + totalItems + ")";
  }
}

updateCartCount();

// 🔥 SEARCH PRODUCTS
function searchProducts() {
  const input = document.getElementById("search-input").value.toLowerCase();

  const filtered = products.filter(product =>
    product.name.toLowerCase().includes(input) ||
    (product.category && product.category.toLowerCase().includes(input))
  );

  displayProducts(filtered);
}

// 🔥 FILTER CATEGORY
function filterCategory(category) {
  if (category === "all") {
    displayProducts(products);
  } else {
    const filtered = products.filter(product => product.category === category);
    displayProducts(filtered);
  }
}

// 🔥 LIGHTBOX
let currentProductIndex = 0;
let currentImageIndex = 0;

function openLightbox(productIndex) {
  currentProductIndex = productIndex;
  currentImageIndex = 0;

  const lb = document.getElementById("lightbox");
  lb.style.display = "flex";

  const product = products[productIndex];
  document.querySelector(".lightbox-img").src =
    product.images ? product.images[0] : product.image;
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

function nextImage() {
  const product = products[currentProductIndex];

  if (!product.images) return;

  currentImageIndex = (currentImageIndex + 1) % product.images.length;
  document.querySelector(".lightbox-img").src = product.images[currentImageIndex];
}

function prevImage() {
  const product = products[currentProductIndex];

  if (!product.images) return;

  currentImageIndex = (currentImageIndex - 1 + product.images.length) % product.images.length;
  document.querySelector(".lightbox-img").src = product.images[currentImageIndex];
}

// 🔥 GO TO DETAILS PAGE
function goToDetails(index) {
  localStorage.setItem("selectedProduct", index);
  window.location.href = "product.html";
}

// 🔥 ADMIN SHORTCUT
document.addEventListener("keydown", function(e) {
  if (e.ctrlKey && e.key === "a") {
    document.getElementById("admin-link").style.display = "block";
    alert("Admin link unlocked!");
  }
});

// 🚀 LOAD PRODUCTS ON PAGE LOAD
loadProducts();
window.addToCart = addToCart;
window.goToDetails = goToDetails;
window.searchProducts = searchProducts;
window.filterCategory = filterCategory;