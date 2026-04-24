const FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/log-food`;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type NutritionItem = {
  name: string;
  qty: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  saturated_fat_g?: number | null;
  sodium_mg?: number | null;
  source?: string | null;
};

export type ParsedMeal = {
  items: NutritionItem[];
  total: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
    sugar_g?: number | null;
    saturated_fat_g?: number | null;
    sodium_mg?: number | null;
  };
  confidence: number;
  notes: string;
  _gemini_raw?: unknown;
};

export async function logFood(input: {
  description?: string;
  imageBase64?: string;
  useWebSearch?: boolean;
}): Promise<ParsedMeal> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Function error ${res.status}`);
  if (data?.error) throw new Error(data.error);

  return data as ParsedMeal;
}
