import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth } from "./firebase.js";
import "./ui.js";
import { ensureUserProfile, readReferralCodeFromUrl } from "./referral-system.js";

function updateReferralBanner() {
  const referralBanner = document.getElementById("referral-banner");
  if (!referralBanner) return;

  const referralCode = readReferralCodeFromUrl();
  if (!referralCode) {
    referralBanner.hidden = true;
    return;
  }

  referralBanner.hidden = false;
  referralBanner.textContent = `Referral applied: ${referralCode}`;
}

window.signup = async function () {
  const name = document.getElementById("name").value.trim();
  const address = document.getElementById("address").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");
  const referralCode = readReferralCodeFromUrl();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, {
      displayName: name
    });

    await ensureUserProfile(userCredential.user, {
      name,
      address,
      role: "customer",
      referralCode
    });
    await sendEmailVerification(userCredential.user);
    localStorage.setItem("userId", userCredential.user.uid);
    localStorage.setItem("userName", name);
    localStorage.setItem("address", address);

    msg.style.color = "green";
    msg.innerText = "Account created! Check your email to verify(check spam for message).";
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
      await signOut(auth);
      msg.style.color = "red";
      msg.innerText = "Please verify your email before logging in.";
      return;
    }

    localStorage.setItem("userId", userCredential.user.uid);
    localStorage.setItem("userName", userCredential.user.displayName || "");
    const profile = await ensureUserProfile(userCredential.user, {
      role: "customer"
    });
    localStorage.setItem("address", profile?.address || "");

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
    localStorage.setItem("userName", user.displayName || "");
  } else {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("address");
  }
});

updateReferralBanner();
