import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
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

// ── Personal network (people the user knows; distinct from `contact`, which is
// the user's own resume header) ──

export const NETWORK_CONTACT_SOURCES = ["linkedin_csv", "manual"] as const;
export type NetworkContactSource = (typeof NETWORK_CONTACT_SOURCES)[number];

export const networkContacts = sqliteTable(
  "network_contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    headline: text("headline"),
    notes: text("notes"),
    source: text("source")
      .notNull()
      .default("manual")
      .$type<NetworkContactSource>(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("network_contacts_user_company_idx").on(t.userId, t.companyId)],
);

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

// ── OAuth 2.1 (MCP authorization server) ──
//
// The app is its own authorization server for the `/mcp` resource: Claude's
// connector UI accepts a URL and, at most, an OAuth client id/secret — there is
// no field for a static bearer token — so remote clients (claude.ai web, and
// therefore mobile) authenticate through the flow these tables back.
//
// Codes and tokens are stored as SHA-256 digests, not bcrypt hashes. They are
// 256-bit random strings rather than passwords, so a fast digest is sound and
// buys an indexed O(1) lookup on a path that runs on every MCP request.

export const OAUTH_SCOPES = ["mcp:read", "mcp:write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const oauthClients = sqliteTable("oauth_clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash"), // null => public client (PKCE only)
  clientName: text("client_name").notNull(),
  redirectUris: text("redirect_uris").notNull(), // JSON array of strings
  tokenEndpointAuthMethod: text("token_endpoint_auth_method")
    .notNull()
    .default("none"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthAuthCodes = sqliteTable("oauth_auth_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codeHash: text("code_hash").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(), // S256 only
  scope: text("scope").notNull(), // space-delimited
  resource: text("resource").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"), // single-use; set on first exchange
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthAccessTokens = sqliteTable("oauth_access_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  resource: text("resource").notNull(), // audience; checked on every MCP request
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthRefreshTokens = sqliteTable("oauth_refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  clientId: text("client_id").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  resource: text("resource").notNull(),
  expiresAt: text("expires_at").notNull(),
  // Rotation: on use, the old row is stamped with the hash that replaced it.
  // A later presentation of a rotated token is a replay -> invalid_grant.
  rotatedTo: text("rotated_to"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
