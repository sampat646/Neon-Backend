import { Router } from "express";
import { listUsers, setUserRole } from "../controllers/admin.controller.js";
import { asyncHandler } from "../middlewares/async-handler.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.js";

export const adminRouter = Router();

// Both guards run before controller: valid JWT AND role=admin
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", asyncHandler(listUsers));
adminRouter.patch("/users/:id/role", asyncHandler(setUserRole));
