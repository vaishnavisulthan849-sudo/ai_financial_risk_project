import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, portfoliosTable, assetsTable } from "@workspace/db";

const router: IRouter = Router();

function getRiskLevel(score: number): string {
  if (score < 20) return "very_low";
  if (score < 40) return "low";
  if (score < 60) return "medium";
  if (score < 80) return "high";
  return "very_high";
}

router.get("/portfolios/:id/risk", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, id));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  const assets = await db.select().from(assetsTable).where(eq(assetsTable.portfolioId, id));

  const riskScore = parseFloat(portfolio.riskScore);
  const totalValue = parseFloat(portfolio.totalValue);

  let weightedBeta = 0;
  let totalCost = 0;
  let hasBeta = false;
  const sectorMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  let concentrationMax = 0;

  for (const a of assets) {
    const qty = parseFloat(a.quantity);
    const cv = qty * parseFloat(a.currentPrice);
    const cost = qty * parseFloat(a.purchasePrice);
    totalCost += cost;
    if (a.beta !== null) { weightedBeta += parseFloat(a.beta) * cv; hasBeta = true; }
    const sector = a.sector ?? a.assetType;
    sectorMap[sector] = (sectorMap[sector] ?? 0) + cv;
    typeMap[a.assetType] = (typeMap[a.assetType] ?? 0) + cv;
    const w = totalValue > 0 ? cv / totalValue : 0;
    if (w > concentrationMax) concentrationMax = w;
  }

  const beta = hasBeta && totalValue > 0 ? weightedBeta / totalValue : 1.0;
  const returnRate = parseFloat(portfolio.returnRate);
  const riskFreeRate = 4.5;
  const volatility = Math.abs(beta) * 15 + Math.random() * 5;
  const sharpeRatio = (returnRate - riskFreeRate) / Math.max(volatility, 0.01);
  const maxDrawdown = -(Math.abs(beta) * 12 + Math.random() * 8);
  const diversificationScore = Math.min(Object.keys(sectorMap).length / 8, 1) * 100;
  const concentrationRisk = concentrationMax * 100;
  const correlationRisk = Math.max(0, 100 - diversificationScore);
  const valueAtRisk = totalValue * (volatility / 100) * 1.65;

  const breakdown = [
    { category: "market", score: Math.min(Math.abs(beta) / 2, 1) * 100, label: "Market Risk", description: "Exposure to broad market movements" },
    { category: "concentration", score: concentrationRisk, label: "Concentration Risk", description: "Risk from over-exposure to a single asset" },
    { category: "diversification", score: 100 - diversificationScore, label: "Diversification Risk", description: "Lack of spread across sectors and asset classes" },
    { category: "liquidity", score: assets.some((a) => a.assetType === "real_estate") ? 60 : 20, label: "Liquidity Risk", description: "Risk of inability to exit positions quickly" },
    { category: "volatility", score: Math.min(volatility * 2, 100), label: "Volatility Risk", description: "Historical price fluctuation exposure" },
  ];

  res.json({
    portfolioId: id,
    riskScore,
    valueAtRisk,
    sharpeRatio,
    beta,
    volatility,
    maxDrawdown,
    diversificationScore,
    concentrationRisk,
    correlationRisk,
    riskLevel: getRiskLevel(riskScore),
    breakdown,
  });
});

router.get("/risk/market", async (_req, res): Promise<void> => {
  const now = new Date();
  res.json({
    fearGreedIndex: 42,
    fearGreedLabel: "Fear",
    vix: 18.5,
    sp500Change: -0.82,
    bondYield10y: 4.32,
    usdIndex: 104.2,
    marketSentiment: "bearish",
    topRisks: [
      "Elevated inflation persistence",
      "Federal Reserve policy uncertainty",
      "Geopolitical tensions in key markets",
      "Credit market stress signals",
      "Tech sector valuation concerns",
    ],
    updatedAt: now.toISOString(),
  });
});

router.get("/risk/history", async (req, res): Promise<void> => {
  const portfolioId = req.query.portfolioId ? parseInt(req.query.portfolioId as string, 10) : null;
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

  const entries = [];
  const now = new Date();
  let baseRisk = 45;
  let baseVaR = 8500;
  let baseVol = 12;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    baseRisk += (Math.random() - 0.48) * 3;
    baseRisk = Math.max(10, Math.min(90, baseRisk));
    baseVaR += (Math.random() - 0.48) * 500;
    baseVaR = Math.max(1000, baseVaR);
    baseVol += (Math.random() - 0.48) * 0.8;
    baseVol = Math.max(5, Math.min(35, baseVol));
    entries.push({
      date: date.toISOString().split("T")[0],
      riskScore: parseFloat(baseRisk.toFixed(2)),
      portfolioId: portfolioId ?? null,
      valueAtRisk: parseFloat(baseVaR.toFixed(2)),
      volatility: parseFloat(baseVol.toFixed(2)),
    });
  }

  res.json(entries);
});

export default router;
