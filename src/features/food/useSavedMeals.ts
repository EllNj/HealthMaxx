import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';

export type SavedMeal = {
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
  created_at: string;
};

export function useSavedMeals(userId: string | undefined) {
  return useQuery({
    queryKey: ['saved_meals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_meals')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedMeal[];
    },
  });
}

export function useSaveMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<SavedMeal, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('saved_meals')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as SavedMeal;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['saved_meals', v.user_id] });
    },
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; userId: string }) => {
      const { error } = await supabase.from('saved_meals').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['saved_meals', v.userId] });
    },
  });
}
