import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useExpenses } from '../context/ExpenseContext';

export default function ExpensesScreen() {
  const { expenses } = useExpenses();
  const [filterCategory, setFilterCategory] = useState('');

  const filteredExpenses = expenses.filter((exp) => {
    return filterCategory ? exp.category === filterCategory : true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Expenses</Text>
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
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
  expenseListContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
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
