import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../src/store/themeStore';
import { useRouter } from 'expo-router';

export default function Settings() {
  const { colors, mode, toggleTheme } = useThemeStore();
  const router = useRouter();

  const SettingItem = ({ icon, title, subtitle, onPress, rightElement }: any) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
          <SettingItem
            icon="moon-outline"
            title="Dark Mode"
            subtitle={mode === 'dark' ? 'Enabled' : 'Disabled'}
            rightElement={
              <Switch
                value={mode === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>App Configuration</Text>
          <SettingItem
            icon="options-outline"
            title="Customization"
            subtitle="Manage lead sources, event types, and more"
            onPress={() => router.push('/customization')}
            rightElement={
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data Management</Text>
          <SettingItem
            icon="cloud-upload-outline"
            title="Backup Data"
            subtitle="Export your data to a file"
            rightElement={
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            }
          />
          <SettingItem
            icon="cloud-download-outline"
            title="Restore Data"
            subtitle="Import data from backup"
            rightElement={
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
          <SettingItem
            icon="information-circle-outline"
            title="Version"
            subtitle="1.0.0"
          />
          <SettingItem
            icon="business-outline"
            title="Visyra Productions Control Center"
            subtitle="Photography Business Management"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
  },
});
