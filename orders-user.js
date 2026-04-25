import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db } from "./firebase.js";

const container = document.getElementById("orders-container");
const empty = document.getElementById("empty-orders");

const summaryTotalOrders = document.getElementById("summary-total-orders");
const summaryPendingOrders = document.getElementById("summary-pending-orders");
const summaryDeliveredOrders = document.getElementById("summary-delivered-orders");
const summaryTotalSpent = document.getElementById("summary-total-spent");

function formatOrderDate(createdAt) {
  if (!createdAt) return "N/A";

  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleString();
  }

  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function normalizeStatus(status) {
  return String(status || "Pending").trim().toLowerCase();
}

function buildTrackingSteps(status) {
  const current = normalizeStatus(status);
  const orderFlow = ["pending", "paid", "shipped", "delivered"];
  const currentIndex = orderFlow.indexOf(current);

  return orderFlow.map((step, index) => {
    const active = currentIndex >= index ? "active" : "";
    const label = step.charAt(0).toUpperCase() + step.slice(1);

    return `<span class="track-step ${active}">${label}</span>`;
  }).join("");
}

function getStatusBadgeClass(status) {
  return normalizeStatus(status);
}

function renderSummary(orders) {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((order) => normalizeStatus(order.status) === "pending").length;
  const deliveredOrders = orders.filter((order) => normalizeStatus(order.status) === "delivered").length;
  const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  summaryTotalOrders.textContent = totalOrders;
  summaryPendingOrders.textContent = pendingOrders;
  summaryDeliveredOrders.textContent = deliveredOrders;
  summaryTotalSpent.textContent = formatCurrency(totalSpent);
}

function renderOrders(orders) {
  if (!container) return;

  container.innerHTML = "";

  orders.forEach((order) => {
    const itemsHTML = (order.items || [])
      .map((item) => {
        const image = item.images?.[0] || item.image || "";
        return `
          <div class="order-item">
            <img src="${image}" class="order-img" alt="${item.name || "Item"}">
            <div class="order-details">
              <h4>${item.name || "Item"}</h4>
              <p>${item.variation || "No option selected"}</p>
              <p>Qty: ${item.quantity || 1}</p>
            </div>
          </div>
        `;
      })
      .join("");

    const totalItems = (order.items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 1),
      0
    );

    const div = document.createElement("article");
    div.className = "order-card upgraded-order-card";

    div.innerHTML = `
      <div class="order-header">
        <div>
          <strong>Order #${order.id}</strong>
          <p>${formatOrderDate(order.createdAt)}</p>
        </div>
        <span class="status ${getStatusBadgeClass(order.status)}">
          ${order.status || "Pending"}
        </span>
      </div>

      <div class="order-summary-grid">
        <div>
          <span>Total</span>
          <strong>${formatCurrency(order.total || 0)}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>${order.paymentMethod || "N/A"}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>${totalItems}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>${order.status || "Pending"}</strong>
        </div>
      </div>

      <div class="order-items">
        ${itemsHTML}
      </div>

      <div class="tracking tracking-upgraded">
        ${buildTrackingSteps(order.status)}
      </div>
    `;

    container.appendChild(div);
  });
}

onAuthStateChanged(auth, (user) => {
  if (!container) return;

  if (!user) {
    if (empty) empty.style.display = "none";
    renderSummary([]);
    container.innerHTML = `<div class="orders-page-empty">Please login to view your orders.</div>`;
    return;
  }

  loadOrders(user.uid);
});

async function loadOrders(userId) {
  if (!container) return;

  container.innerHTML = `<div class="orders-page-empty">Loading orders...</div>`;

  try {
    const ordersQuery = query(
      collection(db, "orders"),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(ordersQuery);

    const orders = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || new Date(a.createdAt || 0).getTime() || 0;
        const bTime = b.createdAt?.seconds || new Date(b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });

    if (!orders.length) {
      container.innerHTML = "";
      if (empty) empty.style.display = "block";
      renderSummary([]);
      return;
    }

    if (empty) empty.style.display = "none";
    renderSummary(orders);
    renderOrders(orders);
  } catch (err) {
    console.error("Error loading orders:", err);
    container.innerHTML = `<div class="orders-page-empty">Failed to load orders: ${err.message}</div>`;
  }
}
