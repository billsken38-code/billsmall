import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth } from "./firebase.js";

window.signup = async function () {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, {
      displayName: name
    });

    await sendEmailVerification(userCredential.user);
    localStorage.setItem("userId", userCredential.user.uid);

    msg.style.color = "green";
    msg.innerText = "Account created! Check your email to verify.";
  } catch (err) {
    msg.style.color = "red";
    msg.innerText = err.message;
  }
};

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    if (!userCredential.user.emailVerified) {
      await auth.signOut();
      msg.style.color = "red";
      msg.innerText = "Please verify your email before logging in.";
      return;
    }

    localStorage.setItem("userId", userCredential.user.uid);

    msg.style.color = "green";
    msg.innerText = "Login successful";

    window.location.href = "index.html";
  } catch (err) {
    msg.style.color = "red";
    msg.innerText = err.message;
  }
};

onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    localStorage.setItem("userId", user.uid);
  } else {
    localStorage.removeItem("userId");
  }
});
