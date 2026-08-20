import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { db } from "~/db";
import { jobs, projects, bullets, summaries, skills } from "~/db/schema";
import { asc, eq } from "drizzle-orm";
import { JobCard } from "~/components/library/JobCard";
import { ProjectCard } from "~/components/library/ProjectCard";
import { SummaryList } from "~/components/library/SummaryList";
import { SkillList } from "~/components/library/SkillList";
import { requireUserId } from "~/lib/auth.server";
import type { Route } from "./+types/library";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
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

  return {
    jobs: allJobs,
    projects: allProjects,
    bullets: allBullets,
    summaries: allSummaries,
    skills: allSkills,
  };
}

export default function Library() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const fetcher = useFetcher();

  const handleCreate = (action: string) => {
    fetcher.submit({ _action: "create" }, { method: "post", action });
  };

  const jobBullets = (jobId: number) =>
    data.bullets.filter(
      (b) => b.parentType === "job" && b.parentId === jobId
    );

  const projectBullets = (projectId: number) =>
    data.bullets.filter(
      (b) => b.parentType === "project" && b.parentId === projectId
    );

  return (
    <div className="space-y-8">
      {/* Jobs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Jobs
          </h2>
          <button
            type="button"
            onClick={() => { handleCreate("/api/jobs"); revalidator.revalidate(); }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Job
          </button>
        </div>
        <div className="space-y-3">
          {data.jobs.map((job) => (
            <JobCard key={job.id} job={job} bullets={jobBullets(job.id)} />
          ))}
          {data.jobs.length === 0 && (
            <p className="text-sm text-gray-500">No jobs yet.</p>
          )}
        </div>
      </section>

      {/* Projects */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Projects
          </h2>
          <button
            type="button"
            onClick={() => { handleCreate("/api/projects"); revalidator.revalidate(); }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Project
          </button>
        </div>
        <div className="space-y-3">
          {data.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              bullets={projectBullets(project.id)}
            />
          ))}
          {data.projects.length === 0 && (
            <p className="text-sm text-gray-500">No projects yet.</p>
          )}
        </div>
      </section>

      {/* Summaries */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Summaries
          </h2>
          <button
            type="button"
            onClick={() => { handleCreate("/api/summaries"); revalidator.revalidate(); }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Summary
          </button>
        </div>
        <SummaryList summaries={data.summaries} />
      </section>

      {/* Skills */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Skills
          </h2>
          <button
            type="button"
            onClick={() => { handleCreate("/api/skills"); revalidator.revalidate(); }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Skill Row
          </button>
        </div>
        <SkillList skills={data.skills} />
      </section>
    </div>
  );
}
