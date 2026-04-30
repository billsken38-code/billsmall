// Product Reviews System
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { showToast } from "./ui.js";

let currentProductId = null;
let currentUser = null;

// Initialize reviews for a product
export function initReviews(productId, user) {
  currentProductId = productId;
  currentUser = user;
  loadReviews();
}

// Load and display reviews for a product
async function loadReviews() {
  if (!currentProductId) return;

  const reviewsContainer = document.getElementById("reviews-container");
  if (!reviewsContainer) return;

  try {
    const reviewsRef = collection(db, "products", currentProductId, "reviews");
    const q = query(reviewsRef, orderBy("createdAt", "desc"), limit(20));
    const snapshot = await getDocs(q);

    const reviews = [];
    let totalRating = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalRating += data.rating || 0;
      reviews.push({ id: doc.id, ...data });
    });

    const avgRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    renderReviews(reviews, avgRating);
  } catch (error) {
    console.error("Error loading reviews:", error);
    reviewsContainer.innerHTML = `<p class="reviews-error">Unable to load reviews.</p>`;
  }
}

// Render reviews on the page
function renderReviews(reviews, avgRating) {
  const reviewsContainer = document.getElementById("reviews-container");
  if (!reviewsContainer) return;

  const isLoggedIn = !!(currentUser || localStorage.getItem("userId"));

  reviewsContainer.innerHTML = `
    <div class="reviews-section">
      <h3>Customer Reviews</h3>
      
      <div class="reviews-summary">
        <div class="avg-rating">
          <span class="rating-number">${avgRating}</span>
          <div class="rating-stars">${renderStars(avgRating)}</div>
          <span class="review-count">${reviews.length} review${reviews.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      ${isLoggedIn ? `
        <div class="review-form">
          <h4>Write a Review</h4>
          <div class="rating-input">
            <span>Your Rating:</span>
            <div class="star-rating-input">
              ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-rating="${n}">★</button>`).join("")}
            </div>
          </div>
          <textarea id="review-text" placeholder="Share your experience with this product..." rows="4"></textarea>
          <button type="button" id="submit-review-btn" class="submit-review-btn">Submit Review</button>
        </div>
      ` : `
        <p class="login-to-review">Log in to write a review</p>
      `}

      <div class="reviews-list">
        ${reviews.length > 0 ? reviews.map(renderReviewCard).join("") : "<p class='no-reviews'>No reviews yet. Be the first to review!</p>"}
      </div>
    </div>
  `;

  // Bind events
  bindReviewEvents();
}

// Render star display
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  let html = "";

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      html += "<span class='star filled'>★</span>";
    } else if (i === fullStars && hasHalf) {
      html += "<span class='star half'>★</span>";
    } else {
      html += "<span class='star'>★</span>";
    }
  }

  return html;
}

// Render individual review card
function renderReviewCard(review) {
  const date = review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : "Recently";
  const stars = renderStars(review.rating || 0);

  return `
    <div class="review-card">
      <div class="review-header">
        <span class="reviewer-name">${review.userName || "Anonymous"}</span>
        <span class="review-date">${date}</span>
      </div>
      <div class="review-stars">${stars}</div>
      <p class="review-text">${review.comment || ""}</p>
    </div>
  `;
}

// Bind review form events
function bindReviewEvents() {
  const starBtns = document.querySelectorAll(".star-rating-input .star-btn");
  let selectedRating = 0;

  starBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedRating = parseInt(btn.dataset.rating);
      starBtns.forEach((b, i) => {
        b.classList.toggle("active", i < selectedRating);
      });
    });
  });

  const submitBtn = document.getElementById("submit-review-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => submitReview(selectedRating));
  }
}

// Submit a new review
async function submitReview(rating) {
  if (!currentProductId) {
    showToast("Product not found", { type: "error" });
    return;
  }

  if (!rating || rating < 1 || rating > 5) {
    showToast("Please select a rating", { type: "error" });
    return;
  }

  const comment = document.getElementById("review-text")?.value?.trim();
  if (!comment) {
    showToast("Please write a review", { type: "error" });
    return;
  }

  const userId = localStorage.getItem("userId");
  const userName = localStorage.getItem("userName") || "Customer";

  const submitBtn = document.getElementById("submit-review-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  try {
    const reviewsRef = collection(db, "products", currentProductId, "reviews");
    await addDoc(reviewsRef, {
      userId,
      userName,
      rating,
      comment,
      createdAt: new Date()
    });

    showToast("Review submitted successfully!", { type: "success" });
    loadReviews();
  } catch (error) {
    console.error("Error submitting review:", error);
    showToast("Failed to submit review. Please try again.", { type: "error" });
  }
}