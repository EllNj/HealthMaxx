import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import type { DisplayUnit, Equipment, Exercise, MuscleGroup } from './types';

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Exercise[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      muscle_group?: MuscleGroup | null;
      equipment?: Equipment | null;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.muscle_group !== undefined) patch.muscle_group = input.muscle_group;
      if (input.equipment !== undefined) patch.equipment = input.equipment;
      const { error } = await supabase.from('exercises').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['logged_exercises'] });
    },
  });
}

export function useLoggedExercises(userId: string | undefined) {
  return useQuery({
    queryKey: ['logged_exercises', userId],
    enabled: !!userId,
    queryFn: async () => {
      // Exercises the user has actually logged at least one set for
      const { data, error } = await supabase
        .from('workout_sets')
        .select('exercise_id, exercise:exercises(id, name, muscle_group, equipment, display_unit), session:workout_sessions!inner(user_id, ended_at)')
        .eq('session.user_id', userId!)
        .not('session.ended_at', 'is', null)
        .order('exercise_id');
      if (error) throw error;

      const seen = new Map<string, Exercise & { set_count: number }>();
      for (const row of (data ?? []) as any[]) {
        const ex = row.exercise as Exercise;
        if (!seen.has(ex.id)) seen.set(ex.id, { ...ex, set_count: 0 });
        seen.get(ex.id)!.set_count++;
      }
      return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 2,
  });
}

export type CreateExerciseInput = {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  display_unit?: DisplayUnit;
  user_id: string;
};

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExerciseInput) => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          name: input.name.trim(),
          muscle_group: input.muscle_group,
          equipment: input.equipment,
          display_unit: input.display_unit ?? 'kg',
          is_system: false,
          user_id: input.user_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Exercise;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}
