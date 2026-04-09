import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productList = document.getElementById("product-list");

async function displayProducts() {
  productList.innerHTML = "Loading...";

  const snapshot = await getDocs(collection(db, "products"));

  productList.innerHTML = "";

  snapshot.forEach(docSnap => {
    const product = docSnap.data();
    const id = docSnap.id;

    let div = document.createElement("div");
    div.classList.add("admin-card");

    div.innerHTML = `
      <h4>${product.name}</h4>
      <p>GHS ${product.price}</p>
      <p>Category: ${product.category}</p>
      <img src="${product.images ? product.images[0] : ''}" width="80">
      <button onclick="deleteProduct('${id}')">Delete</button>
      <hr>
    `;

    productList.appendChild(div);
  });
}

async function addProduct() {
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

  let images = imagesInput.split(",").map(img => img.trim());

  try {
    await addDoc(collection(db, "products"), {
      name,
      price: Number(price),
      category,
      images,
      description,
      variations
    });

    alert("✅ Product added to Firebase!");
  // Clear form
document.getElementById("name").value = "";
document.getElementById("price").value = "";
document.getElementById("images").value = "";
document.getElementById("product-description").value = "";
document.getElementById("variations").value = "";

    displayProducts(); // refresh list

  } catch (err) {
    console.error(err);
    alert("❌ Error adding product");
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  await deleteDoc(doc(db, "products", id));
  displayProducts();
}

displayProducts();
window.addProduct = addProduct;
window.deleteProduct = deleteProduct;