import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db } from "./firebase.js";
import { redirectWithToast } from "./ui.js";
import {
  defaultDeliveryConfig,
  normalizeDeliveryConfig,
  calculateDeliveryFee as calculateConfiguredDeliveryFee
} from "./delivery-config.js";
import { ensureUserProfile } from "./referral-system.js";

const BACKEND_BASE_URL = "https://backend-616b.onrender.com";

let currentUser = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let deliveryConfig = normalizeDeliveryConfig(defaultDeliveryConfig);
const vendorLocationCache = new Map();

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
const authNotice = document.getElementById("checkout-auth-notice");
const payNowBtn = document.getElementById("pay-now-btn");
const confirmOrderBtn = document.getElementById("confirm-order-btn");

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
    emailInput.readOnly = !!user?.email;
  }

  if (nameInput && !nameInput.value) {
    nameInput.value = user?.displayName || "";
  }

  if (addressInput && !addressInput.value) {
    addressInput.value = localStorage.getItem("address") || "";
  }

  checkForm();
}

function updateCheckoutAccess() {
  const isLoggedIn = !!currentUser?.emailVerified;

  if (authNotice) {
    authNotice.hidden = isLoggedIn;
  }

  if (paymentMethod) {
    paymentMethod.disabled = !isLoggedIn;
  }

  if (payNowBtn) {
    payNowBtn.disabled = !isLoggedIn;
  }

  if (confirmOrderBtn) {
    confirmOrderBtn.disabled = !isLoggedIn;
  }

  if (!isLoggedIn) {
    if (paymentMethod) {
      paymentMethod.value = "";
    }

    if (momoSection) {
      momoSection.style.display = "none";
    }

    if (codSection) {
      codSection.style.display = "none";
    }
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user?.emailVerified ? user : null;
  fillCustomerDetails(currentUser);
  updateCheckoutAccess();
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
  const cachedLocation = firstWithLocation?.vendorId
    ? vendorLocationCache.get(firstWithLocation.vendorId)
    : "";

  return String(firstWithLocation?.vendorLocation || cachedLocation || "").trim().toLowerCase();
}

async function hydrateVendorLocations() {
  const vendorIds = Array.from(
    new Set(
      cart
        .filter((item) => item.vendorId && !String(item.vendorLocation || "").trim())
        .map((item) => item.vendorId)
    )
  );

  if (!vendorIds.length) return;

  let updated = false;

  for (const vendorId of vendorIds) {
    try {
      const vendorSnap = await getDoc(doc(db, "vendors", vendorId));
      if (!vendorSnap.exists()) continue;

      const vendorLocation = String(vendorSnap.data()?.vendorLocation || "").trim().toLowerCase();
      if (!vendorLocation) continue;

      vendorLocationCache.set(vendorId, vendorLocation);

      cart = cart.map((item) => {
        if (item.vendorId !== vendorId || String(item.vendorLocation || "").trim()) {
          return item;
        }

        updated = true;
        return {
          ...item,
          vendorLocation
        };
      });
    } catch (error) {
      console.error(`Failed to load vendor location for ${vendorId}:`, error);
    }
  }

  if (updated) {
    localStorage.setItem("cart", JSON.stringify(cart));
    updateTotalDisplay();
  }
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
  setPaymentMessage(
    currentUser
      ? ""
      : "Log in to unlock payment and place your order.",
    currentUser ? "inherit" : "#b00020"
  );
  paymentSection.style.display = "block";
  updateCheckoutAccess();
  paymentSection.scrollIntoView({ behavior: "smooth" });
}

proceedBtn?.addEventListener("click", goToPayment);

window.togglePaymentMethod = function () {
  if (!currentUser) {
    setPaymentMessage("Log in to choose a payment method.", "#b00020");
    if (paymentMethod) {
      paymentMethod.value = "";
    }
    if (momoSection) momoSection.style.display = "none";
    if (codSection) codSection.style.display = "none";
    return;
  }

  const method = paymentMethod.value;

  if (momoSection) momoSection.style.display = method === "momo" ? "block" : "none";
  if (codSection) codSection.style.display = method === "cod" ? "block" : "none";

  if (!method) {
    setPaymentMessage("Choose a payment method.", "#b00020");
    return;
  }

  setPaymentMessage("");
};

window.payWithPaystack = function () {
  if (!currentUser) {
    redirectWithToast("login.html", "Log in to complete your order.", { type: "info" });
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
  const res = await fetch(`${BACKEND_BASE_URL}/verify-payment`, {
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

async function notifyOrderByEmail(orderId) {
  if (!orderId) return;

  const response = await fetch(`${BACKEND_BASE_URL}/notify-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Notification request failed with status ${response.status}`);
  }
}

async function getCurrentUserIdToken() {
  if (!currentUser) {
    throw new Error("Log in to complete your order.");
  }

  return currentUser.getIdToken();
}

async function createOrdersOnServer(payload) {
  const response = await fetch(`${BACKEND_BASE_URL}/create-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to create order.");
  }

  return data;
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
    redirectWithToast("login.html", "Log in to complete your order.", { type: "info" });
    return;
  }

  if (!currentUser.emailVerified) {
    setPaymentMessage("Please verify your email before placing an order.", "#b00020");
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
  const notificationTasks = [];

  try {
    await ensureUserProfile(currentUser, {
      name,
      address,
      role: "customer"
    });

    const vendorIds = Object.keys(groupedByVendor);
    const idToken = await getCurrentUserIdToken();
    const requestCart = vendorIds.flatMap((vendorId) => {
      const vendorItems = groupedByVendor[vendorId];
      const vendorDelivery = deliveryBreakdown.find((entry) => entry.vendorId === vendorId);
      const vendorDeliveryFee = Number(vendorDelivery?.fee || 0);

      return vendorItems.map((item, index) => ({
        id: item.id,
        productId: item.id,
        vendorId,
        vendorLocation: vendorDelivery?.vendorLocation || item.vendorLocation || "",
        variation: item.variation || "",
        quantity: Number(item.quantity || 1),
        image: item.image || item.images?.[0] || "",
        deliveryFee: index === 0 ? vendorDeliveryFee : 0
      }));
    });

    const result = await createOrdersOnServer({
      idToken,
      customer: {
        name,
        email: currentUser.email || document.getElementById("email")?.value.trim(),
        phone,
        address,
        location
      },
      cart: requestCart,
      paymentMethod: paymentType
    });

    for (const orderId of result.orderIds || []) {
      notificationTasks.push(
        notifyOrderByEmail(orderId).catch((notifyError) => {
          console.error(`Failed to notify for order ${orderId}:`, notifyError);
        })
      );
    }

    await Promise.allSettled(notificationTasks);

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
fillCustomerDetails(auth.currentUser?.emailVerified ? auth.currentUser : null);
checkForm();
loadDeliveryConfig();
hydrateVendorLocations();
updateCheckoutAccess();

if (paymentSection) {
  paymentSection.style.display = "none";
}

momoSection.style.display = "none";
codSection.style.display = "none";
