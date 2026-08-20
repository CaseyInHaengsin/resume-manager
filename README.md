# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

## MCP

This app exposes your resume/job-search data to Claude (Desktop or Code) via the [Model Context Protocol](https://modelcontextprotocol.io), letting you ask Claude to read your profile, coach you through interview pipelines, or suggest what to learn based on companies you're tracking — all against live app state.

### Endpoints

- **Dev**: `http://localhost:5173/mcp`
- **Prod**: `https://<your-host>/mcp`

Both accept `POST` (JSON-RPC) and `GET` (SSE). Authenticate with a bearer token generated from `/settings`.

### Generate a token

1. Log in to the app
2. Visit **Settings** in the top nav
3. Click **Generate MCP Token**
4. Copy the token — it's shown once and never again
5. Store it in your MCP client (below). Regenerating from `/settings` revokes the old token.

### Connect Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent on your platform:

```json
{
  "mcpServers": {
    "resume-builder": {
      "transport": {
        "type": "streamable-http",
        "url": "http://localhost:5173/mcp",
        "headers": {
          "Authorization": "Bearer rbmcp_YOUR_TOKEN_HERE"
        }
      }
    }
  }
}
```

Restart Claude Desktop. The `resume-builder` tools appear in the tools drawer.

### Connect Claude Code

```bash
claude mcp add resume-builder \
  --transport http \
  --url http://localhost:5173/mcp \
  --header "Authorization: Bearer rbmcp_YOUR_TOKEN_HERE"
```

### Tool inventory

| Tool | Purpose |
|---|---|
| `get_profile` | Full dump: user, contact, education, summaries, resumes, jobs, projects, bullets, skills, companies, applications, tech-stack |
| `get_contact`, `get_education` | Singleton entities |
| `list_summaries` | Resume summary paragraphs |
| `list_resumes`, `get_resume` | Resumes (get: composed with selected jobs/projects/bullets/skills/summary/company) |
| `list_applications`, `get_application` | Application pipeline (list: optional `status` filter) |
| `list_jobs`, `get_job` | Work history (get: with bullets) |
| `list_projects`, `get_project` | Side projects (get: with bullets) |
| `list_companies`, `get_company` | Research targets |
| `get_skills` | Skill groups |
| `get_tech_stack` | Unified tech-keyword graph (nodes + co-occurrence links) |
| `list_bullets_for` | Bullets for a specific job or project |
| `update_application_status` | Move an application through the pipeline (wishlist/applied/interviewing/offer/accepted/rejected) |
| `append_application_note` | Append a timestamped note to an application |
| `add_skill` | Create a new skill group `(category, name, items)` |
| `add_bullet` | Add a bullet to a job or project |

All tools are scoped to the token-bearer's user. Writes are intentionally narrow — create/delete of resumes/jobs/projects is done via the web UI.

### Troubleshooting

- **401 on every request**: token is missing, malformed, or was revoked. Regenerate from `/settings`.
- **Claude Desktop doesn't list the server**: restart after editing `claude_desktop_config.json`; check the file is valid JSON.
- **Tools work but writes don't reflect in the UI**: make sure you're logged in as the same user the token was generated for.

---

Built with ❤️ using React Router.
