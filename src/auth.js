import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "./config.js";

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role === "ADMIN" ? "admin" : user.role === "OPPORTUNITY_GIVER" ? "opportunity_giver" : "student",
  pathway: user.pathway,
  focus: user.focus,
  interests: user.interests,
  language: user.language,
  theme: user.theme,
  prefersReducedMotion: user.prefersReducedMotion,
  screenReaderMode: user.screenReaderMode,
  phone: user.phone,
  emailVerifiedAt: user.emailVerifiedAt
});
export const publicOpportunity = (item) => ({ ...item, deadline: item.deadline?.toISOString() || null });
export const publicApplication = (item) => ({ id: item.id, status: item.status.toLowerCase(), note: item.note, cvUrl: item.cvUrl, certificateUrls: item.certificateUrls, createdAt: item.createdAt, applicant: item.user ? publicUser(item.user) : undefined, opportunity: item.opportunity ? publicOpportunity(item.opportunity) : undefined });
export const publicProject = (item) => item;

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);
export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "7d" });
export const createRawToken = () => crypto.randomBytes(32).toString("hex");
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth?.role)) return res.status(403).json({ message: "Insufficient permissions" });
  next();
};
