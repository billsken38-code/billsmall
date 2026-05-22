import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import { auth, db } from "./firebase.js";
import { redirectWithToast } from "./ui.js";
import {
  DEFAULT_REFERRAL_SETTINGS,
  ensureUserProfile,
  getReferredCustomers,
  getReferredVendors
} from "./referral-system.js";

const nameEl = document.getElementById("user-name");
const emailEl = document.getElementById("user-email");
const avatarEl = document.getElementById("profile-avatar");
const addressEl = document.getElementById("user-address");
const logoutButton = document.querySelector(".logout-btn");
const profileRoleBadge = document.getElementById("profile-role-badge");
const referralCodeDisplay = document.getElementById("referral-code-display");
const referralLinkInput = document.getElementById("referral-link-input");
const copyReferralLinkBtn = document.getElementById("copy-referral-link-btn");
const referralTotalEarnings = document.getElementById("referral-total-earnings");
const referralApprovedBalance = document.getElementById("referral-approved-balance");
const referralPendingBalance = document.getElementById("referral-pending-balance");
const referralWithdrawnBalance = document.getElementById("referral-withdrawn-balance");
const customerReferralCount = document.getElementById("customer-referral-count");
const vendorReferralCount = document.getElementById("vendor-referral-count");
const commissionHistoryList = document.getElementById("commission-history-list");
const referredAccountList = document.getElementById("referred-account-list");
const withdrawalNote = document.getElementById("withdrawal-note");

let currentProfile = null;

function formatCurrency(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function loadAddress() {
  const saved = localStorage.getItem("address");
  if (addressEl) {
    addressEl.innerText = saved || currentProfile?.address || "No address added";
  }
}

function updateProfileUi(user, profile = null) {
  if (!user) {
    if (nameEl) nameEl.innerText = "Guest User";
    if (emailEl) emailEl.innerText = "Not logged in";
    if (avatarEl) avatarEl.innerText = "G";
    if (profileRoleBadge) profileRoleBadge.textContent = "Customer";

    if (logoutButton) {
      logoutButton.innerText = "Login";
    }
    return;
  }

  const displayName = profile?.name || user.displayName || "User";
  const email = profile?.email || user.email || "No email saved";
  const role = String(profile?.role || "customer").toLowerCase();

  if (nameEl) nameEl.innerText = displayName;
  if (emailEl) emailEl.innerText = email;
  if (avatarEl) avatarEl.innerText = displayName.charAt(0).toUpperCase();
  if (profileRoleBadge) {
    profileRoleBadge.textContent = role.charAt(0).toUpperCase() + role.slice(1);
  }

  if (logoutButton) {
    logoutButton.innerText = "Logout";
  }
}

function renderCommissionSummary(commissions = [], minWithdrawal = DEFAULT_REFERRAL_SETTINGS.minWithdrawal) {
  const totals = commissions.reduce((acc, commission) => {
    const amount = Number(commission.amount || 0);
    const status = String(commission.status || "pending").toLowerCase();

    acc.total += amount;

    if (status === "approved") acc.approved += amount;
    else if (status === "paid") acc.paid += amount;
    else if (status !== "rejected") acc.pending += amount;

    return acc;
  }, {
    total: 0,
    approved: 0,
    paid: 0,
    pending: 0
  });

  referralTotalEarnings.textContent = formatCurrency(totals.total);
  referralApprovedBalance.textContent = formatCurrency(totals.approved);
  referralPendingBalance.textContent = formatCurrency(totals.pending);
  referralWithdrawnBalance.textContent = formatCurrency(totals.paid);
  withdrawalNote.textContent =
    totals.approved >= minWithdrawal
      ? `You are eligible for payout. Minimum withdrawal is ${formatCurrency(minWithdrawal)}. Withdrawn payouts move into the withdrawn total.`
      : `Minimum withdrawal is ${formatCurrency(minWithdrawal)}. Approved balance unlocks payouts, and completed payouts appear as withdrawn.`;
}

function formatCommissionDate(timestamp) {
  const milliseconds = typeof timestamp?.seconds === "number"
    ? timestamp.seconds * 1000
    : null;

  if (!milliseconds) return "";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(milliseconds));
}

function renderCommissionHistory(commissions = []) {
  if (!commissionHistoryList) return;

  commissionHistoryList.innerHTML = commissions.length
    ? commissions.map((commission) => {
      const status = String(commission.status || "pending").toLowerCase();
      const statusLabel = status === "paid" ? "Withdrawn" : (commission.status || "pending");
      const withdrawnAt = status === "paid"
        ? `<span>Withdrawn on: ${formatCommissionDate(commission.paidAt) || "Recorded"}</span>`
        : "";

      return `
        <article class="referral-history-card">
          <strong>${commission.type === "customer" ? "Customer" : "Vendor"} referral</strong>
          <span>${formatCurrency(commission.amount)} • ${commission.percentage}%</span>
          <span>Status: ${statusLabel}</span>
          <span>Order: ${commission.orderId || "N/A"}</span>
          ${withdrawnAt}
        </article>
      `;
    }).join("")
    : '<div class="empty-state">No referral commissions yet.</div>';
}

function renderReferredAccounts(customers = [], vendors = []) {
  if (!referredAccountList) return;

  if (customerReferralCount) customerReferralCount.textContent = customers.length;
  if (vendorReferralCount) vendorReferralCount.textContent = vendors.length;

  const customerCards = customers.map((customer) => `
    <article class="referral-history-card">
      <strong>${customer.name || customer.email || customer.id}</strong>
      <span>Customer referral</span>
      <span>${customer.email || "No email"}</span>
    </article>
  `);

  const vendorCards = vendors.map((vendor) => `
    <article class="referral-history-card">
      <strong>${vendor.storeName || vendor.contactEmail || vendor.id}</strong>
      <span>Vendor referral</span>
      <span>Status: ${vendor.status || "pending"}</span>
    </article>
  `);

  referredAccountList.innerHTML = [...customerCards, ...vendorCards].length
    ? [...customerCards, ...vendorCards].join("")
    : '<div class="empty-state">No referred accounts yet.</div>';
}

async function loadReferralDashboard(user) {
  currentProfile = await ensureUserProfile(user, {
    role: "customer"
  });

  loadAddress();
  updateProfileUi(user, currentProfile);

  if (referralCodeDisplay) {
    referralCodeDisplay.textContent = `Referral code: ${currentProfile.referralCode || "--"}`;
  }

  if (referralLinkInput) {
    referralLinkInput.value = currentProfile.referralLink || "";
  }

  const settingsSnap = await getDoc(doc(db, "platform_settings", "main"));
  const minWithdrawal = settingsSnap.data()?.referrals?.minWithdrawal
    ?? DEFAULT_REFERRAL_SETTINGS.minWithdrawal;

  const commissionsSnap = await getDocs(
    query(
      collection(db, "commissions"),
      where("referrerId", "==", user.uid)
    )
  );

  const commissions = commissionsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  renderCommissionSummary(commissions, Number(minWithdrawal || DEFAULT_REFERRAL_SETTINGS.minWithdrawal));
  renderCommissionHistory(commissions);

  const [customers, vendors] = await Promise.all([
    getReferredCustomers(user.uid),
    getReferredVendors(user.uid)
  ]);

  renderReferredAccounts(customers, vendors);
}

window.addEventListener("DOMContentLoaded", () => {
  loadAddress();

  copyReferralLinkBtn?.addEventListener("click", async () => {
    const value = referralLinkInput?.value || "";
    if (!value) {
      showToast("Referral link is not ready yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showToast("Referral link copied.");
    } catch (error) {
      console.error("Copy failed:", error);
      showToast("Unable to copy referral link.");
    }
  });
});

window.editAddress = function () {
  document.getElementById("addressModal").style.display = "flex";
  document.getElementById("addressInput").value =
    localStorage.getItem("address") || currentProfile?.address || "";
};

window.closeModal = function () {
  document.getElementById("addressModal").style.display = "none";
};

window.saveAddress = async function () {
  const address = document.getElementById("addressInput").value.trim();

  if (!address) {
    showToast("Please enter an address");
    return;
  }

  localStorage.setItem("address", address);

  if (auth.currentUser) {
    currentProfile = await ensureUserProfile(auth.currentUser, {
      address,
      role: currentProfile?.role || "customer"
    });
  }

  loadAddress();
  window.closeModal();
  showToast("Address saved");
};

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

window.logout = async function () {
  if (!auth.currentUser) {
    window.location.href = "login.html";
    return;
  }

  try {
    await signOut(auth);
    localStorage.removeItem("userId");
    redirectWithToast("index.html", "Logged out. You can still browse products.", { type: "info" });
  } catch (error) {
    console.error("Logout failed:", error);
    showToast("Failed to logout");
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user?.emailVerified) {
    currentProfile = null;
    updateProfileUi(null);
    renderCommissionSummary([], DEFAULT_REFERRAL_SETTINGS.minWithdrawal);
    renderCommissionHistory([]);
    renderReferredAccounts([], []);
    redirectWithToast("login.html", "Please log in to view your profile.", { type: "info" });
    return;
  }

  try {
    currentProfile = await ensureUserProfile(user, {
      role: "customer"
    });
    updateProfileUi(user, currentProfile);
    loadAddress();
    await loadReferralDashboard(user);
  } catch (error) {
    console.error("Failed to load profile:", error);
    showToast("Failed to load your profile.");
  }
});
