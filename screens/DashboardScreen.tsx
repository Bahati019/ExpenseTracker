import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
};

export default function DashboardScreen() {
  const { logout } = useAuth();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const handleAddExpense = () => {
    if (!description || !amount || !category) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      description,
      amount: parseFloat(amount),
      category,
      date: date.toISOString(),
    };

    setExpenses((prev) => [newExpense, ...prev]);

    setDescription('');
    setAmount('');
    setCategory('');
    setDate(new Date());
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchCategory = filterCategory ? exp.category === filterCategory : true;
    const matchDate = filterDate
      ? exp.date.slice(0, 10) === filterDate
      : true;
    return matchCategory && matchDate;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expense Tracker</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* Expense Form Card */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Add New Expense</Text>
              <TextInput
                placeholder="Description"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={description}
                onChangeText={setDescription}
              />
              <TextInput
                placeholder="Amount (KES)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={category}
                  onValueChange={(itemValue) => setCategory(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Category" value="" color="#64748B" />
                  <Picker.Item label="Food" value="Food" />
                  <Picker.Item label="Transport" value="Transport" />
                  <Picker.Item label="Utilities" value="Utilities" />
                  <Picker.Item label="Entertainment" value="Entertainment" />
                  <Picker.Item label="Others" value="Others" />
                </Picker>
              </View>

              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.input, styles.dateButton]}
              >
                <Text style={{ color: '#0F172A' }}>{date.toDateString()}</Text>
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

              <TouchableOpacity onPress={handleAddExpense} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Add Expense</Text>
              </TouchableOpacity>
            </View>

            {/* Filters Section */}
            <View style={styles.filterSection}>
              <Text style={styles.sectionTitle}>Recent Expenses</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={filterCategory}
                  onValueChange={(value) => setFilterCategory(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="All Categories" value="" />
                  <Picker.Item label="Food" value="Food" />
                  <Picker.Item label="Transport" value="Transport" />
                  <Picker.Item label="Utilities" value="Utilities" />
                  <Picker.Item label="Entertainment" value="Entertainment" />
                  <Picker.Item label="Others" value="Others" />
                </Picker>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.expenseItem}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseText}>{item.description}</Text>
              <Text style={styles.expenseDate}>
                {item.category} • {new Date(item.date).toDateString()}
              </Text>
            </View>
            <Text style={styles.expenseAmount}>KES {item.amount.toFixed(2)}</Text>
          </View>
        )}
        contentContainerStyle={styles.expenseListContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 60 : 70,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  expenseListContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  pickerContainer: {
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: 12,
  },
  expenseItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  expenseLeft: {
    flex: 1,
  },
  expenseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 13,
    color: '#64748B',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
});
