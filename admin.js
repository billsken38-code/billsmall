import {
  collection,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging.js";

import { app, db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";

const messaging = getMessaging(app);
const container = document.getElementById("admin-container");
const totalOrdersEl = document.getElementById("total-orders");
const totalRevenueEl = document.getElementById("total-revenue");
const pendingOrdersEl = document.getElementById("pending-orders");

let chartInstance = null;

async function initNotifications() {
  if (!("Notification" in window)) return;

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") return;

    const token = await getToken(messaging, {
      vapidKey: "YOUR_VAPID_KEY_HERE"
    });

    console.log("FCM Token:", token);
  } catch (err) {
    console.error("Notification error:", err);
  }
}

onMessage(messaging, (payload) => {
  if (Notification.permission !== "granted") return;

  new Notification(payload.notification?.title || "New Order", {
    body: payload.notification?.body || "A new order was received."
  });
});

function showOrderPopup(orderId, name) {
  const popup = document.getElementById("order-popup");
  const text = document.getElementById("popup-text");

  if (!popup || !text) return;

  text.textContent = `Order #${orderId} from ${name || "Customer"}`;
  popup.classList.add("show");

  setTimeout(() => popup.classList.remove("show"), 4000);
}

function notify(orderId, name) {
  if (Notification.permission === "granted") {
    new Notification("New Order", {
      body: `Order #${orderId} from ${name || "Customer"}`
    });
  }
}

async function updateStatus(orderId, newStatus) {
  try {
    const ref = doc(db, "orders", orderId);
    await updateDoc(ref, { status: newStatus });
  } catch (err) {
    console.error("Status update failed:", err);
    alert(`Status update failed: ${err.message}`);
  }
}

function renderChart(orders) {
  const ctx = document.getElementById("salesChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ordersByDate = {};

  orders.forEach((order) => {
    if (!order.createdAt) return;

    const date = order.createdAt.seconds
      ? new Date(order.createdAt.seconds * 1000)
      : new Date(order.createdAt);

    const key = date.toLocaleString("default", {
      month: "short",
      year: "numeric"
    });

    if (!ordersByDate[key]) {
      ordersByDate[key] = 0;
    }

    ordersByDate[key] += 1;
  });

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(ordersByDate),
      datasets: [{
        label: "Orders per Month",
        data: Object.values(ordersByDate),
        borderColor: "#8B5E3C",
        backgroundColor: "rgba(139,94,60,0.2)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true
    }
  });
}

function renderOrderCard(orderId, order) {
  let itemsHTML = "";

  (order.items || []).forEach((item) => {
    itemsHTML += `
      <div style="display:flex; gap:10px; margin:5px 0;">
        <img src="${item.images?.[0] || item.image || ""}" width="60">
        <p>${item.name || "Item"} x ${item.quantity || 1}</p>
      </div>
    `;
  });

  const div = document.createElement("div");
  div.classList.add("admin-card");

  div.innerHTML = `
    <h3>${order.customer?.name || "Unknown"}</h3>
    <p>${order.customer?.phone || ""}</p>
    <p>${order.customer?.address || ""}</p>
    <p>${order.customer?.location || ""}</p>
    ${itemsHTML}
    <p><b>Total:</b> GHS ${order.total || 0}</p>
    <p><b>Status:</b> ${order.status || "Pending"}</p>
    <div class="admin-controls">
      <select id="status-${orderId}">
        <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
        <option value="Paid" ${order.status === "Paid" ? "selected" : ""}>Paid</option>
        <option value="Shipped" ${order.status === "Shipped" ? "selected" : ""}>Shipped</option>
        <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
      </select>
      <button onclick="changeStatus('${orderId}')">Update</button>
    </div>
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

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const order = change.doc.data();
          const orderId = change.doc.id;

          showOrderPopup(orderId, order.customer?.name);
          notify(orderId, order.customer?.name);
        }
      });

      let totalRevenue = 0;
      let pending = 0;
      const orders = [];

      snapshot.forEach((docSnap) => {
        const order = docSnap.data();
        orders.push(order);
        totalRevenue += Number(order.total) || 0;

        if ((order.status || "").toLowerCase() === "pending") {
          pending += 1;
        }

        container.appendChild(renderOrderCard(docSnap.id, order));
      });

      totalOrdersEl.innerText = snapshot.size;
      totalRevenueEl.innerText = `GHS ${totalRevenue}`;
      pendingOrdersEl.innerText = pending;

      if (snapshot.empty) {
        container.innerHTML = "No orders yet.";
      }

      renderChart(orders);
    },
    (err) => {
      console.error("Failed to load admin orders:", err);
      container.innerHTML = `Failed to load orders: ${err.message}`;
    }
  );
}

window.changeStatus = async function (orderId) {
  const select = document.getElementById(`status-${orderId}`);
  if (!select) return;

  await updateStatus(orderId, select.value);
};

requireAdmin()
  .then(() => {
    initNotifications();
    loadOrders();
  })
  .catch(() => {});
