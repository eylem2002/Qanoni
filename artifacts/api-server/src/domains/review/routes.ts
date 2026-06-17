import { Router, type IRouter } from "express";
import multer from "multer";
import { requireAuth } from "../../api/middlewares";
import {
  reviewUpload,
  reviewText,
  listReviews,
  getReview,
} from "./controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم. المقبول: PDF, DOCX, TXT"));
    }
  },
});

const reviewRouter: IRouter = Router();

reviewRouter.get("/reviews", requireAuth, listReviews);
reviewRouter.get("/reviews/:id", requireAuth, getReview);

reviewRouter.post(
  "/contracts/review",
  requireAuth,
  upload.single("contract"),
  reviewUpload,
);
// Accepts plain JSON { contractText } — used when reviewing a just-generated contract
reviewRouter.post("/contracts/review-text", requireAuth, reviewText);

export default reviewRouter;
