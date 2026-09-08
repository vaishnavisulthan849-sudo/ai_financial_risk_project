import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, assetsTable, portfoliosTable, activityTable } from "@workspace/db";

const router: IRouter = Router();

async function recalcPortfolio(portfolioId: number) {
  const assets = await db.select().from(assetsTable).where(eq(assetsTable.portfolioId, portfolioId));
  if (assets.length === 0) {
    await db.update(portfoliosTable)
      .set({ totalValue: "0", returnRate: "0", riskScore: "0" })
      .where(eq(portfoliosTable.id, portfolioId));
    return;
  }
  let totalValue = 0;
  let totalCost = 0;
  let weightedBeta = 0;
  let hasBeta = false;
  for (const a of assets) {
    const qty = parseFloat(a.quantity);
    const currentValue = qty * parseFloat(a.currentPrice);
    const cost = qty * parseFloat(a.purchasePrice);
    totalValue += currentValue;
    totalCost += cost;
    if (a.beta !== null) { weightedBeta += parseFloat(a.beta) * currentValue; hasBeta = true; }
  }
  const returnRate = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const avgBeta = hasBeta && totalValue > 0 ? weightedBeta / totalValue : 1;
  const concentrationMax = assets.reduce((max, a) => {
    const w = totalValue > 0 ? (parseFloat(a.quantity) * parseFloat(a.currentPrice)) / totalValue : 0;
    return Math.max(max, w);
  }, 0);
  const sectorSet = new Set(assets.map((a) => a.sector ?? a.assetType));
  const diversification = Math.min(sectorSet.size / 8, 1);
  const betaRisk = Math.min(Math.abs(avgBeta) / 2, 1) * 40;
  const concentrationRisk = concentrationMax * 30;
  const diversificationRisk = (1 - diversification) * 30;
  const riskScore = Math.min(betaRisk + concentrationRisk + diversificationRisk, 100);
  await db.update(portfoliosTable)
    .set({ totalValue: totalValue.toFixed(2), returnRate: returnRate.toFixed(4), riskScore: riskScore.toFixed(2) })
    .where(eq(portfoliosTable.id, portfolioId));
}

router.patch("/assets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { currentPrice, quantity } = req.body;

  const updates: Record<string, string> = {};
  if (currentPrice != null) updates.currentPrice = String(currentPrice);
  if (quantity != null) updates.quantity = String(quantity);

  const [asset] = await db.update(assetsTable).set(updates).where(eq(assetsTable.id, id)).returning();
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  await recalcPortfolio(asset.portfolioId);
  const portfolio = await db.select({ totalValue: portfoliosTable.totalValue }).from(portfoliosTable).where(eq(portfoliosTable.id, asset.portfolioId));
  const totalValue = portfolio[0] ? parseFloat(portfolio[0].totalValue) : 0;

  const qty = parseFloat(asset.quantity);
  const currentValue = qty * parseFloat(asset.currentPrice);
  const costBasis = qty * parseFloat(asset.purchasePrice);
  const gainLoss = currentValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  const weight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;

  res.json({
    id: asset.id, portfolioId: asset.portfolioId, symbol: asset.symbol, name: asset.name,
    assetType: asset.assetType, sector: asset.sector ?? null, quantity: qty,
    purchasePrice: parseFloat(asset.purchasePrice), currentPrice: parseFloat(asset.currentPrice),
    currentValue, gainLoss, gainLossPercent, weight,
    beta: asset.beta !== null ? parseFloat(asset.beta) : null,
    createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(),
  });
});

router.delete("/assets/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [asset] = await db.delete(assetsTable).where(eq(assetsTable.id, id)).returning();
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  await recalcPortfolio(asset.portfolioId);
  const portfolio = await db.select({ name: portfoliosTable.name }).from(portfoliosTable).where(eq(portfoliosTable.id, asset.portfolioId));
  await db.insert(activityTable).values({
    type: "asset_removed",
    title: "Asset Removed",
    description: `${asset.symbol} removed from portfolio.`,
    portfolioName: portfolio[0]?.name ?? null,
  });

  res.sendStatus(204);
});

export default router;
