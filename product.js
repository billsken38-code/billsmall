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

import { app, auth,db } from "./firebase.js";

let product = null;
let selectedVariation = null;

async function loadProduct() {
  const productId = localStorage.getItem("selectedProductId");

  if (!productId) {
    document.getElementById("product-details").innerHTML =
      "<h2>No product selected</h2>";
    return;
  }

  const snapshot = await getDocs(collection(db, "products"));

  snapshot.forEach(docSnap => {
    if (docSnap.id === productId) {
      product = { id: docSnap.id, ...docSnap.data() };
    }
  });

  if (!product) {
    document.getElementById("product-details").innerHTML =
      "<h2>Product not found</h2>";
    return;
  }

  renderProduct();
}

function renderProduct() {
  const container = document.getElementById("product-details");

  const images = product.images?.length ? product.images : [];

  container.innerHTML = `
    <div class="details-container">

      <!-- LEFT SIDE -->
      <div class="details-left">
        <img id="main-image" src="${images[0] || ''}" />

        <div>
          ${images.map(img => `
            <img src="${img}" class="thumb" onclick="changeImage('${img}')">
          `).join("")}
        </div>
      </div>

      <!-- RIGHT SIDE -->
      <div class="details-right">
        <h2>${product.name}</h2>
        <p><b>GHS ${product.price}</b></p>

        <p>${product.description || ""}</p>

        ${product.variations?.length ? `
          <div class="variation-box">
            ${product.variations.map(v => `
              <button onclick="selectVariation('${v}', this)">
                ${v}
              </button>
            `).join("")}
          </div>
        ` : ""}

        <button class="add-btn" onclick="addToCart()">
          Add to Cart
        </button>
      </div>

    </div>
  `;
}
// ================= IMAGE SWITCH =================
function changeImage(src) {
  document.getElementById("main-image").src = src;
}

// ================= VARIATION SELECT (FIXED BUTTON SCOPE) =================
function selectVariation(value, btn) {
  selectedVariation = value;

  document
    .querySelectorAll(".variation-box button")
    .forEach(b => b.classList.remove("active"));

  btn.classList.add("active");
}

// ================= ADD TO CART =================
function addToCart() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (product.variations?.length && !selectedVariation) {
    alert("Select a variation");
    return;
  }

  const existing = cart.find(
    i => i.id === product.id && i.variation === selectedVariation
  );

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      images: product.images || [],
      variation: selectedVariation,
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Added to cart!");
}

// expose
window.changeImage = changeImage;
window.selectVariation = selectVariation;
window.addToCart = addToCart;

// init
loadProduct();