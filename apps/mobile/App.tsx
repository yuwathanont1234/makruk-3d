import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

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

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden />
      <WebView
        ref={webRef}
        source={{ uri: GAME_URL }}
        style={styles.web}
        originWhitelist={['*']}
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
    ...StyleSheet.absoluteFillObject,
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
