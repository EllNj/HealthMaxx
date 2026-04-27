import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';

import { Colors } from '@/constants/theme';
import { askCoach } from '@/src/lib/coach';
import type { NutritionGoals } from '@/src/features/profile/useProfile';
import { useRecentFoodEntries } from './useFoodEntries';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
  goals: NutritionGoals;
  scheme: 'light' | 'dark';
};

function buildPrompt(
  goals: NutritionGoals,
  recentFoods: { description: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number }[],
  todayFoods: { description: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number }[],
  customNote: string,
): string {
  const goalLine = `My daily nutrition goals: ${goals.calorie_goal} kcal · ${goals.protein_goal_g}g protein · ${goals.carbs_goal_g}g carbs · ${goals.fat_goal_g}g fat.`;

  const todayTotal = todayFoods.reduce(
    (a, e) => ({ cal: a.cal + e.calories, p: a.p + e.protein_g }),
    { cal: 0, p: 0 },
  );

  const todaySection =
    todayFoods.length > 0
      ? `So far today I've had:\n${todayFoods
          .map((e) => `- ${e.description ?? 'Unknown'} (${e.calories} kcal, ${Math.round(e.protein_g)}g P)`)
          .join('\n')}\nToday's running total: ${Math.round(todayTotal.cal)} kcal, ${Math.round(todayTotal.p)}g protein.`
      : "I haven't eaten anything today yet.";

  // Deduplicate recent foods by description, summing occurrences
  const freq = new Map<string, { count: number; avgCal: number; avgP: number }>();
  for (const e of recentFoods) {
    const key = (e.description ?? 'Unknown').toLowerCase().trim();
    const existing = freq.get(key);
    if (existing) {
      existing.count++;
      existing.avgCal = (existing.avgCal * (existing.count - 1) + e.calories) / existing.count;
      existing.avgP = (existing.avgP * (existing.count - 1) + e.protein_g) / existing.count;
    } else {
      freq.set(key, { count: 1, avgCal: e.calories, avgP: e.protein_g });
    }
  }
  const topFoods = [...freq.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([name, v]) => `- ${name} (~${Math.round(v.avgCal)} kcal, ~${Math.round(v.avgP)}g P)${v.count > 1 ? ` ×${v.count}` : ''}`)
    .join('\n');

  const historySection =
    topFoods.length > 0
      ? `Foods I commonly eat (last 14 days, most frequent first):\n${topFoods}`
      : 'I have limited food history logged so far.';

  const request = customNote.trim()
    ? customNote.trim()
    : 'Based on my goals and what I normally eat, suggest meals for the rest of today and tomorrow. Include rough macros for each meal and make sure the day hits my targets.';

  return `${goalLine}\n\n${todaySection}\n\n${historySection}\n\n${request}`;
}

export function MealPlannerSheet({ visible, onClose, userId, goals, scheme }: Props) {
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const bg = scheme === 'dark' ? '#1f2224' : '#ffffff';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const [note, setNote] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: recentEntries } = useRecentFoodEntries(userId, 14);

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = (recentEntries ?? []).filter((e) => e.logged_for_date === today);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const prompt = buildPrompt(goals, recentEntries ?? [], todayEntries, note);
      const result = await askCoach([{ role: 'user', content: prompt }]);
      setReply(result);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onDismiss = () => {
    setNote('');
    setReply(null);
    setError(null);
    onClose();
  };

  const markdownStyles = {
    body: { color: c.text, fontSize: 14, lineHeight: 21 },
    strong: { fontWeight: '700' as const },
    paragraph: { marginVertical: 2 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    heading2: { color: c.text, fontSize: 15, fontWeight: '700' as const, marginVertical: 6 },
    heading3: { color: c.text, fontSize: 14, fontWeight: '600' as const, marginVertical: 4 },
    code_inline: { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, paddingHorizontal: 4 },
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onDismiss} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: bg, borderTopColor: border, paddingBottom: insets.bottom + 16 },
          ]}>
          <View style={[styles.handle, { backgroundColor: muted }]} />

          <View style={styles.titleRow}>
            <Ionicons name="restaurant-outline" size={18} color={c.tint} />
            <Text style={[styles.title, { color: c.text }]}>Meal planner</Text>
            <Pressable onPress={onDismiss} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Ionicons name="close" size={20} color={muted} />
            </Pressable>
          </View>

          {!reply && (
            <>
              <Text style={[styles.hint, { color: muted }]}>
                Leave blank for a general plan, or add a specific request.
              </Text>
              <TextInput
                style={[styles.noteInput, { borderColor: border, color: c.text }]}
                placeholder="e.g. high-protein lunch, no dairy, meal prep for 3 days…"
                placeholderTextColor={muted}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={200}
              />
            </>
          )}

          {error && (
            <Text style={[styles.error, { color: '#ef4444' }]}>{error}</Text>
          )}

          {reply && (
            <ScrollView style={styles.replyScroll} showsVerticalScrollIndicator={false}>
              <Markdown style={markdownStyles}>{reply}</Markdown>
            </ScrollView>
          )}

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.tint} />
              <Text style={[styles.loadingText, { color: muted }]}>Thinking…</Text>
            </View>
          )}

          <View style={styles.btnRow}>
            {reply && (
              <Pressable
                onPress={() => { setReply(null); setNote(''); }}
                style={({ pressed }) => [
                  styles.resetBtn,
                  { borderColor: border, opacity: pressed ? 0.6 : 1 },
                ]}>
                <Text style={[styles.resetText, { color: c.text }]}>New plan</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onGenerate}
              disabled={loading}
              style={({ pressed }) => [
                styles.generateBtn,
                { backgroundColor: c.tint, opacity: pressed || loading ? 0.7 : 1, flex: reply ? 0 : 1 },
              ]}>
              <Ionicons name="sparkles" size={16} color={onTint} />
              <Text style={[styles.generateText, { color: onTint }]}>
                {reply ? 'Regenerate' : 'Generate plan'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
    opacity: 0.4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '700', flex: 1 },
  hint: { fontSize: 13, marginBottom: 10 },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  replyScroll: { marginBottom: 14, maxHeight: 360 },
  error: { fontSize: 13, marginBottom: 10 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  loadingText: { fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 10 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  generateText: { fontSize: 15, fontWeight: '700' },
  resetBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { fontSize: 15, fontWeight: '600' },
});
