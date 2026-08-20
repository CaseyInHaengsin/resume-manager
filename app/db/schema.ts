import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Auth ──

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // bcrypt hash
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mcpTokens = sqliteTable("mcp_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  label: text("label").notNull().default("default"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
});

// ── Library tables (source of truth, managed independently) ──

export const contact = sqliteTable("contact", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email").notNull(),
  linkedin: text("linkedin"),
  github: text("github"),
});

export const education = sqliteTable("education", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  school: text("school").notNull(),
  degrees: text("degrees", { mode: "json" }).notNull().$type<string[]>(),
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  company: text("company").notNull(),
  dates: text("dates").notNull(),
  location: text("location").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dates: text("dates").notNull(),
  tech: text("tech").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const bullets = sqliteTable("bullets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentType: text("parent_type").notNull(), // "job" | "project"
  parentId: integer("parent_id").notNull(),
  text: text("text").notNull(),
  tags: text("tags", { mode: "json" }).notNull().$type<string[]>(),
  priority: integer("priority").notNull().default(2),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const summaries = sqliteTable("summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "API focus", "Elixir focus"
  text: text("text").notNull(),
});

export const skills = sqliteTable("skills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // e.g. "Languages", "Frameworks"
  name: text("name").notNull(), // e.g. "JS-first", "Elixir-first"
  items: text("items", { mode: "json" }).notNull().$type<string[]>(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Companies (jobbernaut port: research targets, not work history) ──

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tagline: text("tagline"),
  logoUrl: text("logo_url"),
  techStack: text("tech_stack", { mode: "json" }).$type<string[]>(),
  values: text("values"),
  culture: text("culture"),
  industry: text("industry"),
  location: text("location"),
  size: text("size"),
  recentNews: text("recent_news", { mode: "json" }).$type<string[]>(),
  notableProjects: text("notable_projects"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Resume tables (each resume is a selection of library content) ──

export const resumes = sqliteTable("resumes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  summaryId: integer("summary_id").references(() => summaries.id),
  companyId: integer("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  template: text("template").notNull().default("modern"),
  useCustomContact: integer("use_custom_contact", { mode: "boolean" })
    .notNull()
    .default(false),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  contactLinkedin: text("contact_linkedin"),
  contactGithub: text("contact_github"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const resumeJobs = sqliteTable("resume_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resumeId: integer("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const resumeProjects = sqliteTable("resume_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resumeId: integer("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const resumeBullets = sqliteTable("resume_bullets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resumeId: integer("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  bulletId: integer("bullet_id")
    .notNull()
    .references(() => bullets.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Applications (job application pipeline tracker) ──

/**
 * Pipeline statuses. Order matters — drives Kanban column order.
 * Terminal: "accepted", "rejected".
 */
export const APPLICATION_STATUSES = [
  "wishlist",
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  resumeId: integer("resume_id").references(() => resumes.id, {
    onDelete: "set null",
  }),
  jobTitle: text("job_title").notNull(),
  jobUrl: text("job_url"),
  source: text("source"), // LinkedIn, referral, board, etc.
  location: text("location"),
  remote: integer("remote", { mode: "boolean" }).notNull().default(false),
  salaryRange: text("salary_range"),
  status: text("status").notNull().default("applied").$type<ApplicationStatus>(),
  appliedAt: text("applied_at"), // ISO date; null if wishlist
  nextStepAt: text("next_step_at"),
  lastContactAt: text("last_contact_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const resumeSkills = sqliteTable("resume_skills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resumeId: integer("resume_id")
    .notNull()
    .references(() => resumes.id, { onDelete: "cascade" }),
  skillId: integer("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});
