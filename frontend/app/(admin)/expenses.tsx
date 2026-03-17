import { View, Text, ScrollView } from 'react-native';

/**
 * Expenses Page - Admin Only
 *
 * Protected by (admin) group layout
 * Employees are redirected to dashboard
 */
export default function ExpensesScreen() {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">
          Expenses
        </Text>
        {/* Your expenses content here */}
        <Text className="text-gray-600">Admin only content</Text>
      </View>
    </ScrollView>
  );
}

