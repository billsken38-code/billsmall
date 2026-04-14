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

// 🔥 CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "bills-mall.firebaseapp.com",
  projectId: "bills-mall",
  storageBucket: "bills-mall.firebasestorage.app",
  messagingSenderId: "741823099772",
  appId: "1:741823099772:web:f152557c54cfc14e8caaf9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUID = null;

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
if (!user) {
  document.getElementById("user-name").innerText = "Not logged in";
  document.getElementById("user-email").innerText = "Please login";
  return;
}
  currentUID = user.uid;

  console.log("User UID:", currentUID);

  await loadProfile(currentUID);
  await loadStats(currentUID);
  loadCart();
});

// ================= PROFILE =================
async function loadProfile(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    let data;

    if (!snap.exists()) {
      data = {
        name: "Guest User",
        email: "",
        address: ""
      };

      await setDoc(userRef, data);
    } else {
      data = snap.data();
      if (!data.email) data.email = auth.currentUser.email;
    }

    document.getElementById("user-name").innerText =
      data.name || "Guest User";

    document.getElementById("user-email").innerText =
      data.email || "No email";

    document.getElementById("user-address").innerText =
      data.address || "No address";

  } catch (err) {
    console.error("Profile error:", err);
  }
}

// ================= STATS =================
async function loadStats(uid) {
  try {
    const snapshot = await getDocs(collection(db, "orders"));

    let totalOrders = 0;
    let totalSpent = 0;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();

      if (data.userId === uid) {
        totalOrders++;
        totalSpent += data.total || 0;
      }
    });

    document.getElementById("total-orders").innerText = totalOrders;
    document.getElementById("total-spent").innerText = "GHS " + totalSpent;

  } catch (err) {
    console.error("Stats error:", err);
  }
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

  if (!address || !currentUID) return;

  try {
    const userRef = doc(db, "users", currentUID);

    await setDoc(userRef, { address }, { merge: true });

    document.getElementById("user-address").innerText = address;

    closeModal();
    showToast("Address saved ✔");

  } catch (err) {
    console.error("Save error:", err);
  }
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
  auth.signOut();
  window.location.href = "login.html";
};