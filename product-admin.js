import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy
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

const CATEGORY_OPTIONS = [
  "Fashion",
  "Electronics",
  "Beauty",
  "Home & Kitchen",
  "Health",
  "Shoes",
  "Bags",
  "Accessories",
  "Books",
  "Baby Products",
  "Groceries",
  "Sports",
  "Office Supplies",
  "Jewelry",
  "Other"
];

const elements = {
  productForm: document.getElementById("product-form"),
  productList: document.getElementById("product-list"),
  nameInput: document.getElementById("name"),
  priceInput: document.getElementById("price"),
  categoryInput: document.getElementById("category"),
  stockInput: document.getElementById("stock"),
  statusInput: document.getElementById("status"),
  featuredInput: document.getElementById("featured"),
  imageInput: document.getElementById("images"),
  imageFilesInput: document.getElementById("image-files"),
  imagePreview: document.getElementById("admin-image-preview"),
  descriptionInput: document.getElementById("product-description"),
  variationsInput: document.getElementById("variations"),
  resetFormBtn: document.getElementById("reset-product-form")
};

const state = {
  uploadedImages: [],
  unsubscribeProducts: null,
  isSaving: false,
  isReady: false,
  eventsBound: false
};

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

function isValidImagePath(value) {
  const path = String(value || "").trim();

  if (!path) return false;

  if (/^https?:\/\//i.test(path)) return true;

  if (
    path.startsWith("./") ||
    path.startsWith("../") ||
    path.startsWith("/") ||
    path.startsWith("images/") ||
    path.startsWith("./images/")
  ) {
    return true;
  }

  return false;
}

function normalizeImageList(values = []) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => isValidImagePath(value));
}

function sanitizeFileName(fileName = "") {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function initializeCategoryDropdown() {
  const select = elements.categoryInput;
  if (!select) return;

  if (select.tagName !== "SELECT") {
    console.warn("#category should be a <select> element.");
    return;
  }

  select.innerHTML = [
    '<option value="">Select category</option>',
    ...CATEGORY_OPTIONS.map(
      (category) => `<option value="${category}">${category}</option>`
    )
  ].join("");
}

function updateImagePreview(images) {
  if (!elements.imagePreview) return;

  if (!images.length) {
    elements.imagePreview.innerHTML = "";
    elements.imagePreview.classList.remove("has-images");
    return;
  }

  function resolveImagePath(src) {
    src = src.trim();
    if (/^https?:\/\//i.test(src)) {
      return src;
    }
    // Handle relative paths
    let base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    if (src.startsWith("./")) {
      return base + src.substring(2);
    }
    if (src.startsWith("../")) {
      let result = src;
      while (result.startsWith("../")) {
        result = result.substring(3);
        base = base.substring(0, base.slice(0, -1).lastIndexOf('/') + 1);
      }
      return base + result;
    }
    if (src.startsWith("images/")) {
      return base + src;
    }
    return base + src;
  }

  elements.imagePreview.innerHTML = images
    .map(
      (src, index) =>
        `<img src="${resolveImagePath(src)}" alt="Preview ${index + 1}" class="vendor-image-thumb" onerror="this.style.display='none'">`
    )
    .join("");

  elements.imagePreview.classList.add("has-images");
}

async function uploadImageFile(file) {
  const currentUserId = auth.currentUser?.uid;

  if (!currentUserId) {
    throw new Error("You must be logged in as admin to upload images.");
  }

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const storageRef = ref(storage, `products/${currentUserId}/${safeName}`);

  await uploadBytes(storageRef, file, {
    contentType: file.type
  });

  return await getDownloadURL(storageRef);
}

function resetForm() {
  if (!state.isReady) {
    showToast("Admin access is still loading.", { type: "info" });
    return;
  }

  elements.productForm?.reset();
  state.uploadedImages = [];
  updateImagePreview([]);

  if (elements.categoryInput?.tagName === "SELECT") {
    elements.categoryInput.value = "";
  }

  if (elements.statusInput) {
    elements.statusInput.value = "Active";
  }
}

function setFormEnabled(enabled) {
  const fields = elements.productForm?.querySelectorAll("input, select, textarea, button");
  fields?.forEach((field) => {
    field.disabled = !enabled;
  });
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
          <img src="${image}" alt="${escapeHtml(product.name)}" class="product-admin-thumb" loading="lazy">
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

function renderProducts(products) {
  if (!elements.productList) return;

  if (!products.length) {
    elements.productList.innerHTML = `<div class="product-admin-empty">No products yet.</div>`;
    return;
  }

  elements.productList.innerHTML = products
    .map((item) => productCardTemplate(item.id, item.data))
    .join("");
}

function subscribeProducts() {
  if (!elements.productList) return;

  elements.productList.innerHTML = `<div class="product-admin-empty">Loading products...</div>`;

  if (state.unsubscribeProducts) {
    state.unsubscribeProducts();
  }

  const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));

  state.unsubscribeProducts = onSnapshot(
    productsQuery,
    (snapshot) => {
      const products = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data()
      }));

      renderProducts(products);
    },
    (err) => {
      console.error("Error loading products:", err);
      elements.productList.innerHTML = `<div class="product-admin-empty">Failed to load products: ${err.message}</div>`;
    }
  );
}

function getFormData() {
  const name = elements.nameInput?.value.trim() || "";
  const price = Number(elements.priceInput?.value || 0);
  const category = elements.categoryInput?.value || "";
  const stock = Number(elements.stockInput?.value || 0);
  const status = elements.statusInput?.value || "Active";
  const featured = elements.featuredInput?.checked || false;

  const typedImages = normalizeImageList(
    (elements.imageInput?.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const images = [...typedImages, ...state.uploadedImages].filter(Boolean);

  const description = elements.descriptionInput?.value.trim() || "";
  const variationsInput = elements.variationsInput?.value.trim() || "";
  const variations = variationsInput
    ? variationsInput.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    name,
    price,
    category,
    stock,
    status,
    featured,
    images,
    description,
    variations
  };
}

function validateFormData(data) {
  if (!data.name) {
    return "Product name is required.";
  }

  if (Number.isNaN(data.price) || data.price <= 0) {
    return "Enter a valid product price.";
  }

  if (!data.category) {
    return "Please select a category.";
  }

  if (Number.isNaN(data.stock) || data.stock < 0) {
    return "Stock must be 0 or more.";
  }

  if (!data.description) {
    return "Product description is required.";
  }

  if (!data.images.length) {
    return "Add at least one product image.";
  }

  return "";
}

async function addProduct() {
  if (!state.isReady) {
    showToast("Admin access is still loading.", { type: "info" });
    return;
  }

  if (state.isSaving) return;
  state.isSaving = true;

  const submitButton = elements.productForm?.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const formData = getFormData();
    const validationMessage = validateFormData(formData);

    console.log("Admin typed images:", normalizeImageList(
      (elements.imageInput?.value || "").split(",")
    ));
    console.log("Admin uploaded images:", state.uploadedImages);
    console.log("Admin final images:", formData.images);

    if (validationMessage) {
      showToast(validationMessage, { type: "error" });
      return;
    }

    await addDoc(collection(db, "products"), {
      name: formData.name,
      price: formData.price,
      category: formData.category,
      stock: formData.stock,
      status: formData.status,
      featured: formData.featured,
      image: formData.images[0],
      images: formData.images,
      description: formData.description,
      variations: formData.variations,
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
    state.isSaving = false;
    if (submitButton) submitButton.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!state.isReady) {
    showToast("Admin access is still loading.", { type: "info" });
    return;
  }

  if (!confirm("Delete this product?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    showToast("Product deleted.", { type: "success" });
  } catch (err) {
    console.error("Error deleting product:", err);
    showToast(`Error deleting product: ${err.message}`, { type: "error" });
  }
}

function bindEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;

  elements.productForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addProduct();
  });

  elements.resetFormBtn?.addEventListener("click", resetForm);

  elements.productList?.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-delete-product]");
    if (!target) return;

    const productId = target.getAttribute("data-delete-product");
    if (!productId) return;
    await deleteProduct(productId);
  });

  elements.imageInput?.addEventListener("input", (event) => {
    const typedImages = normalizeImageList(
      event.target.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    if (typedImages.length) {
      state.uploadedImages = typedImages;
      updateImagePreview(typedImages);
    } else if (!elements.imageFilesInput?.files.length) {
      state.uploadedImages = [];
      updateImagePreview([]);
    }
  });

  elements.imageFilesInput?.addEventListener("change", async (event) => {
    if (!state.isReady) {
      showToast("Admin access is still loading.", { type: "info" });
      event.target.value = "";
      return;
    }

    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    if (files.some((file) => !file.type.startsWith("image/"))) {
      showToast("Please choose image files only.", { type: "error" });
      event.target.value = "";
      return;
    }

    try {
      showToast("Uploading images...", { type: "info" });

      const uploaded = await Promise.all(files.map((file) => uploadImageFile(file)));
      state.uploadedImages = uploaded;
      updateImagePreview(state.uploadedImages);

      showToast(
        `${state.uploadedImages.length} image${state.uploadedImages.length > 1 ? "s" : ""} uploaded successfully.`,
        { type: "success" }
      );
    } catch (err) {
      console.error(err);
      showToast(`Image upload failed: ${err.message}`, { type: "error" });
    }
  });
}

async function init() {
  initializeCategoryDropdown();
  setFormEnabled(false);
  bindEvents();

  try {
    await requireAdmin();
    state.isReady = true;
    setFormEnabled(true);
    subscribeProducts();
  } catch {
    state.isReady = false;
    setFormEnabled(false);
  }
}

init();
