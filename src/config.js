import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

export const config = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "https://frontend-learnify.vercel.app",
  jwtSecret: process.env.JWT_SECRET || "development-only-change-me",
  ussdProvider: process.env.USSD_PROVIDER || "africastalking",
  emailFrom: process.env.EMAIL_FROM || "no-reply@learnify.app",
  smtp: process.env.SMTP_HOST ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD } : null
};
