import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  // Auth routes (no layout wrapper — full-page sign-in)
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),

  // MCP endpoint (bearer-auth, no session, no layout)
  route("mcp", "routes/mcp.tsx"),

  // Authed app
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("library", "routes/library.tsx"),
    route("builder", "routes/builder-index.tsx"),
    route("builder/:id", "routes/builder.tsx"),
    route("companies", "routes/companies._index.tsx"),
    route("companies/new", "routes/companies.new.tsx"),
    route("companies/:id", "routes/companies.$id.tsx"),
    route("companies/:id/edit", "routes/companies.$id.edit.tsx"),
    route("applications", "routes/applications._index.tsx"),
    route("applications/:id", "routes/applications.$id.tsx"),
    route("api/applications", "routes/api.applications.tsx"),
    route("uploads/:file", "routes/uploads.$file.tsx"),
    route("techstack", "routes/techstack.tsx"),
    route("settings", "routes/settings.tsx"),
    route("api/export", "routes/api.export.tsx"),
    // API actions
    route("api/jobs", "routes/api.jobs.tsx"),
    route("api/projects", "routes/api.projects.tsx"),
    route("api/bullets", "routes/api.bullets.tsx"),
    route("api/summaries", "routes/api.summaries.tsx"),
    route("api/skills", "routes/api.skills.tsx"),
    route("api/resumes", "routes/api.resumes.tsx"),
    route("pdf-test", "routes/pdf-test.tsx"),
  ]),
] satisfies RouteConfig;
