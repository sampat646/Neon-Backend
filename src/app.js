import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { systemRouter } from "./routes/system.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

export function createApp() {
  const app = express();
  // CORS must come before routes so preflight OPTIONS gets ACAO headers.
  // Regex origins cover Cloudflare preview hashes (e.g. <hash>.frontend-8iw.pages.dev)
  // and Vercel preview URLs, which change on every deploy and can't be listed exactly.
  const allowedOriginPatterns = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^https:\/\/([a-z0-9-]+\.)*frontend-8iw\.pages\.dev$/,
    /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/,
  ];
  app.use(
    cors({
      origin: allowedOriginPatterns,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
    })
  );
  app.use(express.json());

  app.use("/", systemRouter);
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);

  // Must be last: catches AppError + DB errors + 500s
  app.use(errorHandler);

  return app;
}
