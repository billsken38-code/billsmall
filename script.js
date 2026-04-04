// Load products from localStorage or default
let products = JSON.parse(localStorage.getItem("products")) || [
  
{
  name: "Sneakers",
  price: 120,
  image: "images/shoe.jpg",
  description: "Comfortable and stylish sneakers for everyday wear.",
  variations: ["Size 38", "Size 39", "Size 40"]
}
  
];
function saveProducts() {
  localStorage.setItem("products", JSON.stringify(products));
}

// Cart system
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// display products
function displayProducts(list) {
  const productContainer = document.getElementById("products-container");
  productContainer.innerHTML = "";

  list.forEach((product, index) => {
    let div = document.createElement("div");
    div.classList.add("product");

    div.innerHTML = `
      <div onclick="goToDetails(${index})" style="cursor:pointer;">
      <img src="${product.images[0]}" class="main-img" alt="${product.name}"
      <h4>${product.name}</h4>
      <p>GHS ${product.price}</p>
     <p>${product.description}</p>
  
     <button onclick="addToCart(${index})">Add to Cart</button>`;

    productContainer.appendChild(div);
  });
}
  
// Initial display
displayProducts(products);
document.addEventListener("keydown", function(e) {
  if (e.ctrlKey && e.key === "a") {
    document.getElementById("admin-link").style.display = "block";
    alert("Admin link unlocked!");
  }
});
// Add to cart
function addToCart(index) {
  let products = JSON.parse(localStorage.getItem("products")) || [];
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  let product = products[index];

  let existing = cart.find(item => item.name === product.name);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  }
   else {
  cart.push({
  name: product.name,
  price: product.price,
  images: product.images ? product.images : [product.image],
  description: product.description ? product.description : "",
  variation: selectedVariation || null,
  quantity: 1
});
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  alert("Added to cart!");
updateCartCount();
}

// Update cart count
function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartBtn = document.querySelector(".cart-btn");

  let totalItems = cart.reduce((sum, item) => {
    return sum + (item.quantity || 1);
  }, 0);

  if (cartBtn) {
    cartBtn.innerText = "Cart 🛒 (" + totalItems + ")";
  }
}

updateCartCount();

// Search products
function searchProducts() {
  const input = document.getElementById("search-input").value.toLowerCase();
  const filtered = products.filter(product =>
    product.name.toLowerCase().includes(input) ||
    product.category.toLowerCase().includes(input)
  );
  displayProducts(filtered);
}

// Filter by category
function filterCategory(category) {
  if (category === "all") {
    displayProducts(products);
  } else {
    const filtered = products.filter(product => product.category === category);
    displayProducts(filtered);
  }
}

// change product element
function changeImage(element) {
  const mainImage = element.closest('.product').querySelector('.main-img');
  mainImage.src = element.src;
}

//lightbox 
let currentProductIndex = 0;
let currentImageIndex = 0;

function openLightbox(productIndex) {
  currentProductIndex = productIndex;
  currentImageIndex = 0;
  const lb = document.getElementById("lightbox");
  lb.style.display = "flex";
  document.querySelector(".lightbox-img").src = products[productIndex].images[0];
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

function nextImage() {
  const product = products[currentProductIndex];
  currentImageIndex = (currentImageIndex + 1) % product.images.length;
  document.querySelector(".lightbox-img").src = product.images[currentImageIndex];}
function prevImage() {
  const product = products[currentProductIndex];
  currentImageIndex = (currentImageIndex - 1 + product.images.length) % product.images.length;
  document.querySelector(".lightbox-img").src = product.images[currentImageIndex];
  }
  function goToDetails(index) {
  localStorage.setItem("selectedProduct", index);
  window.location.href = "product.html";
}