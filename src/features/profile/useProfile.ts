import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';

export type NutritionGoals = {
  calorie_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
};

export const DEFAULT_GOALS: NutritionGoals = {
  calorie_goal: 3000,
  protein_goal_g: 200,
  carbs_goal_g: 340,
  fat_goal_g: 90,
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as NutritionGoals | null) ?? DEFAULT_GOALS;
    },
    enabled: !!userId,
    placeholderData: DEFAULT_GOALS,
  });
}

export function useUpdateGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, goals }: { userId: string; goals: NutritionGoals }) => {
      const { error } = await supabase
        .from('profiles')
        .update(goals)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['profile', v.userId] });
    },
  });
}
