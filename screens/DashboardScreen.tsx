import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart } from 'react-native-chart-kit';
import { useAuth } from '../context/AuthContext';
import { useExpenses, Expense } from '../context/ExpenseContext';
import { useThemeColors } from '../theme';

const screenWidth = Dimensions.get('window').width;

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#EF4444',
  Transport: '#3B82F6',
  Utilities: '#F59E0B',
  Entertainment: '#10B981',
  Others: '#8B5CF6',
};

export default function DashboardScreen() {
  const { logout } = useAuth();
  const { addExpense, expenses } = useExpenses();
  const theme = useThemeColors();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleAddExpense = () => {
    if (!description || !amount || !category) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      description,
      amount: parseFloat(amount),
      category,
      date: date.toISOString(),
    };

    addExpense(newExpense);

    setDescription('');
    setAmount('');
    setCategory('');
    setDate(new Date());
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.keys(categoryTotals).map((cat) => ({
    name: cat,
    population: categoryTotals[cat],
    color: CATEGORY_COLORS[cat] || '#CBD5E1',
    legendFontColor: theme.textSecondary,
    legendFontSize: 12,
  }));

  const chartConfig = {
    backgroundGradientFrom: theme.background,
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: theme.background,
    backgroundGradientToOpacity: 0.5,
    color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Expense Tracker</Text>
        <TouchableOpacity onPress={logout} style={[styles.logoutButton, { backgroundColor: theme.dangerBg }]}>
          <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
          <Text style={styles.summaryTitle}>Total Spent</Text>
          <Text style={styles.summaryTotal}>KES {totalExpenses.toFixed(2)}</Text>
          
          {expenses.length > 0 ? (
            <PieChart
              data={pieChartData}
              width={screenWidth - 80}
              height={180}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"0"}
              absolute
            />
          ) : (
            <Text style={styles.noDataText}>No expenses yet. Add one below!</Text>
          )}
        </View>

        {/* Expense Form Card */}
        <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.text }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Add New Expense</Text>
          <TextInput
            placeholder="Description"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            placeholder="Amount (KES)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
            value={amount}
            onChangeText={setAmount}
          />
          <View style={[styles.pickerContainer, { backgroundColor: theme.inputBackground }]}>
            <Picker
              selectedValue={category}
              onValueChange={(itemValue) => setCategory(itemValue)}
              style={[styles.picker, { color: theme.text }]}
            >
              <Picker.Item label="Select Category" value="" color={theme.textSecondary} />
              <Picker.Item label="Food" value="Food" />
              <Picker.Item label="Transport" value="Transport" />
              <Picker.Item label="Utilities" value="Utilities" />
              <Picker.Item label="Entertainment" value="Entertainment" />
              <Picker.Item label="Others" value="Others" />
            </Picker>
          </View>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[styles.input, styles.dateButton, { backgroundColor: theme.inputBackground }]}
          >
            <Text style={{ color: theme.text }}>{date.toDateString()}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          <TouchableOpacity onPress={handleAddExpense} style={[styles.primaryButton, { backgroundColor: theme.text }]}>
            <Text style={[styles.primaryButtonText, { color: theme.background }]}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 60 : 70,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  summaryTitle: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryTotal: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
  },
  noDataText: {
    color: '#E0E7FF',
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 55,
    width: '100%',
  },
  dateButton: {
    justifyContent: 'center',
    height: 55,
  },
  primaryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
