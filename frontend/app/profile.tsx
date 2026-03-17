import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useThemeStore } from '../src/store/themeStore';
import { useAuthStore } from '../src/store/authStore';
import { updateProfile } from '../src/api/services/auth';
import { supabase } from '../src/api/supabase';

export default function Profile() {
  const { colors } = useThemeStore();
  const { user, setUser } = useAuthStore();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setUsername(user.username || '');
    setPhone(user.phone || '');
  }, [user]);

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const avatar = (data?.user?.user_metadata?.avatar_url as string | undefined) || null;
        setAvatarUrl(avatar);
      } catch (error) {
        console.error('[Profile] avatar load error:', error);
      }
    };

    loadAvatar();
  }, []);

  const handlePickProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to select a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[Profile] pick photo error:', error);
      Alert.alert('Error', 'Failed to select profile photo.');
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User session not found. Please login again.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username is required.');
      return;
    }

    try {
      setSaving(true);
      const result = await updateProfile(user.id, {
        name: name.trim(),
        username: username.trim(),
        phone: phone.trim(),
      });

      if (result.error || !result.user) {
        Alert.alert('Error', result.error || 'Failed to update profile.');
        return;
      }

      if (avatarUrl) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { avatar_url: avatarUrl },
        });

        if (metadataError) {
          Alert.alert('Warning', 'Profile saved, but photo update failed.');
        }
      }

      setUser(result.user);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error) {
      console.error('[Profile] update error:', error);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'User session not found. Please login again.');
      return;
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Validation Error', 'All password fields are required.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Validation Error', 'New password and confirm password do not match.');
      return;
    }

    try {
      setSaving(true);

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        Alert.alert('Error', 'Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        Alert.alert('Error', updateError.message || 'Failed to update password.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Password updated successfully.');
    } catch (error) {
      console.error('[Profile] password update error:', error);
      Alert.alert('Error', 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Profile Details</Text>

        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={[styles.avatarContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handlePickProfilePhoto}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={36} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickProfilePhoto}>
            <Text style={[styles.photoAction, { color: colors.primary }]}>Upload Profile Photo</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone"
          keyboardType="phone-pad"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
        <TextInput
          value={user.email || ''}
          editable={false}
          selectTextOnFocus={false}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textTertiary, borderColor: colors.border }]}
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text, marginTop: 30 }]}>Change Password</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Current Password</Text>
        <TextInput
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Current Password"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>New Password</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New Password"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm New Password</Text>
        <TextInput
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          placeholder="Confirm New Password"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleChangePassword}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 10 },
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  photoAction: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  saveButton: {
    marginTop: 24,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

