let cart = JSON.parse(localStorage.getItem("cart")) || [];

const cartContainer = document.getElementById("cart-items");
const totalDisplay = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");
const checkoutLink = document.getElementById("checkout-link");

const summaryItems = document.getElementById("cart-summary-items");
const summaryProducts = document.getElementById("cart-summary-products");
const summaryTotal = document.getElementById("cart-summary-total");

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function displayCart() {
  if (!cartContainer) return;

  cartContainer.innerHTML = "";

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="cart-empty-state">
        <h3>Your cart is empty 🛒</h3>
        <p>Add some products to continue shopping.</p>
        <a href="index.html" class="cart-shop-link">Go to Shop</a>
      </div>
    `;

    totalDisplay.innerText = formatCurrency(0);
    summaryItems.innerText = "0";
    summaryProducts.innerText = "0";
    summaryTotal.innerText = formatCurrency(0);

    checkoutBtn.disabled = true;
    checkoutLink.removeAttribute("href");
    return;
  }

  let total = 0;
  let totalItems = 0;

  cart.forEach((item, index) => {
    const qty = Number(item.quantity || 1);
    const subtotal = Number(item.price || 0) * qty;
    total += subtotal;
    totalItems += qty;

    const div = document.createElement("article");
    div.classList.add("cart-item");

    div.innerHTML = `
      <img src="${item.images?.[0] || item.image || ""}" alt="${item.name || "Product"}">

      <div class="cart-details">
        <h3>${item.name || "Unnamed Product"}</h3>

        ${item.variation ? `<p><strong>Option:</strong> ${item.variation}</p>` : ""}
        <p>${item.description || "No description available"}</p>
        <p class="cart-price">${formatCurrency(item.price)}</p>

        <div class="quantity-controls">
          <button type="button" data-action="decrease" data-index="${index}">-</button>
          <span>${qty}</span>
          <button type="button" data-action="increase" data-index="${index}">+</button>
        </div>

        <p><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>

        <button type="button" class="remove-btn" data-action="remove" data-index="${index}">
          Remove
        </button>
      </div>
    `;

    cartContainer.appendChild(div);
  });

  totalDisplay.innerText = formatCurrency(total);
  summaryItems.innerText = totalItems;
  summaryProducts.innerText = cart.length;
  summaryTotal.innerText = formatCurrency(total);

  checkoutBtn.disabled = false;
  checkoutLink.setAttribute("href", "checkout.html");
}

function increase(index) {
  cart[index].quantity = Number(cart[index].quantity || 1) + 1;
  saveAndRefresh();
}

function decrease(index) {
  if (Number(cart[index].quantity || 1) > 1) {
    cart[index].quantity -= 1;
  } else {
    cart.splice(index, 1);
  }
  saveAndRefresh();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveAndRefresh();
}

function saveAndRefresh() {
  localStorage.setItem("cart", JSON.stringify(cart));
  displayCart();
  updateCartCount();
}

function updateCartCount() {
  const countElement = document.querySelector(".cart-count");
  const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  if (countElement) {
    countElement.innerText = totalItems;
  }
}

cartContainer?.addEventListener("click", (event) => {
  const action = event.target.getAttribute("data-action");
  const index = Number(event.target.getAttribute("data-index"));

  if (!action || Number.isNaN(index)) return;

  if (action === "increase") increase(index);
  if (action === "decrease") decrease(index);
  if (action === "remove") removeItem(index);
});

displayCart();
updateCartCount();