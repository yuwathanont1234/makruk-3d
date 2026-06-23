import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { MobileGame, type UiState, type Mode, type Diff } from './src/MobileGame';
import { THEMES } from './src/three/themes/registry';

// เว็บ (react-native-web): ทำให้ root เต็มจอ
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent = 'html,body,#root{height:100%;width:100%;margin:0;padding:0;background:#241a10}';
  document.head.appendChild(s);
}

const INITIAL: UiState = {
  ready: false,
  turn: 'white',
  statusText: '',
  statusKind: 'normal',
  mode: '2p',
  difficulty: 'medium',
  themeId: 'ayutthaya',
  historyLen: 0,
  onlineStatus: '',
  muted: false,
};

export default function App() {
  const [ui, setUi] = useState<UiState>(INITIAL);
  const [code, setCode] = useState('');
  const gameRef = useRef<MobileGame | null>(null);
  if (!gameRef.current) gameRef.current = new MobileGame(setUi);
  const game = gameRef.current;
  // dev hook (เฉพาะ web target สำหรับทดสอบ — native ไม่มี document)
  if (typeof document !== 'undefined') (window as unknown as Record<string, unknown>).__mgame = game;

  const layout = useRef({ w: 1, h: 1 });
  const drag = useRef({ x: 0, y: 0, moved: false });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          drag.current = { x: 0, y: 0, moved: false };
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) drag.current.moved = true;
          const dx = g.dx - drag.current.x;
          const dy = g.dy - drag.current.y;
          drag.current.x = g.dx;
          drag.current.y = g.dy;
          game.orbit(dx, dy);
        },
        onPanResponderRelease: (e) => {
          if (!drag.current.moved) game.tap(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
      }),
    [game]
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    game.attachGL(gl, layout.current.w, layout.current.h);
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height) {
      layout.current = { w: width, h: height };
      game.setLayout(width, height);
    }
  };

  // fallback ขนาดสำหรับ preview headless (window = 0)
  let W: number | undefined;
  let H: number | undefined;
  if (typeof window !== 'undefined') {
    W = window.innerWidth || (typeof screen !== 'undefined' ? screen.width : 0) || undefined;
    H = window.innerHeight || (typeof screen !== 'undefined' ? screen.height : 0) || undefined;
  }

  return (
    <View style={[styles.root, W && H ? { width: W, height: H } : null]} onLayout={onLayout}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.badgeRow}>
          <View style={[styles.dot, ui.turn === 'white' ? styles.dotW : styles.dotB]} />
          <Text style={styles.turnTxt}>{ui.turn === 'white' ? 'ตาขาว' : 'ตาดำ'}</Text>
          {!!ui.statusText && (
            <Text
              style={[
                styles.status,
                ui.statusKind === 'over' && styles.statusOver,
                ui.statusKind === 'check' && styles.statusCheck,
              ]}
            >
              {ui.statusText}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.brand}>♟️ หมากรุกไทย 3D</Text>

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.seg}>
          {(['2p', 'ai', 'online'] as Mode[]).map((m) => (
            <Pressable key={m} onPress={() => game.setMode(m)} style={[styles.segBtn, ui.mode === m && styles.segOn]}>
              <Text style={[styles.segTxt, ui.mode === m && styles.segTxtOn]}>
                {m === '2p' ? '🧑‍🤝‍🧑 2 คน' : m === 'ai' ? '🤖 AI' : '🌐 ออนไลน์'}
              </Text>
            </Pressable>
          ))}
        </View>

        {ui.mode === 'ai' && (
          <View style={styles.seg}>
            {(['easy', 'medium', 'hard'] as Diff[]).map((d) => (
              <Pressable
                key={d}
                onPress={() => game.setDifficulty(d)}
                style={[styles.segBtn, ui.difficulty === d && styles.segOn]}
              >
                <Text style={[styles.segTxt, ui.difficulty === d && styles.segTxtOn]}>
                  {d === 'easy' ? 'ง่าย' : d === 'medium' ? 'กลาง' : 'ยาก'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {ui.mode === 'online' && (
          <View style={styles.onlineRow}>
            <Pressable onPress={() => game.createRoom()} style={styles.btn}>
              <Text style={styles.btnTxt}>🆕 สร้างห้อง</Text>
            </Pressable>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="รหัส"
              placeholderTextColor="#889"
              autoCapitalize="characters"
              maxLength={4}
              style={styles.input}
            />
            <Pressable onPress={() => game.joinRoom(code)} style={styles.btn}>
              <Text style={styles.btnTxt}>เข้าร่วม</Text>
            </Pressable>
          </View>
        )}
        {ui.mode === 'online' && !!ui.onlineStatus && <Text style={styles.onlineStatus}>{ui.onlineStatus}</Text>}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.themeScroll}
          contentContainerStyle={styles.themeRow}
        >
          {THEMES.map((t) => (
            <Pressable key={t.id} onPress={() => game.setTheme(t.id)} style={[styles.chip, ui.themeId === t.id && styles.chipOn]}>
              <Text style={styles.chipTxt}>
                {t.emoji} {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={() => game.newGame()} style={[styles.btn, styles.primary]}>
            <Text style={styles.primaryTxt}>♻️ เกมใหม่</Text>
          </Pressable>
          <Pressable onPress={() => game.undoMove()} style={styles.btn}>
            <Text style={styles.btnTxt}>↩️ ย้อน</Text>
          </Pressable>
          <Pressable onPress={() => game.toggleMute()} style={styles.btn}>
            <Text style={styles.btnTxt}>{ui.muted ? '🔇' : '🔊'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const PANEL = 'rgba(18,22,30,0.82)';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241a10' },
  top: { position: 'absolute', top: 44, left: 0, right: 0, alignItems: 'center' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PANEL,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  dotW: { backgroundColor: '#f3f5f8' },
  dotB: { backgroundColor: '#1c2128' },
  turnTxt: { color: '#eef2f7', fontWeight: '700', fontSize: 14 },
  status: { color: '#9aa6b6', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  statusOver: { color: '#ffc24e' },
  statusCheck: { color: '#ff8a4c' },
  brand: { position: 'absolute', top: 48, left: 16, color: '#fff', fontWeight: '800', fontSize: 15, opacity: 0.85 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', gap: 8 },
  seg: { flexDirection: 'row', backgroundColor: PANEL, borderRadius: 12, overflow: 'hidden' },
  segBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  segOn: { backgroundColor: '#2b7fd6' },
  segTxt: { color: '#eef2f7', fontWeight: '700', fontSize: 13 },
  segTxtOn: { color: '#fff' },

  onlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  onlineStatus: { color: '#cdd6e0', fontWeight: '700', fontSize: 12, backgroundColor: PANEL, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  input: {
    width: 86,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 3,
    borderRadius: 10,
    paddingVertical: 8,
  },

  themeScroll: { maxHeight: 44 },
  themeRow: { gap: 8, paddingHorizontal: 8 },
  chip: { backgroundColor: PANEL, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11 },
  chipOn: { backgroundColor: '#7a4a25', borderWidth: 1, borderColor: '#ffc24e' },
  chipTxt: { color: '#eef2f7', fontWeight: '700', fontSize: 13 },

  actions: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: PANEL, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 11 },
  btnTxt: { color: '#eef2f7', fontWeight: '700', fontSize: 13 },
  primary: { backgroundColor: '#ffc24e' },
  primaryTxt: { color: '#2a1d05', fontWeight: '800', fontSize: 13 },
});
