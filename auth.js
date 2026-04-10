import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// Firebase config
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

// ================= SIGN UP =================
window.signup = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created!");
    console.log(userCredential.user);
  } catch (err) {
    alert(err.message);
  }
};

// ================= LOGIN =================
window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful!");
    console.log(userCredential.user);
  } catch (err) {
    alert(err.message);
  }
};

// ================= LOGOUT =================
window.logout = async function () {
  await signOut(auth);
  alert("Logged out");
};

// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in:", user.uid);
    localStorage.setItem("userId", user.uid);
  } else {
    console.log("No user");
    localStorage.removeItem("userId");
  }
});