import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import { app, auth, db } from "./firebase.js";
import { requireAdmin } from "./admin-auth.js";
import { showToast } from "./ui.js";

const storage = getStorage(app);

const productForm = document.getElementById("product-form");
const productList = document.getElementById("product-list");
const imageInput = document.getElementById("images");
const imageFilesInput = document.getElementById("image-files");
const imagePreview = document.getElementById("admin-image-preview");
const resetFormBtn = document.getElementById("reset-product-form");

let uploadedImages = [];
let unsubscribeProducts = null;
let isSaving = false;

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateImagePreview(images) {
  if (!imagePreview) return;

  if (!images.length) {
    imagePreview.innerHTML = "";
    imagePreview.classList.remove("has-images");
    return;
  }

  imagePreview.innerHTML = images
    .map(
      (src, index) =>
        `<img src="${src}" alt="Preview ${index + 1}" class="vendor-image-thumb">`
    )
    .join("");

  imagePreview.classList.add("has-images");
}

async function uploadImageFile(file) {
  const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, "-");
  const folder = auth.currentUser?.uid || "admin";
  const storageRef = ref(storage, `products/${folder}/${safeName}`);

  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

function resetForm() {
  if (productForm) {
    productForm.reset();
  }

  uploadedImages = [];
  updateImagePreview([]);
}

function productCardTemplate(id, product) {
  const status = product.status || "Active";
  const stock = Number(product.stock || 0);
  const variations = Array.isArray(product.variations) ? product.variations : [];
  const image = product.images?.[0] || product.image || "";

  return `
    <article class="product-admin-item">
      <div class="product-admin-item-top">
        <div class="product-admin-item-media">
          <img src="${image}" alt="${escapeHtml(product.name)}" class="product-admin-thumb">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-admin-meta">${escapeHtml(product.category || "Uncategorized")}</p>
          </div>
        </div>
        <span class="product-admin-badge">${escapeHtml(status)}</span>
      </div>

      <div class="product-admin-item-grid">
        <div><span>Price</span><strong>${formatCurrency(product.price)}</strong></div>
        <div><span>Stock</span><strong>${stock}</strong></div>
        <div><span>Featured</span><strong>${product.featured ? "Yes" : "No"}</strong></div>
        <div><span>Vendor</span><strong>${escapeHtml(product.vendorId || "admin")}</strong></div>
      </div>

      ${
        product.description
          ? `<p class="product-admin-description">${escapeHtml(product.description)}</p>`
          : ""
      }

      ${
        variations.length
          ? `<div class="product-admin-tags">
              ${variations.map((variation) => `<span>${escapeHtml(variation)}</span>`).join("")}
            </div>`
          : ""
      }

      <div class="product-admin-item-actions">
        <button type="button" class="danger-btn" data-delete-product="${id}">Delete</button>
      </div>
    </article>
  `;
}

function displayProducts() {
  if (!productList) return;

  productList.innerHTML = `<div class="product-admin-empty">Loading products...</div>`;

  if (unsubscribeProducts) {
    unsubscribeProducts();
  }

  unsubscribeProducts = onSnapshot(
    collection(db, "products"),
    (snapshot) => {
      if (snapshot.empty) {
        productList.innerHTML = `<div class="product-admin-empty">No products yet.</div>`;
        return;
      }

      const items = [];
      snapshot.forEach((docSnap) => {
        items.push(productCardTemplate(docSnap.id, docSnap.data()));
      });

      productList.innerHTML = items.join("");
    },
    (err) => {
      console.error("Error loading products:", err);
      productList.innerHTML = `<div class="product-admin-empty">Failed to load products: ${err.message}</div>`;
    }
  );
}

async function addProduct() {
  if (isSaving) return;
  isSaving = true;

  const submitButton = productForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  const name = document.getElementById("name").value.trim();
  const price = Number(document.getElementById("price").value);
  const category = document.getElementById("category").value;
  const stock = Number(document.getElementById("stock")?.value || 0);
  const status = document.getElementById("status")?.value || "Active";
  const featured = document.getElementById("featured")?.checked || false;

  const typedImages = imageInput.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const images = typedImages.length ? typedImages : uploadedImages;
  const description = document.getElementById("product-description").value.trim();
  const variationsInput = document.getElementById("variations").value.trim();

  if (!name || Number.isNaN(price) || !description || !images.length) {
    showToast("Please fill all required fields and add at least one image.", {
      type: "error"
    });
    isSaving = false;
    if (submitButton) submitButton.disabled = false;
    return;
  }

  if (Number.isNaN(stock) || stock < 0) {
    showToast("Stock must be 0 or more.", { type: "error" });
    isSaving = false;
    if (submitButton) submitButton.disabled = false;
    return;
  }

  const variations = variationsInput
    ? variations.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  try {
    await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      stock,
      status,
      featured,
      image: images[0],
      images,
      description,
      variations,
      vendorId: auth.currentUser?.uid || "admin",
      createdAt: new Date().toISOString(),
      sold: 0,
      views: 0
    });

    showToast("Product added successfully!", { type: "success" });
    resetForm();
  } catch (err) {
    console.error("Error adding product:", err);
    showToast(`Error adding product: ${err.message}`, { type: "error" });
  } finally {
    isSaving = false;
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    showToast("Product deleted.", { type: "success" });
  } catch (err) {
    console.error("Error deleting product:", err);
    showToast(`Error deleting product: ${err.message}`, { type: "error" });
  }
}

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addProduct();
});

resetFormBtn?.addEventListener("click", resetForm);

productList?.addEventListener("click", async (event) => {
  const productId = event.target.getAttribute("data-delete-product");
  if (!productId) return;
  await deleteProduct(productId);
});

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
    showToast("Uploading images...", { type: "info" });

    uploadedImages = await Promise.all(files.map((file) => uploadImageFile(file)));
    imageInput.value = "";
    updateImagePreview(uploadedImages);

    showToast(
      `${uploadedImages.length} image${uploadedImages.length > 1 ? "s" : ""} uploaded successfully.`,
      { type: "success" }
    );
  } catch (err) {
    console.error(err);
    showToast(`Image upload failed: ${err.message}`, { type: "error" });
  }
});

requireAdmin()
  .then(() => {
    displayProducts();
  })
  .catch(() => {});