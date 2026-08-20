import type { ResumeData, TemplateId } from "../types";
import { ModernTemplate } from "./modern";
import { ClassicTemplate } from "./classic";
import { MinimalTemplate } from "./minimal";

export const templateComponents: Record<
  TemplateId,
  React.ComponentType<{ data: ResumeData }>
> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
};
