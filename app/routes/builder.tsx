import { useLoaderData, useFetcher } from "react-router";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { db } from "~/db";
import {
  resumes,
  jobs,
  projects,
  bullets,
  summaries,
  skills,
  contact,
  education,
  resumeJobs,
  resumeProjects,
  resumeBullets,
  resumeSkills,
  companies,
} from "~/db/schema";
import { and, eq, asc } from "drizzle-orm";
import type { Route } from "./+types/builder";
import type { ResumeData, TemplateId } from "~/components/pdf/ResumeDocument";
import { TEMPLATES } from "~/components/pdf/ResumeDocument";
import { requireUserId } from "~/lib/auth.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const resumeId = Number(params.id);
  const resume = db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .get();
  if (!resume) throw new Response("Not found", { status: 404 });

  const allJobs = db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(asc(jobs.sortOrder))
    .all();
  const allProjects = db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.sortOrder))
    .all();
  const allBullets = db
    .select()
    .from(bullets)
    .where(eq(bullets.userId, userId))
    .orderBy(asc(bullets.sortOrder))
    .all();
  const allSummaries = db
    .select()
    .from(summaries)
    .where(eq(summaries.userId, userId))
    .all();
  const allSkills = db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId))
    .orderBy(asc(skills.sortOrder))
    .all();
  const contactRow = db
    .select()
    .from(contact)
    .where(eq(contact.userId, userId))
    .get();
  const educationRow = db
    .select()
    .from(education)
    .where(eq(education.userId, userId))
    .get();
  const allCompanies = db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.userId, userId))
    .all();

  // Current selections
  const selectedJobs = db.select().from(resumeJobs).where(eq(resumeJobs.resumeId, resumeId)).all();
  const selectedProjects = db.select().from(resumeProjects).where(eq(resumeProjects.resumeId, resumeId)).all();
  const selectedBullets = db.select().from(resumeBullets).where(eq(resumeBullets.resumeId, resumeId)).all();
  const selectedSkills = db.select().from(resumeSkills).where(eq(resumeSkills.resumeId, resumeId)).all();

  return {
    resume,
    allJobs,
    allProjects,
    allBullets,
    allSummaries,
    allSkills,
    allCompanies,
    contact: contactRow,
    education: educationRow,
    selectedJobIds: selectedJobs.map((r) => r.jobId),
    selectedProjectIds: selectedProjects.map((r) => r.projectId),
    selectedBulletIds: selectedBullets.map((r) => r.bulletId),
    selectedSkillIds: selectedSkills.map((r) => r.skillId),
  };
}

// ── Selector Components (inline for now, can extract later) ──

function ContactOverride({
  resumeId,
  useCustomContact,
  defaults,
  values,
}: {
  resumeId: number;
  useCustomContact: boolean;
  defaults: {
    name: string | null;
    phone: string | null;
    email: string | null;
    linkedin: string | null;
    github: string | null;
  };
  values: {
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    contactLinkedin: string | null;
    contactGithub: string | null;
  };
}) {
  const toggleFetcher = useFetcher();
  const fieldFetcher = useFetcher();
  // Optimistic toggle: reflect the submitting value while in flight
  const optimisticToggle = toggleFetcher.formData
    ? toggleFetcher.formData.get("useCustomContact") === "1"
    : useCustomContact;

  const fields: {
    key: keyof typeof values;
    label: string;
    defaultValue: string | null;
  }[] = [
    { key: "contactName", label: "Name", defaultValue: defaults.name },
    { key: "contactPhone", label: "Phone", defaultValue: defaults.phone },
    { key: "contactEmail", label: "Email", defaultValue: defaults.email },
    { key: "contactLinkedin", label: "LinkedIn", defaultValue: defaults.linkedin },
    { key: "contactGithub", label: "GitHub", defaultValue: defaults.github },
  ];

  return (
    <div className="mb-4 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <toggleFetcher.Form method="post" action="/api/resumes">
        <input type="hidden" name="_action" value="toggle_custom_contact" />
        <input type="hidden" name="resumeId" value={resumeId} />
        <input
          type="hidden"
          name="useCustomContact"
          value={optimisticToggle ? "0" : "1"}
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="submit"
            className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
              optimisticToggle
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {optimisticToggle && "✓"}
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Anonymize contact info
          </span>
        </label>
      </toggleFetcher.Form>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Override personal details for this resume. Leave a field blank to hide it.
      </p>
      {optimisticToggle && (
        <div className="mt-3 space-y-2">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                {f.label}
              </label>
              <fieldFetcher.Form method="post" action="/api/resumes">
                <input type="hidden" name="_action" value="set_contact_field" />
                <input type="hidden" name="resumeId" value={resumeId} />
                <input type="hidden" name="field" value={f.key} />
                <input
                  name="value"
                  defaultValue={values[f.key] ?? ""}
                  placeholder={f.defaultValue ?? "(empty)"}
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                  className="w-full rounded border px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </fieldFetcher.Form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyPicker({
  resumeId,
  companies,
  currentId,
}: {
  resumeId: number;
  companies: { id: number; name: string }[];
  currentId: number | null;
}) {
  const fetcher = useFetcher();
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Target company
      </label>
      <fetcher.Form method="post" action="/api/resumes">
        <input type="hidden" name="_action" value="set_company" />
        <input type="hidden" name="resumeId" value={resumeId} />
        <select
          name="companyId"
          defaultValue={currentId ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full rounded border px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="">-- None --</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </fetcher.Form>
      {companies.length === 0 && (
        <p className="mt-1 text-xs text-gray-500">
          No companies yet — add one under Companies to target a resume.
        </p>
      )}
    </div>
  );
}

function SummaryPicker({
  resumeId,
  summaries,
  currentId,
}: {
  resumeId: number;
  summaries: { id: number; name: string; text: string }[];
  currentId: number | null;
}) {
  const fetcher = useFetcher();
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Summary
      </label>
      <fetcher.Form method="post" action="/api/resumes">
        <input type="hidden" name="_action" value="set_summary" />
        <input type="hidden" name="resumeId" value={resumeId} />
        <select
          name="summaryId"
          defaultValue={currentId ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full rounded border px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="">-- None --</option>
          {summaries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </fetcher.Form>
      {currentId && (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
          {summaries.find((s) => s.id === currentId)?.text}
        </p>
      )}
    </div>
  );
}

function ToggleItem({
  resumeId,
  action,
  fieldName,
  itemId,
  selected,
  label,
  sublabel,
  children,
}: {
  resumeId: number;
  action: string;
  fieldName: string;
  itemId: number;
  selected: boolean;
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
}) {
  const fetcher = useFetcher();
  const isSelected = fetcher.formData
    ? !selected // optimistic toggle
    : selected;

  return (
    <div className={`rounded border px-3 py-2 ${isSelected ? "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700" : "border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700"}`}>
      <div className="flex items-center gap-2">
        <fetcher.Form method="post" action="/api/resumes">
          <input type="hidden" name="_action" value={action} />
          <input type="hidden" name="resumeId" value={resumeId} />
          <input type="hidden" name={fieldName} value={itemId} />
          <button
            type="submit"
            className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
              isSelected
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {isSelected && "✓"}
          </button>
        </fetcher.Form>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {label}
          </p>
          {sublabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {sublabel}
            </p>
          )}
        </div>
      </div>
      {isSelected && children && <div className="mt-2 ml-6">{children}</div>}
    </div>
  );
}

const priorityColors: Record<number, string> = {
  0: "bg-gray-200 text-gray-600",
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-green-100 text-green-800",
};

function BulletToggle({
  resumeId,
  bullet,
  selected,
}: {
  resumeId: number;
  bullet: { id: number; text: string; priority: number };
  selected: boolean;
}) {
  const fetcher = useFetcher();
  const isSelected = fetcher.formData ? !selected : selected;

  return (
    <div className="flex items-start gap-2 py-0.5">
      <fetcher.Form method="post" action="/api/resumes">
        <input type="hidden" name="_action" value="toggle_bullet" />
        <input type="hidden" name="resumeId" value={resumeId} />
        <input type="hidden" name="bulletId" value={bullet.id} />
        <button
          type="submit"
          className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
            isSelected
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {isSelected && "✓"}
        </button>
      </fetcher.Form>
      <span
        className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${priorityColors[bullet.priority] || priorityColors[0]}`}
      >
        P{bullet.priority}
      </span>
      <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">
        {bullet.text}
      </span>
    </div>
  );
}

// ── Preview Panel ──

function PreviewPanel({ data, template }: { data: ResumeData; template: TemplateId }) {
  const [Viewer, setViewer] = useState<React.ComponentType<any> | null>(null);
  const [templates, setTemplates] = useState<Record<string, React.ComponentType<any>> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    Promise.all([
      import("@react-pdf/renderer"),
      import("~/components/pdf/templates"),
    ]).then(([pdf, tmpl]) => {
      setViewer(() => pdf.PDFViewer);
      setTemplates(tmpl.templateComponents);
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width: Math.floor(width), height: Math.floor(height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const Doc = templates?.[template];

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      {Viewer && Doc && dims.width > 0 && dims.height > 0 ? (
        <Viewer
          width={dims.width}
          height={dims.height}
          showToolbar={false}
        >
          <Doc data={data} />
        </Viewer>
      ) : (
        <div className="text-gray-500 py-12 text-center">
          Loading PDF preview...
        </div>
      )}
    </div>
  );
}

// ── Export Button ──

function ExportButton({ data, filename, template }: { data: ResumeData; filename: string; template: TemplateId }) {
  const [ready, setReady] = useState(false);
  const [DownloadLink, setDownloadLink] = useState<React.ComponentType<any> | null>(null);
  const [templates, setTemplatesState] = useState<Record<string, React.ComponentType<any>> | null>(null);

  useEffect(() => {
    Promise.all([
      import("@react-pdf/renderer"),
      import("~/components/pdf/templates"),
    ]).then(([pdf, tmpl]) => {
      setDownloadLink(() => pdf.PDFDownloadLink);
      setTemplatesState(tmpl.templateComponents);
      setReady(true);
    });
  }, []);

  const DocComponent = templates?.[template];
  if (!ready || !DownloadLink || !DocComponent) return null;

  return (
    <DownloadLink
      document={<DocComponent data={data} />}
      fileName={`${filename}.pdf`}
      className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
    >
      {({ loading }: { loading: boolean }) =>
        loading ? "Generating..." : "Download PDF"
      }
    </DownloadLink>
  );
}

// ── Main Builder ──

export default function Builder() {
  const {
    resume,
    allJobs,
    allProjects,
    allBullets,
    allSummaries,
    allSkills,
    allCompanies,
    contact: contactRow,
    education: educationRow,
    selectedJobIds,
    selectedProjectIds,
    selectedBulletIds,
    selectedSkillIds,
  } = useLoaderData<typeof loader>();

  const getBullets = (parentType: string, parentId: number) =>
    allBullets.filter(
      (b) => b.parentType === parentType && b.parentId === parentId
    );

  // Build the ResumeData for preview from current selections
  const previewData: ResumeData = useMemo(() => {
    const selectedSummary = resume.summaryId
      ? allSummaries.find((s) => s.id === resume.summaryId)
      : null;

    const selectedJobsList = allJobs
      .filter((j) => selectedJobIds.includes(j.id))
      .map((job) => ({
        title: job.title,
        company: job.company,
        dates: job.dates,
        location: job.location,
        bullets: getBullets("job", job.id)
          .filter((b) => selectedBulletIds.includes(b.id))
          .map((b) => b.text),
      }));

    const selectedProjectsList = allProjects
      .filter((p) => selectedProjectIds.includes(p.id))
      .map((project) => ({
        name: project.name,
        dates: project.dates,
        tech: project.tech,
        bullets: getBullets("project", project.id)
          .filter((b) => selectedBulletIds.includes(b.id))
          .map((b) => b.text),
      }));

    const selectedSkillsList = allSkills
      .filter((s) => selectedSkillIds.includes(s.id))
      .map((s) => ({
        category: s.category,
        items: s.items as string[],
      }));

    const effectiveContact = resume.useCustomContact
      ? {
          name: resume.contactName ?? "",
          phone: resume.contactPhone,
          email: resume.contactEmail ?? "",
          linkedin: resume.contactLinkedin,
          github: resume.contactGithub,
        }
      : contactRow
        ? {
            name: contactRow.name,
            phone: contactRow.phone,
            email: contactRow.email,
            linkedin: contactRow.linkedin,
            github: contactRow.github,
          }
        : { name: "Your Name", email: "email@example.com" };

    return {
      contact: effectiveContact,
      summary: selectedSummary?.text || "",
      jobs: selectedJobsList,
      skills: selectedSkillsList,
      projects: selectedProjectsList,
      education: educationRow
        ? {
            school: educationRow.school,
            degrees: educationRow.degrees as string[],
          }
        : { school: "University", degrees: [] },
    };
  }, [
    resume,
    allJobs,
    allProjects,
    allBullets,
    allSummaries,
    allSkills,
    contactRow,
    educationRow,
    selectedJobIds,
    selectedProjectIds,
    selectedBulletIds,
    selectedSkillIds,
  ]);

  const fetcher = useFetcher();

  // Page overflow warning
  const totalBullets = previewData.jobs.reduce((n, j) => n + j.bullets.length, 0)
    + previewData.projects.reduce((n, p) => n + p.bullets.length, 0);
  const overflowWarning = totalBullets > 12;

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left: Selectors */}
      <div className="w-96 shrink-0 overflow-y-auto space-y-4 pr-2">
        {/* Resume name */}
        <div className="flex items-center gap-2 mb-2">
          <fetcher.Form method="post" action="/api/resumes" className="flex-1">
            <input type="hidden" name="_action" value="update" />
            <input type="hidden" name="id" value={resume.id} />
            <input type="hidden" name="summaryId" value={resume.summaryId ?? ""} />
            <input
              name="name"
              defaultValue={resume.name}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className="w-full text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
            />
          </fetcher.Form>
          <fetcher.Form method="post" action="/api/resumes">
            <input type="hidden" name="_action" value="duplicate" />
            <input type="hidden" name="id" value={resume.id} />
            <button
              type="submit"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Duplicate
            </button>
          </fetcher.Form>
          <ExportButton data={previewData} filename={resume.name.toLowerCase().replace(/\s+/g, "-")} template={(resume.template || "modern") as TemplateId} />
        </div>

        {/* Template picker */}
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Template
          </label>
          <div className="flex gap-2">
            {TEMPLATES.map((t) => {
              const isActive = (resume.template || "modern") === t.id;
              return (
                <fetcher.Form key={t.id} method="post" action="/api/resumes">
                  <input type="hidden" name="_action" value="set_template" />
                  <input type="hidden" name="resumeId" value={resume.id} />
                  <input type="hidden" name="template" value={t.id} />
                  <button
                    type="submit"
                    className={`rounded px-3 py-1.5 text-xs font-medium border ${
                      isActive
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    {t.name}
                  </button>
                </fetcher.Form>
              );
            })}
          </div>
        </div>

        {overflowWarning && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200">
            {totalBullets} bullets selected — resume may exceed one page. Consider removing {totalBullets - 12} bullets.
          </div>
        )}

        {/* Contact override (anonymization) */}
        <ContactOverride
          resumeId={resume.id}
          useCustomContact={resume.useCustomContact}
          defaults={{
            name: contactRow?.name ?? null,
            phone: contactRow?.phone ?? null,
            email: contactRow?.email ?? null,
            linkedin: contactRow?.linkedin ?? null,
            github: contactRow?.github ?? null,
          }}
          values={{
            contactName: resume.contactName,
            contactPhone: resume.contactPhone,
            contactEmail: resume.contactEmail,
            contactLinkedin: resume.contactLinkedin,
            contactGithub: resume.contactGithub,
          }}
        />

        {/* Target company */}
        <CompanyPicker
          resumeId={resume.id}
          companies={allCompanies}
          currentId={resume.companyId}
        />

        {/* Summary */}
        <SummaryPicker
          resumeId={resume.id}
          summaries={allSummaries}
          currentId={resume.summaryId}
        />

        {/* Jobs */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Jobs
          </h3>
          <div className="space-y-2">
            {allJobs.map((job) => (
              <ToggleItem
                key={job.id}
                resumeId={resume.id}
                action="toggle_job"
                fieldName="jobId"
                itemId={job.id}
                selected={selectedJobIds.includes(job.id)}
                label={job.title}
                sublabel={`${job.company} | ${job.dates}`}
              >
                <div className="space-y-0.5">
                  {getBullets("job", job.id).map((bullet) => (
                    <BulletToggle
                      key={bullet.id}
                      resumeId={resume.id}
                      bullet={bullet}
                      selected={selectedBulletIds.includes(bullet.id)}
                    />
                  ))}
                </div>
              </ToggleItem>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Projects
          </h3>
          <div className="space-y-2">
            {allProjects.map((project) => (
              <ToggleItem
                key={project.id}
                resumeId={resume.id}
                action="toggle_project"
                fieldName="projectId"
                itemId={project.id}
                selected={selectedProjectIds.includes(project.id)}
                label={project.name}
                sublabel={project.tech}
              >
                <div className="space-y-0.5">
                  {getBullets("project", project.id).map((bullet) => (
                    <BulletToggle
                      key={bullet.id}
                      resumeId={resume.id}
                      bullet={bullet}
                      selected={selectedBulletIds.includes(bullet.id)}
                    />
                  ))}
                </div>
              </ToggleItem>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Skills
          </h3>
          <div className="space-y-2">
            {allSkills.map((skill) => (
              <ToggleItem
                key={skill.id}
                resumeId={resume.id}
                action="toggle_skill"
                fieldName="skillId"
                itemId={skill.id}
                selected={selectedSkillIds.includes(skill.id)}
                label={skill.category}
                sublabel={`${skill.name}: ${(skill.items as string[]).join(", ")}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: PDF Preview */}
      <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-gray-200 bg-gray-100 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
        <div className="flex-1 min-h-0">
          <PreviewPanel data={previewData} template={(resume.template || "modern") as TemplateId} />
        </div>
      </div>
    </div>
  );
}
