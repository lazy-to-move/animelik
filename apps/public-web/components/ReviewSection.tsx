"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicReview } from "../lib/api";

type ReviewSectionProps = {
  animeId: number;
  initialReviews: PublicReview[];
  isSignedIn: boolean;
  currentUserId: number | null;
  currentUserRole: "user" | "admin" | null;
};

function formatReviewDate(value: string | Date | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export function ReviewSection({
  animeId,
  initialReviews,
  isSignedIn,
  currentUserId,
  currentUserRole,
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [rating, setRating] = useState(
    initialReviews.find((review) => review.userId === currentUserId)?.rating ?? 8,
  );
  const [comment, setComment] = useState(
    initialReviews.find((review) => review.userId === currentUserId)?.comment ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentUserReview = useMemo(
    () => reviews.find((review) => review.userId === currentUserId) ?? null,
    [currentUserId, reviews],
  );

  async function saveReview() {
    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          animeId,
          rating,
          comment,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to save your review.");
      }

      const payload = (await response.json()) as {
        review: PublicReview | null;
      };

      if (!payload.review) {
        throw new Error("Unable to refresh your review.");
      }

      setReviews((current) => {
        const remaining = current.filter(
          (review) => review.id !== payload.review!.id && review.userId !== payload.review!.userId,
        );
        return [payload.review!, ...remaining];
      });
      setComment(payload.review.comment ?? "");
      setRating(payload.review.rating);
      setMessage(currentUserReview ? "Review updated." : "Review posted.");
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to save your review.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeReview(reviewId: number) {
    setPendingDeleteId(reviewId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to delete this review.");
      }

      setReviews((current) => current.filter((review) => review.id !== reviewId));
      if (currentUserReview?.id === reviewId) {
        setComment("");
        setRating(8);
      }
      setMessage("Review deleted.");
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to delete this review.",
      );
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="panel review-panel">
      <div className="watch-heading-row">
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Reviews</h2>
          <p className="muted auth-copy" style={{ margin: 0 }}>
            Share a score and a short reaction directly from the Next.js
            migration surface.
          </p>
        </div>
        <span className="pill">{reviews.length} total</span>
      </div>

      {!isSignedIn ? (
        <div className="review-auth-card">
          <p className="muted auth-copy">
            Sign in to post your own review and keep your reactions with the new
            public app.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="button primary">
              Sign In
            </Link>
            <Link href="/signup" className="button">
              Create Account
            </Link>
          </div>
        </div>
      ) : (
        <div className="review-composer">
          <div className="review-rating-row">
            <label className="watchlist-field">
              <span>Rating</span>
              <input
                type="range"
                min={1}
                max={10}
                value={rating}
                disabled={isSubmitting}
                onChange={(event) => setRating(Number(event.target.value))}
              />
            </label>
            <strong className="review-rating-pill">{rating}/10</strong>
          </div>

          <label className="watchlist-field">
            <span>Your review</span>
            <textarea
              value={comment}
              rows={4}
              maxLength={2000}
              disabled={isSubmitting}
              placeholder="Share what worked, what did not, or why this anime stood out."
              onChange={(event) => setComment(event.target.value)}
            />
          </label>

          <div className="hero-actions">
            <button
              type="button"
              className="button primary"
              disabled={isSubmitting}
              onClick={() => void saveReview()}
            >
              {isSubmitting
                ? "Saving..."
                : currentUserReview
                  ? "Update review"
                  : "Post review"}
            </button>
            {currentUserReview ? (
              <button
                type="button"
                className="button danger"
                disabled={pendingDeleteId === currentUserReview.id}
                onClick={() => void removeReview(currentUserReview.id)}
              >
                {pendingDeleteId === currentUserReview.id
                  ? "Removing..."
                  : "Delete review"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {message ? <p className="watch-sync-note success">{message}</p> : null}
      {error ? <p className="watch-sync-note error">{error}</p> : null}

      <div className="review-list">
        {reviews.length === 0 ? (
          <div className="review-item">No reviews yet.</div>
        ) : (
          reviews.map((review) => {
            const canDelete =
              currentUserRole === "admin" || review.userId === currentUserId;

            return (
              <article key={review.id} className="review-item">
                <div className="review-item-header">
                  <div>
                    <strong>{review.userName || "Anonymous"}</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {formatReviewDate(review.createdAt)}
                    </div>
                  </div>
                  <div className="review-item-actions">
                    <span className="review-rating-pill">{review.rating}/10</span>
                    {canDelete ? (
                      <button
                        type="button"
                        className="button danger compact"
                        disabled={pendingDeleteId === review.id}
                        onClick={() => void removeReview(review.id)}
                      >
                        {pendingDeleteId === review.id ? "Removing..." : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <p style={{ marginBottom: 0 }}>
                  {review.comment || "No written review."}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
