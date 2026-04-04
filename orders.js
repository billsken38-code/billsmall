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