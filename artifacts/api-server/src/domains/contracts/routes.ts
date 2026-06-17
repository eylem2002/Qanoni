import { Router, type IRouter } from "express";
import { GenerateContractBody } from "@workspace/api-zod";
import { RentalBody, ServiceBody, NdaBody, SupplierBody } from "./clauses";
import { validateBody } from "../../api/middlewares";
import * as controller from "./controller";

const contractsRouter: IRouter = Router();

contractsRouter.post(
  "/contracts/generate",
  validateBody(GenerateContractBody),
  controller.generate("employment"),
);
contractsRouter.post(
  "/contracts/generate-rental",
  validateBody(RentalBody),
  controller.generate("rental"),
);
contractsRouter.post(
  "/contracts/generate-service",
  validateBody(ServiceBody),
  controller.generate("service"),
);
contractsRouter.post(
  "/contracts/generate-nda",
  validateBody(NdaBody),
  controller.generate("nda"),
);
contractsRouter.post(
  "/contracts/generate-supplier",
  validateBody(SupplierBody),
  controller.generate("supplier"),
);

contractsRouter.post("/contracts/export-report", controller.exportReport);
contractsRouter.post("/contracts/export-word", controller.exportWord);

export default contractsRouter;
