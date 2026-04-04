let orders = JSON.parse(localStorage.getItem("orders")) || [];

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