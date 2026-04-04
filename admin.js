let orders = JSON.parse(localStorage.getItem("orders")) || [];
const container = document.getElementById("admin-container");

function displayOrders() {
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = "<p>No orders available.</p>";
    return;
  }

  orders.forEach((order, index) => {
    let div = document.createElement("div");
    div.classList.add("admin-card");

    let itemsHTML = order.items.map(item => `
      <p>${item.name} x ${item.quantity} = GHS ${item.price * item.quantity}</p>
    `).join("");

    div.innerHTML = `
      <h3>Order ${index + 1}</h3>
      <p><strong>Name:</strong> ${order.customer.name}</p>
      <p><strong>Phone:</strong> ${order.customer.phone}</p>
      <p><strong>Address:</strong> ${order.customer.address}</p>
      <p><strong>Date:</strong> ${order.date}</p>
      <p><strong>Location:</strong> ${order.customer.location}</p>
      <p><strong>Delivery Fee:</strong> GHS ${order.deliveryFee}</p>
      <div>${itemsHTML}</div>

      <h4>Total: GHS ${order.total}</h4>
      <p><strong>Payment:</strong> ${order.paymentMethod || "Not specified"}</p>
     <p>Status: <strong class="status ${order.status}">
  ${order.status}
</strong></p>

      <button onclick="updateStatus(${index}, 'Paid')">Mark Paid</button>
      <button onclick="updateStatus(${index}, 'Shipped')">Mark Shipped</button>
      <button onclick="updateStatus(${index}, 'Delivered')">Mark Delivered</button>
      <button onclick="deleteOrder(${index})">Delete</button>

      <hr>
    `;

    container.appendChild(div);
  });
}

// Mark as delivered
function markDelivered(index) {
  orders[index].status = "Delivered";
  saveOrders();
}

// Delete order
function deleteOrder(index) {
  if (confirm("Delete this order?")) {
    orders.splice(index, 1);
    saveOrders();
  }
}

// Save + refresh
function saveOrders() {
  localStorage.setItem("orders", JSON.stringify(orders));
  displayOrders();
  updateStats(); // 👈 ADD THIS
}



function updateStats() {
  let totalOrders = orders.length;

  let totalRevenue = 0;
  let pending = 0;

  orders.forEach(order => {
    totalRevenue += order.total;

    if (order.status === "Pending") {
      pending++;
    }
  });

  document.getElementById("total-orders").innerText = totalOrders;
  document.getElementById("total-revenue").innerText = "GHS " + totalRevenue;
  document.getElementById("pending-orders").innerText = pending;
}

function updateStatus(index, status) {
  orders[index].status = status;
  saveOrders();
}


// Initial display
displayOrders();
updateStats();
