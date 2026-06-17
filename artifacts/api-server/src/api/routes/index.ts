import { Router, type IRouter } from "express";
import healthRouter from "./health.routes";
import contractsRouter from "../../domains/contracts/routes";
import reviewRouter from "../../domains/review/routes";

/* Aggregates every domain router under a single /api mount point. */
const apiRouter: IRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(contractsRouter);
apiRouter.use(reviewRouter);

export default apiRouter;
