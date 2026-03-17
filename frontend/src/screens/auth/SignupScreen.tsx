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
import type { SignupPayload } from '../api/services/auth';

interface SignupFormData {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

/**
 * SignupScreen Component
 *
 * Handles user registration with:
 * - Input validation
 * - Real-time error handling
 * - Auto-logout after signup (user must wait for admin approval)
 */
export default function SignupScreen() {
  const router = useRouter();
  const { signup, isLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState<Partial<SignupFormData>>({});

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const errors: Partial<SignupFormData> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^\d{10,}$/.test(formData.phone.replace(/\D/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
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
    if (!validateForm()) {
      return;
    }

    const signupPayload: SignupPayload = {
      name: formData.name.trim(),
      username: formData.username.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
    };

    const result = await signup(signupPayload);

    if (result.error) {
      Alert.alert('Signup Failed', result.error, [{ text: 'OK' }]);
      return;
    }

    // Success - show approval pending message
    Alert.alert(
      'Signup Successful',
      'Your account has been created! Your account is pending admin approval. You will receive a notification once it is approved.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Redirect to login screen
            router.replace('/auth/login');
          },
        },
      ]
    );
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
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 40 }}
    >
      {/* Header */}
      <View className="mb-8">
        <Text className="text-3xl font-bold text-gray-800 mb-2">
          Create Account
        </Text>
        <Text className="text-gray-600">
          Sign up to get started with Visyra CRM
        </Text>
      </View>

      {/* Auth Error Alert */}
      {authError && (
        <View className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <Text className="text-red-700">{authError}</Text>
        </View>
      )}

      {/* Name Field */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Full Name</Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base ${
            validationErrors.name
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder="Enter your full name"
          value={formData.name}
          onChangeText={(text) => updateField('name', text)}
          editable={!isLoading}
        />
        {validationErrors.name && (
          <Text className="text-red-500 text-sm mt-1">{validationErrors.name}</Text>
        )}
      </View>

      {/* Username Field */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Username</Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base ${
            validationErrors.username
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder="Choose a username"
          value={formData.username}
          onChangeText={(text) => updateField('username', text)}
          editable={!isLoading}
        />
        {validationErrors.username && (
          <Text className="text-red-500 text-sm mt-1">{validationErrors.username}</Text>
        )}
      </View>

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

      {/* Phone Field */}
      <View className="mb-4">
        <Text className="text-gray-700 font-semibold mb-2">Phone Number</Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base ${
            validationErrors.phone
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder="Enter your phone number"
          value={formData.phone}
          onChangeText={(text) => updateField('phone', text)}
          keyboardType="phone-pad"
          editable={!isLoading}
        />
        {validationErrors.phone && (
          <Text className="text-red-500 text-sm mt-1">{validationErrors.phone}</Text>
        )}
      </View>

      {/* Password Field */}
      <View className="mb-4">
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

      {/* Confirm Password Field */}
      <View className="mb-6">
        <Text className="text-gray-700 font-semibold mb-2">Confirm Password</Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base ${
            validationErrors.confirmPassword
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300'
          }`}
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChangeText={(text) => updateField('confirmPassword', text)}
          secureTextEntry
          editable={!isLoading}
        />
        {validationErrors.confirmPassword && (
          <Text className="text-red-500 text-sm mt-1">{validationErrors.confirmPassword}</Text>
        )}
      </View>

      {/* Info Box */}
      <View className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
        <Text className="text-blue-800 text-sm">
          <Text className="font-semibold">Important:</Text> Your account will need to be
          approved by an administrator before you can access the app.
        </Text>
      </View>

      {/* Signup Button */}
      <TouchableOpacity
        onPress={handleSignup}
        disabled={isLoading}
        className={`rounded-lg py-4 flex-row items-center justify-center ${
          isLoading ? 'bg-gray-400' : 'bg-blue-600'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text className="text-white font-bold text-lg">Create Account</Text>
        )}
      </TouchableOpacity>

      {/* Login Link */}
      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-600">Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text className="text-blue-600 font-semibold">Log In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

