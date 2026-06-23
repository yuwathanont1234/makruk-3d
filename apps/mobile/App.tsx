import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Haptics from 'expo-haptics';

// แอปมือถือ = WebView ครอบเว็บ 3D ที่ deploy แล้ว → ได้ทุกฟีเจอร์ครบ
// (ตัวหมาก 3D, ธีมตำนานไทย + เดิน, ท่าฟันตอนกิน, AI สร้างธีม, เล่นออนไลน์ข้ามแพลตฟอร์ม)
// เล่นกับคนเล่นเว็บ/มือถือคนอื่นได้ทันที เพราะใช้เว็บ + Supabase Realtime ตัวเดียวกัน
const GAME_URL = 'https://yuwathanont1234.github.io/makruk-3d/';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webRef = useRef<WebView>(null);

  const reload = () => {
    setError(false);
    setLoading(true);
    webRef.current?.reload();
  };

  // เว็บ 3D ส่งสัญญาณตอนเดิน/กินหมากมาทาง postMessage → สั่นแบบ native (App Store 4.2)
  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string };
      if (msg.type === 'capture') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (msg.type === 'move') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // ไม่ใช่ข้อความ JSON ที่เรารู้จัก — ข้ามไป
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden />
      <WebView
        ref={webRef}
        source={{ uri: GAME_URL }}
        style={styles.web}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        onHttpError={() => {
          setError(true);
          setLoading(false);
        }}
      />

      {loading && !error && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffc24e" />
          <Text style={styles.loadingTxt}>♟️ กำลังโหลดหมากรุกไทย 3D…</Text>
        </View>
      )}

      {error && (
        <View style={styles.overlay}>
          <Text style={styles.errTitle}>เชื่อมต่อไม่ได้</Text>
          <Text style={styles.errMsg}>ต้องต่ออินเทอร์เน็ตเพื่อโหลดเกมครั้งแรก</Text>
          <Pressable onPress={reload} style={styles.retry}>
            <Text style={styles.retryTxt}>↻ ลองใหม่</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241a10' },
  web: { flex: 1, backgroundColor: '#241a10' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#241a10',
    gap: 14,
  },
  loadingTxt: { color: '#eecb8c', fontWeight: '700', fontSize: 15 },
  errTitle: { color: '#fff', fontWeight: '800', fontSize: 20 },
  errMsg: { color: '#cdb89a', fontSize: 14 },
  retry: {
    marginTop: 6,
    backgroundColor: '#ffc24e',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryTxt: { color: '#2a1d05', fontWeight: '800', fontSize: 15 },
});
