import { Router } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { sendOtpEmail, verifyEmailTransport } from "../utils/mailer.js";
import adminRoutes from "./adminRoutes.js";
import authRoutes from "./authRoutes.js";
import chatbotRoutes from "./chatbotRoutes.js";
import driversRoutes from "./driversRoutes.js";
import legacyRoutes from "./legacyRoutes.js";
import notificationsRoutes from "./notificationsRoutes.js";
import issuesRoutes from "./issuesRoutes.js";
import publicRoutes from "./publicRoutes.js";
import ridesRoutes from "./ridesRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import stopsRoutes from "./stopsRoutes.js";
import testDbRoutes from "./testDbRoutes.js";
import usersRoutes from "./usersRoutes.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, message: "API is running" });
});

router.get("/health", async (_req, res, next) => {
  try {
    res.json({
      ok: true,
      service: "campus-rider-backend",
      uptimeSeconds: Math.round(process.uptime()),
      mongoReadyState: mongoose.connection.readyState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/health/email", async (_req, res, next) => {
  try {
    const result = await verifyEmailTransport();
    const payload = {
      ok: result.ok,
      service: "email",
      configured: result.configured,
      code: result.code || null,
      message: result.message,
      hasEmailUser: Boolean(env.emailUser),
      hasEmailPass: Boolean(env.emailPass),
      timestamp: new Date().toISOString(),
    };

    const statusCode = result.ok ? 200 : result.configured ? 502 : 503;
    res.status(statusCode).json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/test-email", async (req, res, next) => {
  try {
    const to = String(req.query.to || env.emailUser || "").trim();
    const otp = String(req.query.otp || "123456").trim();
    const result = await sendOtpEmail(to, otp, {
      name: "CampusRide Admin",
      subject: "CampusRide Test OTP Email",
      intro: "This is a test OTP from CampusRide:",
      expiresMinutes: 10,
    });

    if (!result.sent) {
      const statusCode = result.code === "EMAIL_CREDENTIALS_MISSING" ? 503 : 502;
      return res.status(statusCode).json({
        ok: false,
        message: "Test email failed",
        reason: result.reason,
        code: result.code || "EMAIL_SEND_FAILED",
      });
    }

    return res.json({
      ok: true,
      message: "Test email sent",
      to,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.use("/auth", authRoutes);
router.use("/rides", ridesRoutes);
router.use("/public", publicRoutes);
router.use("/users", usersRoutes);
router.use("/drivers", driversRoutes);
router.use("/admin", adminRoutes);
router.use("/settings", settingsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/issues", issuesRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/legacy", legacyRoutes);
router.use("/test-db", testDbRoutes);
router.use("/stops", stopsRoutes);

export default router;