import { supabase } from '@/src/lib/supabase';

export const BASELINE_PROFILE = {
  height_cm: 187,
  weight_kg: 88.9,
  body_fat_pct: 23.8,
  skeletal_muscle_kg: 37.5,
  tee_kcal: 2821,
  calorie_goal: 3000,
  protein_goal_g: 200,
  carbs_goal_g: 340,
  fat_goal_g: 90,
};

export async function ensureProfile(userId: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (existing) return;
  const { error } = await supabase.from('profiles').insert({ id: userId, ...BASELINE_PROFILE });
  if (error) throw error;
}
