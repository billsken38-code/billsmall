import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔥 Firebase config
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

const container = document.getElementById("admin-container");

// 🔥 LOAD ORDERS
async function loadOrders() {
  container.innerHTML = "Loading orders...";

  let totalOrders = 0;
  let totalRevenue = 0;
  let pending = 0;

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const order = doc.data();

      totalOrders++;
      totalRevenue += Number(order.total) || 0;

      if ((order.status || "").toLowerCase() === "pending") {
        pending++;
      }

      let itemsHTML = "";

      order.items.forEach(item => {
        itemsHTML += `
          <div style="display:flex; gap:10px;">
           <img src="${item.images ? item.images[0] : item.image || ''}" width="60">
            <p>${item.name} x ${item.quantity}</p>
          </div>
        `;
      });

      const div = document.createElement("div");
      div.classList.add("admin-card");

      div.innerHTML = `
        <h3>${order.customer.name}</h3>
        <p>${order.customer.phone}</p>
        <p>${order.customer.address}</p>
        <p><b>Location:</b> ${order.customer.location}</p>

        ${itemsHTML}

        <p><b>Total:</b> GHS ${order.total}</p>
        <p><b>Status:</b> ${order.status || "Pending"}</p>
        <hr>
      `;

      container.appendChild(div);
    });

    // 🔥 UPDATE STATS
    document.getElementById("total-orders").innerText = totalOrders;
    document.getElementById("total-revenue").innerText = "GHS " + totalRevenue;
    document.getElementById("pending-orders").innerText = pending;

  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

// 🚀 RUN
loadOrders();