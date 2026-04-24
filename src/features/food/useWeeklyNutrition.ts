import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';

export type DayNutrition = {
  date: string;
  label: string;
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

export function useWeeklyNutrition(userId: string | undefined) {
  return useQuery({
    queryKey: ['weekly_nutrition', userId],
    enabled: !!userId,
    queryFn: async (): Promise<DayNutrition[]> => {
      const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days: DayNutrition[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
          date: localDateString(d),
          label: i === 0 ? 'Today' : DAY_LABELS[d.getDay()],
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        });
      }

      const { data, error } = await supabase
        .from('food_entries')
        .select('logged_for_date, calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId!)
        .gte('logged_for_date', days[0].date);
      if (error) throw error;

      for (const e of (data ?? [])) {
        const day = days.find((d) => d.date === e.logged_for_date);
        if (day) {
          day.calories += e.calories ?? 0;
          day.protein_g += e.protein_g ?? 0;
          day.carbs_g += e.carbs_g ?? 0;
          day.fat_g += e.fat_g ?? 0;
        }
      }

      return days;
    },
    staleTime: 1000 * 60 * 5,
  });
}
