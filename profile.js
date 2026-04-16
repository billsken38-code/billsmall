import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth } from "./firebase.js";

const nameEl = document.getElementById("user-name");
const emailEl = document.getElementById("user-email");
const avatarEl = document.getElementById("profile-avatar");
const addressEl = document.getElementById("user-address");

function loadAddress() {
  const saved = localStorage.getItem("address");

  if (saved) {
    addressEl.innerText = saved;
  } else {
    addressEl.innerText = "No address added";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    nameEl.innerText = "Guest User";
    emailEl.innerText = "Not logged in";
    avatarEl.innerText = "👤";
    return;
  }

  const displayName = user.displayName || "User";
  const email = user.email || "No email saved";

  nameEl.innerText = displayName;
  emailEl.innerText = email;
  avatarEl.innerText = displayName.charAt(0).toUpperCase();
});

window.addEventListener("DOMContentLoaded", () => {
  loadAddress();
});

window.editAddress = function () {
  document.getElementById("addressModal").style.display = "flex";
  document.getElementById("addressInput").value =
    localStorage.getItem("address") || "";
};

window.closeModal = function () {
  document.getElementById("addressModal").style.display = "none";
};

window.saveAddress = function () {
  const address = document.getElementById("addressInput").value.trim();

  if (!address) {
    showToast("Please enter an address");
    return;
  }

  localStorage.setItem("address", address);
  loadAddress();
  window.closeModal();
  showToast("Address saved");
};

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
  try {
    await signOut(auth);
    localStorage.removeItem("cart");
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout failed:", error);
    showToast("Failed to logout");
  }
};