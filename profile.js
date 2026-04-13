import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
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
const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadProfile(user.uid);
    loadStats(user.uid);
    loadCart();
  } else {
    window.location.href = "login.html";
  }
});

// ================= PROFILE =================
async function loadProfile(uid) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: "Guest User",
      email: "",
      address: ""
    });
  }

  const data = (await getDoc(userRef)).data();

  document.getElementById("user-name").innerText = data.name;
  document.getElementById("user-email").innerText = data.email;
  document.getElementById("user-address").innerText = data.address;
}


// ================= STATS =================
async function loadStats(uid) {
  const ordersSnap = await getDocs(collection(db, "orders"));

  let totalOrders = 0;
  let totalSpent = 0;

  ordersSnap.forEach(docSnap => {
    const data = docSnap.data();

    if (data.userId === uid) {
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