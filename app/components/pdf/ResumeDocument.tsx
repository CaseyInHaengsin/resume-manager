// Re-export types and the default template for backwards compatibility
export type {
  ResumeContact,
  ResumeJob,
  ResumeProject,
  ResumeSkillRow,
  ResumeEducation,
  ResumeData,
  TemplateId,
} from "./types";

export { TEMPLATES } from "./types";
export { ModernTemplate as ResumeDocument } from "./templates/modern";
export { templateComponents } from "./templates";
