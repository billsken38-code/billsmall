const PENDING_TOAST_KEY = "pending_app_toast";
const WHATSAPP_POSITION_KEY = "whatsapp_support_position";
import { WHATSAPP_POOL } from "./whatsapp-pool.js";

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

// WhatsApp Support Button
export function initWhatsAppButton() {
  // Check if button already exists
  if (document.getElementById("whatsapp-support-btn")) return;

  const waBtn = document.createElement("a");
  waBtn.id = "whatsapp-support-btn";
  waBtn.href = WHATSAPP_POOL.getChatUrl("Hi, I need help with my order.");
  waBtn.target = "_blank";
  waBtn.rel = "noopener noreferrer";
  waBtn.title = "Chat on WhatsApp";
  waBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
    <span>Chat with us</span>
  `;

  document.body.appendChild(waBtn);
  makeWhatsAppButtonDraggable(waBtn);
}

function makeWhatsAppButtonDraggable(button) {
  if (!button) return;

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let dragged = false;
  let suppressClick = false;

  const clampPosition = (left, top) => {
    const rect = button.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - rect.height - 12);

    return {
      left: Math.min(Math.max(12, left), maxLeft),
      top: Math.min(Math.max(12, top), maxTop)
    };
  };

  const applyPosition = (left, top, persist = true) => {
    const next = clampPosition(left, top);
    button.style.left = `${next.left}px`;
    button.style.top = `${next.top}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";

    if (persist) {
      localStorage.setItem(WHATSAPP_POSITION_KEY, JSON.stringify(next));
    }
  };

  const restorePosition = () => {
    try {
      const raw = localStorage.getItem(WHATSAPP_POSITION_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (typeof saved.left !== "number" || typeof saved.top !== "number") return;

      applyPosition(saved.left, saved.top, false);
    } catch (error) {
      console.error("Failed to restore WhatsApp button position:", error);
    }
  };

  const resetDefaultPosition = () => {
    button.style.left = "";
    button.style.top = "";
    button.style.right = "";
    button.style.bottom = "";
    localStorage.removeItem(WHATSAPP_POSITION_KEY);
  };

  requestAnimationFrame(restorePosition);

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const rect = button.getBoundingClientRect();
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    dragged = false;
    suppressClick = false;

    button.classList.add("is-dragging");
    button.setPointerCapture(pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (!dragged && Math.hypot(deltaX, deltaY) > 6) {
      dragged = true;
      suppressClick = true;
    }

    if (!dragged) return;

    applyPosition(originLeft + deltaX, originTop + deltaY);
  });

  const releaseDrag = (event) => {
    if (pointerId !== event.pointerId) return;

    if (button.hasPointerCapture(pointerId)) {
      button.releasePointerCapture(pointerId);
    }

    pointerId = null;
    button.classList.remove("is-dragging");

    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
  };

  button.addEventListener("pointerup", releaseDrag);
  button.addEventListener("pointercancel", releaseDrag);

  button.addEventListener("click", (event) => {
    if (!suppressClick) return;

    event.preventDefault();
    event.stopPropagation();
  });

  button.addEventListener("dblclick", () => {
    resetDefaultPosition();
  });

  window.addEventListener("resize", () => {
    const raw = localStorage.getItem(WHATSAPP_POSITION_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (typeof saved.left !== "number" || typeof saved.top !== "number") return;
      applyPosition(saved.left, saved.top);
    } catch (error) {
      console.error("Failed to resize WhatsApp button position:", error);
    }
  });
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWhatsAppButton);
} else {
  initWhatsAppButton();
}
