import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);
const container = document.getElementById("admin-container");

// =======================
// 🔔 PUSH NOTIFICATIONS
// =======================
function notify(orderId, name) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification("🛒 New Order Received", {
      body: `Order #${orderId} from ${name || "Customer"}`
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification("🛒 New Order Received", {
          body: `Order #${orderId} from ${name || "Customer"}`
        });
      }
    });
  }
}

// =======================
// 🔔 POPUP ALERT
// =======================
function showOrderPopup(orderId, customerName) {
  const popup = document.getElementById("order-popup");
  const text = document.getElementById("popup-text");

  if (!popup || !text) return;

  text.textContent = `Order #${orderId} from ${customerName || "Unknown"}`;
  popup.classList.add("show");

  setTimeout(() => popup.classList.remove("show"), 4000);
}

// =======================
// ✏️ UPDATE STATUS
// =======================
async function updateStatus(orderId, newStatus) {
  const ref = doc(db, "orders", orderId);
  await updateDoc(ref, {
    status: newStatus
  });
}

// =======================
// 🔥 LOAD ORDERS REALTIME
// =======================
function loadOrders() {
  container.innerHTML = "Loading orders...";

  onSnapshot(collection(db, "orders"), (snapshot) => {
    container.innerHTML = "";

    snapshot.docChanges().forEach(change => {
      const order = change.doc.data();
      const orderId = change.doc.id;

      // 🔔 NEW ORDER
      if (change.type === "added") {
        showOrderPopup(orderId, order.customer?.name);
        notify(orderId, order.customer?.name);
      }
    });

    snapshot.forEach(docSnap => {
      renderChart(snapshot.docs.map(doc => doc.data()));
      const order = docSnap.data();
      const orderId = docSnap.id;

      let itemsHTML = "";

      (order.items || []).forEach(item => {
        itemsHTML += `
          <div style="display:flex; gap:10px; margin:5px 0;">
            <img src="${item.images ? item.images[0] : item.image || ''}" width="60">
            <p>${item.name} x ${item.quantity}</p>
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
          <b>Status:</b> <span class="status ${order.status || "pending"}">
            ${order.status || "Pending"}
          </span>
        </p>

        <!-- 🔥 STATUS CONTROLS -->
        <div class="admin-controls">
          <select id="status-${orderId}">
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>

          <button onclick="changeStatus('${orderId}')">Update</button>
        </div>
      `;

      container.appendChild(div);
    });
  });
}

// =======================
// 🔥 GLOBAL FUNCTION
// =======================
window.changeStatus = async function(orderId) {
  const select = document.getElementById(`status-${orderId}`);
  const newStatus = select.value;

  await updateStatus(orderId, newStatus);
};
async function initNotifications() {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission denied");
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: "YOUR_VAPID_KEY_HERE"
    });

    console.log("FCM Token:", token);

    // 👉 send this token to Firestore if you want later
  } catch (err) {
    console.error("Notification error:", err);
  }
}
onMessage(messaging, (payload) => {
  console.log("Message received:", payload);

  new Notification(payload.notification.title, {
    body: payload.notification.body
  });
});

function renderChart(orders) {
  const ctx = document.getElementById("salesChart");

  const labels = orders.map(o => o.customer?.name || "User");
  const data = orders.map(o => Number(o.total) || 0);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Sales (GHS)",
        data: data,
        backgroundColor: "#8B5E3C"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true
        }
      }
    }
  });
}
initNotifications();
loadOrders();