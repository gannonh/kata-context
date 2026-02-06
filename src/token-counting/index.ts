import { countTokens } from "gpt-tokenizer";

/**
 * Count tokens in a string using o200k_base encoding (default).
 * Compatible with GPT-4o, GPT-4.1, o1, o3, o4 models.
 */
export function countMessageTokens(content: string): number {
  return countTokens(content);
}
