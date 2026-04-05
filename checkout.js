// ====== checkout.js ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
 const firebaseConfig = {
    apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
    authDomain: "bills-mall.firebaseapp.com",
    projectId: "bills-mall",
    storageBucket: "bills-mall.firebasestorage.app",
    messagingSenderId: "741823099772",
    appId: "1:741823099772:web:f152557c54cfc14e8caaf9",
    measurementId: "G-KXGSYRH35E"
  };

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

  // ✅ THIS IS WHAT YOU WERE MISSING
  const db = getFirestore(app);

// Get cart from localStorage
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Elements
const orderItems = document.getElementById("order-items");
const totalPrice = document.getElementById("total-price");
const error = document.getElementById("error");
const proceedBtn = document.getElementById("proceed-btn"); // Make sure your button has this id

// Display cart items and total
function displayOrder() {
  let total = 0;
  orderItems.innerHTML = "";

  cart.forEach(item => {
    let qty = item.quantity || 1;
    let subtotal = item.price * qty;
    total += subtotal;

    let div = document.createElement("div");
    div.innerHTML = `<p>${item.name} (${item.variation}) x ${qty} = GHS ${subtotal}</p>`;
    orderItems.appendChild(div);
  });

  const location = document.getElementById("location").value;
  const locationSelect = document.getElementById("location");

   if (locationSelect) {
  locationSelect.addEventListener("change", displayOrder);
}
  // ✅ CALCULATE DELIVERY
  let deliveryFee = 0;
  if (location === "kumasi") {
    deliveryFee = 20;
  } else if (location ==="accra") {
    deliveryFee = 30;
   }  else if (location === "obuasi") {
    deliveryFee = 10;
  } else if (location) {
    deliveryFee = 15;
  }

  // ✅ FINAL TOTAL
  let finalTotal = total + deliveryFee;

  // ✅ SHOW EVERYTHING
  totalPrice.innerHTML = `
    <p>Items Total: GHS ${total}</p>
    <p>Delivery Fee: GHS ${deliveryFee}</p>
    <h3>Total: GHS ${finalTotal}</h3>
  `;
}

displayOrder();

// Enable Proceed to Payment button only if form is filled
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

// ====== Go to Payment ======
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

  // ✅ SHOW PAYMENT SECTION
  document.getElementById("payment-section").style.display = "block";
}
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("proceed-btn");

  if (btn) {
    btn.addEventListener("click", goToPayment);
  }
});

// ====== Toggle Payment Method ======
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

// ====== Confirm Mobile Money Payment ======
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

// ====== Place COD Order ======
function placeCODOrder() {
  placeOrder("Pay on Delivery");
}

async function placeOrder(paymentType) {
  console.log("🚀 placeOrder triggered");
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const location = document.getElementById("location").value;

  if (!location) {
    error.innerText = "⚠️ Please select delivery location!";
    return;
  }

  if (!name || !phone || !address) {
    error.innerText = "⚠️ Please fill in all delivery details!";
    return;
  }

  if (phone.length < 10) {
    error.innerText = "⚠️ Enter a valid phone number!";
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  // ✅ CALCULATE TOTAL FIRST
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
  });

  // ✅ THEN DELIVERY FEE
  let deliveryFee = 0;

  if (location === "kumasi") {
    deliveryFee = 10;
  } else if (location === "accra") {
    deliveryFee = 20;
  } else {
    deliveryFee = 15;
  }

  // ✅ FINAL TOTAL
  let finalTotal = total + deliveryFee;

  let orders = JSON.parse(localStorage.getItem("orders")) || [];
 const userId = localStorage.getItem("userId") || phone;
 const updatedCart = cart.map(item => ({
  ...item,
  image: "https://billsken38-code.github.io/bills-mall/" + item.image
}));
 const newOrder = {
    userId: userId, 
    customer: { name, phone, address, location }, // ✅ include location
    items: updatedCart,
    total: finalTotal,
    deliveryFee: deliveryFee,
    paymentMethod: paymentType,
    date: new Date().toLocaleString(),
    status: paymentType === "Paid" ? "Paid" : "Pending"
  };

  orders.push(newOrder);
 await saveOrderToFirebase(newOrder);
  localStorage.removeItem("cart");
  console.log("Sending order:", newOrder);

  alert("✅ Order placed successfully!");
  window.location.href = "index.html";
}
async function saveOrderToFirebase(order) {
  try {
    await addDoc(collection(db, "orders"), order);
    console.log("✅ Order saved to Firebase!");
  } catch (err) {
    console.error("❌ Firebase FULL error:", err);
  }
}
window.togglePaymentMethod = togglePaymentMethod;
window.confirmPayment = confirmPayment;
window.placeCODOrder = placeCODOrder;

