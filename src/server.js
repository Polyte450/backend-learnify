import express from "express";
import cors from "cors";
import { z } from "zod";
import nodemailer from "nodemailer";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { comparePassword, createRawToken, hashPassword, hashToken, publicApplication, publicOpportunity, publicProject, publicUser, requireAuth, requireRole, signToken } from "./auth.js";

const app = express();
const allowedOrigins = new Set([config.frontendUrl, "https://frontend-learnify.vercel.app", "http://localhost:5173"]);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use(express.json());

const credentials = z.object({ email: z.string().email(), password: z.string().min(6) });
const registration = credentials.extend({
  name: z.string().trim().min(2),
  role: z.enum(["student", "opportunity_giver", "provider"]).default("student"),
  interests: z.union([z.string(), z.array(z.string())]).optional()
});
const frontendUrl = config.frontendUrl;
const mailer = config.smtp ? nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465, auth: { user: config.smtp.user, pass: config.smtp.password } }) : null;
async function ensureAdminAccount() {
  if (!config.adminPassword) {
    console.warn("ADMIN_PASSWORD is not configured; skipping admin account bootstrap");
    return;
  }
  const email = config.adminEmail.toLowerCase();
  const passwordHash = await hashPassword(config.adminPassword);
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash, emailVerifiedAt: new Date() },
    create: { name: "System Administrator", email, passwordHash, role: "ADMIN", emailVerifiedAt: new Date(), interests: [] }
  });
  console.log(`Admin account ready for ${email}`);
}
async function sendLink({ user, token, path, subject }) {
  const link = `${frontendUrl}${path}?token=${token}`;
  if (!mailer) { console.log(`[email development link] ${link}`); return; }
  await mailer.sendMail({ from: config.emailFrom, to: user.email, subject, text: `Open this link to continue: ${link}`, html: `<p>Open this link to continue:</p><p><a href="${link}">${link}</a></p>` });
}
async function issueAuthToken(userId, type, hours) {
  const raw = createRawToken();
  await prisma.authToken.deleteMany({ where: { userId, type } });
  await prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + hours * 3600000) } });
  return raw;
}

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "learnify-api", database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error);
    res.status(503).json({ ok: false, service: "learnify-api", database: "unavailable" });
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const data = registration.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "An account with that email already exists" });
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        passwordHash: await hashPassword(data.password),
        role: data.role === "opportunity_giver" || data.role === "provider" ? "OPPORTUNITY_GIVER" : "STUDENT",
        interests: Array.isArray(data.interests) ? data.interests : data.interests ? [data.interests] : []
      }
    });
    res.status(201).json({ user: publicUser(user), token: signToken(user), requiresVerification: false });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const data = credentials.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user?.passwordHash || !(await comparePassword(data.password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password" });
    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) { next(error); }
});

app.post("/api/auth/verify-email", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
    const record = await prisma.authToken.findFirst({ where: { tokenHash: hashToken(token), type: "EMAIL_VERIFICATION", usedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!record) return res.status(400).json({ message: "This verification link is invalid or expired" });
    const user = await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    await prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) { next(error); }
});

app.post("/api/auth/resend-verification", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user && !user.emailVerifiedAt) { const token = await issueAuthToken(user.id, "EMAIL_VERIFICATION", 24); await sendLink({ user, token, path: "/verify-email", subject: "Verify your Learnify email" }); }
    res.json({ message: "If that account exists, a verification link has been sent" });
  } catch (error) { next(error); }
});

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) { const token = await issueAuthToken(user.id, "PASSWORD_RESET", 1); await sendLink({ user, token, path: "/reset-password", subject: "Reset your Learnify password" }); }
    res.json({ message: "If that account exists, a password reset link has been sent" });
  } catch (error) { next(error); }
});

app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const data = z.object({ token: z.string().min(20), password: z.string().min(6) }).parse(req.body);
    const record = await prisma.authToken.findFirst({ where: { tokenHash: hashToken(data.token), type: "PASSWORD_RESET", usedAt: null, expiresAt: { gt: new Date() } } });
    if (!record) return res.status(400).json({ message: "This reset link is invalid or expired" });
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(data.password) } });
    await prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    res.json({ message: "Password reset successfully" });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.patch("/api/users/me/preferences", requireAuth, async (req, res, next) => {
  try {
    const data = z.object({ language: z.string().min(2).max(10).optional(), theme: z.enum(["light", "dark"]).optional(), prefersReducedMotion: z.boolean().optional(), screenReaderMode: z.boolean().optional(), phone: z.string().max(30).optional(), interests: z.array(z.string()).optional() }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.auth.sub }, data });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.patch("/api/users/me", requireAuth, async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().trim().min(2).optional(), phone: z.string().max(30).optional(), language: z.string().min(2).max(10).optional(), interests: z.array(z.string()).optional() }).parse(req.body);
    const user = await prisma.user.update({ where: { id: req.auth.sub }, data });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get("/api/opportunities", requireAuth, async (_req, res, next) => { try { res.json({ opportunities: (await prisma.opportunity.findMany({ orderBy: { createdAt: "desc" } })).map(publicOpportunity) }); } catch (error) { next(error); } });
app.post("/api/opportunities", requireAuth, requireRole("ADMIN", "OPPORTUNITY_GIVER"), async (req, res, next) => {
  try { const data = z.object({ title: z.string().min(3), type: z.string().min(2), organization: z.string().min(2), description: z.string().min(10), deadline: z.string().optional(), location: z.string().optional(), requirements: z.array(z.string()).default([]), status: z.enum(["OPEN", "DRAFT"]).default("OPEN") }).parse(req.body); const opportunity = await prisma.opportunity.create({ data: { ...data, deadline: data.deadline ? new Date(data.deadline) : null, createdById: req.auth.sub } }); res.status(201).json({ opportunity: publicOpportunity(opportunity) }); } catch (error) { next(error); }
});
app.post("/api/opportunities/:id/applications", requireAuth, async (req, res, next) => {
  try { const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } }); if (!opportunity || opportunity.status !== "OPEN") return res.status(404).json({ message: "Opportunity is not available" }); const application = await prisma.application.create({ data: { userId: req.auth.sub, opportunityId: opportunity.id, note: req.body.note || null }, include: { opportunity: true } }); res.status(201).json({ application: publicApplication(application) }); } catch (error) { if (error.code === "P2002") return res.status(409).json({ message: "You already applied to this opportunity" }); next(error); }
});
app.get("/api/applications", requireAuth, async (req, res, next) => { try { const where = req.auth.role === "ADMIN" ? {} : { userId: req.auth.sub }; const applications = await prisma.application.findMany({ where, include: { opportunity: true }, orderBy: { createdAt: "desc" } }); res.json({ applications: applications.map(publicApplication) }); } catch (error) { next(error); } });
app.patch("/api/applications/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => { try { const data = z.object({ status: z.enum(["PENDING", "REVIEW", "APPROVED", "REJECTED"]) }).parse(req.body); const application = await prisma.application.update({ where: { id: req.params.id }, data, include: { opportunity: true } }); res.json({ application: publicApplication(application) }); } catch (error) { next(error); } });
app.get("/api/projects", requireAuth, async (req, res, next) => { try { const projects = await prisma.project.findMany({ where: req.auth.role === "ADMIN" ? {} : { userId: req.auth.sub }, orderBy: { createdAt: "desc" } }); res.json({ projects: projects.map(publicProject) }); } catch (error) { next(error); } });
app.post("/api/projects", requireAuth, async (req, res, next) => { try { const data = z.object({ title: z.string().min(3), description: z.string().min(10), category: z.string().min(2), link: z.string().url().optional(), fileUrl: z.string().url().optional() }).parse(req.body); const project = await prisma.project.create({ data: { ...data, userId: req.auth.sub } }); res.status(201).json({ project: publicProject(project) }); } catch (error) { next(error); } });
app.get("/api/admin/users", requireAuth, requireRole("ADMIN"), async (_req, res, next) => { try { res.json({ users: (await prisma.user.findMany({ orderBy: { createdAt: "desc" } })).map(publicUser) }); } catch (error) { next(error); } });
app.delete("/api/admin/users/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => { try { if (req.params.id === req.auth.sub) return res.status(400).json({ message: "You cannot remove your own account" }); await prisma.user.delete({ where: { id: req.params.id } }); res.status(204).end(); } catch (error) { next(error); } });

app.get("/api/integrations/:provider/start", (req, res) => {
  const supported = ["google", "github", "linkedin", "instagram", "duolingo"];
  if (!supported.includes(req.params.provider)) return res.status(404).json({ message: "Unsupported provider" });
  return res.status(503).json({ message: `${req.params.provider} OAuth is not configured. Add its credentials to .env first.` });
});

app.post("/api/integrations/ussd", async (req, res, next) => {
  try {
    const phone = z.string().min(7).parse(req.body.phoneNumber || req.body.phone);
    const text = String(req.body.text || "").trim();
    const response = text ? "CON Reply with 1 to open learning, 2 for opportunities, or 0 to go back" : "CON Welcome to Learnify\n1. Learning\n2. Opportunities\n3. Language\n0. Exit";
    res.type("text/plain").send(response);
    if (phone.length < 7) return;
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request", issues: error.issues });
  console.error(error);
  res.status(500).json({ message: "Internal server error" });
});

ensureAdminAccount()
  .then(() => app.listen(config.port, () => console.log(`Learnify API running on http://localhost:${config.port}`)))
  .catch((error) => { console.error("Could not prepare the admin account", error); process.exit(1); });
