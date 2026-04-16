import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth } from "./firebase.js";

onAuthStateChanged(auth, (user) => {
  const nameEl = document.getElementById("user-name");
  const emailEl = document.getElementById("user-email");

  if (!user) {
    nameEl.innerText = "Guest User";
    emailEl.innerText = "Not logged in";
    return;
  }

  nameEl.innerText = user.displayName || "User";
  emailEl.innerText = user.email || "";
});

function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  document.getElementById("cart-items").innerText = totalItems;
}

window.addEventListener("DOMContentLoaded", loadCart);

window.editAddress = function () {
  document.getElementById("addressModal").style.display = "flex";
  document.getElementById("addressInput").value = localStorage.getItem("address") || "";
};

window.closeModal = function () {
  document.getElementById("addressModal").style.display = "none";
};

window.saveAddress = function () {
  const address = document.getElementById("addressInput").value.trim();

  if (!address) return;

  localStorage.setItem("address", address);
  document.getElementById("user-address").innerText = address;
  window.closeModal();
  showToast("Address saved");
};

(function loadAddress() {
  const saved = localStorage.getItem("address");
  if (saved) {
    document.getElementById("user-address").innerText = saved;
  }
})();

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};
