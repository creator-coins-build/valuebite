export const VALUE_SCORE_VERSION = "VALUE_SCORE_V1" as const;

export interface ScoreInput {
  id: string;
  /** Total price in USD actually paid for everything received (deal effective price for bundles). */
  price: number | null | undefined;
  /** Total calories for everything received. */
  calories: number | null | undefined;
  /** Total protein grams for everything received. null/undefined = unknown (never treated as 0). */
  protein: number | null | undefined;
}

export type Invalid =
  | "missing_price" | "nonpositive_price" | "missing_calories" | "negative_calories"
  | "negative_protein" | "unreasonable_calories" | "unreasonable_protein"
  | "unreasonable_price" | "duplicate_id" | "protein_exceeds_calorie_limit";

export type ValueLabel = "Excellent" | "Great" | "Good" | "Average" | "Poor";

export interface ScoreResult {
  id: string;
  version: typeof VALUE_SCORE_VERSION;
  /** null when the record is invalid (never ranked) */
  valid: boolean;
  invalidReasons: Invalid[];
  price: number | null;
  calories: number | null;
  protein: number | null;
  calPerDollar: number | null;
  proteinPerDollar: number | null;
  /** 0..1 normalized components; null when not computable */
  calorieScore: number | null;
  proteinScore: number | null;
  priceScore: number | null;
  /** 0..10, one decimal. null if invalid or protein unknown (see docs/value-score-v1.md) */
  valueScore: number | null;
  label: ValueLabel | null;
  /** how bounds were chosen for normalization */
  normalization: "population" | "reference";
}
