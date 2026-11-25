import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Share,
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

interface ExpenseSection {
  title: string;
  formattedSubtotal: string;
  data: Expense[];
}

export default function ExpensesScreen() {
  const { expenses, updateExpense, removeExpense } = useExpenses();
  const theme = useThemeColors();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Digital Receipt Modal State
  const [viewingReceipt, setViewingReceipt] = useState<Expense | null>(null);

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

  // Group filtered expenses into Timeline Sections (Today, Yesterday, or specific dates with subtotals)
  const sections = useMemo((): ExpenseSection[] => {
    const groups: Record<string, { date: Date; items: Expense[] }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filteredExpenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      const dateKey = `${expDate.getFullYear()}-${expDate.getMonth()}-${expDate.getDate()}`;
      if (!groups[dateKey]) {
        groups[dateKey] = { date: expDate, items: [] };
      }
      groups[dateKey].items.push(exp);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return groups[b].date.getTime() - groups[a].date.getTime();
    });

    return sortedKeys.map((key) => {
      const group = groups[key];
      const groupDate = new Date(group.date);
      groupDate.setHours(0, 0, 0, 0);

      let title = '';
      if (groupDate.getTime() === today.getTime()) {
        title = 'Today';
      } else if (groupDate.getTime() === yesterday.getTime()) {
        title = 'Yesterday';
      } else {
        title = group.date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: group.date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }

      const subtotal = group.items.reduce((sum, item) => sum + item.amount, 0);

      return {
        title,
        formattedSubtotal: formatCurrency(subtotal),
        data: group.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
    });
  }, [filteredExpenses]);

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
    setViewingReceipt(null);
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
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeExpense(id);
            setViewingReceipt(null);
          },
        },
      ]
    );
  };

  const handleShareReceipt = async (item: Expense) => {
    try {
      const code = item.id.startsWith('MPESA_') ? item.id.replace('MPESA_', '') : item.id;
      const text = `Expense Receipt:\n${item.description}\nAmount: ${formatCurrency(item.amount)}\nCategory: ${item.category}\nDate: ${new Date(item.date).toLocaleString()}\nReceipt Ref: ${code}`;
      await Share.share({ message: text });
    } catch {
      // ignore
    }
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
            placeholder="Search by merchant, category, or code..."
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

      {/* Timeline Grouped Expenses SectionList */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.expenseListContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
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
        renderSectionHeader={({ section: { title, formattedSubtotal } }) => (
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionDateTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.sectionSubtotal, { color: theme.textSecondary }]}>
              {formattedSubtotal}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const meta = getCategoryMeta(item.category);
          const isMpesa = item.id.startsWith('MPESA_');

          return (
            <TouchableOpacity
              style={[
                styles.expenseItem,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => setViewingReceipt(item)}
              activeOpacity={0.7}
            >
              {/* Category Icon Badge */}
              <View style={[styles.categoryIconCircle, { backgroundColor: meta.lightBg }]}>
                <Ionicons name={meta.icon as any} size={20} color={meta.color} />
              </View>

              {/* Middle details */}
              <View style={styles.expenseMiddle}>
                <Text style={[styles.expenseTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.description}
                </Text>

                <View style={styles.expenseMetaRow}>
                  <View style={[styles.categoryTag, { backgroundColor: meta.lightBg }]}>
                    <Text style={[styles.categoryTagText, { color: meta.color }]}>{meta.name}</Text>
                  </View>

                  <Text style={[styles.expenseDate, { color: theme.textSecondary }]}>
                    {new Date(item.date).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  {isMpesa && (
                    <View style={[styles.mpesaTag, { backgroundColor: theme.successBg }]}>
                      <Text style={[styles.mpesaTagText, { color: theme.success }]}>M-PESA</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right side amount & chevron */}
              <View style={styles.expenseRight}>
                <Text style={[styles.expenseAmount, { color: theme.text }]}>
                  {formatCurrency(item.amount)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Digital Receipt Modal Sheet */}
      <Modal
        visible={viewingReceipt !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewingReceipt(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setViewingReceipt(null)}
        >
          {viewingReceipt && (
            <View
              style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}
              onStartShouldSetResponder={() => true}
            >
              {/* Receipt Header Badge */}
              <View style={styles.receiptTopIconCircle}>
                <View style={[styles.receiptSuccessIcon, { backgroundColor: theme.successBg }]}>
                  <Ionicons name="checkmark-circle" size={32} color={theme.success} />
                </View>
              </View>

              <Text style={[styles.receiptHeaderTitle, { color: theme.textSecondary }]}>
                Transaction Receipt
              </Text>

              {/* Amount Display */}
              <Text style={[styles.receiptAmount, { color: theme.text }]}>
                {formatCurrency(viewingReceipt.amount)}
              </Text>

              {/* Merchant / Description */}
              <Text style={[styles.receiptMerchant, { color: theme.text }]} numberOfLines={2}>
                {viewingReceipt.description}
              </Text>

              {/* Perforated / Dashed Separator */}
              <View style={[styles.receiptDivider, { borderBottomColor: theme.borderLight }]} />

              {/* Receipt Details Box */}
              <View style={[styles.receiptDetailsBox, { backgroundColor: theme.inputBackground }]}>
                {/* Category */}
                <View style={styles.receiptDetailRow}>
                  <Text style={[styles.receiptDetailLabel, { color: theme.textSecondary }]}>
                    Category
                  </Text>
                  <View style={styles.receiptCategoryGroup}>
                    <Ionicons
                      name={getCategoryMeta(viewingReceipt.category).icon as any}
                      size={15}
                      color={getCategoryMeta(viewingReceipt.category).color}
                    />
                    <Text style={[styles.receiptDetailValue, { color: theme.text }]}>
                      {viewingReceipt.category || 'Others'}
                    </Text>
                  </View>
                </View>

                {/* Date & Time */}
                <View style={styles.receiptDetailRow}>
                  <Text style={[styles.receiptDetailLabel, { color: theme.textSecondary }]}>
                    Date & Time
                  </Text>
                  <Text style={[styles.receiptDetailValue, { color: theme.text }]}>
                    {new Date(viewingReceipt.date).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                </View>

                {/* M-Pesa Reference ID */}
                <View style={styles.receiptDetailRow}>
                  <Text style={[styles.receiptDetailLabel, { color: theme.textSecondary }]}>
                    Reference Ref
                  </Text>
                  <Text style={[styles.receiptRefCode, { color: theme.primary }]}>
                    {viewingReceipt.id.startsWith('MPESA_')
                      ? viewingReceipt.id.replace('MPESA_', '')
                      : viewingReceipt.id}
                  </Text>
                </View>
              </View>

              {/* Action Buttons on Receipt */}
              <View style={styles.receiptActionRow}>
                <TouchableOpacity
                  style={[styles.receiptSecondaryBtn, { backgroundColor: theme.inputBackground }]}
                  onPress={() => handleShareReceipt(viewingReceipt)}
                >
                  <Ionicons name="share-social-outline" size={16} color={theme.text} />
                  <Text style={[styles.receiptBtnText, { color: theme.text }]}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.receiptSecondaryBtn, { backgroundColor: theme.inputBackground }]}
                  onPress={() => handleOpenEdit(viewingReceipt)}
                >
                  <Ionicons name="pencil-outline" size={16} color={theme.text} />
                  <Text style={[styles.receiptBtnText, { color: theme.text }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.receiptSecondaryBtn, { backgroundColor: theme.dangerBg }]}
                  onPress={() => handleDelete(viewingReceipt.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  <Text style={[styles.receiptBtnText, { color: theme.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={[styles.receiptCloseBtn, { backgroundColor: theme.primary }]}
                onPress={() => setViewingReceipt(null)}
              >
                <Text style={styles.receiptCloseBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  sectionDateTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtotal: {
    fontSize: 13,
    fontWeight: '600',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
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
  receiptTopIconCircle: {
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptSuccessIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  receiptAmount: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  receiptMerchant: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  receiptDetailsBox: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptDetailLabel: {
    fontSize: 13,
  },
  receiptCategoryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptDetailValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  receiptRefCode: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  receiptActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  receiptSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  receiptBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  receiptCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  receiptCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
