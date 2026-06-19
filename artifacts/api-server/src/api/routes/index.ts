import { Router, type IRouter } from "express";
import healthRouter from "./health.routes";
import authRouter from "../../domains/auth/routes";
import contractsRouter from "../../domains/contracts/routes";
import reviewRouter from "../../domains/review/routes";
import adminRouter from "../../domains/admin/routes";

/* Aggregates every domain router under a single /api mount point. */
const apiRouter: IRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(contractsRouter);
apiRouter.use(reviewRouter);
apiRouter.use(adminRouter);

export default apiRouter;
