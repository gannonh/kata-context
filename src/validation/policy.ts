import { z } from "zod/v4";

export const policyConfigSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.8),
  preserveRecentCount: z.number().int().min(0).default(10),
  enabled: z.boolean().default(true),
});

export type PolicyConfig = z.infer<typeof policyConfigSchema>;

/** Default policy config with all defaults applied. */
export const DEFAULT_POLICY: PolicyConfig = policyConfigSchema.parse({});

/** Resolve policy config: merge partial input with defaults. */
export function resolvePolicy(input: unknown): PolicyConfig {
  return policyConfigSchema.parse(input ?? {});
}
