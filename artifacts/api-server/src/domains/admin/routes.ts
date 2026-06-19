import { Router, type IRouter } from "express";
import { requireAuth } from "../../api/middlewares";
import { listLawChanges, acknowledgeAndRefresh } from "./controller";

const adminRouter: IRouter = Router();

adminRouter.get("/admin/law-changes", requireAuth, listLawChanges);
adminRouter.post("/admin/law-changes/acknowledged", requireAuth, acknowledgeAndRefresh);

export default adminRouter;
