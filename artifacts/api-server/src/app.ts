import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const reviewRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تجاوزت الحد المسموح به للمراجعة. الرجاء الانتظار 10 دقائق." },
});

const contractRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "لقد تجاوزت الحد المسموح به. الرجاء الانتظار 10 دقائق قبل المحاولة مجدداً." },
});

app.use("/api/contracts/review", reviewRateLimit);
app.use("/api/contracts", contractRateLimit);

app.use("/api", router);

export default app;
