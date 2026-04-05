import { collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
// 🔥 YOUR CONFIG
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

if (orders.length === 0) {
  container.innerHTML = "<p>No orders yet.</p>";
} else {
  orders.forEach((order, index) => {
    let div = document.createElement("div");
    div.classList.add("order-card");
localStorage.setItem("userId", phone);
    let itemsHTML = order.items.map(item => `
      <p>${item.name} x ${item.quantity} = GHS ${item.price * item.quantity}</p>
    `).join("");

    div.innerHTML = `
      <h3>Order ${index + 1}</h3>
      <p><strong>Name:</strong> ${order.customer.name}</p>
      <p><strong>Phone:</strong> ${order.customer.phone}</p>
      <p><strong>Address:</strong> ${order.customer.address}</p>
      <p><strong>Date:</strong> ${order.date}</p>

      <div>${itemsHTML}</div>

      <h4>Total: GHS ${order.total}</h4>
      <hr>
    `;

    container.appendChild(div);
  });
}
async function loadOrders() {
  const container =
    document.getElementById("orders-container") ||
    document.getElementById("admin-container");

  if (!container) return;

  const isUserPage = document.getElementById("orders-container"); // user page
  const currentUser = localStorage.getItem("userId");

  container.innerHTML = "Loading orders...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const order = doc.data();

      // 🔒 FILTER FOR USER PAGE
      if (isUserPage && order.userId !== currentUser) return;

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
        <p><b>Status:</b> ${order.status}</p>
        <hr>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error:", err);
  }
}