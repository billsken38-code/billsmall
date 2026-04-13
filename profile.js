import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs } 
from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

const userId = localStorage.getItem("userId");

// ================= LOAD PROFILE =================
async function loadProfile() {
  try {
    const snapshot = await getDocs(collection(db, "orders"));

    let orders = [];
    let totalSpent = 0;

    snapshot.forEach(orderDoc => {
      const data = orderDoc.data();

      if (data.userId === userId) {
        orders.push(data);
        totalSpent += data.total || 0;
      }
    });

    // ===== SAFE DOM UPDATES =====
    const ordersEl = document.getElementById("total-orders");
    const spentEl = document.getElementById("total-spent");
    const cartEl = document.getElementById("cart-items");
    const nameEl = document.getElementById("user-name");
    const emailEl = document.getElementById("user-email");
    const addressEl = document.getElementById("user-address");

    if (ordersEl) ordersEl.innerText = orders.length;
    if (spentEl) spentEl.innerText = "GHS " + totalSpent;
    if (cartEl) cartEl.innerText = JSON.parse(localStorage.getItem("cart") || "[]").length;

    if (nameEl) nameEl.innerText = userId || "Guest User";
    if (emailEl) emailEl.innerText = localStorage.getItem("email") || "No email saved";
    if (addressEl) addressEl.innerText = localStorage.getItem("address") || "No address saved";

  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// ================= ADDRESS =================
function editAddress() {
  document.getElementById("addressModal").style.display = "flex";
}

  localStorage.setItem("address", address);
  document.getElementById("user-address").innerText = address;

// ================= LOGOUT =================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

// ================= WAIT FOR PAGE LOAD =================
window.addEventListener("DOMContentLoaded", loadProfile);

function closeModal() {
  document.getElementById("addressModal").style.display = "none";
}

window.editAddress = function () {
  const input = document.getElementById("addressInput").value;

  if (!input) return;

  localStorage.setItem("address", input);
  document.getElementById("user-address").innerText = input;

  closeModal();
  showToast("Address saved ✔");
}
function showToast(message) {
  const toast = document.getElementById("toast");

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}
// EXPORTS
window.editAddress = editAddress;
window.saveAddress = saveAddress;
window.closeModal = closeModal;
window.logout = logout;