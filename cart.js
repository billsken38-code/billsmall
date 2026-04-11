let cart = JSON.parse(localStorage.getItem("cart")) || [];

const cartContainer = document.getElementById("cart-items");
const totalDisplay = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout-btn");

// ================= DISPLAY CART =================
function displayCart() {
  cartContainer.innerHTML = "";

  if (cart.length === 0) {
    cartContainer.innerHTML = "<p>Your cart is empty 🛒</p>";
    totalDisplay.innerText = "";
    checkoutBtn.disabled = true;
    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    let qty = item.quantity || 1;
    let subtotal = item.price * qty;
    total += subtotal;

    const div = document.createElement("div");
    div.classList.add("cart-item");

    div.innerHTML = `
      <img src="${item.images ? item.images[0] : item.image}" width="80">

      <div class="cart-details">
        <h4>${item.name}</h4>

        ${item.variation ? `<p><strong>Option:</strong> ${item.variation}</p>` : ""}

        <p>${item.description || "No description available"}</p>
        <p><b>Price:</b> GHS ${item.price}</p>

        <div class="quantity-controls">
          <button onclick="decrease(${index})">-</button>
          <span>${qty}</span>
          <button onclick="increase(${index})">+</button>
        </div>

        <p><b>Subtotal:</b> GHS ${subtotal}</p>

        <button class="remove-btn" onclick="removeItem(${index})">
          Remove
        </button>
      </div>
    `;

    cartContainer.appendChild(div);
  });

  totalDisplay.innerText = "Total: GHS " + total;
  checkoutBtn.disabled = false;
}

// ================= ACTIONS =================
function increase(index) {
  cart[index].quantity = (cart[index].quantity || 1) + 1;
  saveAndRefresh();
}

function decrease(index) {
  if ((cart[index].quantity || 1) > 1) {
    cart[index].quantity--;
  } else {
    cart.splice(index, 1);
  }
  saveAndRefresh();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveAndRefresh();
}

// ================= SAVE =================
function saveAndRefresh() {
  localStorage.setItem("cart", JSON.stringify(cart));
  displayCart();
}

// ================= CART COUNT =================
function updateCartCount() {
  const cartBtn = document.querySelector(".cart-btn");

  let totalItems = cart.reduce((sum, item) => {
    return sum + (item.quantity || 1);
  }, 0);

  if (cartBtn) {
    cartBtn.innerText = `Cart 🛒 (${totalItems})`;
  }
}

// ================= INIT =================
displayCart();
updateCartCount();