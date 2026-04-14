import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  setPersistence,
 browserLocalPersistence,
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
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // ✅ send verification email
    await sendEmailVerification(userCredential.user);

    msg.style.color = "green";
    msg.innerText = "Account created! Check your email to verify.";

  } catch (err) {
    msg.style.color = "red";
    msg.innerText = err.message;
  }
};

// ================= LOGIN =================
window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // ❌ BLOCK UNVERIFIED USERS
    if (!userCredential.user.emailVerified) {
      msg.style.color = "red";
      msg.innerText = "Please verify your email before logging in.";
      return;
    }

    localStorage.setItem("userId", userCredential.user.uid);

    msg.style.color = "green";
msg.innerHTML = `
    Account created successfully
  `;
    window.location.href = "index.html";

  } catch (err) {
    msg.style.color = "red";
    msg.innerText = err.message;
  }
};

// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    localStorage.setItem("userId", user.uid);
  } else {
    localStorage.removeItem("userId");
  }
});