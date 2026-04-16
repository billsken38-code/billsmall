import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const FALLBACK_ADMIN_EMAILS = ["billsken38@gmail.com"];

function waitForUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function isAdmin(user) {
  if (!user) return false;

  if (FALLBACK_ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
    return true;
  }

  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    return adminDoc.exists();
  } catch (err) {
    console.error("Admin lookup failed:", err);
    return false;
  }
}

export async function requireAdmin() {
  const user = await waitForUser();

  if (!user) {
    alert("Please login as admin.");
    window.location.href = "login.html";
    throw new Error("Not logged in");
  }

  const allowed = await isAdmin(user);

  if (!allowed) {
    alert("Admin access denied.");
    window.location.href = "index.html";
    throw new Error("Not an admin");
  }

  return user;
}
