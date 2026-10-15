import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import { useExpenses } from '../context/ExpenseContext';
import { useThemeColors } from '../theme';

const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Others'];

export default function BudgetsScreen() {
  const { expenses, budgets, setBudget } = useExpenses();
  const theme = useThemeColors();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [budgetInput, setBudgetInput] = useState('');

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const handleSaveBudget = () => {
    if (selectedCategory && budgetInput) {
      setBudget(selectedCategory, parseFloat(budgetInput));
    }
    setModalVisible(false);
    setSelectedCategory('');
    setBudgetInput('');
  };

  const openModal = (category: string) => {
    setSelectedCategory(category);
    setBudgetInput(budgets[category] ? budgets[category].toString() : '');
    setModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Monthly Budgets</Text>
      </View>

      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: category }) => {
          const spent = categoryTotals[category] || 0;
          const limit = budgets[category] || 0;
          let progress = 0;
          let progressColor = theme.primary;

          if (limit > 0) {
            progress = Math.min((spent / limit) * 100, 100);
            if (progress >= 100) progressColor = theme.danger;
            else if (progress >= 80) progressColor = '#F59E0B'; // Orange
          }

          return (
            <TouchableOpacity 
              style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.text }]}
              onPress={() => openModal(category)}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.categoryName, { color: theme.text }]}>{category}</Text>
                <Text style={[styles.limitText, { color: theme.textSecondary }]}>
                  {limit > 0 ? `Limit: KES ${limit.toFixed(2)}` : 'No limit set'}
                </Text>
              </View>

              <Text style={[styles.spentText, { color: theme.text }]}>
                Spent: KES {spent.toFixed(2)}
              </Text>

              {limit > 0 && (
                <View style={[styles.progressBarBg, { backgroundColor: theme.inputBackground }]}>
                  <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: progressColor }]} />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Budget for {selectedCategory}
            </Text>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Amount (KES)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              value={budgetInput}
              onChangeText={setBudgetInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: theme.primary }]} onPress={handleSaveBudget}>
                <Text style={[styles.modalButtonText, { color: theme.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  listContent: {
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
  },
  limitText: {
    fontSize: 14,
  },
  spentText: {
    fontSize: 16,
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
