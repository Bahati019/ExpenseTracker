import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useExpenses } from '../context/ExpenseContext';
import {
  useThemeColors,
  CATEGORIES,
  getCategoryMeta,
  formatCurrency,
} from '../theme';

export default function BudgetsScreen() {
  const { expenses, budgets, setBudget } = useExpenses();
  const theme = useThemeColors();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [budgetInput, setBudgetInput] = useState('');

  // Current month's expenses calculation
  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return expenses.filter((e) => {
      const expDate = new Date(e.date);
      return expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;
    });
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    return currentMonthExpenses.reduce((acc, exp) => {
      const cat = exp.category || 'Others';
      acc[cat] = (acc[cat] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [currentMonthExpenses]);

  // Total budget & spending calculations
  const totalBudgeted = useMemo(() => {
    return Object.values(budgets).reduce((sum, limit) => sum + (limit || 0), 0);
  }, [budgets]);

  const totalSpentAcrossBudgeted = useMemo(() => {
    return Object.keys(budgets).reduce((sum, cat) => {
      if (budgets[cat] > 0) {
        return sum + (categoryTotals[cat] || 0);
      }
      return sum;
    }, 0);
  }, [budgets, categoryTotals]);

  const overallProgress = useMemo(() => {
    if (totalBudgeted <= 0) return 0;
    return Math.min(Math.round((totalSpentAcrossBudgeted / totalBudgeted) * 100), 100);
  }, [totalBudgeted, totalSpentAcrossBudgeted]);

  const remainingBudget = totalBudgeted - totalSpentAcrossBudgeted;

  // Safe daily spend analytics
  const now = new Date();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - now.getDate() + 1);
  const safeDailySpend = remainingBudget > 0 ? remainingBudget / daysRemaining : 0;

  const handleSaveBudget = () => {
    if (selectedCategory) {
      const parsed = parseFloat(budgetInput);
      setBudget(selectedCategory, isNaN(parsed) || parsed < 0 ? 0 : parsed);
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

  const handlePreset = (amount: number) => {
    const current = parseFloat(budgetInput) || 0;
    setBudgetInput((current + amount).toString());
  };

  const handleClearBudget = () => {
    setBudgetInput('0');
  };

  const selectedCategoryMeta = getCategoryMeta(selectedCategory);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Financial Goals</Text>
          <Text style={[styles.title, { color: theme.text }]}>Monthly Budgets</Text>
        </View>

        <View style={[styles.activeBudgetCountPill, { backgroundColor: theme.primaryLight }]}>
          <Ionicons name="pie-chart" size={14} color={theme.primary} />
          <Text style={[styles.activeBudgetCountText, { color: theme.primary }]}>
            {Object.values(budgets).filter((b) => b > 0).length} Set
          </Text>
        </View>
      </View>

      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          /* Financial Health Hero Overview Card */
          <View style={[styles.healthCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.healthCardHeader}>
              <View>
                <Text style={[styles.healthCardSubtitle, { color: theme.textSecondary }]}>
                  Monthly Budget Status
                </Text>
                <Text style={[styles.healthCardAmount, { color: theme.text }]}>
                  {totalBudgeted > 0 ? formatCurrency(totalSpentAcrossBudgeted) : 'No Budgets Configured'}
                </Text>
              </View>

              {totalBudgeted > 0 && (
                <View
                  style={[
                    styles.statusBadgePill,
                    {
                      backgroundColor:
                        overallProgress >= 100
                          ? theme.dangerBg
                          : overallProgress >= 80
                          ? theme.warningBg
                          : theme.successBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgePillText,
                      {
                        color:
                          overallProgress >= 100
                            ? theme.danger
                            : overallProgress >= 80
                            ? theme.warning
                            : theme.success,
                      },
                    ]}
                  >
                    {overallProgress}% Used
                  </Text>
                </View>
              )}
            </View>

            {totalBudgeted > 0 ? (
              <>
                {/* Overall Progress Bar */}
                <View style={[styles.progressBarContainer, { backgroundColor: theme.inputBackground }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${overallProgress}%`,
                        backgroundColor:
                          overallProgress >= 100
                            ? theme.danger
                            : overallProgress >= 80
                            ? theme.warning
                            : theme.primary,
                      },
                    ]}
                  />
                </View>

                {/* Health Metrics Details Row */}
                <View style={[styles.healthMetricsRow, { borderTopColor: theme.borderLight }]}>
                  <View style={styles.healthMetricCol}>
                    <Text style={[styles.healthMetricLabel, { color: theme.textSecondary }]}>Total Limit</Text>
                    <Text style={[styles.healthMetricValue, { color: theme.text }]}>
                      {formatCurrency(totalBudgeted)}
                    </Text>
                  </View>

                  <View style={[styles.healthDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.healthMetricCol}>
                    <Text style={[styles.healthMetricLabel, { color: theme.textSecondary }]}>
                      {remainingBudget >= 0 ? 'Remaining' : 'Exceeded By'}
                    </Text>
                    <Text
                      style={[
                        styles.healthMetricValue,
                        { color: remainingBudget >= 0 ? theme.success : theme.danger },
                      ]}
                    >
                      {formatCurrency(Math.abs(remainingBudget))}
                    </Text>
                  </View>
                </View>

                {/* Safe Daily Allowance Analytics Banner */}
                {remainingBudget > 0 ? (
                  <View style={[styles.dailyAllowanceBanner, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
                    <View style={styles.dailyAllowanceTextGroup}>
                      <Text style={[styles.dailyAllowanceTitle, { color: theme.primary }]}>
                        Safe Daily Allowance: {formatCurrency(safeDailySpend)}/day
                      </Text>
                      <Text style={[styles.dailyAllowanceSubtitle, { color: theme.textSecondary }]}>
                        Remaining for the next {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} to stay on track.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.dailyAllowanceBanner, { backgroundColor: theme.dangerBg }]}>
                    <Ionicons name="alert-circle" size={18} color={theme.danger} />
                    <View style={styles.dailyAllowanceTextGroup}>
                      <Text style={[styles.dailyAllowanceTitle, { color: theme.danger }]}>
                        Monthly Target Exceeded
                      </Text>
                      <Text style={[styles.dailyAllowanceSubtitle, { color: theme.text }]}>
                        Total spending is {formatCurrency(Math.abs(remainingBudget))} over your set limit.
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Text style={[styles.noBudgetHelperText, { color: theme.textSecondary }]}>
                Tap any category below to set a monthly spending target and track your limits in real-time.
              </Text>
            )}
          </View>
        }
        renderItem={({ item: catMeta }) => {
          const category = catMeta.name;
          const spent = categoryTotals[category] || 0;
          const limit = budgets[category] || 0;
          let progress = 0;
          let statusText = 'No Limit';
          let statusColor = theme.textSecondary;
          let statusBg = theme.inputBackground;

          if (limit > 0) {
            progress = Math.min(Math.round((spent / limit) * 100), 100);
            if (spent >= limit) {
              statusText = 'Over Limit';
              statusColor = theme.danger;
              statusBg = theme.dangerBg;
            } else if (progress >= 80) {
              statusText = 'Near Limit';
              statusColor = theme.warning;
              statusBg = theme.warningBg;
            } else {
              statusText = 'On Track';
              statusColor = theme.success;
              statusBg = theme.successBg;
            }
          }

          const remaining = limit - spent;

          return (
            <TouchableOpacity
              style={[styles.budgetCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => openModal(category)}
              activeOpacity={0.8}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.categoryIconCircle, { backgroundColor: catMeta.lightBg }]}>
                    <Ionicons name={catMeta.icon as any} size={20} color={catMeta.color} />
                  </View>
                  <View>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{category}</Text>
                    <Text style={[styles.limitSubtext, { color: theme.textSecondary }]}>
                      {limit > 0 ? `Target: ${formatCurrency(limit)}` : 'Tap to set monthly target'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.categoryStatusPill, { backgroundColor: statusBg }]}>
                  <Text style={[styles.categoryStatusText, { color: statusColor }]}>{statusText}</Text>
                </View>
              </View>

              {/* Spending Stats */}
              <View style={styles.cardStatsRow}>
                <View>
                  <Text style={[styles.spentAmountText, { color: theme.text }]}>
                    {formatCurrency(spent)}{' '}
                    <Text style={[styles.spentLabelSub, { color: theme.textSecondary }]}>spent this month</Text>
                  </Text>
                </View>

                {limit > 0 && (
                  <Text
                    style={[
                      styles.remainingAmountText,
                      { color: remaining >= 0 ? theme.textSecondary : theme.danger },
                    ]}
                  >
                    {remaining >= 0 ? `${formatCurrency(remaining)} left` : `+${formatCurrency(Math.abs(remaining))} over`}
                  </Text>
                )}
              </View>

              {/* Progress Bar */}
              {limit > 0 ? (
                <View style={[styles.progressBarContainer, { backgroundColor: theme.inputBackground }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progress}%`,
                        backgroundColor:
                          spent >= limit ? theme.danger : progress >= 80 ? theme.warning : catMeta.color,
                      },
                    ]}
                  />
                </View>
              ) : (
                <View style={[styles.noLimitNotice, { backgroundColor: theme.inputBackground }]}>
                  <Ionicons name="add-circle-outline" size={14} color={theme.primary} />
                  <Text style={[styles.noLimitNoticeText, { color: theme.primary }]}>Set Monthly Limit</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Set Budget Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={[styles.modalCategoryIconCircle, { backgroundColor: selectedCategoryMeta.lightBg }]}>
                  <Ionicons name={selectedCategoryMeta.icon as any} size={18} color={selectedCategoryMeta.color} />
                </View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedCategory} Budget
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeModalBtn, { backgroundColor: theme.inputBackground }]}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Monthly Limit (KES)</Text>
              <View style={[styles.amountInputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Text style={[styles.currencyPrefix, { color: theme.primary }]}>KES</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="numeric"
                  style={[styles.amountInput, { color: theme.text }]}
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  autoFocus={true}
                />
              </View>

              {/* Quick Preset Buttons */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Quick Add Presets</Text>
              <View style={styles.presetRow}>
                <TouchableOpacity
                  onPress={() => handlePreset(1000)}
                  style={[styles.presetBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                >
                  <Text style={[styles.presetBtnText, { color: theme.text }]}>+1,000</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePreset(5000)}
                  style={[styles.presetBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                >
                  <Text style={[styles.presetBtnText, { color: theme.text }]}>+5,000</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handlePreset(10000)}
                  style={[styles.presetBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
                >
                  <Text style={[styles.presetBtnText, { color: theme.text }]}>+10,000</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClearBudget}
                  style={[styles.presetBtn, { backgroundColor: theme.dangerBg, borderColor: theme.dangerBg }]}
                >
                  <Text style={[styles.presetBtnText, { color: theme.danger }]}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={[styles.cancelBtn, { backgroundColor: theme.inputBackground }]}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveBudget}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.saveBtnText}>Save Budget</Text>
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
  activeBudgetCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeBudgetCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  healthCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  healthCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  healthCardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  healthCardAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  healthMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  healthMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  healthDivider: {
    width: 1,
    height: 26,
  },
  healthMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  healthMetricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  dailyAllowanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  dailyAllowanceTextGroup: {
    flex: 1,
  },
  dailyAllowanceTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  dailyAllowanceSubtitle: {
    fontSize: 11,
  },
  noBudgetHelperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  budgetCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  limitSubtext: {
    fontSize: 12,
  },
  categoryStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  spentAmountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  spentLabelSub: {
    fontSize: 12,
    fontWeight: '400',
  },
  remainingAmountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noLimitNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  noLimitNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 22,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalCategoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 8,
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
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
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
