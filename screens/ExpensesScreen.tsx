import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useExpenses } from '../context/ExpenseContext';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme';

export default function ExpensesScreen() {
  const { expenses, removeExpense } = useExpenses();
  const theme = useThemeColors();
  const [filterCategory, setFilterCategory] = useState('');

  const filteredExpenses = expenses.filter((exp) => {
    return filterCategory ? exp.category === filterCategory : true;
  });

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeExpense(id) },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>All Expenses</Text>
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.filterSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Expenses</Text>
            <View style={[styles.pickerContainer, { backgroundColor: theme.inputBackground }]}>
              <Picker
                selectedValue={filterCategory}
                onValueChange={(value) => setFilterCategory(value)}
                style={[styles.picker, { color: theme.text }]}
              >
                <Picker.Item label="All Categories" value="" color={theme.textSecondary} />
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
          <View style={[styles.expenseItem, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.text }]}>
            <View style={styles.expenseLeft}>
              <Text style={[styles.expenseText, { color: theme.text }]}>{item.description}</Text>
              <Text style={[styles.expenseDate, { color: theme.textSecondary }]}>
                {item.category} • {new Date(item.date).toDateString()}
              </Text>
            </View>
            <View style={styles.expenseRight}>
              <Text style={[styles.expenseAmount, { color: theme.primary }]}>KES {item.amount.toFixed(2)}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={[styles.deleteButton, { backgroundColor: theme.dangerBg }]}>
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </TouchableOpacity>
            </View>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 60 : 70,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  expenseListContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
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
  filterSection: {
    marginBottom: 12,
  },
  expenseItem: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
  },
  expenseLeft: {
    flex: 1,
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 13,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 12,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
  },
});
