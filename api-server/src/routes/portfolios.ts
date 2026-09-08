import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, portfoliosTable, assetsTable, activityTable } from "@workspace/db";

const router: IRouter = Router();

function computeAssetDerivedFields(asset: {
  quantity: string;
  purchasePrice: string;
  currentPrice: string;
  portfolioId: number;
}) {
  const qty = parseFloat(asset.quantity);
  const purchasePrice = parseFloat(asset.purchasePrice);
  const currentPrice = parseFloat(asset.currentPrice);
  const currentValue = qty * currentPrice;
  const costBasis = qty * purchasePrice;
  const gainLoss = currentValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  return { currentValue, gainLoss, gainLossPercent };
}

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
    if (a.beta !== null) {
      weightedBeta += parseFloat(a.beta) * currentValue;
      hasBeta = true;
    }
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
    .set({
      totalValue: totalValue.toFixed(2),
      returnRate: returnRate.toFixed(4),
      riskScore: riskScore.toFixed(2),
    })
    .where(eq(portfoliosTable.id, portfolioId));
}

router.get("/portfolios", async (req, res): Promise<void> => {
  const rows = await db.select().from(portfoliosTable).orderBy(portfoliosTable.createdAt);
  const result = rows.map((p) => ({
    ...p,
    totalValue: parseFloat(p.totalValue),
    returnRate: parseFloat(p.returnRate),
    riskScore: parseFloat(p.riskScore),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
  res.json(result);
});

router.post("/portfolios", async (req, res): Promise<void> => {
  const { name, description, currency, riskTolerance } = req.body;
  if (!name || !currency || !riskTolerance) {
    res.status(400).json({ error: "name, currency, and riskTolerance are required" });
    return;
  }

  const [portfolio] = await db.insert(portfoliosTable).values({
    name,
    description: description ?? null,
    currency,
    riskTolerance,
  }).returning();

  await db.insert(activityTable).values({
    type: "portfolio_updated",
    title: "Portfolio Created",
    description: `New portfolio "${name}" was created.`,
    portfolioName: name,
  });

  res.status(201).json({
    ...portfolio,
    totalValue: parseFloat(portfolio.totalValue),
    returnRate: parseFloat(portfolio.returnRate),
    riskScore: parseFloat(portfolio.riskScore),
    createdAt: portfolio.createdAt.toISOString(),
    updatedAt: portfolio.updatedAt.toISOString(),
  });
});

router.get("/portfolios/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, id));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  res.json({
    ...portfolio,
    totalValue: parseFloat(portfolio.totalValue),
    returnRate: parseFloat(portfolio.returnRate),
    riskScore: parseFloat(portfolio.riskScore),
    createdAt: portfolio.createdAt.toISOString(),
    updatedAt: portfolio.updatedAt.toISOString(),
  });
});

router.patch("/portfolios/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, description, riskTolerance } = req.body;

  const updates: Record<string, string | null> = {};
  if (name != null) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (riskTolerance != null) updates.riskTolerance = riskTolerance;

  const [portfolio] = await db.update(portfoliosTable).set(updates).where(eq(portfoliosTable.id, id)).returning();
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  res.json({
    ...portfolio,
    totalValue: parseFloat(portfolio.totalValue),
    returnRate: parseFloat(portfolio.returnRate),
    riskScore: parseFloat(portfolio.riskScore),
    createdAt: portfolio.createdAt.toISOString(),
    updatedAt: portfolio.updatedAt.toISOString(),
  });
});

router.delete("/portfolios/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db.delete(portfoliosTable).where(eq(portfoliosTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/portfolios/:id/assets", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const assets = await db.select().from(assetsTable).where(eq(assetsTable.portfolioId, id));
  const portfolio = await db.select({ totalValue: portfoliosTable.totalValue }).from(portfoliosTable).where(eq(portfoliosTable.id, id));
  const totalValue = portfolio[0] ? parseFloat(portfolio[0].totalValue) : 0;

  const result = assets.map((a) => {
    const qty = parseFloat(a.quantity);
    const currentValue = qty * parseFloat(a.currentPrice);
    const costBasis = qty * parseFloat(a.purchasePrice);
    const gainLoss = currentValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    const weight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    return {
      id: a.id,
      portfolioId: a.portfolioId,
      symbol: a.symbol,
      name: a.name,
      assetType: a.assetType,
      sector: a.sector ?? null,
      quantity: qty,
      purchasePrice: parseFloat(a.purchasePrice),
      currentPrice: parseFloat(a.currentPrice),
      currentValue,
      gainLoss,
      gainLossPercent,
      weight,
      beta: a.beta !== null ? parseFloat(a.beta) : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  });

  res.json(result);
});

router.post("/portfolios/:id/assets", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const portfolioId = parseInt(raw, 10);
  const { symbol, name, assetType, sector, quantity, purchasePrice, currentPrice, beta } = req.body;

  if (!symbol || !name || !assetType || quantity == null || purchasePrice == null || currentPrice == null) {
    res.status(400).json({ error: "symbol, name, assetType, quantity, purchasePrice, and currentPrice are required" });
    return;
  }

  const [asset] = await db.insert(assetsTable).values({
    portfolioId,
    symbol,
    name,
    assetType,
    sector: sector ?? null,
    quantity: String(quantity),
    purchasePrice: String(purchasePrice),
    currentPrice: String(currentPrice),
    beta: beta != null ? String(beta) : null,
  }).returning();

  await recalcPortfolio(portfolioId);

  const portfolio = await db.select({ totalValue: portfoliosTable.totalValue, name: portfoliosTable.name }).from(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
  const totalValue = portfolio[0] ? parseFloat(portfolio[0].totalValue) : 0;
  const portfolioName = portfolio[0]?.name ?? null;

  await db.insert(activityTable).values({
    type: "asset_added",
    title: "Asset Added",
    description: `${symbol} (${name}) added to portfolio.`,
    portfolioName,
  });

  const qty = parseFloat(asset.quantity);
  const currentValue = qty * parseFloat(asset.currentPrice);
  const costBasis = qty * parseFloat(asset.purchasePrice);
  const gainLoss = currentValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
  const weight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;

  res.status(201).json({
    id: asset.id,
    portfolioId: asset.portfolioId,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    sector: asset.sector ?? null,
    quantity: qty,
    purchasePrice: parseFloat(asset.purchasePrice),
    currentPrice: parseFloat(asset.currentPrice),
    currentValue,
    gainLoss,
    gainLossPercent,
    weight,
    beta: asset.beta !== null ? parseFloat(asset.beta) : null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  });
});

export default router;
