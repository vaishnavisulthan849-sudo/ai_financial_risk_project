import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, portfoliosTable, assetsTable, alertsTable, decisionsTable, activityTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const portfolios = await db.select().from(portfoliosTable);
  const assets = await db.select().from(assetsTable);
  const alerts = await db.select().from(alertsTable);
  const decisions = await db.select().from(decisionsTable);

  const totalValue = portfolios.reduce((s, p) => s + parseFloat(p.totalValue), 0);
  const totalReturnRate = portfolios.length > 0
    ? portfolios.reduce((s, p) => s + parseFloat(p.returnRate), 0) / portfolios.length
    : 0;
  const averageRiskScore = portfolios.length > 0
    ? portfolios.reduce((s, p) => s + parseFloat(p.riskScore), 0) / portfolios.length
    : 0;

  const activeAlerts = alerts.filter((a) => a.status === "active").length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical" && a.status === "active").length;
  const pendingDecisions = decisions.filter((d) => d.status === "pending").length;

  const sorted = [...portfolios].sort((a, b) => parseFloat(b.returnRate) - parseFloat(a.returnRate));
  const topPerformer = sorted[0]?.name ?? null;
  const worstPerformer = sorted[sorted.length - 1]?.name ?? null;

  res.json({
    totalPortfolios: portfolios.length,
    totalAssets: assets.length,
    totalValue,
    totalReturnRate,
    averageRiskScore,
    activeAlerts,
    criticalAlerts,
    pendingDecisions,
    marketSentiment: "bearish",
    topPerformer,
    worstPerformer,
  });
});

router.get("/dashboard/sector-allocation", async (_req, res): Promise<void> => {
  const assets = await db.select().from(assetsTable);

  const sectorMap: Record<string, { value: number; count: number; beta: number[]; }> = {};
  let totalValue = 0;

  for (const a of assets) {
    const qty = parseFloat(a.quantity);
    const cv = qty * parseFloat(a.currentPrice);
    const sector = a.sector ?? a.assetType;
    if (!sectorMap[sector]) sectorMap[sector] = { value: 0, count: 0, beta: [] };
    sectorMap[sector].value += cv;
    sectorMap[sector].count += 1;
    if (a.beta !== null) sectorMap[sector].beta.push(parseFloat(a.beta));
    totalValue += cv;
  }

  const result = Object.entries(sectorMap).map(([sector, data]) => {
    const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
    const avgBeta = data.beta.length > 0 ? data.beta.reduce((s, b) => s + b, 0) / data.beta.length : 1;
    const riskContribution = percentage * Math.abs(avgBeta) / 100;
    return {
      sector,
      value: parseFloat(data.value.toFixed(2)),
      percentage: parseFloat(percentage.toFixed(2)),
      assetCount: data.count,
      riskContribution: parseFloat(riskContribution.toFixed(4)),
    };
  }).sort((a, b) => b.value - a.value);

  res.json(result);
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const rows = await db.select().from(activityTable)
    .orderBy(desc(activityTable.timestamp))
    .limit(20);

  res.json(rows.map((a) => ({
    ...a,
    timestamp: a.timestamp.toISOString(),
  })));
});

export default router;
