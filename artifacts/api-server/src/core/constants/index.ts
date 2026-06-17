/** App-wide constants and shared user-facing strings. */

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const CONTRACT_RATE_LIMIT_MAX = 20;
export const REVIEW_RATE_LIMIT_MAX = 5;

export const MESSAGES = {
  rateLimitContract:
    "لقد تجاوزت الحد المسموح به. الرجاء الانتظار 10 دقائق قبل المحاولة مجدداً.",
  rateLimitReview: "تجاوزت الحد المسموح به للمراجعة. الرجاء الانتظار 10 دقائق.",
  notFound: "المسار غير موجود",
  unexpected: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
  invalidBody: "بيانات غير صحيحة",
} as const;
