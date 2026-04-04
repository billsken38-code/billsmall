import { collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app)

const container = document.getElementById("orders-container");

function displayOrders() {
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  orders.reverse().forEach((order, orderIndex) => {
    let div = document.createElement("div");
    div.classList.add("order-card");

    // 🖼️ ITEMS WITH IMAGES
    let itemsHTML = order.items.map(item => `
      <div class="order-item">
        <img src="${item.images ? item.images[0] : item.image}" class="order-img">

        <div>
          <p><strong>${item.name}</strong></p>
          <p>${item.variation ? "Option: " + item.variation : ""}</p>
          <p>Qty: ${item.quantity}</p>
        </div>
      </div>
    `).join("");

    // 🚚 TRACKING STATUS
    let statusSteps = ["Order placed", "Shipped", "Delivered"];

    let trackingHTML = statusSteps.map(step => `
      <span class="track-step ${order.status === step ? "active" : ""}">
        ${step}
      </span>
    `).join(" ➝ ");

    div.innerHTML = `
      <h3>${order.customer.name}</h3>

      <div class="order-items">
        ${itemsHTML}
      </div>

      <p><strong>Delivery Fee:</strong> GHS ${order.deliveryFee}</p>
      <p><strong>Total:</strong> GHS ${order.total}</p>

      <div class="tracking">
        ${trackingHTML}
      </div>

      <p class="status">${order.status}</p>
      <small>${order.date}</small>
    `;

    container.appendChild(div);
  });
}

displayOrders();
// 🔥 LOAD ORDERS
async function loadOrders() {
  const container = document.getElementById("orders-container");

  container.innerHTML = "Loading orders...";

  try {
    const snapshot = await getDocs(collection(db, "orders"));

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const order = doc.data();

      const div = document.createElement("div");
      div.classList.add("order-card");

      // 🔥 SHOW ITEMS + IMAGES
      let itemsHTML = "";
      order.items.forEach(item => {
        itemsHTML += `
          <div>
            <img src="${item.image}" width="60">
            <p>${item.name} (${item.variation}) x ${item.quantity}</p>
          </div>
        `;
      });

      div.innerHTML = `
        <h3>${order.customer.name}</h3>
        <p>${order.customer.phone}</p>
        <p>${order.customer.address}</p>
        <p><b>Location:</b> ${order.customer.location}</p>

        ${itemsHTML}

        <p><b>Total:</b> GHS ${order.total}</p>
        <p><b>Status:</b> ${order.status}</p>
        <hr>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

loadOrders();