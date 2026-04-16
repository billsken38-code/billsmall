import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";
import { showToast } from "./ui.js";

const productList = document.getElementById("product-list");
const imageInput = document.getElementById("images");
const imageFilesInput = document.getElementById("image-files");
const imagePreview = document.getElementById("admin-image-preview");

let uploadedImages = [];

function updateImagePreview(images) {
  if (!imagePreview) return;

  if (!images.length) {
    imagePreview.innerHTML = "";
    imagePreview.classList.remove("has-images");
    return;
  }

  imagePreview.innerHTML = images
    .map((src, index) => `<img src="${src}" alt="Preview ${index + 1}" class="vendor-image-thumb">`)
    .join("");
  imagePreview.classList.add("has-images");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("images").value = "";
  document.getElementById("product-description").value = "";
  document.getElementById("variations").value = "";
  if (imageFilesInput) {
    imageFilesInput.value = "";
  }
  uploadedImages = [];
  updateImagePreview([]);
}

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
        <img src="${product.images?.[0] || product.image || ""}" width="80">
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
  const typedImages = imageInput.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const images = typedImages.length ? typedImages : uploadedImages;
  const description = document.getElementById("product-description").value.trim();
  const variationsInput = document.getElementById("variations").value.trim();

  if (!name || !price || !images.length || !description) {
    showToast("Please fill all required fields.", { type: "error" });
    return;
  }

  const variations = variationsInput
    ? variationsInput.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  try {
    await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      image: images[0],
      images,
      description,
      variations,
      vendorId: auth.currentUser?.uid || "admin"
    });

    showToast("Product added successfully!", { type: "success" });
    resetForm();
    await displayProducts();
  } catch (err) {
    console.error("Error adding product:", err);
    showToast(`Error adding product: ${err.message}`, { type: "error" });
  }
};

window.deleteProduct = async function (id) {
  if (!confirm("Delete this product?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    showToast("Product deleted.", { type: "success" });
    await displayProducts();
  } catch (err) {
    console.error("Error deleting product:", err);
    showToast(`Error deleting product: ${err.message}`, { type: "error" });
  }
};

imageInput?.addEventListener("input", (event) => {
  const typedImages = event.target.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (typedImages.length) {
    uploadedImages = typedImages;
    updateImagePreview(typedImages);
  } else if (!imageFilesInput.files.length) {
    uploadedImages = [];
    updateImagePreview([]);
  }
});

imageFilesInput?.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);

  if (!files.length) {
    if (!imageInput.value.trim()) {
      uploadedImages = [];
      updateImagePreview([]);
    }
    return;
  }

  if (files.some((file) => !file.type.startsWith("image/"))) {
    showToast("Please choose image files only.", { type: "error" });
    event.target.value = "";
    return;
  }

  try {
    uploadedImages = await Promise.all(files.map((file) => readImageFile(file)));
    imageInput.value = "";
    updateImagePreview(uploadedImages);
    showToast(`${uploadedImages.length} image${uploadedImages.length > 1 ? "s" : ""} ready to upload.`, { type: "success" });
  } catch (err) {
    console.error(err);
    showToast(err.message, { type: "error" });
  }
});

requireAdmin()
  .then(() => {
    displayProducts();
  })
  .catch(() => {});
