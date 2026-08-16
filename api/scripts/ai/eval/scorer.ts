import { ZodError } from 'zod';
import { productDraftEvalSchema } from './product-draft.eval-schema';
import { EvalCase } from './dataset';

export interface CaseScore {
  id: string;
  latencyMs: number;
  schemaValid: boolean;
  parseError?: string;
  categoryCorrect: boolean;
  unitCorrect: boolean;
  taxCodeCorrect: boolean;
  priceError: number | null;
  /** El modelo inventó un costo cuando la entrada no lo mencionaba — la falla que §07 prohíbe explícitamente. */
  costHallucinated: boolean;
  /** La entrada sí daba costo y el modelo lo devolvió null — extracción perdida, distinto de alucinar. */
  costMissed: boolean;
  costError: number | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function scoreOne(evalCase: EvalCase, rawContent: string, latencyMs: number): CaseScore {
  let json: unknown;
  try {
    json = JSON.parse(rawContent);
  } catch {
    return {
      id: evalCase.id,
      latencyMs,
      schemaValid: false,
      parseError: 'La salida no es JSON válido.',
      categoryCorrect: false,
      unitCorrect: false,
      taxCodeCorrect: false,
      priceError: null,
      costHallucinated: false,
      costMissed: false,
      costError: null,
    };
  }

  const parsed = productDraftEvalSchema.safeParse(json);
  if (!parsed.success) {
    return {
      id: evalCase.id,
      latencyMs,
      schemaValid: false,
      parseError: describeZodError(parsed.error),
      categoryCorrect: false,
      unitCorrect: false,
      taxCodeCorrect: false,
      priceError: null,
      costHallucinated: false,
      costMissed: false,
      costError: null,
    };
  }

  const actual = parsed.data;
  const expected = evalCase.expected;

  const costHallucinated = expected.costPrice === null && actual.costPrice !== null;
  const costMissed = expected.costPrice !== null && actual.costPrice === null;
  const costError =
    expected.costPrice !== null && actual.costPrice !== null
      ? Math.abs(actual.costPrice - expected.costPrice)
      : null;

  return {
    id: evalCase.id,
    latencyMs,
    schemaValid: true,
    categoryCorrect: normalize(actual.categoryName) === normalize(expected.categoryName),
    unitCorrect: normalize(actual.unitName) === normalize(expected.unitName),
    taxCodeCorrect: actual.taxCode === expected.taxCode,
    priceError: Math.abs(actual.price - expected.price),
    costHallucinated,
    costMissed,
    costError,
  };
}

function describeZodError(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`).join('; ');
}

export interface ModelReport {
  model: string;
  totalCases: number;
  schemaValidPct: number;
  categoryCorrectPct: number;
  unitCorrectPct: number;
  taxCodeCorrectPct: number;
  meanPriceError: number;
  costHallucinatedCount: number;
  costMissedCount: number;
  meanLatencyMs: number;
  failures: CaseScore[];
}

export function summarizeModel(model: string, scores: CaseScore[]): ModelReport {
  const total = scores.length;
  const valid = scores.filter((s) => s.schemaValid);
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  const priceErrors = valid.map((s) => s.priceError).filter((v): v is number => v != null);

  return {
    model,
    totalCases: total,
    schemaValidPct: pct(valid.length),
    categoryCorrectPct: pct(valid.filter((s) => s.categoryCorrect).length),
    unitCorrectPct: pct(valid.filter((s) => s.unitCorrect).length),
    taxCodeCorrectPct: pct(valid.filter((s) => s.taxCodeCorrect).length),
    meanPriceError: priceErrors.length > 0 ? priceErrors.reduce((a, b) => a + b, 0) / priceErrors.length : 0,
    costHallucinatedCount: scores.filter((s) => s.costHallucinated).length,
    costMissedCount: scores.filter((s) => s.costMissed).length,
    meanLatencyMs: scores.reduce((a, b) => a + b.latencyMs, 0) / total,
    failures: scores.filter((s) => !s.schemaValid || !s.categoryCorrect || !s.unitCorrect || !s.taxCodeCorrect || s.costHallucinated),
  };
}
