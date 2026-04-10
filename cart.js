let cart = JSON.parse(localStorage.getItem("cart")) || [];
const cartContainer = document.getElementById("cart-items");

function displayCart() {
  cartContainer.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    cartContainer.innerHTML = "<p>Your cart is empty</p>";
    return;
  }

  cart.forEach((item, index) => {
    if (!item.quantity) item.quantity = 1;
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const div = document.createElement("div");
    div.classList.add("cart-item");

    div.innerHTML = `
      <img src="${item.images ? item.images[0] : item.image}" width="80">
      <div class="cart-details">
        <h4>${item.name}</h4>
        ${item.variation ? `
  <p><strong>Option:</strong> ${item.variation}</p>
` : ""}
         <p>${item.description ? item.description : "No description available"}</p>
        <p>Price: GHS ${item.price}</p>
        <div class="quantity-controls">
          <button onclick="decrease(${index})">-</button>
          <span>${item.quantity}</span>
          <button onclick="increase(${index})">+</button>
        </div>
        <p>Subtotal: GHS ${subtotal}</p>
        <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
      </div>
      <hr>
    `;

    cartContainer.appendChild(div);
  });

  const totalDiv = document.createElement("h3");
  totalDiv.innerText = "Total: GHS " + total;
  cartContainer.appendChild(totalDiv);
}
 updateCartCount();

// Increase quantity
function increase(index) {
  cart[index].quantity++;
  saveAndRefresh();
}

// Decrease quantity
function decrease(index) {
  if (cart[index].quantity > 1) {
    cart[index].quantity--;
  } else {
    cart.splice(index, 1);
  }
  saveAndRefresh();
}

// Remove item
function removeItem(index) {
  cart.splice(index, 1);
  saveAndRefresh();
}

// Save to localStorage and refresh cart display
function saveAndRefresh() {
  localStorage.setItem("cart", JSON.stringify(cart));
  displayCart(); // **no page reload needed**
}

// Initial display
displayCart();

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartBtn = document.querySelector(".cart-btn");

  let totalItems = cart.reduce((sum, item) => {
    return sum + (item.quantity || 1);
  }, 0);

  if (cartBtn) {
    cartBtn.innerText = "Cart 🛒 (" + totalItems + ")";
  }}