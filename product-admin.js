import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// 🔥 FIREBASE CONFIG (FIXED)
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productList = document.getElementById("product-list");

// ================= DISPLAY PRODUCTS =================
async function displayProducts() {
  productList.innerHTML = "Loading products...";

  try {
    const snapshot = await getDocs(collection(db, "products"));

    productList.innerHTML = "";

    snapshot.forEach(docSnap => {
      const product = docSnap.data();
      const id = docSnap.id;

      const div = document.createElement("div");
      div.classList.add("admin-card");

      div.innerHTML = `
        <h3>${product.name}</h3>
        <p><b>Price:</b> GHS ${product.price}</p>
        <p><b>Category:</b> ${product.category}</p>

        <img src="${product.images?.[0] || ''}" width="80">

        <button onclick="deleteProduct('${id}')">
          Delete
        </button>

        <hr>
      `;

      productList.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading products:", err);
    productList.innerHTML = "❌ Failed to load products";
  }
}

// ================= ADD PRODUCT =================
async function addProduct() {
  const name = document.getElementById("name").value.trim();
  const price = Number(document.getElementById("price").value);
  const category = document.getElementById("category").value;
  const imagesInput = document.getElementById("images").value.trim();
  const description = document.getElementById("product-description").value.trim();
  const variationsInput = document.getElementById("variations").value.trim();

  if (!name || !price || !imagesInput || !description) {
    alert("⚠️ Please fill all required fields");
    return;
  }

  const images = imagesInput.split(",").map(i => i.trim());

  const variations = variationsInput
    ? variationsInput.split(",").map(v => v.trim())
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

    alert("✅ Product added successfully!");

    // Clear form
    document.getElementById("name").value = "";
    document.getElementById("price").value = "";
    document.getElementById("images").value = "";
    document.getElementById("product-description").value = "";
    document.getElementById("variations").value = "";

    displayProducts();

  } catch (err) {
    console.error(err);
    alert("❌ Error adding product");
  }
}

// ================= DELETE PRODUCT =================
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    alert("🗑️ Product deleted");
    displayProducts();
  } catch (err) {
    console.error(err);
  }
}

// ================= INIT =================
displayProducts();

window.addProduct = addProduct;
window.deleteProduct = deleteProduct;