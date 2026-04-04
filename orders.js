import { collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let orders = JSON.parse(localStorage.getItem("orders")) || [];
const container = document.getElementById("orders-container");

if (orders.length === 0) {
  container.innerHTML = "<p>No orders yet.</p>";
} else {
  orders.forEach((order, index) => {
    let div = document.createElement("div");
    div.classList.add("order-card");

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
  const ordersContainer = document.getElementById("orders-container");

  ordersContainer.innerHTML = "Loading...";

  try {
    const querySnapshot = await getDocs(collection(db, "orders"));

    ordersContainer.innerHTML = "";

    querySnapshot.forEach(doc => {
      const order = doc.data();

      const div = document.createElement("div");
      div.innerHTML = `
        <h3>${order.customer.name}</h3>
        <p>Phone: ${order.customer.phone}</p>
        <p>Total: GHS ${order.total}</p>
        <p>Status: ${order.status}</p>
      `;

      ordersContainer.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading orders:", err);
  }
}

loadOrders();