import { Router, type IRouter } from "express";
import * as controller from "./controller";

const authRouter: IRouter = Router();

authRouter.post("/auth/signup", controller.signup);
authRouter.post("/auth/login", controller.login);
authRouter.post("/auth/logout", controller.logout);
authRouter.get("/auth/me", controller.me);

export default authRouter;
