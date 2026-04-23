import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ExercisePicker } from '@/src/features/workouts/ExercisePicker';
import type { TemplateExerciseWithExercise } from '@/src/features/workouts/types';
import {
  useAddTemplateExercise,
  useDeleteTemplate,
  useRemoveTemplateExercise,
  useReorderTemplateExercises,
  useTemplate,
  useUpdateTemplate,
  useUpdateTemplateExercise,
} from '@/src/features/workouts/useTemplates';

export default function TemplateEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { data, isLoading, error } = useTemplate(id);
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const addEx = useAddTemplateExercise();
  const removeEx = useRemoveTemplateExercise();
  const reorderEx = useReorderTemplateExercises();

  const [name, setName] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (data?.template.name && !nameLoaded) {
      setName(data.template.name);
      setNameLoaded(true);
    }
  }, [data?.template.name, nameLoaded]);

  const commitName = () => {
    if (!id || !data) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === data.template.name) return;
    updateTemplate.mutate({ id: id as string, name: trimmed });
  };

  const onDeleteTemplate = () => {
    Alert.alert('Delete template?', `"${data?.template.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate.mutateAsync(id as string);
          router.back();
        },
      },
    ]);
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!data) return;
    const next = [...data.exercises];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    reorderEx.mutate({
      template_id: id as string,
      ordered_ids: next.map((r) => r.id),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>Template</Text>
        <Pressable onPress={onDeleteTemplate} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} />
        </View>
      )}

      {error && (
        <Text style={{ color: '#ff6b6b', padding: 16 }}>{(error as Error).message}</Text>
      )}

      {data && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={styles.section}>
              <Text style={[styles.label, { color: muted }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onBlur={commitName}
                onSubmitEditing={commitName}
                style={[
                  styles.nameInput,
                  { color: c.text, backgroundColor: cardBg, borderColor: border },
                ]}
                placeholder="Template name"
                placeholderTextColor={muted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.label, { color: muted }]}>Exercises</Text>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.addBtn,
                    { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Ionicons name="add" size={16} color={onTint} />
                  <Text style={[styles.addBtnText, { color: onTint }]}>Add</Text>
                </Pressable>
              </View>

              {data.exercises.length === 0 && (
                <View
                  style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <Text style={{ color: muted, textAlign: 'center' }}>
                    No exercises yet. Tap{' '}
                    <Text style={{ fontWeight: '600', color: c.text }}>Add</Text>.
                  </Text>
                </View>
              )}

              {data.exercises.map((row, idx) => (
                <TemplateExerciseRow
                  key={row.id}
                  row={row}
                  index={idx}
                  total={data.exercises.length}
                  c={c}
                  muted={muted}
                  border={border}
                  cardBg={cardBg}
                  onMove={(dir) => move(idx, dir)}
                  templateId={id as string}
                  onRemove={() =>
                    Alert.alert('Remove exercise?', row.exercise.name, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () =>
                          removeEx.mutate({ id: row.id, template_id: id as string }),
                      },
                    ])
                  }
                />
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <View
            style={[
              styles.header,
              { paddingTop: 14, borderBottomColor: border, paddingBottom: 10 },
            ]}>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} style={styles.iconBtn}>
              <Text style={{ color: c.tint, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: c.text }]}>Add exercise</Text>
            <View style={styles.iconBtn} />
          </View>
          <ExercisePicker
            onSelect={async (ex) => {
              try {
                await addEx.mutateAsync({
                  template_id: id as string,
                  exercise_id: ex.id,
                });
                setPickerOpen(false);
              } catch (e: any) {
                Alert.alert('Could not add', e.message ?? String(e));
              }
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

type RowProps = {
  row: TemplateExerciseWithExercise;
  index: number;
  total: number;
  c: typeof Colors.light;
  muted: string;
  border: string;
  cardBg: string;
  templateId: string;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
};

function TemplateExerciseRow({
  row,
  index,
  total,
  c,
  muted,
  border,
  cardBg,
  templateId,
  onMove,
  onRemove,
}: RowProps) {
  const updateEx = useUpdateTemplateExercise();
  const [sets, setSets] = useState(String(row.target_sets));
  const [rest, setRest] = useState(String(row.rest_seconds));
  const [notes, setNotes] = useState(row.notes ?? '');

  useEffect(() => {
    setSets(String(row.target_sets));
    setRest(String(row.rest_seconds));
    setNotes(row.notes ?? '');
  }, [row.target_sets, row.rest_seconds, row.notes]);

  const commitSets = () => {
    const n = Math.max(1, Math.min(20, parseInt(sets, 10) || row.target_sets));
    if (n !== row.target_sets) {
      updateEx.mutate({ id: row.id, template_id: templateId, target_sets: n });
    }
    setSets(String(n));
  };
  const commitRest = () => {
    const n = Math.max(0, Math.min(600, parseInt(rest, 10) || row.rest_seconds));
    if (n !== row.rest_seconds) {
      updateEx.mutate({ id: row.id, template_id: templateId, rest_seconds: n });
    }
    setRest(String(n));
  };
  const commitNotes = () => {
    const next = notes.trim() || null;
    if (next !== row.notes) {
      updateEx.mutate({ id: row.id, template_id: templateId, notes: next });
    }
  };

  const meta = useMemo(
    () =>
      [row.exercise.muscle_group, row.exercise.equipment]
        .filter(Boolean)
        .map((s) => s!.charAt(0).toUpperCase() + s!.slice(1))
        .join(' · '),
    [row.exercise]
  );

  return (
    <View style={[rowStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={rowStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[rowStyles.name, { color: c.text }]} numberOfLines={1}>
            {row.exercise.name}
          </Text>
          {meta.length > 0 && (
            <Text style={[rowStyles.meta, { color: muted }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
        <View style={rowStyles.moveCol}>
          <Pressable
            onPress={() => onMove(-1)}
            disabled={index === 0}
            hitSlop={6}
            style={({ pressed }) => [rowStyles.moveBtn, { opacity: index === 0 ? 0.3 : pressed ? 0.5 : 1 }]}>
            <Ionicons name="chevron-up" size={18} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => onMove(1)}
            disabled={index === total - 1}
            hitSlop={6}
            style={({ pressed }) => [
              rowStyles.moveBtn,
              { opacity: index === total - 1 ? 0.3 : pressed ? 0.5 : 1 },
            ]}>
            <Ionicons name="chevron-down" size={18} color={c.text} />
          </Pressable>
        </View>
        <Pressable onPress={onRemove} hitSlop={6} style={rowStyles.removeBtn}>
          <Ionicons name="close" size={18} color={muted} />
        </Pressable>
      </View>

      <View style={rowStyles.fieldsRow}>
        <Field
          label="Sets"
          value={sets}
          onChangeText={setSets}
          onBlur={commitSets}
          keyboardType="number-pad"
          c={c}
          muted={muted}
          border={border}
        />
        <Field
          label="Rest (s)"
          value={rest}
          onChangeText={setRest}
          onBlur={commitRest}
          keyboardType="number-pad"
          c={c}
          muted={muted}
          border={border}
        />
      </View>
      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        onBlur={commitNotes}
        c={c}
        muted={muted}
        border={border}
        placeholder="Optional"
        multiline
      />
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  onBlur: () => void;
  c: typeof Colors.light;
  muted: string;
  border: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
  flex?: number;
};

function Field({
  label,
  value,
  onChangeText,
  onBlur,
  c,
  muted,
  border,
  placeholder,
  keyboardType,
  multiline,
}: FieldProps) {
  return (
    <View style={{ flex: 1, marginTop: 10 }}>
      <Text style={[rowStyles.fieldLabel, { color: muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={muted}
        style={[
          rowStyles.fieldInput,
          {
            color: c.text,
            borderColor: border,
            minHeight: multiline ? 40 : undefined,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 8, minWidth: 40, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 20 },
  center: { padding: 32, alignItems: 'center' },
});

const rowStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 12 },
  moveCol: { flexDirection: 'column', marginHorizontal: 4 },
  moveBtn: { padding: 4 },
  removeBtn: { padding: 6 },
  fieldsRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
});
