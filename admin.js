// ====== admin.js ======

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
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

// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

// 🔥 INIT
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

const container = document.getElementById("admin-container");

// =======================
// 🔔 NOTIFICATIONS
// =======================
async function initNotifications() {
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

// Foreground messages
onMessage(messaging, (payload) => {
  new Notification(payload.notification.title, {
    body: payload.notification.body
  });
});

// =======================
// 🔔 POPUP ALERT
// =======================
function showOrderPopup(orderId, name) {
  const popup = document.getElementById("order-popup");
  const text = document.getElementById("popup-text");

  if (!popup || !text) return;

  text.textContent = `Order #${orderId} from ${name || "Customer"}`;
  popup.classList.add("show");

  setTimeout(() => popup.classList.remove("show"), 4000);
}

// =======================
// 🔔 BROWSER NOTIFY
// =======================
function notify(orderId, name) {
  if (Notification.permission === "granted") {
    new Notification("🛒 New Order", {
      body: `Order #${orderId} from ${name || "Customer"}`
    });
  }
}

// =======================
// ✏️ UPDATE STATUS
// =======================
async function updateStatus(orderId, newStatus) {
  try {
    const ref = doc(db, "orders", orderId);
    await updateDoc(ref, { status: newStatus });
  } catch (err) {
    console.error("Status update failed:", err);
  }
}

// =======================
// 📊 CHART
// =======================
let chartInstance = null;

function renderChart(orders) {
  const ctx = document.getElementById("salesChart");

  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy(); // prevent duplicates
  }

  const labels = orders.map(o => o.customer?.name || "User");
  const data = orders.map(o => Number(o.total) || 0);

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sales (GHS)",
        data,
        backgroundColor: "#8B5E3C"
      }]
    },
    options: {
      responsive: true
    }
  });
}

// =======================
// 📦 LOAD ORDERS
// =======================
function loadOrders() {
  container.innerHTML = "Loading orders...";

  onSnapshot(collection(db, "orders"), (snapshot) => {

    container.innerHTML = "";

    // 🔔 detect new orders
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const order = change.doc.data();
        const orderId = change.doc.id;

        showOrderPopup(orderId, order.customer?.name);
        notify(orderId, order.customer?.name);
      }
    });

    // 📊 stats
    let totalOrders = snapshot.size;
    let totalRevenue = 0;
    let pending = 0;

    const ordersArray = [];

    snapshot.forEach(docSnap => {
      const order = docSnap.data();
      const orderId = docSnap.id;

      ordersArray.push(order);

      totalRevenue += Number(order.total) || 0;
      if ((order.status || "").toLowerCase() === "pending") {
        pending++;
      }

      let itemsHTML = "";

      (order.items || []).forEach(item => {
        itemsHTML += `
          <div style="display:flex; gap:10px; margin:5px 0;">
            <img src="${item.images ? item.images[0] : item.image || ''}" width="60">
            <p>${item.name} x ${item.quantity || 1}</p>
          </div>
        `;
      });

      const div = document.createElement("div");
      div.classList.add("admin-card");

      div.innerHTML = `
        <h3>${order.customer?.name || "Unknown"}</h3>
        <p>${order.customer?.phone || ""}</p>
        <p>${order.customer?.address || ""}</p>

        ${itemsHTML}

        <p><b>Total:</b> GHS ${order.total || 0}</p>

        <p>
          <b>Status:</b>
          <span class="status ${(order.status || "pending").toLowerCase()}">
            ${order.status || "Pending"}
          </span>
        </p>

        <div class="admin-controls">
          <select id="status-${orderId}">
            <option value="Pending" ${order.status==="Pending"?"selected":""}>Pending</option>
            <option value="Paid" ${order.status==="Paid"?"selected":""}>Paid</option>
            <option value="Shipped" ${order.status==="Shipped"?"selected":""}>Shipped</option>
            <option value="Delivered" ${order.status==="Delivered"?"selected":""}>Delivered</option>
          </select>

          <button onclick="changeStatus('${orderId}')">Update</button>
        </div>
      `;

      container.appendChild(div);
    });

    // 🔥 update stats UI
    document.getElementById("total-orders").innerText = totalOrders;
    document.getElementById("total-revenue").innerText = "GHS " + totalRevenue;
    document.getElementById("pending-orders").innerText = pending;

    // 📊 render chart ONCE
    renderChart(ordersArray);
  });
}

// =======================
// 🌍 GLOBAL FUNCTION
// =======================
window.changeStatus = async function(orderId) {
  const select = document.getElementById(`status-${orderId}`);
  const newStatus = select.value;

  await updateStatus(orderId, newStatus);
};

// =======================
// 🚀 INIT
// =======================
initNotifications();
loadOrders();