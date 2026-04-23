import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { AddExerciseModal } from './AddExerciseModal';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from './types';
import { useExercises } from './useExercises';

type Props = {
  onSelect: (exercise: Exercise) => void;
};

export function ExercisePicker({ onSelect }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const chipBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const chipSelectedBg = c.tint;
  const chipSelectedText = scheme === 'dark' ? '#000' : '#fff';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: exercises, isLoading, error } = useExercises();

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (filter && ex.muscle_group !== filter) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, search, filter]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.searchRow}>
        <View style={[styles.searchWrap, { backgroundColor: chipBg, borderColor: border }]}>
          <Ionicons name="search" size={16} color={muted} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Search exercises"
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={6}>
          <Ionicons name="add" size={22} color={chipSelectedText} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}>
        <Chip
          label="All"
          selected={filter === null}
          onPress={() => setFilter(null)}
          bg={chipBg}
          selectedBg={chipSelectedBg}
          textColor={c.text}
          selectedTextColor={chipSelectedText}
        />
        {MUSCLE_GROUPS.map((g) => (
          <Chip
            key={g}
            label={capitalize(g)}
            selected={filter === g}
            onPress={() => setFilter(g)}
            bg={chipBg}
            selectedBg={chipSelectedBg}
            textColor={c.text}
            selectedTextColor={chipSelectedText}
          />
        ))}
      </ScrollView>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={{ color: '#ff6b6b' }}>{(error as Error).message}</Text>
        </View>
      )}

      {!isLoading && !error && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: border }]} />
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.rowMeta, { color: muted }]} numberOfLines={1}>
                  {[
                    item.muscle_group ? capitalize(item.muscle_group) : null,
                    item.equipment ? capitalize(item.equipment) : null,
                    !item.is_system ? 'Custom' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ color: muted, textAlign: 'center' }}>
                {search.trim().length > 0
                  ? `No matches for "${search.trim()}". Tap + to add as custom.`
                  : 'No exercises yet.'}
              </Text>
            </View>
          }
        />
      )}

      <AddExerciseModal
        visible={addOpen}
        prefillName={search.trim()}
        onClose={() => setAddOpen(false)}
        onCreated={(ex) => {
          setAddOpen(false);
          setSearch('');
          onSelect(ex);
        }}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  bg,
  selectedBg,
  textColor,
  selectedTextColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  bg: string;
  selectedBg: string;
  textColor: string;
  selectedTextColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? selectedBg : bg,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text
        style={{
          color: selected ? selectedTextColor : textColor,
          fontWeight: selected ? '600' : '500',
          fontSize: 13,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 15 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTitle: { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  rowMeta: { fontSize: 13 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyWrap: { padding: 32 },
});
