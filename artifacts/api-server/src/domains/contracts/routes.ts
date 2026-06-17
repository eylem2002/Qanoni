import { Router, type IRouter } from "express";
import { GenerateContractBody } from "@workspace/api-zod";
import { RentalBody, ServiceBody, NdaBody, SupplierBody } from "./clauses";
import { validateBody, requireAuth } from "../../api/middlewares";
import * as controller from "./controller";

const contractsRouter: IRouter = Router();

// Saved-contract listing/retrieval — declared before the parametric routes
// and gated behind auth, scoped to the session user.
contractsRouter.get("/contracts", requireAuth, controller.listContracts);
contractsRouter.get("/contracts/:id", requireAuth, controller.getContract);

contractsRouter.post(
  "/contracts/generate",
  requireAuth,
  validateBody(GenerateContractBody),
  controller.generate("employment"),
);
contractsRouter.post(
  "/contracts/generate-rental",
  requireAuth,
  validateBody(RentalBody),
  controller.generate("rental"),
);
contractsRouter.post(
  "/contracts/generate-service",
  requireAuth,
  validateBody(ServiceBody),
  controller.generate("service"),
);
contractsRouter.post(
  "/contracts/generate-nda",
  requireAuth,
  validateBody(NdaBody),
  controller.generate("nda"),
);
contractsRouter.post(
  "/contracts/generate-supplier",
  requireAuth,
  validateBody(SupplierBody),
  controller.generate("supplier"),
);

contractsRouter.post("/contracts/export-report", controller.exportReport);
contractsRouter.post("/contracts/export-word", controller.exportWord);

export default contractsRouter;
