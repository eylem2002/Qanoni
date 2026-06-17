import rateLimit from "express-rate-limit";
import {
  RATE_LIMIT_WINDOW_MS,
  CONTRACT_RATE_LIMIT_MAX,
  REVIEW_RATE_LIMIT_MAX,
  MESSAGES,
} from "../../core/constants";

export const contractRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: CONTRACT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: MESSAGES.rateLimitContract },
});

export const reviewRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: REVIEW_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: MESSAGES.rateLimitReview },
});
