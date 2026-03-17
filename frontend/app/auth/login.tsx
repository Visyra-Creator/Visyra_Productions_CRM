import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';

interface LoginFormData {
  username: string;
  password: string;
}

interface ValidationError {
  username?: string;
  password?: string;
}

/**
 * Login Screen Component
 *
 * Features:
 * - Username/Email input
 * - Password input
 * - Login button
 * - Error messages for:
 *   - Invalid credentials
 *   - Account not approved
 *   - Network/server errors
 * - Loading states
 * - Link to signup
 * - Forgot password option
 */
export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { login, loading: isLoading } = useAuthStore();

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });

  const [validationErrors, setValidationErrors] = useState<ValidationError>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const errors: ValidationError = {};

    if (!formData.username.trim()) {
      errors.username = 'Username/Email is required';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle login submission
   */
  const handleLogin = async () => {
    setLoginError(null);

    if (!validateForm()) {
      return;
    }

    const result = await login(formData.username, formData.password);

    if (result.success) {
      // Navigation happens automatically via auth store
      router.replace('/');
    } else if (result.error) {
      // Show appropriate error message
      if (result.error.includes('approved')) {
        setLoginError('Your account has not been approved yet. Please contact your administrator.');
      } else if (result.error.includes('credentials') || result.error.includes('Invalid')) {
        setLoginError('Invalid username or password');
      } else {
        setLoginError(result.error);
      }
    }
  };

  /**
   * Update form field
   */
  const updateField = <K extends keyof LoginFormData>(
    field: K,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
    // Clear login error when user starts typing again
    if (loginError) {
      setLoginError(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 32, alignItems: 'center' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary + '15',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 40, fontWeight: '900' }}>V</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
            Welcome Back
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            Sign in to your Visyra CRM account
          </Text>
        </View>

        {/* Login Error Alert */}
        {loginError && (
          <View
            style={{
              backgroundColor: '#fee2e2',
              borderWidth: 1,
              borderColor: '#fecaca',
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <Text style={{ color: '#991b1b', fontSize: 13, flex: 1, fontWeight: '500' }}>
              {loginError}
            </Text>
          </View>
        )}

        {/* Username Field */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Username or Email
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: validationErrors.username ? '#ef4444' : colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: validationErrors.username ? '#fee2e2' : colors.surface,
            }}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={validationErrors.username ? '#ef4444' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 14,
              }}
              placeholder="Enter your username or email"
              placeholderTextColor={colors.textTertiary}
              value={formData.username}
              onChangeText={(text) => updateField('username', text)}
              editable={!isLoading}
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="email-address"
            />
          </View>
          {validationErrors.username && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.username}
            </Text>
          )}
        </View>

        {/* Password Field */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Password
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: validationErrors.password ? '#ef4444' : colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: validationErrors.password ? '#fee2e2' : colors.surface,
            }}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={validationErrors.password ? '#ef4444' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 14,
              }}
              placeholder="Enter your password"
              placeholderTextColor={colors.textTertiary}
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
              editable={!isLoading}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ padding: 8 }}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {validationErrors.password && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.password}
            </Text>
          )}
        </View>

        {/* Forgot Password Link */}
        <TouchableOpacity style={{ marginBottom: 24, alignItems: 'flex-end' }}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        {/* Info Box */}
        <View
          style={{
            backgroundColor: colors.info + '10',
            borderWidth: 1,
            borderColor: colors.info + '30',
            borderRadius: 8,
            padding: 12,
            marginBottom: 24,
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <Ionicons name="information-circle" size={16} color={colors.info} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 }}>
            Your account must be approved by an administrator before you can access the app.
          </Text>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={isLoading}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            opacity: isLoading ? 0.7 : 1,
            marginBottom: 20,
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="log-in" size={18} color="white" />
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textSecondary, marginHorizontal: 12, fontSize: 12 }}>
            New to Visyra?
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Signup Link */}
        <TouchableOpacity
          onPress={() => router.push('/auth/signup')}
          style={{
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
            Create Account
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 11,
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          By signing in, you agree to our Terms & Conditions
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

