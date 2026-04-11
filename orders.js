import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

const container = document.getElementById("orders-container");

// ================= LOAD ORDERS =================
async function loadOrders() {
  container.innerHTML = "Loading orders...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      const order = docSnap.data();
      const orderId = docSnap.id;

      let itemsHTML = "";

      (order.items || []).forEach(item => {
        itemsHTML += `
          <div style="display:flex; gap:10px; align-items:center; margin:5px 0;">
            <img src="${item.images ? item.images[0] : item.image}" width="60">
            <div>
              <p><b>${item.name}</b></p>
              <p>Qty: ${item.quantity}</p>
            </div>
          </div>
        `;
      });

      const div = document.createElement("div");
      div.classList.add("order-card");

      div.innerHTML = `
        <h3>Order #${orderId}</h3>

        <p><b>Name:</b> ${order.customer?.name || ""}</p>
        <p><b>Phone:</b> ${order.customer?.phone || ""}</p>
        <p><b>Address:</b> ${order.customer?.address || ""}</p>
        <p><b>Location:</b> ${order.customer?.location || ""}</p>

        ${itemsHTML}

        <p><b>Total:</b> GHS ${order.total}</p>

        <p><b>Status:</b> ${order.status || "Pending"}</p>

        <!-- STATUS CONTROL -->
        <select id="status-${orderId}">
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
        </select>

        <button onclick="updateStatus('${orderId}')">
          Update Status
        </button>

        <hr>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

// ================= UPDATE STATUS =================
window.updateStatus = async function(orderId) {
  const select = document.getElementById(`status-${orderId}`);
  const newStatus = select.value;

  const ref = doc(db, "orders", orderId);

  await updateDoc(ref, {
    status: newStatus
  });

  alert("Status updated!");
  loadOrders(); // refresh UI
};

// 🚀 RUN
loadOrders();