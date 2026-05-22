import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

export const DEFAULT_REFERRAL_SETTINGS = {
  adminCommissionRate: 5,
  customerReferralRate: 1.5,
  vendorReferralRate: 1,
  minWithdrawal: 50,
  durationMonths: 2
};

export const DEFAULT_ADMIN_COMMISSION_TIERS = [
  { min: 0, max: 99.99, rate: 3 },
  { min: 100, max: 499.99, rate: 5 },
  { min: 500, max: null, rate: 7 }
];

const USER_ROLE_PRIORITY = {
  customer: 1,
  vendor: 2,
  admin: 3
};

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getStoredOrderEarnings(order = {}) {
  return order.earnings && typeof order.earnings === "object"
    ? order.earnings
    : {};
}

export function normalizeCommissionTiers(
  tiers = DEFAULT_ADMIN_COMMISSION_TIERS,
  fallbackRate = DEFAULT_REFERRAL_SETTINGS.adminCommissionRate
) {
  const normalized = (Array.isArray(tiers) ? tiers : [])
    .map((tier) => {
      const min = Math.max(0, Number(tier?.min || 0));
      const hasMax = tier?.max !== "" && tier?.max !== null && typeof tier?.max !== "undefined";
      const max = hasMax ? Number(tier.max) : null;
      const rate = Math.max(0, Number(tier?.rate ?? fallbackRate));

      return {
        min: roundCurrency(min),
        max: max !== null && Number.isFinite(max) ? roundCurrency(Math.max(max, min)) : null,
        rate: roundCurrency(rate)
      };
    })
    .filter((tier) => Number.isFinite(tier.min) && Number.isFinite(tier.rate))
    .sort((a, b) => a.min - b.min);

  if (normalized.length) {
    return normalized;
  }

  return [{
    min: 0,
    max: null,
    rate: roundCurrency(fallbackRate)
  }];
}

export function getAdminCommissionRateForAmount(
  amount,
  tiers = DEFAULT_ADMIN_COMMISSION_TIERS,
  fallbackRate = DEFAULT_REFERRAL_SETTINGS.adminCommissionRate
) {
  const total = Math.max(0, Number(amount || 0));
  const normalizedTiers = normalizeCommissionTiers(tiers, fallbackRate);
  const matchedTier = normalizedTiers.find((tier) =>
    total >= tier.min && (tier.max === null || total <= tier.max)
  );

  return Number(matchedTier?.rate ?? fallbackRate);
}

export function getAdminCommissionAmountForAmount(
  amount,
  tiers = DEFAULT_ADMIN_COMMISSION_TIERS,
  fallbackRate = DEFAULT_REFERRAL_SETTINGS.adminCommissionRate
) {
  const total = roundCurrency(amount);
  const rate = getAdminCommissionRateForAmount(total, tiers, fallbackRate);
  return roundCurrency(total * (rate / 100));
}

export function getAdminCommissionSummaryForOrder(
  order = {},
  tiers = DEFAULT_ADMIN_COMMISSION_TIERS,
  fallbackRate = DEFAULT_REFERRAL_SETTINGS.adminCommissionRate
) {
  const storedEarnings = getStoredOrderEarnings(order);
  const storedSalesBase = roundCurrency(
    storedEarnings.grossSales
    ?? order.totalAmount
    ?? order.total
    ?? 0
  );
  const storedAmount = roundCurrency(
    storedEarnings.platformGrossCommission
    ?? storedEarnings.platformEarnings
    ?? order.adminCommissionAmount
    ?? 0
  );

  if (storedAmount > 0 || storedSalesBase > 0) {
    const appliedRate = storedSalesBase > 0
      ? roundCurrency((storedAmount / storedSalesBase) * 100)
      : fallbackRate;

    return {
      amount: storedAmount,
      salesBase: storedSalesBase,
      effectiveRate: appliedRate,
      appliedRate
    };
  }

  const items = Array.isArray(order.items) ? order.items : [];

  if (items.length) {
    const salesBase = roundCurrency(items.reduce(
      (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)),
      0
    ));
    const amount = roundCurrency(items.reduce((sum, item) => {
      const unitPrice = Number(item.price || 0);
      const quantity = Number(item.quantity || 1);
      const unitCommission = getAdminCommissionAmountForAmount(unitPrice, tiers, fallbackRate);
      return sum + (unitCommission * quantity);
    }, 0));

    return {
      amount,
      salesBase,
      effectiveRate: salesBase > 0 ? roundCurrency((amount / salesBase) * 100) : fallbackRate,
      appliedRate: salesBase > 0 ? roundCurrency((amount / salesBase) * 100) : fallbackRate
    };
  }

  const salesBase = roundCurrency(order.totalAmount ?? order.total ?? 0);
  const appliedRate = getAdminCommissionRateForAmount(salesBase, tiers, fallbackRate);
  const amount = getAdminCommissionAmountForAmount(salesBase, tiers, fallbackRate);

  return {
    amount,
    salesBase,
    effectiveRate: salesBase > 0 ? roundCurrency((amount / salesBase) * 100) : appliedRate,
    appliedRate
  };
}

function normalizeRole(value) {
  const role = String(value || "customer").trim().toLowerCase();
  return ["customer", "vendor", "admin"].includes(role) ? role : "customer";
}

function resolveRole(existingRole, preferredRole) {
  const current = normalizeRole(existingRole);
  const next = normalizeRole(preferredRole);
  return USER_ROLE_PRIORITY[next] > USER_ROLE_PRIORITY[current] ? next : current;
}

export function normalizeOrderStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export function getReferralSettingsFromDoc(data = {}) {
  const referralSettings = data.referrals || {};
  const adminCommissionRate = Number(
    data.commissionRate ?? DEFAULT_REFERRAL_SETTINGS.adminCommissionRate
  );
  const adminCommissionTiers = normalizeCommissionTiers(
    data.commissionTiers,
    adminCommissionRate
  );

  return {
    adminCommissionRate,
    adminCommissionTiers,
    customerReferralRate: Number(
      referralSettings.customerRate ?? DEFAULT_REFERRAL_SETTINGS.customerReferralRate
    ),
    vendorReferralRate: Number(
      referralSettings.vendorRate ?? DEFAULT_REFERRAL_SETTINGS.vendorReferralRate
    ),
    minWithdrawal: Number(
      referralSettings.minWithdrawal ?? DEFAULT_REFERRAL_SETTINGS.minWithdrawal
    ),
    durationMonths: Number(
      referralSettings.durationMonths ?? DEFAULT_REFERRAL_SETTINGS.durationMonths
    ),
    startsAt: referralSettings.startsAt || "",
    endsAt: referralSettings.endsAt || ""
  };
}

export function addMonthsToIsoDate(isoDate, monthsToAdd = DEFAULT_REFERRAL_SETTINGS.durationMonths) {
  const baseDate = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return "";
  }

  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + Number(monthsToAdd || 0));
  return nextDate.toISOString();
}

export function isReferralProgramActive(settings = {}, now = new Date()) {
  const startsAt = settings.startsAt ? new Date(settings.startsAt) : null;
  const endsAt = settings.endsAt ? new Date(settings.endsAt) : null;
  const currentTime = now instanceof Date ? now : new Date(now);

  if (startsAt && !Number.isNaN(startsAt.getTime()) && currentTime < startsAt) {
    return false;
  }

  if (endsAt && !Number.isNaN(endsAt.getTime()) && currentTime > endsAt) {
    return false;
  }

  return true;
}

export function getClientDeviceId() {
  const storageKey = "bcm_device_id";
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId = `dev-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

export function readReferralCodeFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  return String(params.get("ref") || "").trim().toUpperCase();
}

export function buildReferralLink(referralCode, path = "/signup.html") {
  if (!referralCode) return "";

  const origin = window.location.origin || "";
  return `${origin}${path}?ref=${encodeURIComponent(referralCode)}`;
}

async function createUniqueReferralCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `BCM${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const codeSnap = await getDoc(doc(db, "referral_profiles", candidate));

    if (!codeSnap.exists()) {
      return candidate;
    }
  }

  return `BCM${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

async function resolveReferralSource(referralCode, newUserId, clientDeviceId) {
  if (!referralCode) {
    return {
      referredBy: "",
      referralCodeUsed: "",
      flags: []
    };
  }

  const codeSnap = await getDoc(doc(db, "referral_profiles", referralCode));

  if (!codeSnap.exists()) {
    return {
      referredBy: "",
      referralCodeUsed: "",
      flags: ["invalid_referral_code"]
    };
  }

  const referralProfile = codeSnap.data();
  const settingsSnap = await getDoc(doc(db, "platform_settings", "main"));
  const settings = getReferralSettingsFromDoc(settingsSnap.exists() ? settingsSnap.data() : {});
  const referrerId = String(referralProfile.ownerId || "");
  const flags = [];

  if (!isReferralProgramActive(settings)) {
    return {
      referredBy: "",
      referralCodeUsed: "",
      flags: ["referral_program_inactive"]
    };
  }

  if (!referrerId || referrerId === newUserId) {
    return {
      referredBy: "",
      referralCodeUsed: "",
      flags: ["self_referral_blocked"]
    };
  }

  if (referralProfile.disabled) {
    return {
      referredBy: "",
      referralCodeUsed: "",
      flags: ["disabled_referral_code"]
    };
  }

  if (referralProfile.signupDeviceId && referralProfile.signupDeviceId === clientDeviceId) {
    return {
      referredBy: "",
      referralCodeUsed: "",
      flags: ["shared_device_referral_blocked"]
    };
  }

  if (referralProfile.role === "vendor") {
    flags.push("vendor_code_used_for_customer_signup");
  }

  return {
    referredBy: referrerId,
    referralCodeUsed: referralCode,
    flags
  };
}

async function upsertReferralProfile({ referralCode, userId, displayName, role, signupDeviceId }) {
  if (!referralCode || !userId) return;

  await setDoc(doc(db, "referral_profiles", referralCode), {
    referralCode,
    ownerId: userId,
    displayName: displayName || "User",
    role: normalizeRole(role),
    signupDeviceId: signupDeviceId || "",
    disabled: false,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
}

export async function ensureUserProfile(user, options = {}) {
  if (!user?.uid) {
    throw new Error("User profile sync requires an authenticated user.");
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const existing = userSnap.exists() ? userSnap.data() : null;
  const clientDeviceId = getClientDeviceId();
  const preferredRole = normalizeRole(options.role || existing?.role || "customer");
  const referralCode = existing?.referralCode || await createUniqueReferralCode();
  const resolvedRole = resolveRole(existing?.role || "customer", preferredRole);

  let referredBy = existing?.referredBy || "";
  let referralCodeUsed = existing?.referralCodeUsed || "";
  let flags = Array.isArray(existing?.flags) ? [...existing.flags] : [];
  let address = options.address ?? existing?.address ?? localStorage.getItem("address") ?? "";

  if (!existing && options.referralCode) {
    const referral = await resolveReferralSource(options.referralCode, user.uid, clientDeviceId);
    referredBy = referral.referredBy;
    referralCodeUsed = referral.referralCodeUsed;
    flags = flags.concat(referral.flags);
  }

  const payload = {
    id: user.uid,
    name: options.name || user.displayName || existing?.name || "User",
    email: user.email || existing?.email || "",
    address,
    role: resolvedRole,
    referralCode,
    referralLink: buildReferralLink(referralCode),
    referredBy,
    referralCodeUsed,
    signupDeviceId: existing?.signupDeviceId || clientDeviceId,
    referralLocked: flags.some((flag) => flag.includes("blocked")),
    flags: Array.from(new Set(flags)),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    createdAt: existing?.createdAt || serverTimestamp()
  };

  await setDoc(userRef, payload, { merge: true });
  await upsertReferralProfile({
    referralCode,
    userId: user.uid,
    displayName: payload.name,
    role: payload.role,
    signupDeviceId: payload.signupDeviceId
  });

  return {
    ...existing,
    ...payload,
    createdAt: existing?.createdAt || null
  };
}

export async function applyVendorReferralIfEligible({ vendorId, existingVendorData = null }) {
  if (!vendorId) return {};

  const referralCode = readReferralCodeFromUrl();
  if (!referralCode || existingVendorData?.referredBy) {
    return {
      referredBy: existingVendorData?.referredBy || "",
      referralCodeUsed: existingVendorData?.referralCodeUsed || "",
      flags: existingVendorData?.flags || []
    };
  }

  const referral = await resolveReferralSource(referralCode, vendorId, getClientDeviceId());

  return {
    referredBy: referral.referredBy,
    referralCodeUsed: referral.referralCodeUsed,
    flags: referral.flags
  };
}

function buildCommissionDocId(orderId, type, referrerId) {
  return `${orderId}_${type}_${referrerId}`;
}

function buildCommissionBreakdown({ order, customerProfile, vendorProfile, settings }) {
  const commissionSummary = getAdminCommissionSummaryForOrder(
    order,
    settings.adminCommissionTiers,
    settings.adminCommissionRate
  );
  const orderTotal = commissionSummary.salesBase;
  const adminCommissionRate = commissionSummary.appliedRate;
  const adminCommissionAmount = commissionSummary.amount;

  if (!isReferralProgramActive(settings)) {
    return {
      orderTotal,
      adminCommissionRate,
      adminCommissionAmount,
      adminNetCommissionAmount: adminCommissionAmount,
      totalReferralCommissionAmount: 0,
      commissions: []
    };
  }

  const customerReferralBlocked = !!customerProfile?.referralLocked;
  const vendorReferralBlocked = Array.isArray(vendorProfile?.flags)
    && vendorProfile.flags.some((flag) => String(flag || "").includes("blocked"));

  let remainingAdminPool = adminCommissionAmount;
  const commissions = [];

  if (!customerReferralBlocked && customerProfile?.referredBy && customerProfile.referredBy !== order.customerId) {
    const rawCustomerCommission = roundCurrency(
      orderTotal * (Number(settings.customerReferralRate || 0) / 100)
    );
    const amount = roundCurrency(Math.min(rawCustomerCommission, remainingAdminPool));

    if (amount > 0) {
      commissions.push({
        referrerId: customerProfile.referredBy,
        type: "customer",
        percentage: Number(settings.customerReferralRate || 0),
        amount
      });
      remainingAdminPool = roundCurrency(remainingAdminPool - amount);
    }
  }

  if (!vendorReferralBlocked && vendorProfile?.referredBy && vendorProfile.referredBy !== order.vendorId) {
    const rawVendorCommission = roundCurrency(
      orderTotal * (Number(settings.vendorReferralRate || 0) / 100)
    );
    const amount = roundCurrency(Math.min(rawVendorCommission, remainingAdminPool));

    if (amount > 0) {
      commissions.push({
        referrerId: vendorProfile.referredBy,
        type: "vendor",
        percentage: Number(settings.vendorReferralRate || 0),
        amount
      });
      remainingAdminPool = roundCurrency(remainingAdminPool - amount);
    }
  }

  return {
    orderTotal,
    adminCommissionRate,
    adminCommissionAmount,
    adminNetCommissionAmount: remainingAdminPool,
    totalReferralCommissionAmount: roundCurrency(
      commissions.reduce((sum, commission) => sum + commission.amount, 0)
    ),
    commissions
  };
}

export async function updateOrderStatusWithCommissions(orderId, nextStatus) {
  if (!orderId) {
    throw new Error("Order ID is required.");
  }

  const normalizedStatus = normalizeOrderStatus(nextStatus);
  const orderRef = doc(db, "orders", orderId);

  return runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists()) {
      throw new Error("Order not found.");
    }

    const order = {
      id: orderSnap.id,
      ...orderSnap.data()
    };
    const currentStatus = normalizeOrderStatus(order.status);
    const updatePayload = {
      status: nextStatus,
      updatedAt: serverTimestamp()
    };

    if (normalizedStatus !== "delivered" || order.commissionProcessedAt) {
      transaction.update(orderRef, updatePayload);
      return {
        processed: false,
        previousStatus: currentStatus,
        nextStatus: normalizedStatus
      };
    }

    const settingsRef = doc(db, "platform_settings", "main");
    const settingsSnap = await transaction.get(settingsRef);
    const settings = getReferralSettingsFromDoc(settingsSnap.exists() ? settingsSnap.data() : {});

    const customerId = order.customerId || order.userId || "";
    const userRef = customerId ? doc(db, "users", customerId) : null;
    const vendorRef = order.vendorId ? doc(db, "vendors", order.vendorId) : null;
    const customerProfileSnap = userRef ? await transaction.get(userRef) : null;
    const vendorProfileSnap = vendorRef ? await transaction.get(vendorRef) : null;
    const customerProfile = customerProfileSnap?.exists() ? customerProfileSnap.data() : null;
    const vendorProfile = vendorProfileSnap?.exists() ? vendorProfileSnap.data() : null;

    const breakdown = buildCommissionBreakdown({
      order: {
        ...order,
        customerId
      },
      customerProfile,
      vendorProfile,
      settings
    });

    breakdown.commissions.forEach((commission) => {
      const commissionId = buildCommissionDocId(orderId, commission.type, commission.referrerId);
      const commissionRef = doc(db, "commissions", commissionId);

      transaction.set(commissionRef, {
        id: commissionId,
        referrerId: commission.referrerId,
        type: commission.type,
        percentage: commission.percentage,
        amount: commission.amount,
        orderId,
        vendorId: order.vendorId || "",
        customerId,
        orderTotal: breakdown.orderTotal,
        adminCommissionRate: breakdown.adminCommissionRate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "pending"
      }, { merge: true });
    });

    transaction.update(orderRef, {
      ...updatePayload,
      customerId,
      totalAmount: breakdown.orderTotal,
      commissionProcessedAt: serverTimestamp(),
      commissionStatus: breakdown.commissions.length ? "pending" : "not_applicable",
      adminCommissionRate: breakdown.adminCommissionRate,
      adminCommissionAmount: breakdown.adminCommissionAmount,
      adminNetCommissionAmount: breakdown.adminNetCommissionAmount,
      referralCommissionAmount: breakdown.totalReferralCommissionAmount,
      referralCommissionTypes: breakdown.commissions.map((commission) => commission.type)
    });

    return {
      processed: true,
      previousStatus: currentStatus,
      nextStatus: normalizedStatus,
      breakdown
    };
  });
}

export async function updateCommissionStatus(commissionId, nextStatus) {
  if (!commissionId || !nextStatus) {
    throw new Error("Commission ID and status are required.");
  }

  const commissionRef = doc(db, "commissions", commissionId);
  await updateDoc(commissionRef, {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    ...(nextStatus === "paid" ? { paidAt: serverTimestamp() } : {})
  });
}

export async function getReferredCustomers(referrerId) {
  if (!referrerId) return [];

  const snapshot = await getDocs(
    query(collection(db, "users"), where("referredBy", "==", referrerId), limit(50))
  );

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function getReferredVendors(referrerId) {
  if (!referrerId) return [];

  const snapshot = await getDocs(
    query(collection(db, "vendors"), where("referredBy", "==", referrerId), limit(50))
  );

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function getMyUserProfile() {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) return null;

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}
