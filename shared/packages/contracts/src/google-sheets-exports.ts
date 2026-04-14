import { z } from "zod";

export const exportRunToGoogleSheetsRequestSchema = z.object({
  spreadsheetIdOrUrl: z.string().trim().min(1),
  sheetName: z.string().trim().min(1),
});

export const exportRunToGoogleSheetsResponseSchema = z.object({
  spreadsheetId: z.string().trim().min(1),
  sheetName: z.string().trim().min(1),
  appendedRowCount: z.number().int().nonnegative(),
  matchedHeaderCount: z.number().int().nonnegative(),
  matchedHeaders: z.array(z.string()),
  unmatchedHeaders: z.array(z.string()),
});

export type ExportRunToGoogleSheetsRequest = z.infer<
  typeof exportRunToGoogleSheetsRequestSchema
>;
export type ExportRunToGoogleSheetsResponse = z.infer<
  typeof exportRunToGoogleSheetsResponseSchema
>;
