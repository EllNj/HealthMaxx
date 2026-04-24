import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/useAuth';
import {
  useDeleteFoodEntry,
  useDayTotals,
  useLogFood,
  useTodayEntries,
  type FoodEntry,
} from '@/src/features/food/useFoodEntries';
import { useSavedMeals, useDeleteSavedMeal, type SavedMeal } from '@/src/features/food/useSavedMeals';
import { useWeeklyNutrition } from '@/src/features/food/useWeeklyNutrition';

// Hardcoded goals from user profile
const GOALS = { calories: 3000, protein_g: 200, carbs_g: 340, fat_g: 90 };

const RING_SIZE = 160;
const STROKE = 14;
const R = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function FoodScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: entries, isLoading } = useTodayEntries(userId);
  const totals = useDayTotals(entries);
  const deleteEntry = useDeleteFoodEntry();
  const { data: savedMeals } = useSavedMeals(userId);
  const deleteSavedMeal = useDeleteSavedMeal();
  const logFood = useLogFood();
  const { data: weeklyNutrition } = useWeeklyNutrition(userId);

  const calPct = Math.min(totals.calories / GOALS.calories, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - calPct);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  const maxCal = useMemo(() => {
    return Math.max(...(weeklyNutrition ?? []).map((d) => d.calories), GOALS.calories);
  }, [weeklyNutrition]);

  const onDelete = (entry: FoodEntry) => {
    Alert.alert('Delete entry?', entry.description ?? 'This food entry', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteEntry.mutate({ id: entry.id, userId: entry.user_id }),
      },
    ]);
  };

  const onDeleteSaved = (meal: SavedMeal) => {
    Alert.alert('Remove saved meal?', meal.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteSavedMeal.mutate({ id: meal.id, userId: meal.user_id }),
      },
    ]);
  };

  const onRelogSaved = async (meal: SavedMeal) => {
    if (!userId) return;
    try {
      await logFood.mutateAsync({
        userId,
        description: meal.name,
        inputType: 'text',
        parsed: {
          items: [{ name: meal.name, qty: '1 serving', calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g, fiber_g: meal.fiber_g, sugar_g: meal.sugar_g, saturated_fat_g: meal.saturated_fat_g, sodium_mg: meal.sodium_mg }],
          total: { calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g, fiber_g: meal.fiber_g, sugar_g: meal.sugar_g, saturated_fat_g: meal.saturated_fat_g, sodium_mg: meal.sodium_mg },
          confidence: 1,
          notes: 'Re-logged from saved meal',
        },
      });
    } catch (e: any) {
      Alert.alert('Could not log', e.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>Food</Text>
          <Text style={[styles.dateLabel, { color: muted }]}>{todayLabel}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/food/capture' as Href)}
          style={({ pressed }) => [
            styles.logBtn,
            { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Ionicons name="add" size={20} color={onTint} />
          <Text style={[styles.logBtnText, { color: onTint }]}>Log food</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Calorie ring */}
        <View style={styles.ringSection}>
          <View style={styles.ringWrapper}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} stroke={border} strokeWidth={STROKE} fill="none" />
              <Circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                stroke={c.tint} strokeWidth={STROKE} fill="none"
                strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={[styles.ringCal, { color: c.text }]}>{Math.round(totals.calories)}</Text>
              <Text style={[styles.ringLabel, { color: muted }]}>/ {GOALS.calories} kcal</Text>
            </View>
          </View>

          {/* Macro bars */}
          <View style={styles.macroPanel}>
            <MacroBar label="Protein" value={totals.protein_g} goal={GOALS.protein_g} color="#4CAF50" muted={muted} textColor={c.text} />
            <MacroBar label="Carbs" value={totals.carbs_g} goal={GOALS.carbs_g} color="#2196F3" muted={muted} textColor={c.text} />
            <MacroBar label="Fat" value={totals.fat_g} goal={GOALS.fat_g} color="#FF9800" muted={muted} textColor={c.text} />
          </View>
        </View>

        {/* Remaining stats */}
        <View style={[styles.remainRow, { backgroundColor: cardBg, borderColor: border }]}>
          <RemainStat label="Remaining" value={Math.max(0, GOALS.calories - Math.round(totals.calories))} unit="kcal" textColor={c.text} muted={muted} />
          <RemainStat label="Protein left" value={Math.max(0, Math.round(GOALS.protein_g - totals.protein_g))} unit="g" textColor={c.text} muted={muted} />
          <RemainStat label="Entries" value={(entries ?? []).length} unit="" textColor={c.text} muted={muted} />
        </View>

        {/* Micronutrient row */}
        {(totals.fiber_g > 0 || totals.sodium_mg > 0) && (
          <View style={[styles.microRow, { backgroundColor: cardBg, borderColor: border }]}>
            {totals.fiber_g > 0 && (
              <MicroStat label="Fibre" value={`${Math.round(totals.fiber_g)}g`} textColor={c.text} muted={muted} />
            )}
            {totals.sugar_g > 0 && (
              <MicroStat label="Sugar" value={`${Math.round(totals.sugar_g)}g`} textColor={c.text} muted={muted} />
            )}
            {totals.saturated_fat_g > 0 && (
              <MicroStat label="Sat. fat" value={`${Math.round(totals.saturated_fat_g)}g`} textColor={c.text} muted={muted} />
            )}
            {totals.sodium_mg > 0 && (
              <MicroStat label="Sodium" value={`${Math.round(totals.sodium_mg)}mg`} textColor={c.text} muted={muted} />
            )}
          </View>
        )}

        {/* Weekly calorie trend */}
        {weeklyNutrition && weeklyNutrition.some((d) => d.calories > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: muted }]}>This week</Text>
            <View style={[styles.trendCard, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={styles.trendChart}>
                {weeklyNutrition.map((d, i) => {
                  const pct = d.calories / maxCal;
                  const isToday = d.label === 'Today';
                  const atGoal = d.calories >= GOALS.calories * 0.9;
                  const color = isToday ? c.tint : atGoal ? '#4CAF50' : (scheme === 'dark' ? '#3a3d42' : '#d0d4d8');
                  return (
                    <View key={i} style={styles.trendCol}>
                      <View style={styles.trendBarOuter}>
                        {d.calories > 0 && (
                          <View style={[styles.trendBarInner, { height: Math.max(pct * 56, 4), backgroundColor: color }]} />
                        )}
                      </View>
                      <Text style={[styles.trendLabel, { color: isToday ? c.tint : muted }]}>
                        {d.label.slice(0, 3)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.trendGoalLine, { color: muted }]}>Goal: {GOALS.calories.toLocaleString()} kcal · Green = on target</Text>
            </View>
          </View>
        )}

        {/* Saved meals */}
        {savedMeals && savedMeals.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: muted }]}>Saved meals</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
              {savedMeals.map((meal) => (
                <View key={meal.id} style={[styles.savedCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <Text style={[styles.savedName, { color: c.text }]} numberOfLines={2}>{meal.name}</Text>
                  <Text style={[styles.savedCal, { color: muted }]}>{meal.calories} kcal</Text>
                  <Text style={[styles.savedMacros, { color: muted }]}>
                    {Math.round(meal.protein_g)}P · {Math.round(meal.carbs_g)}C · {Math.round(meal.fat_g)}F
                  </Text>
                  <View style={styles.savedActions}>
                    <Pressable
                      onPress={() => onRelogSaved(meal)}
                      disabled={logFood.isPending}
                      style={({ pressed }) => [
                        styles.savedLogBtn,
                        { backgroundColor: c.tint, opacity: pressed || logFood.isPending ? 0.7 : 1 },
                      ]}>
                      <Text style={[styles.savedLogBtnText, { color: onTint }]}>Log</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteSaved(meal)} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                      <Ionicons name="trash-outline" size={16} color={muted} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Entry list */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: muted }]}>Today's entries</Text>

          {isLoading && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={c.tint} />
            </View>
          )}

          {!isLoading && (entries ?? []).length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={{ color: muted, textAlign: 'center' }}>
                Nothing logged yet today. Tap{' '}
                <Text style={{ fontWeight: '600', color: c.text }}>Log food</Text> to get started.
              </Text>
            </View>
          )}

          {(entries ?? []).map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              cardBg={cardBg}
              border={border}
              textColor={c.text}
              muted={muted}
              tint={c.tint}
              onDelete={() => onDelete(entry)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MacroBar({ label, value, goal, color, muted, textColor }: {
  label: string; value: number; goal: number; color: string; muted: string; textColor: string;
}) {
  const pct = Math.min(value / goal, 1);
  return (
    <View style={macroStyles.row}>
      <Text style={[macroStyles.label, { color: muted }]}>{label}</Text>
      <View style={[macroStyles.track, { backgroundColor: muted + '33' }]}>
        <View style={[macroStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[macroStyles.value, { color: textColor }]}>
        {Math.round(value)}<Text style={{ color: muted }}>/{goal}g</Text>
      </Text>
    </View>
  );
}

function RemainStat({ label, value, unit, textColor, muted }: {
  label: string; value: number; unit: string; textColor: string; muted: string;
}) {
  return (
    <View style={remainStyles.stat}>
      <Text style={[remainStyles.value, { color: textColor }]}>
        {value.toLocaleString()}{unit ? ` ${unit}` : ''}
      </Text>
      <Text style={[remainStyles.label, { color: muted }]}>{label}</Text>
    </View>
  );
}

function MicroStat({ label, value, textColor, muted }: {
  label: string; value: string; textColor: string; muted: string;
}) {
  return (
    <View style={remainStyles.stat}>
      <Text style={[{ fontSize: 14, fontWeight: '600', color: textColor }]}>{value}</Text>
      <Text style={[remainStyles.label, { color: muted }]}>{label}</Text>
    </View>
  );
}

function EntryCard({ entry, cardBg, border, textColor, muted, tint, onDelete }: {
  entry: FoodEntry; cardBg: string; border: string; textColor: string; muted: string; tint: string; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMicro = entry.fiber_g != null || entry.sugar_g != null || entry.saturated_fat_g != null || entry.sodium_mg != null;
  const time = new Date(entry.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[entryStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <Pressable style={{ flex: 1 }} onPress={hasMicro ? () => setExpanded((v) => !v) : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[entryStyles.desc, { color: textColor }]} numberOfLines={2}>
              {entry.description}
            </Text>
            <Text style={[entryStyles.macros, { color: muted }]}>
              {entry.calories} kcal · {Math.round(entry.protein_g)}P · {Math.round(entry.carbs_g)}C · {Math.round(entry.fat_g)}F
            </Text>
            {expanded && hasMicro && (
              <Text style={[entryStyles.micro, { color: muted }]}>
                {[
                  entry.fiber_g != null && `Fibre ${Math.round(entry.fiber_g)}g`,
                  entry.sugar_g != null && `Sugar ${Math.round(entry.sugar_g)}g`,
                  entry.saturated_fat_g != null && `Sat. fat ${Math.round(entry.saturated_fat_g)}g`,
                  entry.sodium_mg != null && `Sodium ${Math.round(entry.sodium_mg)}mg`,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[entryStyles.time, { color: muted }]}>{time}</Text>
              {hasMicro && (
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={muted} />
              )}
            </View>
          </View>
          <Pressable onPress={onDelete} hitSlop={8} style={entryStyles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={muted} />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 32, fontWeight: '700' },
  dateLabel: { fontSize: 13, marginTop: 2 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  logBtnText: { fontSize: 14, fontWeight: '700' },
  ringSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  ringWrapper: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringCal: { fontSize: 26, fontWeight: '800' },
  ringLabel: { fontSize: 12 },
  macroPanel: { flex: 1, gap: 10 },
  remainRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  microRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  section: { paddingHorizontal: 16, marginBottom: 4 },
  sectionHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 20 },
  // Trends
  trendCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
  trendChart: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 4 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 72 },
  trendBarOuter: { width: '100%', height: 56, justifyContent: 'flex-end' },
  trendBarInner: { width: '100%', borderRadius: 3 },
  trendLabel: { fontSize: 9, fontWeight: '600', marginTop: 4 },
  trendGoalLine: { fontSize: 11, marginTop: 8 },
  // Saved meals
  savedRow: { paddingBottom: 4, gap: 10 },
  savedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    width: 140,
  },
  savedName: { fontSize: 13, fontWeight: '600', marginBottom: 4, lineHeight: 18 },
  savedCal: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  savedMacros: { fontSize: 11, marginBottom: 10 },
  savedActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedLogBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  savedLogBtnText: { fontSize: 13, fontWeight: '700' },
});

const macroStyles = StyleSheet.create({
  row: { gap: 4 },
  label: { fontSize: 11, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  value: { fontSize: 12, fontWeight: '600' },
});

const remainStyles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center' },
  value: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 11, marginTop: 2 },
});

const entryStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  desc: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  macros: { fontSize: 13, marginBottom: 2 },
  micro: { fontSize: 12, marginBottom: 2, fontStyle: 'italic' },
  time: { fontSize: 11 },
  deleteBtn: { padding: 4, marginLeft: 8 },
});
