const PENDING_TOAST_KEY = "pending_app_toast";

function ensureToastRoot() {
  let root = document.getElementById("app-toast-root");

  if (!root) {
    root = document.createElement("div");
    root.id = "app-toast-root";
    root.className = "app-toast-root";
    document.body.appendChild(root);
  }

  return root;
}

export function showToast(message, options = {}) {
  if (!message) return;

  const { type = "info", duration = 2600 } = options;
  const root = ensureToastRoot();
  const toast = document.createElement("div");

  toast.className = `app-toast app-toast-${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 260);
  }, duration);
}

export function redirectWithToast(url, message, options = {}) {
  if (message) {
    sessionStorage.setItem(
      PENDING_TOAST_KEY,
      JSON.stringify({
        message,
        type: options.type || "info",
        duration: options.duration || 2600
      })
    );
  }

  window.location.href = url;
}

function flushPendingToast() {
  const raw = sessionStorage.getItem(PENDING_TOAST_KEY);
  if (!raw) return;

  sessionStorage.removeItem(PENDING_TOAST_KEY);

  try {
    const payload = JSON.parse(raw);
    showToast(payload.message, {
      type: payload.type,
      duration: payload.duration
    });
  } catch (err) {
    console.error("Failed to restore pending toast:", err);
  }
}

flushPendingToast();
