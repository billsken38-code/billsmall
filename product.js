// Load products
let products = JSON.parse(localStorage.getItem("products")) || [];
let index = localStorage.getItem("selectedProduct");

// Safety check
if (index === null || !products[index]) {
  document.getElementById("product-details").innerHTML = "<p>Product not found</p>";
} else {

  let product = products[index];

  // ✅ Handle images (old + new format)
  let images = product.images ? product.images : [product.image];

  // ✅ Create thumbnails
  const imagesHTML = images.map(img => `
    <img src="${img}" class="thumb" onclick="changeMainImage('${img}')">
  `).join("");

  const container = document.getElementById("product-details");

  container.innerHTML = `
    <div class="details-container">

      <!-- LEFT -->
      <div class="details-left">
        <img src="${images[0]}" id="main-image" class="details-img">

        <div class="thumbnail-container">
          ${imagesHTML}
        </div>
      </div>

      <!-- RIGHT -->
      <div class="details-right">
        <h2>${product.name}</h2>
        <p><strong>GHS ${product.price}</strong></p>

        <p class="details-description">
          ${product.description ? product.description : "No description available"}
        </p>

        ${product.variations ? `
          <label>Select Option:</label>
          <div class="variation-container">
            ${product.variations.map(v => `
              <button class="variation-btn" onclick="selectVariation('${v}', this)">
                ${v}
              </button>
            `).join("")}
          </div>
        ` : ""}

        <br>

        <button onclick="addToCart(${index})">Add to Cart</button>
      </div>

    </div>
  `;
}

// ✅ Variation selection
let selectedVariation = null;

function selectVariation(value, element) {
  selectedVariation = value;

  document.querySelectorAll(".variation-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  element.classList.add("active");
}

// ✅ Change main image
function changeMainImage(src) {
  document.getElementById("main-image").src = src;
}

// ✅ Add to cart
function addToCart(index) {
  let products = JSON.parse(localStorage.getItem("products")) || [];
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  let product = products[index];

  // 🚨 Require variation if exists
  if (product.variations && !selectedVariation) {
    alert("Please select a variation!");
    return;
  }

  let existing = cart.find(item => 
    item.name === product.name && item.variation === selectedVariation
  );

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      name: product.name,
      price: product.price,
      images: product.images ? product.images : [product.image],
      description: product.description || "",
      variation: selectedVariation,
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  alert("Added to cart!");
}