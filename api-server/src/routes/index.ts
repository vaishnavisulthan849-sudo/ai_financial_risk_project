import { Router, type IRouter } from "express";
import healthRouter from "./health";
import portfoliosRouter from "./portfolios";
import assetsRouter from "./assets";
import riskRouter from "./risk";
import alertsRouter from "./alerts";
import decisionsRouter from "./decisions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portfoliosRouter);
router.use(assetsRouter);
router.use(riskRouter);
router.use(alertsRouter);
router.use(decisionsRouter);
router.use(dashboardRouter);

export default router;
