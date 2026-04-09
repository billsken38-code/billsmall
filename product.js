import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSy...",
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

// 🔥 GET SELECTED PRODUCT INDEX
let index = localStorage.getItem("selectedProduct");

// 🔥 LOAD PRODUCTS FROM FIREBASE
async function loadProductDetails() {
  const snapshot = await getDocs(collection(db, "products"));

  products = [];

  snapshot.forEach(doc => {
    products.push(doc.data());
  });

  showProduct();
}

// 🔥 DISPLAY PRODUCT
function showProduct() {
  const container = document.getElementById("product-details");

  if (index === null || !products[index]) {
    container.innerHTML = "<p>Product not found</p>";
    return;
  }

  let product = products[index];

  // ✅ Handle images
  let images = product.images ? product.images : [product.image];

  // ✅ Create thumbnails
  const imagesHTML = images.map(img => `
    <img src="${img}" class="thumb" onclick="changeMainImage('${img}')">
  `).join("");

  container.innerHTML = `
    <div class="details-container">

      <!-- LEFT -->
      <div class="details-left">
        <img src="${images[0]}" id="main-image" class="details-img">

        <div class="thumbnail-container">
          ${imagesHTML}
        </div>
      </div>

      <!-- RIGHT -->
      <div class="details-right">
        <h2>${product.name}</h2>
        <p><strong>GHS ${product.price}</strong></p>

        <p class="details-description">
          ${product.description || "No description available"}
        </p>

        ${product.variations ? `
          <label>Select Option:</label>
          <div class="variation-container">
            ${product.variations.map(v => `
              <button class="variation-btn" onclick="selectVariation('${v}', this)">
                ${v}
              </button>
            `).join("")}
          </div>
        ` : ""}

        <br>

        <button onclick="addToCart(${index})">Add to Cart</button>
      </div>

    </div>
  `;
}

// 🔥 VARIATION
let selectedVariation = null;

function selectVariation(value, element) {
  selectedVariation = value;

  document.querySelectorAll(".variation-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  element.classList.add("active");
}

// 🔥 CHANGE IMAGE
function changeMainImage(src) {
  document.getElementById("main-image").src = src;
}

// 🔥 ADD TO CART
function addToCart(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  let product = products[index];

  // 🚨 Require variation if exists
  if (product.variations && !selectedVariation) {
    alert("Please select a variation!");
    return;
  }

  let existing = cart.find(item => 
    item.name === product.name && item.variation === selectedVariation
  );

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      name: product.name,
      price: product.price,
      images: product.images ? product.images : [product.image],
      description: product.description || "",
      variation: selectedVariation,
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  alert("Added to cart!");
}

// 🚀 LOAD PRODUCT ON PAGE LOAD
loadProductDetails();