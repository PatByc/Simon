import { z } from "zod";

export const paginationInputSchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}
