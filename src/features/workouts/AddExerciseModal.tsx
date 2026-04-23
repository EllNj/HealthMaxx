import { useEffect, useState } from 'react';
import {
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

import { Colors } from '@/constants/theme';
import { useAuth } from '@/src/features/auth/useAuth';
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  type DisplayUnit,
  type Equipment,
  type Exercise,
  type MuscleGroup,
} from './types';
import { useCreateExercise } from './useExercises';

type Props = {
  visible: boolean;
  prefillName?: string;
  onClose: () => void;
  onCreated: (ex: Exercise) => void;
};

export function AddExerciseModal({ visible, prefillName, onClose, onCreated }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const chipBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const chipSelectedText = scheme === 'dark' ? '#000' : '#fff';

  const { session } = useAuth();
  const createExercise = useCreateExercise();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [unit, setUnit] = useState<DisplayUnit>('kg');

  useEffect(() => {
    if (visible) {
      setName(prefillName ?? '');
      setMuscle(null);
      setEquipment(null);
      setUnit('kg');
    }
  }, [visible, prefillName]);

  const canSave =
    name.trim().length > 0 && muscle !== null && equipment !== null && !!session?.user.id;

  const onSave = async () => {
    if (!canSave || !session) return;
    try {
      const ex = await createExercise.mutateAsync({
        name: name.trim(),
        muscle_group: muscle!,
        equipment: equipment!,
        display_unit: unit,
        user_id: session.user.id,
      });
      onCreated(ex);
    } catch (e: any) {
      Alert.alert('Could not add exercise', e.message ?? String(e));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: c.tint, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]}>Add exercise</Text>
          <Pressable onPress={onSave} disabled={!canSave || createExercise.isPending} hitSlop={10}>
            <Text
              style={{
                color: canSave && !createExercise.isPending ? c.tint : muted,
                fontSize: 16,
                fontWeight: '600',
              }}>
              {createExercise.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Label text="Name" color={muted} />
          <TextInput
            style={[
              styles.input,
              { color: c.text, backgroundColor: chipBg, borderColor: border },
            ]}
            placeholder="e.g. Chest Press (Machine)"
            placeholderTextColor={muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Label text="Muscle group" color={muted} />
          <View style={styles.chipGrid}>
            {MUSCLE_GROUPS.map((g) => (
              <SelectChip
                key={g}
                label={capitalize(g)}
                selected={muscle === g}
                onPress={() => setMuscle(g)}
                bg={chipBg}
                selectedBg={c.tint}
                textColor={c.text}
                selectedTextColor={chipSelectedText}
              />
            ))}
          </View>

          <Label text="Equipment" color={muted} />
          <View style={styles.chipGrid}>
            {EQUIPMENT.map((e) => (
              <SelectChip
                key={e}
                label={capitalize(e)}
                selected={equipment === e}
                onPress={() => setEquipment(e)}
                bg={chipBg}
                selectedBg={c.tint}
                textColor={c.text}
                selectedTextColor={chipSelectedText}
              />
            ))}
          </View>

          <Label text="Display unit" color={muted} />
          <View style={styles.chipGrid}>
            {(['kg', 'lbs'] as DisplayUnit[]).map((u) => (
              <SelectChip
                key={u}
                label={u}
                selected={unit === u}
                onPress={() => setUnit(u)}
                bg={chipBg}
                selectedBg={c.tint}
                textColor={c.text}
                selectedTextColor={chipSelectedText}
              />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Label({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.label, { color }]}>{text}</Text>;
}

function SelectChip({
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  body: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
});
