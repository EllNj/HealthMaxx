import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import {
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
import { useTodayEntries, useDayTotals } from '@/src/features/food/useFoodEntries';
import { useSessionHistory, useWeeklyVolume } from '@/src/features/workouts/useSessions';
import { supabase } from '@/src/lib/supabase';

const GOALS = { calories: 3000, protein_g: 200, carbs_g: 340, fat_g: 90 };
const RING_SIZE = 160;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function DashboardScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: foodEntries } = useTodayEntries(userId);
  const totals = useDayTotals(foodEntries);
  const { data: history } = useSessionHistory(userId, 1);
  const { data: weeklyVolume } = useWeeklyVolume(userId);

  const lastSession = history?.[0] ?? null;

  const caloriePct = Math.min(totals.calories / GOALS.calories, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - caloriePct);

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  const lastSessionDate = useMemo(() => {
    if (!lastSession?.started_at) return '';
    const d = new Date(lastSession.started_at);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }, [lastSession]);

  const maxVolume = useMemo(
    () => Math.max(...(weeklyVolume ?? []).map((d) => d.volume), 1),
    [weeklyVolume]
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>HealthMaxx</Text>
          <Text style={[styles.dateText, { color: muted }]}>{dateLabel}</Text>
        </View>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Ionicons name="log-out-outline" size={22} color={muted} />
        </Pressable>
      </View>

      {/* Calories + Macros */}
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: muted }]}>Today's Nutrition</Text>
        <View style={[styles.nutritionCard, { backgroundColor: cardBg, borderColor: border }]}>
          {/* Calorie ring */}
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Track */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={border}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              {/* Progress */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={c.tint}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={[styles.ringCalories, { color: c.text }]}>
                {totals.calories.toLocaleString()}
              </Text>
              <Text style={[styles.ringLabel, { color: muted }]}>kcal</Text>
              <Text style={[styles.ringRemaining, { color: muted }]}>
                {Math.max(0, GOALS.calories - totals.calories).toLocaleString()} left
              </Text>
            </View>
          </View>

          {/* Macro bars */}
          <View style={styles.macros}>
            <MacroBar label="Protein" value={totals.protein_g} goal={GOALS.protein_g} color="#4CAF82" muted={muted} textColor={c.text} />
            <MacroBar label="Carbs" value={totals.carbs_g} goal={GOALS.carbs_g} color="#F5A623" muted={muted} textColor={c.text} />
            <MacroBar label="Fat" value={totals.fat_g} goal={GOALS.fat_g} color="#E74C3C" muted={muted} textColor={c.text} />
            <Pressable
              onPress={() => router.push('/(tabs)/food' as Href)}
              style={({ pressed }) => [
                styles.logFoodBtn,
                { backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="add" size={14} color={onTint} />
              <Text style={[styles.logFoodBtnText, { color: onTint }]}>Log food</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Last workout */}
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: muted }]}>Last Workout</Text>
        {lastSession ? (
          <Pressable
            onPress={() => router.push(`/workout/session/${lastSession.id}` as Href)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                {lastSession.name ?? 'Workout'}
              </Text>
              <Text style={[styles.cardMeta, { color: muted }]}>
                {lastSessionDate}
                {`  ·  ${lastSession.exercise_count} ex  ·  ${lastSession.set_count} sets`}
                {lastSession.total_volume_kg > 0
                  ? `  ·  ${Math.round(lastSession.total_volume_kg).toLocaleString()} kg`
                  : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/(tabs)/workouts' as Href)}
            style={({ pressed }) => [
              styles.emptyCard,
              { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={[styles.emptyText, { color: muted }]}>
              No workouts logged yet.{' '}
              <Text style={{ fontWeight: '600', color: c.text }}>Start one →</Text>
            </Text>
          </Pressable>
        )}
      </View>

      {/* Weekly volume chart */}
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: muted }]}>Weekly Volume</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {weeklyVolume && weeklyVolume.some((d) => d.volume > 0) ? (
            <View style={styles.barChart}>
              {weeklyVolume.map((d, i) => {
                const pct = d.volume / maxVolume;
                const isToday = d.label === 'Today';
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barOuter}>
                      <View
                        style={[
                          styles.barInner,
                          {
                            height: Math.max(pct * 80, d.volume > 0 ? 4 : 0),
                            backgroundColor: isToday ? c.tint : scheme === 'dark' ? '#3a3d42' : '#d0d4d8',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: isToday ? c.tint : muted }]}>
                      {d.label.slice(0, 3)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: muted }]}>
              Log workouts this week to see your volume chart.
            </Text>
          )}
        </View>
      </View>

      {/* Apple Health placeholder */}
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: muted }]}>Apple Health</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.healthIcon, { backgroundColor: scheme === 'dark' ? '#2d1f2a' : '#fce8f3' }]}>
              <Ionicons name="heart" size={20} color="#E91E8C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]}>Apple Health</Text>
              <Text style={[styles.cardMeta, { color: muted }]}>
                Steps, heart rate, VO2 max — requires native build (Step 6)
              </Text>
            </View>
            <Ionicons name="lock-closed-outline" size={16} color={muted} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
  muted,
  textColor,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  muted: string;
  textColor: string;
}) {
  const pct = Math.min(value / goal, 1);
  return (
    <View style={styles.macroRow}>
      <Text style={[styles.macroLabel, { color: muted }]}>{label}</Text>
      <View style={styles.macroBarOuter}>
        <View style={[styles.macroBarInner, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.macroValue, { color: textColor }]}>
        {Math.round(value)}
        <Text style={{ color: muted }}>/{goal}g</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 32, fontWeight: '700' },
  dateText: { fontSize: 13, marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  nutritionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringCalories: { fontSize: 22, fontWeight: '700' },
  ringLabel: { fontSize: 11, marginTop: -2 },
  ringRemaining: { fontSize: 10, marginTop: 2 },
  macros: { flex: 1, gap: 8 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroLabel: { width: 46, fontSize: 11, fontWeight: '600' },
  macroBarOuter: { flex: 1, height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
  macroBarInner: { height: 6, borderRadius: 3 },
  macroValue: { width: 64, fontSize: 11, textAlign: 'right' },
  logFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
    marginTop: 4,
  },
  logFoodBtnText: { fontSize: 13, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  cardMeta: { fontSize: 12 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  emptyText: { fontSize: 14, lineHeight: 20 },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 104,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 104,
  },
  barOuter: {
    width: '100%',
    height: 80,
    justifyContent: 'flex-end',
  },
  barInner: {
    width: '100%',
    borderRadius: 3,
    minHeight: 0,
  },
  barLabel: { fontSize: 9, fontWeight: '600', marginTop: 4 },
  healthIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
