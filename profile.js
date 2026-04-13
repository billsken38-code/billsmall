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

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyAnV7iMKmdg_wFV21jy6Iv5TxRsWvW69BU",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// ================= GLOBAL UID =================
let currentUID = null;

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {
  console.log("AUTH USER:", user);

  if (!user) {
    console.log("No user logged in — showing empty profile");

    // show empty UI instead of redirecting
    document.getElementById("user-name").innerText = "Guest User";
    document.getElementById("user-email").innerText = "Not logged in";
    document.getElementById("user-address").innerText = "No address";

    document.getElementById("total-orders").innerText = "0";
    document.getElementById("total-spent").innerText = "GHS 0";
    document.getElementById("cart-items").innerText = "0";

    return;
  }

  currentUID = user.uid;

  loadProfile(currentUID);
  loadStats(currentUID);
  loadCart();
});
// ================= PROFILE =================
async function loadProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      name: "Guest User",
      email: "",
      address: ""
    });
  }

  const data = (await getDoc(userRef)).data();

  document.getElementById("user-name").innerText = data.name || "Guest User";
  document.getElementById("user-email").innerText = data.email || "No email saved";
  document.getElementById("user-address").innerText = data.address || "No address added";
}

// ================= STATS =================
async function loadStats(uid) {
  const snap = await getDocs(collection(db, "orders"));

  let orders = 0;
  let spent = 0;

  snap.forEach((docSnap) => {
    const data = docSnap.data();

    if (data.userId === uid) {
      orders++;
      spent += data.total || 0;
    }
  });

  document.getElementById("total-orders").innerText = orders;
  document.getElementById("total-spent").innerText = "GHS " + spent;
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

  const userRef = doc(db, "users", currentUID);

  await setDoc(userRef, { address }, { merge: true });

  document.getElementById("user-address").innerText = address;

  closeModal();
  showToast("Address saved ✔");
};

// ================= TOAST =================
function showToast(message) {
  const toast = document.getElementById("toast");

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// ================= LOGOUT =================
window.logout = function () {
  auth.signOut();
  localStorage.clear();
  window.location.href = "login.html";
};