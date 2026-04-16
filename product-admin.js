import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";

const productList = document.getElementById("product-list");

async function displayProducts() {
  productList.innerHTML = "Loading products...";

  try {
    const snapshot = await getDocs(collection(db, "products"));

    productList.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const product = docSnap.data();
      const id = docSnap.id;

      const div = document.createElement("div");
      div.classList.add("admin-card");

      div.innerHTML = `
        <h3>${product.name}</h3>
        <p><b>Price:</b> GHS ${product.price}</p>
        <p><b>Category:</b> ${product.category}</p>
        <img src="${product.images?.[0] || ""}" width="80">
        <button onclick="deleteProduct('${id}')">Delete</button>
        <hr>
      `;

      productList.appendChild(div);
    });

    if (snapshot.empty) {
      productList.innerHTML = "No products yet.";
    }
  } catch (err) {
    console.error("Error loading products:", err);
    productList.innerHTML = `Failed to load products: ${err.message}`;
  }
}

window.addProduct = async function () {
  const name = document.getElementById("name").value.trim();
  const price = Number(document.getElementById("price").value);
  const category = document.getElementById("category").value;
  const imagesInput = document.getElementById("images").value.trim();
  const description = document.getElementById("product-description").value.trim();
  const variationsInput = document.getElementById("variations").value.trim();

  if (!name || !price || !imagesInput || !description) {
    alert("Please fill all required fields");
    return;
  }

  const images = imagesInput.split(",").map((item) => item.trim()).filter(Boolean);
  const variations = variationsInput
    ? variationsInput.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  try {
    await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      images,
      description,
      variations
    });

    alert("Product added successfully!");
    document.getElementById("name").value = "";
    document.getElementById("price").value = "";
    document.getElementById("images").value = "";
    document.getElementById("product-description").value = "";
    document.getElementById("variations").value = "";

    await displayProducts();
  } catch (err) {
    console.error("Error adding product:", err);
    alert(`Error adding product: ${err.message}`);
  }
};

window.deleteProduct = async function (id) {
  if (!confirm("Delete this product?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    alert("Product deleted");
    await displayProducts();
  } catch (err) {
    console.error("Error deleting product:", err);
    alert(`Error deleting product: ${err.message}`);
  }
};

requireAdmin()
  .then(() => {
    displayProducts();
  })
  .catch(() => {});
