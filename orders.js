// 🔥 FIREBASE IMPORTS
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

// 🔥 INIT
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 LOAD ORDERS
async function loadOrders() {
  const container =
    document.getElementById("orders-container") ||
    document.getElementById("admin-container");

  if (!container) return;

  container.innerHTML = "Loading orders...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const order = doc.data();

      let itemsHTML = "";

      order.items.forEach(item => {
        itemsHTML += `
          <div style="display:flex; gap:10px;">
            <img src="${item.image}" width="60">
            <p>${item.name} x ${item.quantity}</p>
          </div>
        `;
      });

      const div = document.createElement("div");

      div.innerHTML = `
        <h3>${order.customer.name}</h3>
        <p>${order.customer.phone}</p>
        <p>${order.customer.address}</p>

        ${itemsHTML}

        <p><b>Total:</b> GHS ${order.total}</p>
        <p><b>Status:</b> ${order.status || "Pending"}</p>
        <hr>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

// 🚀 RUN
loadOrders();