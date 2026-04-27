import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import type { ParsedMeal } from '@/src/lib/gemini';

export type FoodEntry = {
  id: string;
  user_id: string;
  logged_for_date: string;
  input_type: 'text' | 'photo';
  description: string | null;
  image_path: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
  gemini_raw: unknown;
  created_at: string;
};

export type DayTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  saturated_fat_g: number;
  sodium_mg: number;
};

export function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useEntriesForDate(userId: string | undefined, dateStr: string) {
  return useQuery({
    queryKey: ['food_entries', userId, dateStr],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId!)
        .eq('logged_for_date', dateStr)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FoodEntry[];
    },
  });
}

export function useTodayEntries(userId: string | undefined) {
  return useEntriesForDate(userId, localDateString());
}

export function useLogFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      description: string;
      inputType: 'text' | 'photo';
      imagePath?: string | null;
      parsed: ParsedMeal;
    }) => {
      const today = localDateString();
      const { data, error } = await supabase
        .from('food_entries')
        .insert({
          user_id: input.userId,
          logged_for_date: today,
          input_type: input.inputType,
          description: input.description,
          image_path: input.imagePath ?? null,
          calories: Math.round(input.parsed.total.calories),
          protein_g: Math.round(input.parsed.total.protein_g * 10) / 10,
          carbs_g: Math.round(input.parsed.total.carbs_g * 10) / 10,
          fat_g: Math.round(input.parsed.total.fat_g * 10) / 10,
          fiber_g: input.parsed.total.fiber_g != null ? Math.round(input.parsed.total.fiber_g * 10) / 10 : null,
          sugar_g: input.parsed.total.sugar_g != null ? Math.round(input.parsed.total.sugar_g * 10) / 10 : null,
          saturated_fat_g: input.parsed.total.saturated_fat_g != null ? Math.round(input.parsed.total.saturated_fat_g * 10) / 10 : null,
          sodium_mg: input.parsed.total.sodium_mg != null ? Math.round(input.parsed.total.sodium_mg) : null,
          gemini_raw: input.parsed._gemini_raw ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FoodEntry;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['food_entries', v.userId] });
      qc.invalidateQueries({ queryKey: ['weekly_nutrition', v.userId] });
    },
  });
}

export function useDeleteFoodEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; userId: string }) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['food_entries', v.userId] });
      qc.invalidateQueries({ queryKey: ['weekly_nutrition', v.userId] });
    },
  });
}

export function useDayTotals(entries: FoodEntry[] | undefined): DayTotals {
  if (!entries) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, saturated_fat_g: 0, sodium_mg: 0 };
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein_g: acc.protein_g + e.protein_g,
      carbs_g: acc.carbs_g + e.carbs_g,
      fat_g: acc.fat_g + e.fat_g,
      fiber_g: acc.fiber_g + (e.fiber_g ?? 0),
      sugar_g: acc.sugar_g + (e.sugar_g ?? 0),
      saturated_fat_g: acc.saturated_fat_g + (e.saturated_fat_g ?? 0),
      sodium_mg: acc.sodium_mg + (e.sodium_mg ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, saturated_fat_g: 0, sodium_mg: 0 }
  );
}
