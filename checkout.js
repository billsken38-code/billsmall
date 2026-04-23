import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db } from "./firebase.js";
import { redirectWithToast, showToast } from "./ui.js";
import {
  defaultDeliveryConfig,
  normalizeDeliveryConfig,
  calculateDeliveryFee as calculateConfiguredDeliveryFee
} from "./delivery-config.js";

let currentUser = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let deliveryConfig = normalizeDeliveryConfig(defaultDeliveryConfig);

const orderItems = document.getElementById("order-items");
const totalPrice = document.getElementById("total-price");
const error = document.getElementById("error");
const paymentMsg = document.getElementById("payment-msg");
const proceedBtn = document.getElementById("proceed-btn");
const paymentSection = document.getElementById("payment-section");
const paymentMethod = document.getElementById("payment-method");
const momoSection = document.getElementById("momo-section");
const codSection = document.getElementById("cod-section");
const locationSelect = document.getElementById("location");

function formatCurrency(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

function setError(message) {
  if (error) error.innerText = message;
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
    redirectWithToast("login.html", "Please login first.", { type: "error" });
    return;
  }

  currentUser = user;
  fillCustomerDetails(user);
});

function getCustomerLocation() {
  return locationSelect?.value.trim().toLowerCase() || "";
}

function getBaseTotal() {
  return cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );
}

function groupCartByVendor() {
  const grouped = {};

  for (const item of cart) {
    const vendorId = item.vendorId;

    if (!vendorId) {
      console.warn("Cart item missing vendorId:", item);
      continue;
    }

    if (!grouped[vendorId]) {
      grouped[vendorId] = [];
    }

    grouped[vendorId].push(item);
  }

  return grouped;
}

function getVendorLocationFromItems(items = []) {
  const firstWithLocation = items.find((item) => item.vendorLocation);
  return String(firstWithLocation?.vendorLocation || "").trim().toLowerCase();
}

function renderLocationOptions() {
  if (!locationSelect) return;

  const selectedValue = locationSelect.value;
  const optionsHtml = ['<option value="">Select Location</option>']
    .concat(
      deliveryConfig.locations.map(
        (location) => `<option value="${location.value}">${location.label}</option>`
      )
    )
    .join("");

  locationSelect.innerHTML = optionsHtml;

  if (selectedValue && deliveryConfig.locations.some((location) => location.value === selectedValue)) {
    locationSelect.value = selectedValue;
  }
}

function calculateDeliveryFee(vendorLocation, customerLocation) {
  return calculateConfiguredDeliveryFee(vendorLocation, customerLocation, deliveryConfig);
}

async function loadDeliveryConfig() {
  renderLocationOptions();

  try {
    const settingsSnap = await getDoc(doc(db, "platform_settings", "main"));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      deliveryConfig = normalizeDeliveryConfig(data.delivery || defaultDeliveryConfig);
      renderLocationOptions();
      updateTotalDisplay();
      checkForm();
    }
  } catch (err) {
    console.error("Failed to load delivery settings:", err);
  }
}

function getDeliveryBreakdown() {
  const customerLocation = getCustomerLocation();
  const grouped = groupCartByVendor();

  return Object.entries(grouped).map(([vendorId, items]) => {
    const vendorLocation = getVendorLocationFromItems(items);
    const fee = calculateDeliveryFee(vendorLocation, customerLocation);

    return {
      vendorId,
      vendorLocation,
      items,
      fee
    };
  });
}

function getTotalDeliveryFee() {
  return getDeliveryBreakdown().reduce((sum, entry) => sum + Number(entry.fee || 0), 0);
}

function getGrandTotal() {
  return getBaseTotal() + getTotalDeliveryFee();
}

function displayOrder() {
  if (!orderItems || !totalPrice) return;

  if (cart.length === 0) {
    orderItems.innerHTML = `<div class="order-item"><span>Your cart is empty</span></div>`;
    totalPrice.innerHTML = "";
    return;
  }

  orderItems.innerHTML = cart
    .map((item) => {
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);
      const subtotal = price * qty;
      const variation = item.variation ? item.variation : "Standard";

      return `
        <div class="order-item">
          <div>
            <strong>${item.name}</strong><br>
            <small>${variation}</small><br>
            <small>Qty: ${qty}</small>
          </div>
          <div>
            <strong>${formatCurrency(subtotal)}</strong>
          </div>
        </div>
      `;
    })
    .join("");

  updateTotalDisplay();
}

function updateTotalDisplay() {
  if (!totalPrice) return;

  const baseTotal = getBaseTotal();
  const deliveryBreakdown = getDeliveryBreakdown();
  const deliveryTotal = deliveryBreakdown.reduce((sum, entry) => sum + entry.fee, 0);
  const total = baseTotal + deliveryTotal;

  const deliveryHtml = deliveryBreakdown.length
    ? deliveryBreakdown
        .map(
          (entry) => `
            <div class="summary-line">
              <span>Delivery (${entry.vendorLocation || "vendor location not set"})</span>
              <strong>${formatCurrency(entry.fee)}</strong>
            </div>
          `
        )
        .join("")
    : `
      <div class="summary-line">
        <span>Delivery Fee</span>
        <strong>${formatCurrency(0)}</strong>
      </div>
    `;

  totalPrice.innerHTML = `
    <div class="summary-line">
      <span>Items Total</span>
      <strong>${formatCurrency(baseTotal)}</strong>
    </div>
    ${deliveryHtml}
    <div class="summary-line summary-total">
      <span>Total</span>
      <strong>${formatCurrency(total)}</strong>
    </div>
  `;
}

function checkForm() {
  const name = document.getElementById("name")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const address = document.getElementById("address")?.value.trim();
  const location = document.getElementById("location")?.value.trim();

  if (proceedBtn) {
    proceedBtn.disabled = !(name && phone && address && location);
  }
}

["name", "phone", "address"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", checkForm);
});

locationSelect?.addEventListener("change", () => {
  updateTotalDisplay();
  checkForm();
});

function goToPayment() {
  const name = document.getElementById("name")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const address = document.getElementById("address")?.value.trim();
  const location = document.getElementById("location")?.value.trim();

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
    showToast("Login required.", { type: "error" });
    return;
  }

  if (typeof PaystackPop === "undefined") {
    setPaymentMessage("Paystack failed to load. Refresh the page and try again.", "#b00020");
    return;
  }

  const amount = getGrandTotal() * 100;

  if (amount <= 0) {
    setPaymentMessage("Invalid order total.", "#b00020");
    return;
  }

  const handler = PaystackPop.setup({
    key: "pk_live_1593829182b5428b42076c0a6896a88c64e498ba",
    email: currentUser.email,
    amount,
    currency: "GHS",
    callback: function (response) {
      verifyPayment(response.reference).catch((err) => {
        console.error("Verification error:", err);
        setPaymentMessage(`Payment verification failed: ${err.message}`, "#b00020");
      });
    },
    onClose: function () {
      setPaymentMessage("Payment cancelled.", "#b00020");
    }
  });

  handler.openIframe();
};

async function verifyPayment(reference) {
  const res = await fetch("https://backend-616b.onrender.com/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Verification request failed:", errorText);
    throw new Error(`Verification request failed with status ${res.status}`);
  }

  const data = await res.json();

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

  const name = document.getElementById("name")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const address = document.getElementById("address")?.value.trim();
  const location = document.getElementById("location")?.value.trim();

  if (!name || !phone || !address || !location || cart.length === 0) {
    setPaymentMessage("Complete your delivery details before placing the order.", "#b00020");
    return;
  }

  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  setPaymentMessage("Placing your order...", "#4B2E2B");
  localStorage.setItem("address", address);

  const groupedByVendor = groupCartByVendor();
  const deliveryBreakdown = getDeliveryBreakdown();

  try {
    const vendorIds = Object.keys(groupedByVendor);

    for (const vendorId of vendorIds) {
      const vendorItems = groupedByVendor[vendorId];
      const itemsTotal = vendorItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
        0
      );

      const vendorDelivery = deliveryBreakdown.find((entry) => entry.vendorId === vendorId);
      const vendorDeliveryFee = Number(vendorDelivery?.fee || 0);

      const order = {
        userId: currentUser.uid,
        vendorId,
        vendorLocation: vendorDelivery?.vendorLocation || "",
        customerName: name,
        customerEmail: currentUser.email || document.getElementById("email")?.value.trim(),
        customerPhone: phone,
        address,
        location,
        items: vendorItems,
        quantity: vendorItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
        total: itemsTotal,
        deliveryFee: vendorDeliveryFee,
        grandTotal: itemsTotal + vendorDeliveryFee,
        paymentMethod: paymentType,
        status: paymentType === "Paid" ? "Paid" : "Pending",
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "orders"), order);
    }

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
loadDeliveryConfig();

if (paymentSection) {
  paymentSection.style.display = "none";
}

momoSection.style.display = "none";
codSection.style.display = "none";
