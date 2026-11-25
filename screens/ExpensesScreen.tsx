import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useExpenses, Expense } from '../context/ExpenseContext';
import { Ionicons } from '@expo/vector-icons';
import {
  useThemeColors,
  CATEGORIES,
  getCategoryMeta,
  formatCurrency,
} from '../theme';

export default function ExpensesScreen() {
  const { expenses, updateExpense, removeExpense } = useExpenses();
  const theme = useThemeColors();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Edit Modal State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filtered & searched expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesCategory = filterCategory ? exp.category === filterCategory : true;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery = !q
        ? true
        : exp.description.toLowerCase().includes(q) ||
          (exp.category || '').toLowerCase().includes(q) ||
          exp.id.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [expenses, filterCategory, searchQuery]);

  // Aggregate total for filtered list
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || 'Others';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [expenses]);

  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(expense.amount.toString());
    setEditCategory(expense.category || 'Others');
    setEditDate(new Date(expense.date));
  };

  const handleSaveEdit = () => {
    if (!editingExpense) return;
    if (!editDescription.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (!editCategory) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }

    updateExpense({
      id: editingExpense.id,
      description: editDescription.trim(),
      amount: parsedAmount,
      category: editCategory,
      date: editDate.toISOString(),
    });

    setEditingExpense(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeExpense(id) },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Transaction Ledger</Text>
          <Text style={[styles.title, { color: theme.text }]}>Expenses</Text>
        </View>

        <View style={[styles.countBadge, { backgroundColor: theme.primaryLight }]}>
          <Text style={[styles.countBadgeText, { color: theme.primary }]}>{expenses.length} Total</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
          <TextInput
            placeholder="Search by name, category, or M-Pesa ID..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter Chips Horizontal Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          <TouchableOpacity
            onPress={() => setFilterCategory('')}
            style={[
              styles.filterChip,
              !filterCategory
                ? [styles.filterChipActive, { backgroundColor: theme.primary, borderColor: theme.primary }]
                : [styles.filterChipInactive, { backgroundColor: theme.inputBackground, borderColor: theme.border }],
            ]}
          >
            <Ionicons
              name="apps"
              size={14}
              color={!filterCategory ? '#FFFFFF' : theme.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: !filterCategory ? '#FFFFFF' : theme.text, fontWeight: !filterCategory ? '700' : '500' },
              ]}
            >
              All ({expenses.length})
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map((cat) => {
            const isSelected = filterCategory === cat.name;
            const count = categoryCounts[cat.name] || 0;

            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setFilterCategory(isSelected ? '' : cat.name)}
                style={[
                  styles.filterChip,
                  isSelected
                    ? [styles.filterChipActive, { backgroundColor: cat.color, borderColor: cat.color }]
                    : [styles.filterChipInactive, { backgroundColor: theme.inputBackground, borderColor: theme.border }],
                ]}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? '#FFFFFF' : cat.color}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {cat.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Summary strip */}
      <View style={[styles.summaryStrip, { backgroundColor: theme.cardSecondary, borderBottomColor: theme.borderLight }]}>
        <Text style={[styles.summaryStripText, { color: theme.textSecondary }]}>
          Showing {filteredExpenses.length} {filteredExpenses.length === 1 ? 'record' : 'records'}
        </Text>
        <Text style={[styles.summaryStripTotal, { color: theme.text }]}>
          Total: <Text style={{ color: theme.primary, fontWeight: '800' }}>{formatCurrency(filteredTotal)}</Text>
        </Text>
      </View>

      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.expenseListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBg, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="receipt-outline" size={44} color={theme.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Expenses Found</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {searchQuery || filterCategory
                ? 'Try adjusting your search query or category filter.'
                : 'No expenses recorded yet. Add one or sync your M-Pesa SMS!'}
            </Text>
            {(searchQuery || filterCategory) && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setFilterCategory('');
                }}
                style={[styles.resetFilterBtn, { backgroundColor: theme.primaryLight }]}
              >
                <Text style={[styles.resetFilterBtnText, { color: theme.primary }]}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const meta = getCategoryMeta(item.category);
          const isMpesa = item.id.startsWith('MPESA_');

          return (
            <View
              style={[
                styles.expenseItem,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {/* Category Icon Badge */}
              <View style={[styles.categoryIconCircle, { backgroundColor: meta.lightBg }]}>
                <Ionicons name={meta.icon as any} size={20} color={meta.color} />
              </View>

              {/* Middle details */}
              <TouchableOpacity
                style={styles.expenseMiddle}
                onPress={() => handleOpenEdit(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.expenseTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.description}
                </Text>

                <View style={styles.expenseMetaRow}>
                  <View style={[styles.categoryTag, { backgroundColor: meta.lightBg }]}>
                    <Text style={[styles.categoryTagText, { color: meta.color }]}>{meta.name}</Text>
                  </View>

                  <Text style={[styles.expenseDate, { color: theme.textSecondary }]}>
                    {new Date(item.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>

                  {isMpesa && (
                    <View style={[styles.mpesaTag, { backgroundColor: theme.successBg }]}>
                      <Text style={[styles.mpesaTagText, { color: theme.success }]}>M-PESA</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Right side amount & quick actions */}
              <View style={styles.expenseRight}>
                <Text style={[styles.expenseAmount, { color: theme.text }]}>
                  {formatCurrency(item.amount)}
                </Text>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() => handleOpenEdit(item)}
                    style={[styles.actionBtn, { backgroundColor: theme.inputBackground }]}
                    accessibilityLabel="Edit"
                  >
                    <Ionicons name="pencil-outline" size={14} color={theme.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={[styles.actionBtn, { backgroundColor: theme.dangerBg }]}
                    accessibilityLabel="Delete"
                  >
                    <Ionicons name="trash-outline" size={14} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Edit Expense Bottom Sheet Modal */}
      <Modal
        visible={editingExpense !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingExpense(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Expense</Text>
              <TouchableOpacity
                onPress={() => setEditingExpense(null)}
                style={[styles.closeModalBtn, { backgroundColor: theme.inputBackground }]}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category Chips */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
              <View style={styles.categoryChipsGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = editCategory === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      onPress={() => setEditCategory(cat.name)}
                      style={[
                        styles.modalCategoryChip,
                        {
                          backgroundColor: isSelected ? cat.color : theme.inputBackground,
                          borderColor: isSelected ? cat.color : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={15}
                        color={isSelected ? '#FFFFFF' : theme.text}
                      />
                      <Text
                        style={[
                          styles.modalCategoryChipText,
                          { color: isSelected ? '#FFFFFF' : theme.text, fontWeight: isSelected ? '700' : '500' },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Amount Input */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Amount</Text>
              <View style={[styles.amountInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Text style={[styles.currencyPrefix, { color: theme.primary }]}>KES</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="numeric"
                  style={[styles.amountInput, { color: theme.text }]}
                  value={editAmount}
                  onChangeText={setEditAmount}
                />
              </View>

              {/* Description Input */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description</Text>
              <TextInput
                placeholder="Description"
                placeholderTextColor={theme.textTertiary}
                style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={editDescription}
                onChangeText={setEditDescription}
              />

              {/* Date Selector */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateSelectorBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                <Text style={[styles.dateSelectorText, { color: theme.text }]}>
                  {editDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={editDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setEditDate(selectedDate);
                  }}
                />
              )}

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  onPress={() => setEditingExpense(null)}
                  style={[styles.cancelBtn, { backgroundColor: theme.inputBackground }]}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    paddingTop: Platform.OS === 'android' ? 50 : 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filterChipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterChipInactive: {},
  filterChipText: {
    fontSize: 12,
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  summaryStripText: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryStripTotal: {
    fontSize: 12,
  },
  expenseListContent: {
    padding: 16,
    paddingBottom: 40,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseMiddle: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expenseDate: {
    fontSize: 11,
  },
  mpesaTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mpesaTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 22,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  categoryChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  modalCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCategoryChipText: {
    fontSize: 13,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    height: '100%',
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateSelectorText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
