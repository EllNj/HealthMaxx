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
  gemini_raw: unknown;
  created_at: string;
};

export type DayTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useTodayEntries(userId: string | undefined) {
  const today = localDateString();
  return useQuery({
    queryKey: ['food_entries', userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId!)
        .eq('logged_for_date', today)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FoodEntry[];
    },
  });
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
          gemini_raw: input.parsed._gemini_raw ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FoodEntry;
    },
    onSuccess: (_d, v) => {
      const today = localDateString();
      qc.invalidateQueries({ queryKey: ['food_entries', v.userId, today] });
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
      const today = localDateString();
      qc.invalidateQueries({ queryKey: ['food_entries', v.userId, today] });
    },
  });
}

export function useDayTotals(entries: FoodEntry[] | undefined): DayTotals {
  if (!entries) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein_g: acc.protein_g + e.protein_g,
      carbs_g: acc.carbs_g + e.carbs_g,
      fat_g: acc.fat_g + e.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}
