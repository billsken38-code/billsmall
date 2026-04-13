// ====== checkout.js (PROFESSIONAL VERSION) ======

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, addDoc } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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
const db = getFirestore(app);

// ================= CART =================
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ================= STATE =================
let deliveryFee = 0;
let finalTotal = 0;

// ================= ELEMENTS =================
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

    const div = document.createElement("div");
    div.className = "order-item";
    div.innerHTML = `
      ${item.name} (${item.variation || "No option"}) 
      x ${qty} = <b>GHS ${subtotal}</b>
    `;
    orderItems.appendChild(div);
  });

  totalPrice.innerHTML = `<p>Items Total: GHS ${total}</p>`;
}

displayOrder();

// ================= VALIDATION =================
function checkForm() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  proceedBtn.disabled = !(name && phone && address);
}

["name", "phone", "address"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", checkForm);
});

// ================= DELIVERY =================
document.getElementById("location")?.addEventListener("change", () => {
  const location = document.getElementById("location").value;

  if (location === "knust kumasi campus") deliveryFee = 20;
  else if (location === "accra") deliveryFee = 30;
  else if (location === "obuasi") deliveryFee = 10;
  else if (location === "knust obuasi campus") deliveryFee = 5;
  else deliveryFee = 15;

  let total = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  finalTotal = total + deliveryFee;

  totalPrice.innerHTML = `
    <p>Items: GHS ${total}</p>
    <p>Delivery: GHS ${deliveryFee}</p>
    <h3>Total: GHS ${finalTotal}</h3>
  `;
});

// ================= PAYMENT UI =================
function goToPayment() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!name || !phone || !address) {
    error.innerText = "Fill delivery details first!";
    return;
  }

  document.getElementById("payment-section").style.display = "block";
  document.getElementById("payment-section").scrollIntoView({ behavior: "smooth" });
}

proceedBtn.addEventListener("click", goToPayment);

// ================= REALISTIC PAYMENT FLOW =================
async function confirmPayment() {
  const network = document.getElementById("network").value;
  const momo = document.getElementById("momo-number").value.trim();
  const msg = document.getElementById("payment-msg");

  if (!network || !momo) {
    msg.innerText = "Enter payment details";
    msg.style.color = "red";
    return;
  }

  msg.style.color = "orange";
  msg.innerText = "Redirecting to payment gateway...";

  // 👉 HERE is where REAL PAYMENT will connect later
  setTimeout(async () => {
    msg.innerText = "Payment verified";

    await placeOrder("Paid");
  }, 2000);
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

  if (!location || cart.length === 0) return;

  document.querySelectorAll("button").forEach(b => b.disabled = true);

  let total = cart.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);

  const order = {
    userId: localStorage.getItem("userId"),
    customer: { name, phone, address, location },
    items: cart,
    total: finalTotal || total,
    deliveryFee,
    paymentMethod: paymentType,
    status: paymentType === "Paid" ? "Paid" : "Pending",
    date: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "orders"), order);

    localStorage.removeItem("cart");

    alert("Order placed successfully!");
    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    error.innerText = "Order failed";

    document.querySelectorAll("button").forEach(b => b.disabled = false);
  }
}

// ================= GLOBAL =================
window.togglePaymentMethod = function () {
  const method = document.getElementById("payment-method").value;

  document.getElementById("momo-section").style.display = method === "momo" ? "block" : "none";
  document.getElementById("cod-section").style.display = method === "cod" ? "block" : "none";
}
// ================= PAYSTACK PAYMENT =================
function payWithPaystack() {
  const email = document.getElementById("email").value.trim();
  const name = document.getElementById("name").value.trim();

  if (!email || !name) {
    alert("Enter name and email");
    return;
  }

  let total = cart.reduce((sum, item) => {
    return sum + item.price * (item.quantity || 1);
  }, 0);

  const amount = Math.round((finalTotal || total) * 100);

  const handler = PaystackPop.setup({
    key: "pk_live_1593829182b5428b42076c0a6896a88c64e498ba", // ✅ your public key
    email:"email" ,
    amount: amount,
    currency: "GHS",

    metadata: {
      custom_fields: [
        {
          display_name: "Customer Name",
          variable_name: "customer_name",
          value: name
        }
      ]
    },

    callback: function(response) {
      verifyPayment(response.reference);
    },

    onClose: function() {
      alert("Payment cancelled");
    }
  });

  handler.openIframe();
}

// ================= VERIFY PAYMENT =================
async function verifyPayment(reference) {
  try {
    const res = await fetch("https://backend-616b.onrender.com/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference })
    });

    const data = await res.json();

    if (data.success) {
      await placeOrder("Paid");
    } else {
      alert("Payment verification failed!");
    }
  } catch (err) {
    console.error(err);
    alert("Error verifying payment");
  }
}
window.confirmPayment = confirmPayment;
window.placeCODOrder = placeCODOrder;
window.payWithPaystack = payWithPaystack;