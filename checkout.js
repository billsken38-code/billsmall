import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db } from "./firebase.js";

let currentUser = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let deliveryFee = 0;

const orderItems = document.getElementById("order-items");
const totalPrice = document.getElementById("total-price");
const error = document.getElementById("error");
const paymentMsg = document.getElementById("payment-msg");
const proceedBtn = document.getElementById("proceed-btn");
const paymentSection = document.getElementById("payment-section");
const paymentMethod = document.getElementById("payment-method");
const momoSection = document.getElementById("momo-section");
const codSection = document.getElementById("cod-section");

function setError(message) {
  if (error) {
    error.innerText = message;
  }
}

function setPaymentMessage(message, color = "inherit") {
  if (paymentMsg) {
    paymentMsg.innerText = message;
    paymentMsg.style.color = color;
  }
}

function fillCustomerDetails(user) {
  const emailInput = document.getElementById("email");
  const nameInput = document.getElementById("name");
  const addressInput = document.getElementById("address");

  if (emailInput) {
    emailInput.value = user?.email || "";
    emailInput.readOnly = true;
  }

  if (nameInput && !nameInput.value) {
    nameInput.value = user?.displayName || "";
  }

  if (addressInput && !addressInput.value) {
    addressInput.value = localStorage.getItem("address") || "";
  }

  checkForm();
}

onAuthStateChanged(auth, (user) => {
  if (!user || !user.emailVerified) {
    alert("Please login first");
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  fillCustomerDetails(user);
});

function displayOrder() {
  if (!orderItems || !totalPrice) return;

  if (cart.length === 0) {
    orderItems.innerHTML = "<p>Your cart is empty</p>";
    totalPrice.innerHTML = "";
    return;
  }

  let total = 0;
  orderItems.innerHTML = "";

  cart.forEach((item) => {
    const qty = item.quantity || 1;
    const subtotal = Number(item.price || 0) * qty;
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

function getBaseTotal() {
  return cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * (item.quantity || 1),
    0
  );
}

function checkForm() {
  const name = document.getElementById("name")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const address = document.getElementById("address")?.value.trim();

  if (proceedBtn) {
    proceedBtn.disabled = !(name && phone && address);
  }
}

["name", "phone", "address"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", checkForm);
});

document.getElementById("location")?.addEventListener("change", () => {
  const location = document.getElementById("location").value;

  if (location === "knust kumasi campus") deliveryFee = 20;
  else if (location === "accra") deliveryFee = 30;
  else if (location === "knust obuasi campus") deliveryFee = 5;
  else deliveryFee = location ? 15 : 0;

  updateTotalDisplay();
});

function updateTotalDisplay() {
  const baseTotal = getBaseTotal();
  const total = baseTotal + deliveryFee;

  totalPrice.innerHTML = `
    <p>Items: GHS ${baseTotal}</p>
    <p>Delivery: GHS ${deliveryFee}</p>
    <h3>Total: GHS ${total}</h3>
  `;
}

function goToPayment() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const location = document.getElementById("location").value;

  if (!name || !phone || !address || !location) {
    setError("Fill your name, phone, address, and location first.");
    return;
  }

  if (cart.length === 0) {
    setError("Your cart is empty.");
    return;
  }

  setError("");
  setPaymentMessage("");
  paymentSection.style.display = "block";
  paymentSection.scrollIntoView({ behavior: "smooth" });
}

proceedBtn?.addEventListener("click", goToPayment);

window.togglePaymentMethod = function () {
  const method = paymentMethod.value;

  momoSection.style.display = method === "momo" ? "block" : "none";
  codSection.style.display = method === "cod" ? "block" : "none";

  if (!method) {
    setPaymentMessage("Choose a payment method.", "#b00020");
    return;
  }

  setPaymentMessage("");
};

window.payWithPaystack = function () {
  if (!currentUser) {
    alert("Login required");
    return;
  }

  if (typeof PaystackPop === "undefined") {
    console.error("PaystackPop is not available on window.");
    setPaymentMessage("Paystack failed to load. Refresh the page and try again.", "#b00020");
    return;
  }

  const amount = (getBaseTotal() + deliveryFee) * 100;

  if (amount <= 0) {
    setPaymentMessage("Invalid order total.", "#b00020");
    return;
  }

  console.log("Paystack starting", {
    email: currentUser?.email,
    amount,
    deliveryFee,
    cart
  });

  const handler = PaystackPop.setup({
    key: "pk_live_1593829182b5428b42076c0a6896a88c64e498ba",
    email: currentUser.email,
    amount,
    currency: "GHS",
    callback: function (response) {
      console.log("Paystack callback response:", response);
      verifyPayment(response.reference).catch((err) => {
        console.error("Verification error:", err);
        setPaymentMessage(`Payment verification failed: ${err.message}`, "#b00020");
      });
    },
    onClose: function () {
      console.log("Paystack popup closed by user.");
      setPaymentMessage("Payment cancelled.", "#b00020");
    }
  });

  console.log("Opening Paystack iframe...");
  handler.openIframe();
};

async function verifyPayment(reference) {
  console.log("Verifying reference:", reference);

  const res = await fetch("https://backend-616b.onrender.com/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference })
  });

  console.log("Verification HTTP status:", res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Verification request failed:", errorText);
    throw new Error(`Verification request failed with status ${res.status}`);
  }

  const data = await res.json();
  console.log("Verification response data:", data);

  if (data.success) {
    await placeOrder("Paid");
  } else {
    setPaymentMessage("Payment verification failed.", "#b00020");
  }
}

window.placeCODOrder = async function () {
  if (paymentMethod.value !== "cod") {
    setPaymentMessage("Select 'Pay on Delivery' first.", "#b00020");
    return;
  }

  await placeOrder("Pay on Delivery");
};

async function placeOrder(paymentType) {
  if (!currentUser) {
    setPaymentMessage("User not authenticated.", "#b00020");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const location = document.getElementById("location").value;

  if (!name || !phone || !address || !location || cart.length === 0) {
    setPaymentMessage("Complete your delivery details before placing the order.", "#b00020");
    return;
  }

  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  setPaymentMessage("Placing your order...", "#4B2E2B");
  localStorage.setItem("address", address);

  const order = {
    userId: currentUser.uid,
    customer: {
      name,
      phone,
      address,
      location,
      email: currentUser.email || document.getElementById("email").value.trim()
    },
    items: cart,
    total: getBaseTotal() + deliveryFee,
    deliveryFee,
    paymentMethod: paymentType,
    status: paymentType === "Paid" ? "Paid" : "Pending",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "orders"), order);

    localStorage.removeItem("cart");
    setPaymentMessage("Order placed successfully. Redirecting to your orders...", "green");
    window.location.href = "orders-user.html";
  } catch (err) {
    console.error("Order failed:", err);
    setPaymentMessage(`Order failed: ${err.message}`, "#b00020");
    document.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
  }
}

displayOrder();
fillCustomerDetails(auth.currentUser);
checkForm();
momoSection.style.display = "none";
codSection.style.display = "none";
