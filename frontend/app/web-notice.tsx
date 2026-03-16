import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Platform } from 'react-native';

export default function WebNotice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visyra CRM</Text>
      <Text style={styles.message}>
        This app is designed for Android tablets and uses Supabase for cloud data.
      </Text>
      <Text style={styles.submessage}>
        Please use Expo Go on your Android device or build the APK to experience the full app.
      </Text>
      <Text style={styles.info}>
        Platform: {Platform.OS}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 24,
  },
  message: {
    fontSize: 18,
    color: '#f5f5f7',
    textAlign: 'center',
    marginBottom: 16,
  },
  submessage: {
    fontSize: 16,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 24,
  },
  info: {
    fontSize: 14,
    color: '#71717a',
  },
});
