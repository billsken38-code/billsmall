import {
  collection,
  onSnapshot,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";

const container = document.getElementById("orders-container");

function renderOrderCard(orderId, order) {
  let itemsHTML = "";

  (order.items || []).forEach((item) => {
    itemsHTML += `
      <div style="display:flex; gap:10px; align-items:center; margin:5px 0;">
        <img src="${item.images?.[0] || item.image || ""}" width="60">
        <div>
          <p><b>${item.name || "Item"}</b></p>
          <p>Qty: ${item.quantity || 1}</p>
        </div>
      </div>
    `;
  });

  const div = document.createElement("div");
  div.classList.add("order-card");

  div.innerHTML = `
    <h3>Order #${orderId}</h3>
    <p><b>Name:</b> ${order.customer?.name || ""}</p>
    <p><b>Email:</b> ${order.customer?.email || ""}</p>
    <p><b>Phone:</b> ${order.customer?.phone || ""}</p>
    <p><b>Address:</b> ${order.customer?.address || ""}</p>
    <p><b>Location:</b> ${order.customer?.location || ""}</p>
    ${itemsHTML}
    <p><b>Total:</b> GHS ${order.total || 0}</p>
    <p><b>Status:</b> ${order.status || "Pending"}</p>
    <select id="status-${orderId}">
      <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
      <option value="Paid" ${order.status === "Paid" ? "selected" : ""}>Paid</option>
      <option value="Shipped" ${order.status === "Shipped" ? "selected" : ""}>Shipped</option>
      <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
    </select>
    <button onclick="updateStatus('${orderId}')">Update Status</button>
    <hr>
  `;

  return div;
}

function loadOrders() {
  if (!container) return;

  container.innerHTML = "Loading orders...";

  onSnapshot(
    collection(db, "orders"),
    (snapshot) => {
      container.innerHTML = "";

      if (snapshot.empty) {
        container.innerHTML = "No orders yet.";
        return;
      }

      snapshot.forEach((docSnap) => {
        container.appendChild(renderOrderCard(docSnap.id, docSnap.data()));
      });
    },
    (err) => {
      console.error("Error loading orders:", err);
      container.innerHTML = `Failed to load orders: ${err.message}`;
    }
  );
}

window.updateStatus = async function (orderId) {
  const select = document.getElementById(`status-${orderId}`);
  if (!select) return;

  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: select.value
    });

    alert("Status updated!");
  } catch (err) {
    console.error("Status update failed:", err);
    alert(`Status update failed: ${err.message}`);
  }
};

requireAdmin()
  .then(() => {
    loadOrders();
  })
  .catch(() => {});
