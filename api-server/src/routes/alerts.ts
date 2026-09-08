import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, alertsTable, activityTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/alerts", async (req, res): Promise<void> => {
  const portfolioId = req.query.portfolioId ? parseInt(req.query.portfolioId as string, 10) : null;
  const status = req.query.status as string | undefined;

  let rows = await db.select().from(alertsTable).orderBy(alertsTable.triggeredAt);

  if (portfolioId !== null) {
    rows = rows.filter((a) => a.portfolioId === portfolioId);
  }
  if (status) {
    rows = rows.filter((a) => a.status === status);
  }

  res.json(rows.map((a) => ({
    ...a,
    triggeredAt: a.triggeredAt.toISOString(),
    acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
  })));
});

router.post("/alerts", async (req, res): Promise<void> => {
  const { portfolioId, alertType, severity, title, message } = req.body;
  if (!alertType || !severity || !title || !message) {
    res.status(400).json({ error: "alertType, severity, title, and message are required" });
    return;
  }

  const [alert] = await db.insert(alertsTable).values({
    portfolioId: portfolioId ?? null,
    alertType,
    severity,
    title,
    message,
    status: "active",
  }).returning();

  await db.insert(activityTable).values({
    type: "alert_triggered",
    title: `Alert: ${title}`,
    description: message,
    portfolioName: null,
  });

  res.status(201).json({
    ...alert,
    triggeredAt: alert.triggeredAt.toISOString(),
    acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
  });
});

router.patch("/alerts/:id/acknowledge", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [alert] = await db.update(alertsTable)
    .set({ status: "acknowledged", acknowledgedAt: new Date() })
    .where(eq(alertsTable.id, id))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json({
    ...alert,
    triggeredAt: alert.triggeredAt.toISOString(),
    acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
  });
});

export default router;
