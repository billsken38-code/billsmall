import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { redirectWithToast } from "./ui.js";

function waitForUser() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function isAdmin(user) {
  if (!user) return false;

  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    return adminDoc.exists();
  } catch (err) {
    console.error("Admin lookup failed:", {
      code: err.code,
      message: err.message,
      uid: user.uid,
      email: user.email
    });
    throw err;
  }
}

export async function requireAdmin() {
  const user = await waitForUser();

  if (!user) {
    redirectWithToast("login.html", "Please login as admin.", { type: "error" });
    throw new Error("Not logged in");
  }

  console.log("Checking admin access for user:", {
    uid: user.uid,
    email: user.email,
    verified: user.emailVerified
  });

  try {
    const allowed = await isAdmin(user);

    if (!allowed) {
      redirectWithToast("index.html", "Admin access denied.", { type: "error" });
      throw new Error("Not an admin");
    }

    return user;
  } catch (err) {
    if (err.code === "permission-denied") {
      redirectWithToast("index.html", "Admin access denied.", { type: "error" });
      throw err;
    }

    redirectWithToast("index.html", "Admin access denied.", { type: "error" });
    throw err;
  }
}
