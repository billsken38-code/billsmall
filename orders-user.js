import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db } from "./firebase.js";

function formatOrderDate(createdAt) {
  if (!createdAt) return "N/A";

  if (createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleString();
  }

  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
}

onAuthStateChanged(auth, (user) => {
  const container = document.getElementById("orders-container");

  if (!user) {
    if (container) {
      container.innerHTML = "Please login to view orders";
    }
    return;
  }

  loadOrders(user.uid);
});

async function loadOrders(userId) {
  const container = document.getElementById("orders-container");
  const empty = document.getElementById("empty-orders");

  if (!container) return;

  container.innerHTML = "Loading orders...";

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
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    container.innerHTML = "";

    if (orders.length === 0) {
      if (empty) empty.style.display = "block";
      return;
    }

    if (empty) empty.style.display = "none";

    orders.forEach((order) => {
      const div = document.createElement("div");
      div.classList.add("order-card");

      const itemsHTML = (order.items || []).map((item) => `
        <div class="order-item">
          <img src="${item.images?.[0] || item.image || ""}" class="order-img">
          <div>
            <p><b>${item.name || "Item"}</b></p>
            <p>${item.variation || "No option"}</p>
            <p>Qty: ${item.quantity || 1}</p>
          </div>
        </div>
      `).join("");

      div.innerHTML = `
        <h3>Order #${order.id}</h3>
        <p><b>Date:</b> ${formatOrderDate(order.createdAt)}</p>
        <p><b>Total:</b> GHS ${order.total || 0}</p>
        <p><b>Payment:</b> ${order.paymentMethod || "N/A"}</p>
        ${itemsHTML}
        <div class="tracking">
          <span class="track-step ${order.status === "Pending" ? "active" : ""}">Pending</span> ->
          <span class="track-step ${order.status === "Paid" ? "active" : ""}">Paid</span> ->
          <span class="track-step ${order.status === "Shipped" ? "active" : ""}">Shipped</span> ->
          <span class="track-step ${order.status === "Delivered" ? "active" : ""}">Delivered</span>
        </div>
        <p class="status ${(order.status || "pending").toLowerCase()}">
          ${order.status || "Pending"}
        </p>
      `;

      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading orders:", err);
    container.innerHTML = `Failed to load orders: ${err.message}`;
  }
}
