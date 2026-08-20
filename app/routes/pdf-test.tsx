import { useState, useEffect } from "react";
import type { ResumeData } from "~/components/pdf/ResumeDocument";

const sampleData: ResumeData = {
  contact: {
    name: "Casey Rowley",
    phone: "(385) 268-0806",
    email: "caseyinhaengsin@gmail.com",
    linkedin: "linkedin.com/in/casey-rowley",
    github: "github.com/CaseyInHaengsin",
  },
  summary:
    "Platform engineer with 5+ years building API and integration layers for a multi-tenant SaaS serving 100+ higher education institutions. Experienced in GraphQL, authorization systems, and OAuth-based SSO integrations, including zero-downtime migration from a Node.js monolith. Background in customer-facing implementation roles, bridging engineering, product, and enterprise clients.",
  jobs: [
    {
      title: "Software Engineer",
      company: "Kuali, Inc.",
      dates: "Jun 2021 – Present",
      location: "Lehi, UT",
      bullets: [
        "Shipped GraphQL resolvers, auth middleware, and Dataloader-backed cursor pagination in Absinthe, improving API performance and scalability as tenant count grew",
        "Built External Routing: cross-institutional workflows via secure temporary tokens, enabling inter-tenant collaboration without account provisioning",
        "Core contributor to Kuali Build, a no-code platform used by 100+ institutions to create custom workflows without engineering support",
        "Delivered document versioning across 4 services, enabling version-scoped permissions and auditable tracking for regulated workflows",
        "Led design and implementation of conditional permissions scoped to org hierarchies, enabling institutions to model complex approval chains without custom code",
      ],
    },
    {
      title: "Implementation Engineer",
      company: "Kuali, Inc.",
      dates: "Nov 2020 – Jun 2021",
      location: "Lehi, UT",
      bullets: [
        "Authored documentation and training materials that reduced recurring support load and improved customer self-service",
        "Acted as technical liaison between customers and engineering, translating ambiguous institutional requirements into shipped product features",
      ],
    },
    {
      title: "Implementation Consultant to Professional Services Engineer",
      company: "Instructure (Canvas LMS)",
      dates: "2018 – Nov 2020",
      location: "Salt Lake City, UT",
      bullets: [
        "Delivered SIS integrations, SSO/SAML configurations, and custom API integrations supporting enterprise customer launches",
        "Built data migrations using Canvas REST APIs, moving institutions off legacy LMS platforms without loss of historical coursework",
        "Diagnosed SIS integration failures and authentication misconfigurations under tight deadlines, ensuring successful go-lives",
      ],
    },
  ],
  skills: [
    { category: "Languages", items: ["JavaScript (Node.js)", "Elixir", "Ruby", "SQL"] },
    { category: "Frameworks", items: ["React", "Phoenix", "Rails", "GraphQL (Absinthe)", "LiveView"] },
    { category: "Data/Auth", items: ["PostgreSQL", "MongoDB", "OAuth 2.0", "JWT", "SAML/SSO", "RBAC"] },
    { category: "Infrastructure", items: ["Docker", "AWS", "Fly.io", "CI/CD"] },
  ],
  projects: [
    {
      name: "Nodi: Multi-Tenant SaaS Platform",
      dates: "2025",
      tech: "Elixir/Phoenix, PostgreSQL, React, Chrome Extension",
      bullets: [
        "Sole engineer for a multi-tenant SaaS spanning a Chrome Extension, Phoenix API, and PostgreSQL with schema-per-tenant isolation for strict data separation",
        "Integrated Salesforce OAuth for CRM data enrichment across tenant boundaries while preserving tenant isolation guarantees",
      ],
    },
    {
      name: "BrainSpark: Multi-Tenant LMS",
      dates: "2024–2025",
      tech: "Rails 7, PostgreSQL, Hotwire, GoodJob",
      bullets: [
        "Built a webhook-driven auto-enrollment engine with composable rules and idempotent processing, ensuring safe retries under partial failures",
        "Hardened webhook ingestion with JWT auth, RSA signature verification, and SHA256 body validation to prevent replay attacks",
      ],
    },
  ],
  education: {
    school: "Utah Valley University",
    degrees: ["B.A. Political Science"],
  },
};

function PdfPreview() {
  const [Viewer, setViewer] = useState<React.ComponentType<any> | null>(null);
  const [Doc, setDoc] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    Promise.all([
      import("@react-pdf/renderer"),
      import("~/components/pdf/ResumeDocument"),
    ]).then(([pdf, resume]) => {
      setViewer(() => pdf.PDFViewer);
      setDoc(() => resume.ResumeDocument);
    });
  }, []);

  if (!Viewer || !Doc) {
    return (
      <div className="text-gray-500 py-12 text-center">
        Loading PDF preview...
      </div>
    );
  }

  return (
    <Viewer width="100%" height={800} showToolbar>
      <Doc data={sampleData} />
    </Viewer>
  );
}

export default function PdfTest() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        PDF Template Test — open{" "}
        <a href="/pdf-test" className="text-blue-600 underline">
          /pdf-test
        </a>{" "}
        in browser
      </h2>
      <PdfPreview />
    </div>
  );
}
