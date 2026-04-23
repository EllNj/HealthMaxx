import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { useAuth } from '@/src/features/auth/useAuth';
import {
  useLoggedExercises,
  useUpdateExercise,
} from '@/src/features/workouts/useExercises';
import type { Exercise, MuscleGroup, Equipment } from '@/src/features/workouts/types';
import { MUSCLE_GROUPS, EQUIPMENT } from '@/src/features/workouts/types';

export default function ProgressScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const { data: exercises, isLoading } = useLoggedExercises(session?.user.id);
  const updateExercise = useUpdateExercise();

  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [categorisingEx, setCategorisingEx] = useState<(Exercise & { set_count: number }) | null>(null);

  const activeMuscleGroups = useMemo(() => {
    if (!exercises) return [];
    const groups = new Set(exercises.map((e) => e.muscle_group).filter(Boolean));
    return MUSCLE_GROUPS.filter((g) => groups.has(g));
  }, [exercises]);

  const filtered = useMemo(() => {
    if (!exercises) return [];
    let list = exercises;
    if (muscleFilter) list = list.filter((e) => e.muscle_group === muscleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [exercises, search, muscleFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: c.text }]}>Progress</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: border }]}>
        <View style={[styles.searchBox, { backgroundColor: cardBg, borderColor: border }]}>
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Search exercises…"
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Muscle group chips */}
      {activeMuscleGroups.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}>
          {['all', ...activeMuscleGroups].map((g) => {
            const active = g === 'all' ? muscleFilter === null : muscleFilter === g;
            return (
              <Pressable
                key={g}
                onPress={() => setMuscleFilter(g === 'all' ? null : g)}
                style={[
                  styles.chip,
                  active
                    ? { backgroundColor: c.tint, borderColor: c.tint }
                    : { backgroundColor: cardBg, borderColor: border },
                ]}>
                <Text style={[styles.chipText, { color: active ? onTint : c.text }]}>
                  {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Exercise list */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} />
        </View>
      ) : (exercises ?? []).length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="barbell-outline" size={48} color={muted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>No workouts yet</Text>
          <Text style={[styles.emptySubtitle, { color: muted }]}>
            Log some sets or import from Strong to see your progress here.
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: muted }}>No exercises match.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(ex) => ex.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: ex }) => (
            <ExerciseRow
              exercise={ex}
              cardBg={cardBg}
              border={border}
              textColor={c.text}
              muted={muted}
              tint={c.tint}
              onCategorise={() => setCategorisingEx(ex)}
            />
          )}
        />
      )}

      {/* Categorisation modal */}
      {categorisingEx && (
        <CategoriseModal
          exercise={categorisingEx}
          scheme={scheme}
          onClose={() => setCategorisingEx(null)}
          onSave={async (muscle, equipment) => {
            await updateExercise.mutateAsync({
              id: categorisingEx.id,
              muscle_group: muscle,
              equipment,
            });
            setCategorisingEx(null);
          }}
        />
      )}
    </View>
  );
}

function ExerciseRow({
  exercise,
  cardBg,
  border,
  textColor,
  muted,
  tint,
  onCategorise,
}: {
  exercise: Exercise & { set_count: number };
  cardBg: string;
  border: string;
  textColor: string;
  muted: string;
  tint: string;
  onCategorise: () => void;
}) {
  const uncategorised = !exercise.muscle_group;
  const meta = uncategorised
    ? null
    : [exercise.muscle_group, exercise.equipment]
        .filter(Boolean)
        .map((s) => s!.charAt(0).toUpperCase() + s!.slice(1))
        .join(' · ');

  return (
    <Pressable
      onPress={() =>
        router.push(
          `/workout/progress/${exercise.id}?name=${encodeURIComponent(exercise.name)}` as Href
        )
      }
      style={({ pressed }) => [
        styles.exCard,
        { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.exName, { color: textColor }]} numberOfLines={2}>
          {exercise.name}
        </Text>
        {meta ? (
          <Text style={[styles.exMeta, { color: muted }]}>{meta}</Text>
        ) : (
          <Pressable onPress={onCategorise} style={styles.categoriseBtn} hitSlop={6}>
            <Ionicons name="pricetag-outline" size={12} color={tint} />
            <Text style={[styles.categoriseBtnText, { color: tint }]}>Tap to categorise</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.exRight}>
        <Text style={[styles.exSets, { color: muted }]}>{exercise.set_count} sets</Text>
        <Ionicons name="chevron-forward" size={16} color={muted} />
      </View>
    </Pressable>
  );
}

function CategoriseModal({
  exercise,
  scheme,
  onClose,
  onSave,
}: {
  exercise: Exercise;
  scheme: 'light' | 'dark';
  onClose: () => void;
  onSave: (muscle: MuscleGroup, equipment: Equipment) => Promise<void>;
}) {
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';

  const [muscle, setMuscle] = useState<MuscleGroup>(exercise.muscle_group ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(exercise.equipment ?? 'barbell');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(muscle, equipment);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: cardBg, borderTopColor: border }]}>
        <View style={[styles.sheetHandle, { backgroundColor: muted }]} />
        <Text style={[styles.sheetTitle, { color: c.text }]} numberOfLines={1}>
          {exercise.name}
        </Text>

        <Text style={[styles.sheetLabel, { color: muted }]}>Muscle group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={styles.optionRow}>
            {MUSCLE_GROUPS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setMuscle(g)}
                style={[
                  styles.optionChip,
                  muscle === g
                    ? { backgroundColor: c.tint, borderColor: c.tint }
                    : { backgroundColor: scheme === 'dark' ? '#151718' : '#fff', borderColor: border },
                ]}>
                <Text style={[styles.chipText, { color: muscle === g ? onTint : c.text }]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={[styles.sheetLabel, { color: muted, marginTop: 16 }]}>Equipment</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={styles.optionRow}>
            {EQUIPMENT.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEquipment(e)}
                style={[
                  styles.optionChip,
                  equipment === e
                    ? { backgroundColor: c.tint, borderColor: c.tint }
                    : { backgroundColor: scheme === 'dark' ? '#151718' : '#fff', borderColor: border },
                ]}>
                <Text style={[styles.chipText, { color: equipment === e ? onTint : c.text }]}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: c.tint, opacity: pressed || saving ? 0.7 : 1, marginTop: 20 },
          ]}>
          {saving
            ? <ActivityIndicator color={onTint} />
            : <Text style={[styles.saveBtnText, { color: onTint }]}>Save</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 32, fontWeight: '700' },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterScroll: { height: 48, flexGrow: 0 },
  filterRow: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  exCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  exName: { fontSize: 16, fontWeight: '600', marginBottom: 3, flexShrink: 1 },
  exMeta: { fontSize: 13 },
  exRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exSets: { fontSize: 13 },
  categoriseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  categoriseBtnText: { fontSize: 12, fontWeight: '600' },
  // Sheet
  overlay: { flex: 1 },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
    opacity: 0.4,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  sheetLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  optionRow: { flexDirection: 'row', paddingBottom: 4 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
