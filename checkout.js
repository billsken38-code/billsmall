// ====== checkout.js ======

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getFirestore, collection, addDoc } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9",
  measurementId: "G-KXGSYRH35E"
};

// 🔥 INIT FIREBASE
const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getFirestore(app);

// 🔥 GET CART
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// 🔥 ELEMENTS
const orderItems = document.getElementById("order-items");
const totalPrice = document.getElementById("total-price");
const error = document.getElementById("error");
const proceedBtn = document.getElementById("proceed-btn");

// ================= DISPLAY ORDER =================
function displayOrder() {
  if (!orderItems || !totalPrice) return;

  if (cart.length === 0) {
    orderItems.innerHTML = "<p>Your cart is empty 🛒</p>";
    totalPrice.innerHTML = "";
    return;
  }

  let total = 0;
  orderItems.innerHTML = "";

  cart.forEach(item => {
    let qty = item.quantity || 1;
    let subtotal = item.price * qty;
    total += subtotal;

    let div = document.createElement("div");
    div.innerHTML = `
      <p>
        ${item.name} (${item.variation || "No option"}) 
        x ${qty} = <b>GHS ${subtotal}</b>
      </p>
    `;
    orderItems.appendChild(div);
  });

  const location = document.getElementById("location")?.value;

  if (!location) {
    totalPrice.innerHTML = "<p>Select location to see total</p>";
    return;
  }

  let deliveryFee = 0;
  if (location === "kumasi") deliveryFee = 20;
  else if (location === "accra") deliveryFee = 30;
  else if (location === "obuasi") deliveryFee = 10;
  else deliveryFee = 15;

  let finalTotal = total + deliveryFee;

  totalPrice.innerHTML = `
    <p>Items Total: GHS ${total}</p>
    <p>Delivery Fee: GHS ${deliveryFee}</p>
    <h3>Total: GHS ${finalTotal}</h3>
  `;
}

// 🔥 RUN ON LOAD
displayOrder();

// 🔄 UPDATE WHEN LOCATION CHANGES
document.getElementById("location")?.addEventListener("change", displayOrder);

// ================= FORM VALIDATION =================
const inputs = document.querySelectorAll("#name, #phone, #address");

inputs.forEach(input => {
  input.addEventListener("input", checkForm);
});

function checkForm() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (proceedBtn) {
    proceedBtn.disabled = !(name && phone && address);
  }
}

// ================= GO TO PAYMENT =================
function goToPayment() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!name || !phone || !address) {
    error.innerText = "⚠️ Fill delivery details first!";
    return;
  }

  if (phone.length < 10) {
    error.innerText = "⚠️ Enter a valid phone number!";
    return;
  }

  error.innerText = "";

  const paymentSection = document.getElementById("payment-section");
  paymentSection.style.display = "block";

  paymentSection.scrollIntoView({
    behavior: "smooth"
  });
}

// BUTTON EVENT
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("proceed-btn");
  if (btn) btn.addEventListener("click", goToPayment);
});

// ================= PAYMENT METHOD =================
function togglePaymentMethod() {
  const method = document.getElementById("payment-method").value;

  document.getElementById("momo-section").style.display = "none";
  document.getElementById("cod-section").style.display = "none";

  if (method === "momo") {
    document.getElementById("momo-section").style.display = "block";
  } else if (method === "cod") {
    document.getElementById("cod-section").style.display = "block";
  }
}

// ================= MOBILE MONEY =================
function confirmPayment() {
  const network = document.getElementById("network").value;
  const momo = document.getElementById("momo-number").value.trim();
  const msg = document.getElementById("payment-msg");

  if (!network || !momo) {
    msg.style.color = "red";
    msg.innerText = "⚠️ Enter payment details!";
    return;
  }

  msg.style.color = "green";
  msg.innerText = "Processing payment...";

  setTimeout(() => {
    msg.innerText = "✅ Payment successful!";
    placeOrder("Paid");
  }, 1500);
}

// ================= COD =================
function placeCODOrder() {
  placeOrder("Pay on Delivery");
}

// ================= PLACE ORDER =================
async function placeOrder(paymentType) {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const location = document.getElementById("location").value;

  if (!location) {
    error.innerText = "⚠️ Select delivery location!";
    return;
  }

  if (!name || !phone || !address) {
    error.innerText = "⚠️ Fill all delivery details!";
    return;
  }

  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  // 🔥 PREVENT DOUBLE CLICK
  const buttons = document.querySelectorAll("button");
  buttons.forEach(btn => btn.disabled = true);

  // 🔥 CALCULATE TOTAL
  let total = 0;
  cart.forEach(item => {
    total += item.price * (item.quantity || 1);
  });

  let deliveryFee = 0;
  if (location === "kumasi") deliveryFee = 20;
  else if (location === "accra") deliveryFee = 30;
  else if (location === "obuasi") deliveryFee = 10;
  else deliveryFee = 15;

  let finalTotal = total + deliveryFee;

  const updatedCart = cart.map(item => ({
    ...item,
    images: item.images ? item.images : [item.image]
  }));

  const userId = localStorage.getItem("userId");

  const newOrder = {
    userId,
    customer: { name, phone, address, location },
    items: updatedCart,
    total: finalTotal,
    deliveryFee,
    paymentMethod: paymentType,
    date: new Date().toISOString(),
    status: paymentType === "Paid" ? "Paid" : "Pending"
  };

  try {
    await addDoc(collection(db, "orders"), newOrder);

    alert("✅ Order placed successfully!");

    localStorage.removeItem("cart");
    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    error.innerText = "❌ Failed to place order. Try again.";

    // re-enable buttons if failed
    document.querySelectorAll("button").forEach(btn => btn.disabled = false);
  }
}

// ================= GLOBAL FUNCTIONS =================
window.togglePaymentMethod = togglePaymentMethod;
window.confirmPayment = confirmPayment;
window.placeCODOrder = placeCODOrder;