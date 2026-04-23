import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/lib/supabase';
import type {
  TemplateExerciseWithExercise,
  TemplateWithCounts,
  WorkoutTemplate,
} from './types';

export function useTemplates() {
  return useQuery({
    queryKey: ['workout_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*, template_exercises(id)')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        exercise_count: t.template_exercises?.length ?? 0,
      })) as TemplateWithCounts[];
    },
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['workout_template', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data: template, error: e1 } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('id', id!)
        .single();
      if (e1) throw e1;

      const { data: items, error: e2 } = await supabase
        .from('template_exercises')
        .select('*, exercise:exercises(*)')
        .eq('template_id', id!)
        .order('order_index', { ascending: true });
      if (e2) throw e2;

      return {
        template: template as WorkoutTemplate,
        exercises: (items ?? []) as TemplateExerciseWithExercise[],
      };
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; name: string }) => {
      const { data: existing } = await supabase
        .from('workout_templates')
        .select('order_index')
        .eq('user_id', input.user_id)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (existing?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from('workout_templates')
        .insert({
          user_id: input.user_id,
          name: input.name.trim(),
          order_index: nextOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkoutTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout_templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from('workout_templates')
        .update({ name: input.name.trim() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workout_templates'] });
      qc.invalidateQueries({ queryKey: ['workout_template', v.id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout_templates'] }),
  });
}

export function useAddTemplateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      template_id: string;
      exercise_id: string;
      target_sets?: number;
      rest_seconds?: number;
    }) => {
      const { data: last } = await supabase
        .from('template_exercises')
        .select('order_index')
        .eq('template_id', input.template_id)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (last?.order_index ?? -1) + 1;

      const { data, error } = await supabase
        .from('template_exercises')
        .insert({
          template_id: input.template_id,
          exercise_id: input.exercise_id,
          order_index: nextOrder,
          target_sets: input.target_sets ?? 3,
          rest_seconds: input.rest_seconds ?? 90,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workout_template', v.template_id] });
      qc.invalidateQueries({ queryKey: ['workout_templates'] });
    },
  });
}

export function useUpdateTemplateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      template_id: string;
      target_sets?: number;
      rest_seconds?: number;
      notes?: string | null;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.target_sets !== undefined) patch.target_sets = input.target_sets;
      if (input.rest_seconds !== undefined) patch.rest_seconds = input.rest_seconds;
      if (input.notes !== undefined) patch.notes = input.notes;
      const { error } = await supabase
        .from('template_exercises')
        .update(patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workout_template', v.template_id] });
    },
  });
}

export function useRemoveTemplateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; template_id: string }) => {
      const { error } = await supabase
        .from('template_exercises')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workout_template', v.template_id] });
      qc.invalidateQueries({ queryKey: ['workout_templates'] });
    },
  });
}

export function useReorderTemplateExercises() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { template_id: string; ordered_ids: string[] }) => {
      const updates = input.ordered_ids.map((id, idx) =>
        supabase.from('template_exercises').update({ order_index: idx }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workout_template', v.template_id] });
    },
  });
}
