import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import type { LoginPayload } from '../api/services/auth';

interface LoginFormData {
  email: string;
  password: string;
}

/**
 * LoginScreen Component
 *
 * Handles user login with:
 * - Admin approval check
 * - Real-time error handling
 * - Error message for unapproved accounts
 */
export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [validationErrors, setValidationErrors] = useState<Partial<LoginFormData>>({});

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
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
    if (!validateForm()) {
      return;
    }

    const loginPayload: LoginPayload = {
      email: formData.email.trim(),
      password: formData.password,
    };

    const result = await login(loginPayload);

    if (result.error) {
      Alert.alert('Login Failed', result.error, [{ text: 'OK' }]);
      return;
    }

    if (result.user?.approved) {
      // Navigate to main app
      router.replace('/(tabs)/');
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
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 40, justifyContent: 'center' }}
    >
      {/* Header */}
      <View className="mb-8">
        <Text className="text-3xl font-bold text-gray-800 mb-2">
          Welcome Back
        </Text>
        <Text className="text-gray-600">
          Log in to your Visyra CRM account
        </Text>
      </View>

      {/* Auth Error Alert */}
      {authError && (
        <View className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <Text className="text-red-700 text-sm">{authError}</Text>
        </View>
      )}

      {/* Email Field */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Email Address</Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base ${
            validationErrors.email
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder="Enter your email"
          value={formData.email}
          onChangeText={(text) => updateField('email', text)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />
        {validationErrors.email && (
          <Text className="text-red-500 text-sm mt-1">{validationErrors.email}</Text>
        )}
      </View>

      {/* Password Field */}
      <View className="mb-2">
        <Text className="text-gray-700 font-semibold mb-2">Password</Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base ${
            validationErrors.password
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder="Enter your password"
          value={formData.password}
          onChangeText={(text) => updateField('password', text)}
          secureTextEntry
          editable={!isLoading}
        />
        {validationErrors.password && (
          <Text className="text-red-500 text-sm mt-1">{validationErrors.password}</Text>
        )}
      </View>

      {/* Forgot Password Link */}
      <TouchableOpacity className="mb-6">
        <Text className="text-blue-600 text-sm text-right">Forgot Password?</Text>
      </TouchableOpacity>

      {/* Info Box - Approval Pending */}
      <View className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
        <Text className="text-amber-800 text-sm">
          <Text className="font-semibold">Account Pending Approval?</Text>{'\n'}
          If your account has not been approved yet, you will not be able to log in. Please contact your administrator.
        </Text>
      </View>

      {/* Login Button */}
      <TouchableOpacity
        onPress={handleLogin}
        disabled={isLoading}
        className={`rounded-lg py-4 flex-row items-center justify-center ${
          isLoading ? 'bg-gray-400' : 'bg-blue-600'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text className="text-white font-bold text-lg">Log In</Text>
        )}
      </TouchableOpacity>

      {/* Signup Link */}
      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-600">Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text className="text-blue-600 font-semibold">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

