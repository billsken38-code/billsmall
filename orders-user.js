// 🔥 FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔥 CONFIG
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

// 🔐 GET CURRENT USER
const userId = localStorage.getItem("userId");

// ================= LOAD ORDERS =================
async function loadOrders() {
  const container = document.getElementById("orders-container");
  const empty = document.getElementById("empty-orders");

  if (!container) return;

  container.innerHTML = "Loading orders...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    let userOrders = [];

    snapshot.forEach(doc => {
      const order = doc.data();

      // 🔥 FILTER ONLY CURRENT USER
      if (order.userId === userId) {
        userOrders.push({ id: doc.id, ...order });
      }
    });

    // 🔥 SORT (LATEST FIRST)
    userOrders.reverse();

    container.innerHTML = "";

    if (userOrders.length === 0) {
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";

    userOrders.forEach(order => {
      let itemsHTML = "";

      (order.items || []).forEach(item => {
        itemsHTML += `
          <div class="order-item">
            <img src="${item.images ? item.images[0] : item.image}" class="order-img">
            <div>
              <p><b>${item.name}</b></p>
              <p>${item.variation || "No option"}</p>
              <p>Qty: ${item.quantity}</p>
            </div>
          </div>
        `;
      });

      const div = document.createElement("div");
      div.classList.add("order-card");

      div.innerHTML = `
        <h3>Order #${order.id}</h3>

        <p><b>Date:</b> ${order.date || ""}</p>
        <p><b>Total:</b> GHS ${order.total}</p>

        ${itemsHTML}

        <!-- 🔥 TRACKING -->
        <div class="tracking">
          <span class="track-step ${order.status === "Pending" ? "active" : ""}">Pending</span> →
          <span class="track-step ${order.status === "Paid" ? "active" : ""}">Paid</span> →
          <span class="track-step ${order.status === "Shipped" ? "active" : ""}">Shipped</span> →
          <span class="track-step ${order.status === "Delivered" ? "active" : ""}">Delivered</span>
        </div>

        <p class="status ${order.status?.toLowerCase()}">
          ${order.status || "Pending"}
        </p>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

// 🚀 RUN
loadOrders();