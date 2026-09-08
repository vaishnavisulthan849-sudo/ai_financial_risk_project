import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, decisionsTable, portfoliosTable, assetsTable, activityTable } from "@workspace/db";

const router: IRouter = Router();

const aiDecisionTemplates = [
  {
    action: "rebalance",
    priority: "high",
    titleFn: (pName: string) => `Rebalance ${pName} Portfolio`,
    summaryFn: () => "Portfolio drift detected. Sector weights have diverged significantly from target allocation.",
    rationaleFn: () => "Analysis shows concentration risk has increased by 18% over the past month. Rebalancing to target weights will reduce VaR and improve the Sharpe ratio. Technology sector is overweight at 42% vs. 30% target; consider trimming and reallocating to fixed income and international equities.",
    expectedImpact: "Estimated 12-15% reduction in portfolio risk score and 0.3-0.4 improvement in Sharpe ratio.",
    riskReduction: 13.5,
  },
  {
    action: "hedge",
    priority: "high",
    titleFn: () => "Add Downside Protection via Options",
    summaryFn: () => "Market volatility indicators suggest elevated near-term risk. Recommend hedging strategy.",
    rationaleFn: () => "VIX is elevated at 18.5, and the portfolio's beta of 1.2 creates meaningful downside exposure. Purchasing protective puts on 20% of equity holdings at 5% OTM would cost approximately 1.2% of portfolio value but provides protection against a market correction exceeding 10%.",
    expectedImpact: "Reduces maximum drawdown by approximately 35% in a severe market correction scenario.",
    riskReduction: 8.2,
  },
  {
    action: "diversify",
    priority: "medium",
    titleFn: () => "Add Alternative Asset Exposure",
    summaryFn: () => "Portfolio lacks alternative asset exposure. Adding commodities or real assets would improve diversification.",
    rationaleFn: () => "Current correlation analysis shows all major positions move in lockstep during market stress. Allocation of 8-10% to commodity ETFs or REITs with low correlation to equities (historical correlation: -0.12) would provide meaningful diversification benefit.",
    expectedImpact: "Expected 0.25 improvement in diversification score and reduction in portfolio correlation risk.",
    riskReduction: 6.0,
  },
  {
    action: "sell",
    priority: "medium",
    titleFn: () => "Trim Overconcentrated Position",
    summaryFn: () => "Single asset exceeds 25% portfolio weight. Concentration creates idiosyncratic risk.",
    rationaleFn: () => "Concentration risk analysis flags a single position exceeding the 20% threshold. Historical evidence shows portfolios with >25% concentration in a single name experience 40% higher drawdowns during stress events. Reducing the position by 35% would bring it below the risk tolerance threshold.",
    expectedImpact: "Reduces concentration risk by 18 points and overall risk score by approximately 7-9 points.",
    riskReduction: 9.1,
  },
  {
    action: "buy",
    priority: "low",
    titleFn: () => "Increase Fixed Income Allocation",
    summaryFn: () => "Rising rates environment makes bonds attractive. Adding duration provides income and reduces equity beta.",
    rationaleFn: () => "10-year Treasury yield at 4.32% provides attractive risk-adjusted income relative to equity risk premium. Adding 10% allocation to investment-grade bonds would reduce overall portfolio beta by approximately 0.15 while generating stable income.",
    expectedImpact: "Portfolio beta reduction from 1.2 to 1.05 and projected income increase of 0.8% annualized.",
    riskReduction: 4.5,
  },
];

router.get("/decisions", async (req, res): Promise<void> => {
  const portfolioId = req.query.portfolioId ? parseInt(req.query.portfolioId as string, 10) : null;

  let rows = await db.select().from(decisionsTable).orderBy(decisionsTable.generatedAt);
  if (portfolioId !== null) {
    rows = rows.filter((d) => d.portfolioId === portfolioId);
  }

  res.json(rows.map((d) => ({
    ...d,
    riskReduction: d.riskReduction !== null ? parseFloat(d.riskReduction) : null,
    generatedAt: d.generatedAt.toISOString(),
    appliedAt: d.appliedAt ? d.appliedAt.toISOString() : null,
  })));
});

router.post("/decisions", async (req, res): Promise<void> => {
  const { portfolioId } = req.body;
  if (portfolioId == null) {
    res.status(400).json({ error: "portfolioId is required" });
    return;
  }

  const [portfolio] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.id, portfolioId));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  const template = aiDecisionTemplates[Math.floor(Math.random() * aiDecisionTemplates.length)];

  const [decision] = await db.insert(decisionsTable).values({
    portfolioId,
    title: template.titleFn(portfolio.name),
    summary: template.summaryFn(),
    rationale: template.rationaleFn(),
    action: template.action,
    priority: template.priority,
    expectedImpact: template.expectedImpact,
    riskReduction: String(template.riskReduction),
    status: "pending",
  }).returning();

  await db.insert(activityTable).values({
    type: "decision_generated",
    title: `AI Decision: ${decision.title}`,
    description: decision.summary,
    portfolioName: portfolio.name,
  });

  res.status(201).json({
    ...decision,
    riskReduction: decision.riskReduction !== null ? parseFloat(decision.riskReduction) : null,
    generatedAt: decision.generatedAt.toISOString(),
    appliedAt: decision.appliedAt ? decision.appliedAt.toISOString() : null,
  });
});

router.patch("/decisions/:id/apply", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [decision] = await db.update(decisionsTable)
    .set({ status: "applied", appliedAt: new Date() })
    .where(eq(decisionsTable.id, id))
    .returning();

  if (!decision) {
    res.status(404).json({ error: "Decision not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "decision_applied",
    title: `Decision Applied: ${decision.title}`,
    description: `AI recommendation was applied to the portfolio.`,
    portfolioName: null,
  });

  res.json({
    ...decision,
    riskReduction: decision.riskReduction !== null ? parseFloat(decision.riskReduction) : null,
    generatedAt: decision.generatedAt.toISOString(),
    appliedAt: decision.appliedAt ? decision.appliedAt.toISOString() : null,
  });
});

export default router;
