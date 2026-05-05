import { createSignal } from "solid-js";

export interface Review {
  id: string;
  appId: string;
  author: string;
  rating: number; // 1..5
  text: string;
  timestamp: number;
}

const STORAGE_KEY = "cloudos:reviews";

function load(): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Review[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(items: Review[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

const [reviews, setReviews] = createSignal<Review[]>(load());
let nextId = reviews().reduce((max, r) => {
  const n = parseInt(r.id.replace(/^review-/, ""), 10);
  return Number.isFinite(n) && n > max ? n : max;
}, 0);

export { reviews };

export function reviewsFor(appId: string): Review[] {
  return reviews().filter((r) => r.appId === appId).sort((a, b) => b.timestamp - a.timestamp);
}

export interface AppRatingStats {
  count: number;
  average: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function ratingFor(appId: string): AppRatingStats {
  const list = reviewsFor(appId);
  const histogram: AppRatingStats["histogram"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of list) {
    const k = Math.max(1, Math.min(5, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    histogram[k]++;
    sum += r.rating;
  }
  return {
    count: list.length,
    average: list.length > 0 ? sum / list.length : 0,
    histogram,
  };
}

export function addReview(input: { appId: string; author: string; rating: number; text: string }): Review {
  nextId++;
  const review: Review = {
    id: `review-${nextId}`,
    appId: input.appId,
    author: input.author.trim() || "Anonymous",
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    text: input.text.trim(),
    timestamp: Date.now(),
  };
  const next = [review, ...reviews()];
  setReviews(next);
  save(next);
  return review;
}

export function updateReview(id: string, patch: Partial<Pick<Review, "rating" | "text">>) {
  const next = reviews().map((r) =>
    r.id === id
      ? {
          ...r,
          rating:
            typeof patch.rating === "number"
              ? Math.max(1, Math.min(5, Math.round(patch.rating)))
              : r.rating,
          text: typeof patch.text === "string" ? patch.text : r.text,
          timestamp: Date.now(),
        }
      : r,
  );
  setReviews(next);
  save(next);
}

export function deleteReview(id: string) {
  const next = reviews().filter((r) => r.id !== id);
  setReviews(next);
  save(next);
}
