import React, { useRef, useState } from 'react';
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
import type { SignupPayload } from '@/api/services/auth';

interface SignupFormData {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface ValidationError {
  name?: string;
  username?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Signup Screen Component
 *
 * Features:
 * - Name input
 * - Username input
 * - Phone number input
 * - Email input
 * - Password input
 * - Confirm password input
 * - Form validation
 * - Error messages
 * - Loading states
 * - Success message after signup
 * - Link to login
 */
export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { signup, loading: isLoading } = useAuthStore();

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState<ValidationError>({});
  const [signupError, setSignupError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastExistingAccountKeyRef = useRef<string | null>(null);
  const lastSignupAttemptAtRef = useRef<number>(0);

  const SIGNUP_COOLDOWN_MS = 30_000;

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const errors: ValidationError = {};

    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\d{10,}$/.test(formData.phone.replace(/\D/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle signup submission
   */
  const handleSignup = async () => {
    if (isLoading || isSubmitting) {
      console.log('Signup request blocked: request already in progress');
      return;
    }

    const now = Date.now();
    const elapsed = now - lastSignupAttemptAtRef.current;
    if (lastSignupAttemptAtRef.current > 0 && elapsed < SIGNUP_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((SIGNUP_COOLDOWN_MS - elapsed) / 1000);
      console.log('Signup request blocked: cooldown active', { remainingSeconds });
      setSignupError(`Please wait ${remainingSeconds}s before trying again.`);
      return;
    }

    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedUsername = formData.username.trim().toLowerCase();
    const accountKey = `${normalizedEmail}::${normalizedUsername}`;

    if (lastExistingAccountKeyRef.current === accountKey) {
      console.log('Signup request blocked: account already exists for the same input');
      setSignupError('An account with these details already exists. Please use a different username or email.');
      return;
    }

    setSignupError(null);

    if (!validateForm()) {
      return;
    }

    const signupPayload: SignupPayload = {
      name: formData.name.trim(),
      username: formData.username.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      password: formData.password,
    };

    try {
      setIsSubmitting(true);
      console.log('Signup request triggered');
      lastSignupAttemptAtRef.current = Date.now();
      const result = await signup(signupPayload);

      if (result.user) {
        lastExistingAccountKeyRef.current = null;
        console.log('Signup completed successfully');
        Alert.alert('Account Created', 'Account created successfully. Waiting for admin approval.');
        router.replace('/auth/login');
      } else if (result.error) {
        if (
          result.error.toLowerCase().includes('already exists') ||
          result.error.toLowerCase().includes('already taken')
        ) {
          lastExistingAccountKeyRef.current = accountKey;
        }
        setSignupError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Update form field
   */
  const updateField = <K extends keyof SignupFormData>(
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
    // Clear signup error when user starts typing again
    if (signupError) {
      setSignupError(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ marginBottom: 28, alignItems: 'center' }}>
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
            Create Account
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            Sign up to get started with Visyra CRM
          </Text>
        </View>

        {/* Signup Error Alert */}
        {signupError && (
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
              {signupError}
            </Text>
          </View>
        )}

        {/* Name Field */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Full Name
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: validationErrors.name ? '#ef4444' : colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: validationErrors.name ? '#fee2e2' : colors.surface,
            }}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={validationErrors.name ? '#ef4444' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 14,
              }}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textTertiary}
              value={formData.name}
              onChangeText={(text) => updateField('name', text)}
              editable={!isLoading}
              autoCapitalize="words"
            />
          </View>
          {validationErrors.name && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.name}
            </Text>
          )}
        </View>

        {/* Username Field */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Username
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
              name="at-outline"
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
              placeholder="Choose a username"
              placeholderTextColor={colors.textTertiary}
              value={formData.username}
              onChangeText={(text) => updateField('username', text)}
              editable={!isLoading}
              autoCapitalize="none"
            />
          </View>
          {validationErrors.username && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.username}
            </Text>
          )}
        </View>

        {/* Phone Field */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Phone Number
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: validationErrors.phone ? '#ef4444' : colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: validationErrors.phone ? '#fee2e2' : colors.surface,
            }}
          >
            <Ionicons
              name="call-outline"
              size={18}
              color={validationErrors.phone ? '#ef4444' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 14,
              }}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.textTertiary}
              value={formData.phone}
              onChangeText={(text) => updateField('phone', text)}
              editable={!isLoading}
              keyboardType="phone-pad"
            />
          </View>
          {validationErrors.phone && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.phone}
            </Text>
          )}
        </View>

        {/* Email Field */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Email Address
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: validationErrors.email ? '#ef4444' : colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: validationErrors.email ? '#fee2e2' : colors.surface,
            }}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={validationErrors.email ? '#ef4444' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 14,
              }}
              placeholder="Enter your email"
              placeholderTextColor={colors.textTertiary}
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              editable={!isLoading}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          {validationErrors.email && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.email}
            </Text>
          )}
        </View>

        {/* Password Field */}
        <View style={{ marginBottom: 16 }}>
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

        {/* Confirm Password Field */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            Confirm Password
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: validationErrors.confirmPassword ? '#ef4444' : colors.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: validationErrors.confirmPassword ? '#fee2e2' : colors.surface,
            }}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={validationErrors.confirmPassword ? '#ef4444' : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 14,
              }}
              placeholder="Confirm your password"
              placeholderTextColor={colors.textTertiary}
              value={formData.confirmPassword}
              onChangeText={(text) => updateField('confirmPassword', text)}
              editable={!isLoading}
              secureTextEntry={!showConfirmPassword}
              autoComplete="password"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{ padding: 8 }}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {validationErrors.confirmPassword && (
            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>
              {validationErrors.confirmPassword}
            </Text>
          )}
        </View>

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
            Your account will need to be approved by an administrator before you can access the app.
          </Text>
        </View>

        {/* Signup Button */}
        <TouchableOpacity
          onPress={handleSignup}
          disabled={isLoading || isSubmitting}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            opacity: (isLoading || isSubmitting) ? 0.7 : 1,
            marginBottom: 20,
          }}
        >
          {(isLoading || isSubmitting) ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="person-add" size={18} color="white" />
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textSecondary, marginHorizontal: 12, fontSize: 12 }}>
            Already have an account?
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Login Link */}
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          style={{
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
            Sign In
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          By signing up, you agree to our Terms & Conditions
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

