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
      <Text style={styles.title}>Welcome to the Expense Tracker</Text>

      {/* Expense Form */}
      <TextInput
        placeholder="Description"
        style={styles.input}
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        placeholder="Amount"
        keyboardType="numeric"
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
      />
      <Picker
        selectedValue={category}
        onValueChange={(itemValue) => setCategory(itemValue)}
        style={styles.input}
      >
        <Picker.Item label="Select Category" value="" />
        <Picker.Item label="Food" value="Food" />
        <Picker.Item label="Transport" value="Transport" />
        <Picker.Item label="Utilities" value="Utilities" />
        <Picker.Item label="Entertainment" value="Entertainment" />
        <Picker.Item label="Others" value="Others" />
      </Picker>

      <TouchableOpacity
        onPress={() => setShowDatePicker(true)}
        style={[styles.input, styles.dateButton]}
      >
        <Text>{date.toDateString()}</Text>
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

      <TouchableOpacity onPress={handleAddExpense} style={styles.button}>
        <Text style={styles.buttonText}>Add Expense</Text>
      </TouchableOpacity>

      {/* Filters */}
      <Text style={styles.listTitle}>Filter Expenses</Text>
      <Picker
        selectedValue={filterCategory}
        onValueChange={(value) => setFilterCategory(value)}
        style={styles.input}
      >
        <Picker.Item label="All Categories" value="" />
        <Picker.Item label="Food" value="Food" />
        <Picker.Item label="Transport" value="Transport" />
        <Picker.Item label="Utilities" value="Utilities" />
        <Picker.Item label="Entertainment" value="Entertainment" />
        <Picker.Item label="Others" value="Others" />
      </Picker>

      <TextInput
        placeholder="Filter by Date (YYYY-MM-DD)"
        style={styles.input}
        value={filterDate}
        onChangeText={setFilterDate}
      />

      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.expenseItem}>
            <View>
              <Text style={styles.expenseText}>{item.description}</Text>
              <Text style={styles.expenseDate}>
                {item.category} • {new Date(item.date).toDateString()}
              </Text>
            </View>
            <Text style={styles.expenseAmount}>KES {item.amount.toFixed(2)}</Text>
          </View>
        )}
        style={styles.expenseList}
      />

      <TouchableOpacity onPress={logout} style={[styles.button, { backgroundColor: '#E53935' }]}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 60,
    backgroundColor: '#f0f4f7',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 10,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  dateButton: {
    height: 50,
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  expenseList: {
    flex: 1,
    marginTop: 10,
  },
  expenseItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  expenseText: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseDate: {
    fontSize: 12,
    color: '#888',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});
