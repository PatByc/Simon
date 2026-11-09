import { z } from "zod";

export const projectBindingSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  observedPathHash: z.string().min(8),
});
export type ProjectBinding = z.infer<typeof projectBindingSchema>;

export const stateSchema = z.object({
  connected: z.boolean(),
  tiaVersion: z.string().optional(),
  project: projectBindingSchema.nullable(),
});

export const pathInputSchema = z.object({
  path: z.string().min(1).max(2048),
});

export const softwarePathInputSchema = z.object({
  softwarePath: z.string().min(1).max(2048),
});

export const searchInputSchema = softwarePathInputSchema.extend({
  pattern: z.string().max(256).default(""),
  limit: z.number().int().min(1).max(200).default(50),
});

export const analysisInputSchema = softwarePathInputSchema.extend({
  pattern: z.string().max(256).optional(),
  forceRefresh: z.boolean().default(false),
});

export interface EngineeringObject {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly path: string;
  readonly language?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}
