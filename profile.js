import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// 🔥 Firebase config (same as auth.js)
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWzW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    document.getElementById("user-name").innerText = "Guest User";
    document.getElementById("user-email").innerText = "Not logged in";
    return;
  }
const savedName = localStorage.getItem("userName");
  document.getElementById("user-name").innerText =
    user.displayName || "User";

  document.getElementById("user-email").innerText =
    user.email;
});

// ================= CART =================
function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  document.getElementById("cart-items").innerText = cart.length;
}

loadCart();

// ================= ADDRESS (LOCAL STORAGE) =================
window.editAddress = function () {
  document.getElementById("addressModal").style.display = "flex";

  // preload saved address
  const saved = localStorage.getItem("address") || "";
  document.getElementById("addressInput").value = saved;
};

window.closeModal = function () {
  document.getElementById("addressModal").style.display = "none";
};

window.saveAddress = function () {
  const address = document.getElementById("addressInput").value.trim();

  if (!address) return;

  localStorage.setItem("address", address);

  document.getElementById("user-address").innerText = address;

  closeModal();
  showToast("Address saved ✔");
};

// Load saved address on page load
(function loadAddress() {
  const saved = localStorage.getItem("address");
  if (saved) {
    document.getElementById("user-address").innerText = saved;
  }
})();

// ================= TOAST =================
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// ================= LOGOUT =================
window.logout = function () {
  signOut(auth);
  window.location.href = "login.html";
};