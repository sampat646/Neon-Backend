import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { systemRouter } from "./routes/system.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

export function createApp() {
  const app = express();
  // CORS must come before routes so preflight OPTIONS gets ACAO headers.
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173","https://frontend-orcin-nine-i11xfklluu.vercel.app"],
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
