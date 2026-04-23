import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line as SvgLine, Polyline, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/useAuth';
import { useExerciseProgress } from '@/src/features/workouts/useExerciseProgress';
import { formatWeight } from '@/src/utils/units';

type ChartMetric = 'weight' | 'est1rm' | 'volume';

const METRICS: { key: ChartMetric; label: string }[] = [
  { key: 'weight', label: 'Max weight' },
  { key: 'est1rm', label: 'Est. 1RM' },
  { key: 'volume', label: 'Volume (kg)' },
];

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string; name?: string }>();
  const name = useLocalSearchParams<{ name?: string }>().name ?? 'Exercise';
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const { data, isLoading } = useExerciseProgress(id, session?.user.id);

  const [metric, setMetric] = useState<ChartMetric>('est1rm');

  const chartData = useMemo(() => {
    if (!data?.points.length) return [];
    return data.points.map((p, i) => ({
      x: i,
      y:
        metric === 'weight'
          ? p.maxWeightKg
          : metric === 'est1rm'
          ? p.est1rmKg
          : p.totalVolume,
      date: p.date,
    }));
  }, [data, metric]);

  const yLabel = metric === 'volume' ? 'kg·reps' : 'kg';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>
          {decodeURIComponent(name)}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={c.tint} />
        </View>
      )}

      {data && !isLoading && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* PR card */}
          {data.pr && (
            <View style={[styles.prCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.sectionLabel, { color: muted }]}>Personal Records</Text>
              <View style={styles.prRow}>
                <PRStat label="Max weight" value={formatWeight(data.pr.maxWeightKg, 'kg')} tint={c.tint} onTint={onTint} />
                <PRStat label="Est. 1RM" value={formatWeight(data.pr.maxEst1rmKg, 'kg')} tint={c.tint} onTint={onTint} />
                <PRStat label="Max reps" value={String(data.pr.maxReps)} tint={c.tint} onTint={onTint} />
              </View>
            </View>
          )}

          {/* Metric selector */}
          <View style={styles.metricRow}>
            {METRICS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMetric(m.key)}
                style={[
                  styles.metricBtn,
                  {
                    backgroundColor: metric === m.key ? c.tint : cardBg,
                    borderColor: metric === m.key ? c.tint : border,
                  },
                ]}>
                <Text
                  style={[
                    styles.metricBtnText,
                    { color: metric === m.key ? onTint : muted },
                  ]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Chart */}
          {chartData.length >= 2 ? (
            <View style={[styles.chartCard, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[styles.chartTitle, { color: c.text }]}>
                {METRICS.find((m) => m.key === metric)?.label} over time
              </Text>
              <LineChart data={chartData} tint={c.tint} muted={muted} border={border} />
              <Text style={[styles.chartUnits, { color: muted }]}>{yLabel}</Text>
            </View>
          ) : chartData.length === 1 ? (
            <View style={[styles.emptyChart, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={{ color: muted, textAlign: 'center' }}>
                Log at least 2 sessions to see the chart.
              </Text>
            </View>
          ) : null}

          {/* Session history table */}
          {data.points.length > 0 && (
            <View style={[styles.tableCard, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={[styles.tableHeader, { borderBottomColor: border }]}>
                <Text style={[styles.hCell, styles.hDate, { color: muted }]}>DATE</Text>
                <Text style={[styles.hCell, styles.hVal, { color: muted }]}>MAX</Text>
                <Text style={[styles.hCell, styles.hVal, { color: muted }]}>EST 1RM</Text>
                <Text style={[styles.hCell, styles.hVal, { color: muted }]}>SETS</Text>
              </View>
              {[...data.points].reverse().map((p) => (
                <View key={p.date} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <Text style={[styles.dateCell, { color: muted }]}>
                    {new Date(p.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={[styles.valCell, { color: c.text }]}>
                    {formatWeight(p.maxWeightKg, 'kg')}
                  </Text>
                  <Text style={[styles.valCell, { color: c.text }]}>
                    {formatWeight(p.est1rmKg, 'kg')}
                  </Text>
                  <Text style={[styles.valCell, { color: c.text }]}>{p.setCount}</Text>
                </View>
              ))}
            </View>
          )}

          {data.points.length === 0 && (
            <View style={[styles.emptyChart, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={{ color: muted, textAlign: 'center' }}>
                No completed sets logged for this exercise yet.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const CHART_W = 320;
const CHART_H = 180;
const PAD = { top: 12, bottom: 28, left: 48, right: 8 };
const Y_TICKS = 4;

function LineChart({
  data,
  tint,
  muted,
  border,
}: {
  data: { x: number; y: number; date: string }[];
  tint: string;
  muted: string;
  border: string;
}) {
  const rawMin = Math.min(...data.map((d) => d.y));
  const rawMax = Math.max(...data.map((d) => d.y));
  // Give a little headroom so the line doesn't hug the edges
  const padding = (rawMax - rawMin) * 0.15 || rawMax * 0.1 || 5;
  const minY = Math.max(0, rawMin - padding);
  const maxY = rawMax + padding;
  const rangeY = maxY - minY || 1;

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * plotW;
  const toY = (v: number) => PAD.top + plotH - ((v - minY) / rangeY) * plotH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.y)}`).join(' ');

  // Y tick values
  const yTicks = Array.from({ length: Y_TICKS }, (_, i) =>
    minY + (rangeY / (Y_TICKS - 1)) * i
  );

  // X label indices (up to 4 evenly spaced)
  const labelIndices =
    data.length <= 4
      ? data.map((_, i) => i)
      : [0, Math.floor((data.length - 1) / 3), Math.floor((2 * (data.length - 1)) / 3), data.length - 1];

  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      {/* Y grid lines + labels */}
      {yTicks.map((v, i) => {
        const y = toY(v);
        return (
          <React.Fragment key={i}>
            <SvgLine
              x1={PAD.left}
              y1={y}
              x2={CHART_W - PAD.right}
              y2={y}
              stroke={border}
              strokeWidth={0.8}
              strokeDasharray={i === 0 ? undefined : '3 3'}
            />
            <SvgText
              x={PAD.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill={muted}>
              {Math.round(v)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Line */}
      <Polyline
        points={points}
        fill="none"
        stroke={tint}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {data.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.y)} r={3.5} fill={tint} />
      ))}

      {/* X labels */}
      {labelIndices.map((i) => {
        const d = new Date(data[i].date);
        return (
          <SvgText
            key={i}
            x={toX(i)}
            y={CHART_H - 4}
            textAnchor="middle"
            fontSize={10}
            fill={muted}>
            {`${d.getDate()}/${d.getMonth() + 1}`}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function PRStat({ label, value, tint, onTint }: { label: string; value: string; tint: string; onTint: string }) {
  return (
    <View style={prStyles.stat}>
      <Text style={[prStyles.value, { color: tint }]}>{value}</Text>
      <Text style={[prStyles.label, { color: '#888' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 8, minWidth: 48, alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  prCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  prRow: { flexDirection: 'row', gap: 8 },
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  metricBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  metricBtnText: { fontSize: 13, fontWeight: '600' },
  chartCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14 },
  chartTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  chartUnits: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  emptyChart: { borderWidth: 1, borderRadius: 12, padding: 24, marginBottom: 14 },
  tableCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  hCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  hDate: { width: 60 },
  hVal: { flex: 1, textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dateCell: { width: 60, fontSize: 13 },
  valCell: { flex: 1, textAlign: 'center', fontSize: 14 },
});

const prStyles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center' },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11, marginTop: 2 },
});
