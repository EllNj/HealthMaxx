import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { useAuth } from '@/src/features/auth/useAuth';
import { useLogFood } from '@/src/features/food/useFoodEntries';
import { logFood, type ParsedMeal } from '@/src/lib/gemini';

type InputMode = 'text' | 'photo' | 'barcode';
type Phase = 'input' | 'scanning' | 'parsing' | 'confirm' | 'saving';

async function lookupBarcode(barcode: string): Promise<ParsedMeal> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments,serving_size,brands`
  );
  const data = await res.json();

  if (data.status !== 1 || !data.product) {
    throw new Error(`Barcode ${barcode} not found in Open Food Facts database`);
  }

  const p = data.product;
  const n = p.nutriments ?? {};
  const name = [p.brands, p.product_name].filter(Boolean).join(' ') || 'Unknown product';
  const serving = parseFloat(p.serving_size) || 100;

  // OFF stores per 100g — scale to serving size
  const scale = serving / 100;
  const cal = Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * scale);
  const protein = Math.round(((n.proteins_100g ?? n.proteins ?? 0) * scale) * 10) / 10;
  const carbs = Math.round(((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * scale) * 10) / 10;
  const fat = Math.round(((n.fat_100g ?? n.fat ?? 0) * scale) * 10) / 10;

  return {
    items: [{ name, qty: p.serving_size ?? '100g', calories: cal, protein_g: protein, carbs_g: carbs, fat_g: fat }],
    total: { calories: cal, protein_g: protein, carbs_g: carbs, fat_g: fat },
    confidence: 0.95,
    notes: `From Open Food Facts · serving size: ${p.serving_size ?? '100g'}`,
  };
}

export default function CaptureScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const border = scheme === 'dark' ? '#2a2d30' : '#e3e5e8';
  const muted = scheme === 'dark' ? '#9BA1A6' : '#687076';
  const cardBg = scheme === 'dark' ? '#1f2224' : '#f1f3f5';
  const onTint = scheme === 'dark' ? '#000' : '#fff';
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const logFoodMutation = useLogFood();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [mode, setMode] = useState<InputMode>('text');
  const [phase, setPhase] = useState<Phase>('input');
  const [textInput, setTextInput] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMeal | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const scanLock = useRef(false);

  const [editName, setEditName] = useState('');
  const [editCal, setEditCal] = useState('');
  const [editPro, setEditPro] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');

  const textRef = useRef<TextInput>(null);

  const applyParsed = (result: ParsedMeal, nameOverride?: string) => {
    setParsed(result);
    setEditName(nameOverride ?? (result.items.map((i) => i.name).join(', ') || ''));
    setEditCal(String(Math.round(result.total.calories)));
    setEditPro(String(Math.round(result.total.protein_g * 10) / 10));
    setEditCarbs(String(Math.round(result.total.carbs_g * 10) / 10));
    setEditFat(String(Math.round(result.total.fat_g * 10) / 10));
    setPhase('confirm');
  };

  const onSwitchMode = async (m: InputMode) => {
    if (m === 'barcode' && !cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan barcodes.');
        return;
      }
    }
    scanLock.current = false;
    setScannedCode(null);
    setMode(m);
    setPhase('input');
  };

  const onBarcodeScanned = async ({ data: barcode }: { data: string }) => {
    if (scanLock.current || phase !== 'input') return;
    scanLock.current = true;
    setScannedCode(barcode);
    setPhase('parsing');
    try {
      const result = await lookupBarcode(barcode);
      applyParsed(result);
    } catch (e: any) {
      // Barcode not in OFF — fall back to Gemini with the barcode as description
      try {
        const result = await logFood({ description: `Product barcode: ${barcode}`, useWebSearch: true });
        applyParsed(result);
      } catch (e2: any) {
        Alert.alert('Not found', `Could not find barcode ${barcode}. Try typing the product name instead.`);
        setPhase('input');
        scanLock.current = false;
      }
    }
  };

  const onPickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to pick a food photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const onTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph food.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const onParse = async () => {
    if (mode === 'text' && !textInput.trim()) {
      Alert.alert('Enter food', 'Describe what you ate before parsing.');
      return;
    }
    if (mode === 'photo' && !imageBase64) {
      Alert.alert('No photo', 'Take or pick a photo first.');
      return;
    }
    setPhase('parsing');
    try {
      const result = await logFood({
        description: mode === 'text' ? textInput.trim() : (photoNote.trim() || undefined),
        imageBase64: imageBase64 ?? undefined,
        useWebSearch: mode === 'text',
      });
      applyParsed(result);
    } catch (e: any) {
      Alert.alert('Parse failed', e.message ?? String(e));
      setPhase('input');
    }
  };

  const onConfirm = async () => {
    if (!parsed || !session?.user.id) return;
    const cal = parseInt(editCal, 10);
    const pro = parseFloat(editPro);
    const carbs = parseFloat(editCarbs);
    const fat = parseFloat(editFat);
    if (!Number.isFinite(cal) || !Number.isFinite(pro) || !Number.isFinite(carbs) || !Number.isFinite(fat)) {
      Alert.alert('Invalid values', 'Check all macro fields are numbers.');
      return;
    }
    setPhase('saving');
    try {
      await logFoodMutation.mutateAsync({
        userId: session.user.id,
        description: editName.trim() || 'Food entry',
        inputType: mode === 'barcode' ? 'text' : mode,
        imagePath: null,
        parsed: { ...parsed, total: { calories: cal, protein_g: pro, carbs_g: carbs, fat_g: fat } },
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e.message ?? String(e));
      setPhase('confirm');
    }
  };

  const onBack = () => {
    if (phase === 'confirm') { setPhase('input'); scanLock.current = false; return; }
    router.back();
  };

  const MODES: { key: InputMode; icon: string; label: string }[] = [
    { key: 'text', icon: 'text', label: 'Describe' },
    { key: 'photo', icon: 'camera', label: 'Photo' },
    { key: 'barcode', icon: 'barcode-outline', label: 'Barcode' },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: border }]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name={phase === 'confirm' ? 'arrow-back' : 'close'} size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>
          {phase === 'confirm' ? 'Confirm entry' : 'Log food'}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {/* ── BARCODE SCANNER (full-screen camera) ── */}
      {mode === 'barcode' && phase === 'input' && (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={[styles.scanFrame, { borderColor: c.tint }]} />
            <Text style={[styles.scanHint, { color: '#fff' }]}>Point at a food barcode</Text>
          </View>
          {/* Mode toggle overlaid at bottom */}
          <View style={styles.scanModeRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => onSwitchMode(m.key)}
                style={[
                  styles.modeBtn,
                  { backgroundColor: mode === m.key ? c.tint : 'rgba(0,0,0,0.5)' },
                ]}>
                <Ionicons name={m.icon as any} size={16} color="#fff" />
                <Text style={[styles.modeBtnText, { color: '#fff' }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Parsing spinner over barcode scanner */}
      {mode === 'barcode' && phase === 'parsing' && (
        <View style={styles.parsingOverlay}>
          <ActivityIndicator size="large" color={c.tint} />
          <Text style={[styles.parsingNote, { color: c.text, marginTop: 16 }]}>
            Looking up barcode{scannedCode ? ` ${scannedCode}` : ''}…
          </Text>
        </View>
      )}

      {/* ── TEXT / PHOTO + CONFIRM phases ── */}
      {(mode !== 'barcode' || phase === 'confirm' || phase === 'saving') && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">

          {(phase === 'input' || phase === 'parsing') && (
            <>
              {/* Mode toggle */}
              <View style={[styles.modeRow, { backgroundColor: cardBg, borderColor: border }]}>
                {MODES.map((m) => (
                  <Pressable
                    key={m.key}
                    onPress={() => onSwitchMode(m.key)}
                    style={[
                      styles.modeBtn,
                      { backgroundColor: mode === m.key ? c.tint : 'transparent' },
                    ]}>
                    <Ionicons name={m.icon as any} size={16} color={mode === m.key ? onTint : muted} />
                    <Text style={[styles.modeBtnText, { color: mode === m.key ? onTint : muted }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {mode === 'text' && (
                <TextInput
                  ref={textRef}
                  style={[styles.textArea, { borderColor: border, color: c.text }]}
                  placeholder={'e.g. "2 scrambled eggs, toast, coffee with milk" or "Tesco chicken sandwich"'}
                  placeholderTextColor={muted}
                  value={textInput}
                  onChangeText={setTextInput}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  autoFocus
                />
              )}

              {mode === 'photo' && (
                <View style={styles.photoArea}>
                  {imageUri ? (
                    <Pressable onPress={onTakePhoto}>
                      <Image source={{ uri: imageUri }} style={styles.previewImg} />
                    </Pressable>
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: border }]}>
                      <Ionicons name="image-outline" size={48} color={muted} />
                      <Text style={{ color: muted, marginTop: 8 }}>No photo selected</Text>
                    </View>
                  )}
                  <View style={styles.photoButtons}>
                    <Pressable
                      onPress={onTakePhoto}
                      style={({ pressed }) => [
                        styles.photoBtn,
                        { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <Ionicons name="camera-outline" size={18} color={c.text} />
                      <Text style={[styles.photoBtnText, { color: c.text }]}>Camera</Text>
                    </Pressable>
                    <Pressable
                      onPress={onPickPhoto}
                      style={({ pressed }) => [
                        styles.photoBtn,
                        { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <Ionicons name="images-outline" size={18} color={c.text} />
                      <Text style={[styles.photoBtnText, { color: c.text }]}>Library</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.photoNoteInput, { borderColor: border, color: c.text }]}
                    placeholder="Optional: e.g. '2 servings' or 'large portion'"
                    placeholderTextColor={muted}
                    value={photoNote}
                    onChangeText={setPhotoNote}
                  />
                </View>
              )}

              {mode !== 'barcode' && (
                <Pressable
                  onPress={onParse}
                  disabled={phase === 'parsing'}
                  style={({ pressed }) => [
                    styles.parseBtn,
                    { backgroundColor: c.tint, opacity: pressed || phase === 'parsing' ? 0.7 : 1, marginTop: 16 },
                  ]}>
                  {phase === 'parsing' ? (
                    <ActivityIndicator color={onTint} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={onTint} />
                      <Text style={[styles.parseBtnText, { color: onTint }]}>Parse with AI</Text>
                    </>
                  )}
                </Pressable>
              )}
              {phase === 'parsing' && mode !== 'barcode' && (
                <Text style={[styles.parsingNote, { color: muted }]}>
                  {mode === 'text' ? 'Querying Gemini with web search…' : 'Analysing photo…'}
                </Text>
              )}
            </>
          )}

          {/* ── CONFIRM PHASE ── */}
          {(phase === 'confirm' || phase === 'saving') && parsed && (
            <>
              {imageUri && mode === 'photo' && (
                <Image source={{ uri: imageUri }} style={[styles.confirmImg, { borderColor: border }]} />
              )}

              {parsed.items.length > 0 && (
                <View style={[styles.itemsCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <Text style={[styles.cardLabel, { color: muted }]}>
                    {mode === 'barcode' ? 'Product' : 'Detected items'}
                  </Text>
                  {parsed.items.map((item, i) => (
                    <View key={i} style={[styles.itemRow, { borderBottomColor: border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: c.text }]}>{item.name}</Text>
                        <Text style={[styles.itemQty, { color: muted }]}>{item.qty}</Text>
                      </View>
                      <Text style={[styles.itemCal, { color: muted }]}>{item.calories} kcal</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.macroCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.cardLabel, { color: muted }]}>Name</Text>
                <TextInput
                  style={[styles.nameInput, { borderColor: border, color: c.text }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Meal name"
                  placeholderTextColor={muted}
                  returnKeyType="done"
                />
                <Text style={[styles.cardLabel, { color: muted, marginTop: 12 }]}>Totals (editable)</Text>
                <View style={styles.macroGrid}>
                  <MacroField label="Calories" value={editCal} onChangeText={setEditCal} unit="kcal" tint={c.tint} border={border} textColor={c.text} muted={muted} />
                  <MacroField label="Protein" value={editPro} onChangeText={setEditPro} unit="g" tint={c.tint} border={border} textColor={c.text} muted={muted} />
                  <MacroField label="Carbs" value={editCarbs} onChangeText={setEditCarbs} unit="g" tint={c.tint} border={border} textColor={c.text} muted={muted} />
                  <MacroField label="Fat" value={editFat} onChangeText={setEditFat} unit="g" tint={c.tint} border={border} textColor={c.text} muted={muted} />
                </View>
              </View>

              {parsed.notes ? (
                <Text style={[styles.notes, { color: muted }]}>{parsed.notes}</Text>
              ) : null}

              <View style={styles.confidenceRow}>
                <Text style={[styles.confidenceLabel, { color: muted }]}>
                  {mode === 'barcode' ? 'Open Food Facts' : `AI confidence: ${Math.round(parsed.confidence * 100)}%`}
                </Text>
              </View>

              <Pressable
                onPress={onConfirm}
                disabled={phase === 'saving'}
                style={({ pressed }) => [
                  styles.parseBtn,
                  { backgroundColor: c.tint, opacity: pressed || phase === 'saving' ? 0.7 : 1, marginTop: 8 },
                ]}>
                {phase === 'saving' ? (
                  <ActivityIndicator color={onTint} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={onTint} />
                    <Text style={[styles.parseBtnText, { color: onTint }]}>Log this meal</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function MacroField({
  label, value, onChangeText, unit, tint, border, textColor, muted,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  unit: string; tint: string; border: string; textColor: string; muted: string;
}) {
  return (
    <View style={macroStyles.field}>
      <Text style={[macroStyles.label, { color: muted }]}>{label}</Text>
      <View style={[macroStyles.inputRow, { borderColor: border }]}>
        <TextInput
          style={[macroStyles.input, { color: textColor }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text style={[macroStyles.unit, { color: muted }]}>{unit}</Text>
      </View>
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
  modeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
  },
  photoArea: { gap: 12 },
  photoPlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: { width: '100%', height: 220, borderRadius: 12 },
  photoButtons: { flexDirection: 'row', gap: 10 },
  photoNoteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  photoBtnText: { fontSize: 14, fontWeight: '600' },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  parseBtnText: { fontSize: 16, fontWeight: '700' },
  parsingNote: { fontSize: 13, textAlign: 'center', marginTop: 8 },
  parsingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderRadius: 12,
  },
  scanHint: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scanModeRow: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  confirmImg: { width: '100%', height: 180, borderRadius: 12, marginBottom: 14, borderWidth: 1 },
  itemsCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemQty: { fontSize: 12 },
  itemCal: { fontSize: 13, fontWeight: '600' },
  macroCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  notes: { fontSize: 13, marginBottom: 8, fontStyle: 'italic' },
  confidenceRow: { alignItems: 'flex-end', marginBottom: 8 },
  confidenceLabel: { fontSize: 12 },
});

const macroStyles = StyleSheet.create({
  field: { width: '47%' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  unit: { fontSize: 13 },
});
