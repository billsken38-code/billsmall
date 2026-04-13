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

// ================= LOAD ORDERS FROM FIREBASE =================
async function loadProfile() {
  try {
    const snapshot = await getDocs(collection(db, "orders"));

    let orders = [];
    let totalSpent = 0;

    snapshot.forEach(doc => {
      const data = doc.data();

      if (data.userId === userId) {
        orders.push(data);
        totalSpent += data.total || 0;
      }
    });

    // ===== UPDATE UI =====
    document.getElementById("total-orders").innerText = orders.length;
    document.getElementById("total-spent").innerText = "GHS " + totalSpent;

    // ===== CART =====
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    document.getElementById("cart-items").innerText = cart.length;

    // ===== USER INFO =====
    document.getElementById("user-name").innerText = userId || "Guest User";

    document.getElementById("user-email").innerText =
      localStorage.getItem("email") || "No email saved";

    document.getElementById("user-address").innerText =
      localStorage.getItem("address") || "No address saved";

  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// ================= ADDRESS EDIT =================
function editAddress() {
  const address = prompt("Enter your address:");
  if (!address) return;

  localStorage.setItem("address", address);
  document.getElementById("user-address").innerText = address;
}

// ================= LOGOUT =================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

// ================= INIT =================
loadProfile();

// EXPORTS
window.editAddress = editAddress;
window.logout = logout;