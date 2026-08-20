export interface ResumeContact {
  name: string;
  phone?: string | null;
  email: string;
  linkedin?: string | null;
  github?: string | null;
}

export interface ResumeJob {
  title: string;
  company: string;
  dates: string;
  location: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  dates: string;
  tech: string;
  bullets: string[];
}

export interface ResumeSkillRow {
  category: string;
  items: string[];
}

export interface ResumeEducation {
  school: string;
  degrees: string[];
}

export interface ResumeData {
  contact: ResumeContact;
  summary: string;
  jobs: ResumeJob[];
  skills: ResumeSkillRow[];
  projects: ResumeProject[];
  education: ResumeEducation;
}

export type TemplateId = "modern" | "classic" | "minimal";

export const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  { id: "modern", name: "Modern", description: "Accent bar headings, compact layout" },
  { id: "classic", name: "Classic", description: "Full-width rules, traditional look" },
  { id: "minimal", name: "Minimal", description: "Clean headings, generous whitespace" },
];
