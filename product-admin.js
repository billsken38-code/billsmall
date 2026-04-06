let products = JSON.parse(localStorage.getItem("products")) || [];
const productList = document.getElementById("product-list");

function displayProducts() {
  productList.innerHTML = "";

  products.forEach((product, index) => {
    let div = document.createElement("div");
    div.classList.add("admin-card");

    div.innerHTML = `
      <h4>${product.name}</h4>
      <p>GHS ${product.price}</p>
      <p>Category: ${product.category}</p>
      <img src="${product.images ? product.images[0] : product.image}" width="80">
      <button onclick="deleteProduct(${index})">Delete</button>
      <hr>
    `;

    productList.appendChild(div);
  });
}
function addProduct() {
  let name = document.getElementById("name").value.trim();
  let price = document.getElementById("price").value.trim();
  let category = document.getElementById("category").value;
  let imagesInput = document.getElementById("images").value.trim();
  let description = document.getElementById("product-description").value.trim();
let variationsInput = document.getElementById("variations").value.trim();

let variations = variationsInput 
  ? variationsInput.split(",").map(v => v.trim()) 
  : null;
  if (!name || !price || !imagesInput || !description) {
    alert("⚠️ Please fill all fields!");
    return;
  }

  // ✅ convert comma images to array
  let images = imagesInput.split(",").map(img => img.trim());

  let newProduct = {
    name,
    price: Number(price),
    category,
    images, // ✅ IMPORTANT
    description,
    variations
  };

  products.push(newProduct);
  localStorage.setItem("products", JSON.stringify(products));

  alert("✅ Product added!");

  displayProducts();

  // Clear form
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("images").value = "";
  document.getElementById("product-description").value = "";
}
// Add product
// Delete product
function deleteProduct(index) {
  products.splice(index, 1);
  localStorage.setItem("products", JSON.stringify(products));
  displayProducts();
}

// Initial display
displayProducts();
// 🔥 MAKE FUNCTIONS GLOBAL
window.addToCart = addToCart;
window.selectVariation = selectVariation;
window.changeMainImage = changeMainImage;