import { z } from "zod";

export const sourceReferenceSchema = z.object({
  sourceId: z.string().min(1),
  connector: z.string().min(1),
  projectId: z.string().min(1).optional(),
  engineeringPath: z.string().min(1).optional(),
  objectType: z.string().min(1).optional(),
  observedAt: z.string().datetime(),
});

export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const resultWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const resultEnvelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    schemaVersion: z.literal("1"),
    operationId: z.string().uuid(),
    observedAt: z.string().datetime(),
    partial: z.boolean(),
    freshness: z.object({
      source: z.enum(["live", "fresh-snapshot", "reused-snapshot"]),
      ageMs: z.number().int().nonnegative().optional(),
    }),
    warnings: z.array(resultWarningSchema),
    sources: z.array(sourceReferenceSchema),
    data,
  });

export interface ResultEnvelope<T> {
  readonly schemaVersion: "1";
  readonly operationId: string;
  readonly observedAt: string;
  readonly partial: boolean;
  readonly freshness: {
    readonly source: "live" | "fresh-snapshot" | "reused-snapshot";
    readonly ageMs?: number;
  };
  readonly warnings: ReadonlyArray<{ readonly code: string; readonly message: string }>;
  readonly sources: ReadonlyArray<SourceReference>;
  readonly data: T;
}
