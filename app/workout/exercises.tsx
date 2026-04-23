import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ExercisePicker } from '@/src/features/workouts/ExercisePicker';

export default function ExercisesScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Exercises</Text>
      </View>
      <ExercisePicker
        onSelect={(ex) =>
          Alert.alert(ex.name, `${ex.muscle_group ?? '—'} · ${ex.equipment ?? '—'}`)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 4,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 24, fontWeight: '700' },
});
