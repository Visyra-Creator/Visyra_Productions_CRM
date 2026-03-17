import 'react-native-url-polyfill/auto';
import Constants from "expo-constants"
import * as SecureStore from 'expo-secure-store';
import { createClient } from "@supabase/supabase-js"
import { Platform } from 'react-native';

type ExpoExtra = {
  EXPO_PUBLIC_SUPABASE_URL?: string
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string
}

const extra =
  (Constants.expoConfig?.extra as ExpoExtra | undefined) ??
  ((Constants as any).manifest2?.extra as ExpoExtra | undefined) ??
  {}

const supabaseUrl = extra.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = extra.EXPO_PUBLIC_SUPABASE_ANON_KEY

console.log("Supabase URL:", supabaseUrl)
console.log("Supabase Key exists:", !!supabaseKey)

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase config")
}

// Keep app startup safe in production even if config is missing.
const safeSupabaseUrl = supabaseUrl || "https://example.supabase.co"
const safeSupabaseKey = supabaseKey || "missing-supabase-anon-key"

const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('[supabase] getItem failed:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('[supabase] setItem failed:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('[supabase] removeItem failed:', error);
    }
  },
};

export const supabase = createClient(safeSupabaseUrl, safeSupabaseKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})


