import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contractsRouter from "./contracts";
import reviewRouter from "./contracts/review";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contractsRouter);
router.use(reviewRouter);

export default router;
