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
pnpm install
```

### Development

Start the development server with HMR:

```bash
pnpm dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
pnpm build
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

Make sure to deploy the output of `pnpm build`

```
├── package.json
├── pnpm-lock.yaml
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

Both accept `POST` (JSON-RPC) and `GET` (SSE). There are two ways to authenticate:

- **OAuth** — the only option for claude.ai and the mobile apps, and the easiest for Claude Code. Nothing to copy or paste; you approve a consent screen instead. See [Connect Claude web and mobile](#connect-claude-web-and-mobile).
- **A bearer token** from `/settings` — for hand-written Claude Desktop / Claude Code config.

### Connect Claude web and mobile

Connectors are added on claude.ai and then used everywhere, **including iOS and
Android** — the mobile apps can use a connector but can't add one, so this step
happens on the web once.

1. Deploy with `PUBLIC_URL` set (see [DEPLOYMENT.md](DEPLOYMENT.md)). The server must be reachable over HTTPS.
2. On claude.ai: **Settings → Connectors → Add custom connector**.
3. URL: `https://<your-host>/mcp`. Leave the OAuth client ID and secret blank — the server supports Dynamic Client Registration, so Claude registers itself.
4. Claude opens the app's sign-in page, then a consent screen. Approve it.
5. Open Claude on your phone. The `resume-builder` tools are there.

For **Claude Code**, the same flow works without a token:

```bash
claude mcp add resume-builder --transport http --url https://<your-host>/mcp
```

It opens a browser for consent and stores the tokens itself.

<details>
<summary>How the OAuth side is put together</summary>

The app is its own authorization server; there is no external identity provider.

| Endpoint | Purpose |
|---|---|
| `/.well-known/oauth-protected-resource` | RFC 9728 metadata; also served at `/…/oauth-protected-resource/mcp` |
| `/.well-known/oauth-authorization-server` | RFC 8414 metadata |
| `/oauth/register` | RFC 7591 dynamic client registration (JSON) |
| `/oauth/authorize` | Consent screen, gated on your normal app login |
| `/oauth/token` | Code exchange and refresh (form-urlencoded) |

Access tokens last an hour, refresh tokens 30 days and rotate on every use.
Tokens are bound to `<PUBLIC_URL>/mcp` as their audience. Scopes are `mcp:read`
and `mcp:write`; a token without `mcp:write` is not offered the write tools at
all. Registration only accepts callbacks on `claude.ai` / `claude.com` or an
RFC 8252 loopback address.

</details>

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
- **"Couldn't reach the MCP server" when adding a connector**: almost always `PUBLIC_URL`. Check that `curl https://<your-host>/.well-known/oauth-protected-resource/mcp` returns a document whose `resource` is exactly the URL you typed into Claude, and that `issuer` in `/.well-known/oauth-authorization-server` matches the host you fetched it from.
- **"Unknown client_id" on the consent screen**: the registration was pruned (unused registrations are dropped after 30 days). Remove and re-add the connector.
- **Only read tools appear**: the token was granted `mcp:read` but not `mcp:write`. Disconnect and reconnect to re-consent.

---

Built with ❤️ using React Router.
