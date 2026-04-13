import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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


// ================= PROFILE =================
async function loadProfile() {
  if (!userId) return;

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  let userData;

  if (!userSnap.exists()) {
    userData = {
      name: "Guest User",
      email: "",
      address: "",
      createdAt: new Date()
    };

    await setDoc(userRef, userData);
  } else {
    userData = userSnap.data();
  }

  document.getElementById("user-name").innerText = userData.name || "Guest User";
  document.getElementById("user-email").innerText = userData.email || "No email";
  document.getElementById("user-address").innerText = userData.address || "No address";
}


// ================= STATS =================
async function loadStats() {
  const ordersSnap = await getDocs(collection(db, "orders"));

  let totalOrders = 0;
  let totalSpent = 0;

  ordersSnap.forEach(docSnap => {
    const data = docSnap.data();

    if (data.userId === userId) {
      totalOrders++;
      totalSpent += data.total || 0;
    }
  });

  document.getElementById("total-orders").innerText = totalOrders;
  document.getElementById("total-spent").innerText = "GHS " + totalSpent;
}


// ================= CART =================
function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  document.getElementById("cart-items").innerText = cart.length;
}


// ================= ADDRESS MODAL =================
window.editAddress = function () {
  document.getElementById("addressModal").style.display = "flex";
};

window.closeModal = function () {
  document.getElementById("addressModal").style.display = "none";
};

window.saveAddress = async function () {
  const address = document.getElementById("addressInput").value.trim();

  if (!address) return;

  const userRef = doc(db, "users", userId);

  await setDoc(userRef, {
    address: address
  }, { merge: true });

  document.getElementById("user-address").innerText = address;

  window.closeModal();
  showToast("Address saved ✔");
};


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
  localStorage.clear();
  window.location.href = "login.html";
};


// ================= INIT =================
window.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadStats();
  loadCart();
});