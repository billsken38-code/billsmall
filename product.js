import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔥 Firebase config (FIXED)
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

// ================= STATE =================
let products = [];
let selectedProduct = null;
let selectedVariation = null;

// ================= LOAD PRODUCTS =================
async function loadProductDetails() {
  const container = document.getElementById("product-details");
  container.innerHTML = "Loading product...";

  try {
    const snapshot = await getDocs(collection(db, "products"));

    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const index = localStorage.getItem("selectedProduct");

    selectedProduct = products[index];

    if (!selectedProduct) {
      container.innerHTML = "<p>Product not found</p>";
      return;
    }

    renderProduct();

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading product</p>";
  }
}

// ================= RENDER PRODUCT =================
function renderProduct() {
  const container = document.getElementById("product-details");

  selectedVariation = null;

  const images = selectedProduct.images || [selectedProduct.image];

  container.innerHTML = `
    <div class="details-container">

      <!-- LEFT -->
      <div class="details-left">
        <img src="${images[0]}" id="main-image" class="details-img">

        <div class="thumbnail-container">
          ${images.map(img => `
            <img src="${img}" class="thumb" onclick="changeImage('${img}')">
          `).join("")}
        </div>
      </div>

      <!-- RIGHT -->
      <div class="details-right">
        <h2>${selectedProduct.name}</h2>
        <p><strong>GHS ${selectedProduct.price}</strong></p>

        <p class="details-description">
          ${selectedProduct.description || "No description available"}
        </p>

        ${
          selectedProduct.variations?.length
            ? `
          <label>Select Option:</label>
          <div class="variation-container">
            ${selectedProduct.variations.map(v => `
              <button class="variation-btn" onclick="selectVariation('${v}', this)">
                ${v}
              </button>
            `).join("")}
          </div>
        `
            : ""
        }

        <button onclick="addToCart()">Add to Cart</button>
      </div>

    </div>
  `;
}

// ================= CHANGE IMAGE =================
function changeImage(src) {
  document.getElementById("main-image").src = src;
}

// ================= SELECT VARIATION =================
function selectVariation(value, btn) {
  selectedVariation = value;

  document.querySelectorAll(".variation-btn").forEach(b => {
    b.classList.remove("active");
  });

  btn.classList.add("active");
}

// ================= ADD TO CART =================
function addToCart() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  if (selectedProduct.variations?.length && !selectedVariation) {
    alert("Please select a variation!");
    return;
  }

  const existing = cart.find(
    item =>
      item.name === selectedProduct.name &&
      item.variation === selectedVariation
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      name: selectedProduct.name,
      price: selectedProduct.price,
      images: selectedProduct.images || [selectedProduct.image],
      description: selectedProduct.description || "",
      variation: selectedVariation,
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  alert("Added to cart!");
}

// ================= GLOBAL EXPORTS =================
window.changeImage = changeImage;
window.selectVariation = selectVariation;
window.addToCart = addToCart;

// ================= INIT =================
loadProductDetails();