import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // The app runs behind a reverse proxy that terminates HTTPS, so the URL the
  // server sees (http://<container>:3000) never matches the browser's `origin`
  // header. React Router compares those two on every action and rejects the
  // request with a 400 when they differ, which breaks all mutations. Listing
  // the public domain here tells it the mismatch is expected.
  allowedActionOrigins: ["resume.caseyinhaengsin.com"],
} satisfies Config;
