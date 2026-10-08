import { Router } from "express";
import { db } from "../db.js";

export const systemRouter = Router();

systemRouter.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(503).json({ ok: false, database: "unreachable" });
  }
});

// // TEMPORARY: delete before deploying
// systemRouter.get("/debug/count", async (req, res) => {
//   try {
//     const { rows } = await db.query("SELECT count(*)::int AS total FROM users");
//     res.json({ total: rows[0].total });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
