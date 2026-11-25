import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  PermissionsAndroid,
  Alert,
  ActivityIndicator,
  NativeModules,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import SmsListener from 'react-native-android-sms-listener';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';

import { useAuth } from '../context/AuthContext';
import { useExpenses, Expense } from '../context/ExpenseContext';
import {
  useThemeColors,
  CATEGORIES,
  getCategoryMeta,
  formatCurrency,
} from '../theme';
import { parseMPesaSMS } from '../utils/mpesaParser';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen({ navigation }: any) {
  const { logout } = useAuth();
  const { addExpense, addExpenses, expenses } = useExpenses();
  const theme = useThemeColors();

  // Add Expense Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Timeframe filter for dashboard stats: 'month' | 'all'
  const [timeframe, setTimeframe] = useState<'month' | 'all'>('month');

  // Filter expenses based on timeframe
  const filteredExpenses = useMemo(() => {
    if (timeframe === 'all') return expenses;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return expenses.filter((e) => {
      const expDate = new Date(e.date);
      return expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;
    });
  }, [expenses, timeframe]);

  // Aggregate stats
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  const categoryTotals = useMemo(() => {
    return filteredExpenses.reduce((acc, exp) => {
      const cat = exp.category || 'Others';
      acc[cat] = (acc[cat] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredExpenses]);

  const topCategory = useMemo(() => {
    let topCat = 'None';
    let max = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > max) {
        max = val;
        topCat = cat;
      }
    });
    return { name: topCat, amount: max };
  }, [categoryTotals]);

  // Pie chart data
  const pieChartData = useMemo(() => {
    return Object.keys(categoryTotals).map((cat) => {
      const meta = getCategoryMeta(cat);
      return {
        name: cat,
        population: Math.round(categoryTotals[cat]),
        color: meta.color,
        legendFontColor: theme.textSecondary,
        legendFontSize: 12,
      };
    });
  }, [categoryTotals, theme.textSecondary]);

  // Recent 4 transactions
  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [expenses]);

  // Sync past M-Pesa SMS from device inbox
  const syncMpesaSms = useCallback(
    async (silent = false) => {
      if (Platform.OS !== 'android') {
        if (!silent) {
          Alert.alert('Info', 'SMS auto-sync is supported on Android devices.');
        }
        return;
      }

      const smsModule = SmsAndroid?.list ? SmsAndroid : NativeModules.Sms;
      if (!smsModule || typeof smsModule.list !== 'function') {
        if (!silent) {
          Alert.alert('Not Supported', 'SMS reading module is not available on this device build.');
        }
        return;
      }

      try {
        setIsSyncing(true);

        const hasReadPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
        if (!hasReadPermission) {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
            title: 'M-Pesa SMS Permission',
            message: 'Expense Tracker needs permission to read SMS to automatically import your M-Pesa receipts.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          });
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            if (!silent) {
              Alert.alert('Permission Denied', 'SMS permission is required to scan your inbox for M-Pesa messages.');
            }
            setIsSyncing(false);
            return;
          }
        }

        const filter = JSON.stringify({
          box: 'inbox',
          maxCount: 500,
        });

        smsModule.list(
          filter,
          (fail: string) => {
            console.warn('Failed to read SMS inbox:', fail);
            setIsSyncing(false);
            if (!silent) {
              Alert.alert('Sync Error', 'Could not access SMS inbox: ' + fail);
            }
          },
          (count: number, smsListStr: string) => {
            setIsSyncing(false);
            try {
              const messages: Array<{ _id: string | number; address?: string; body?: string; date?: number }> =
                JSON.parse(smsListStr);
              const newExpensesToImport: Expense[] = [];
              const existingIds = new Set(expenses.map((e) => e.id));

              for (const msg of messages) {
                const body = msg.body || '';
                const address = (msg.address || '').toUpperCase();

                if (address.includes('MPESA') || /confirmed/i.test(body) || /ksh/i.test(body)) {
                  const parsed = parseMPesaSMS(body);
                  if (parsed && parsed.amount > 0) {
                    const expenseId = `MPESA_${parsed.id}`;

                    const alreadyExists =
                      existingIds.has(expenseId) ||
                      expenses.some(
                        (e) =>
                          e.id === expenseId ||
                          (e.description.toLowerCase() === parsed.description.toLowerCase() &&
                            e.amount === parsed.amount &&
                            e.date.substring(0, 10) === parsed.date.toISOString().substring(0, 10))
                      );

                    if (!alreadyExists) {
                      const transactionDate = parsed.date || (msg.date ? new Date(msg.date) : new Date());
                      newExpensesToImport.push({
                        id: expenseId,
                        description: parsed.description,
                        amount: parsed.amount,
                        category: parsed.suggestedCategory || 'Others',
                        date: transactionDate.toISOString(),
                      });
                      existingIds.add(expenseId);
                    }
                  }
                }
              }

              if (newExpensesToImport.length > 0) {
                addExpenses(newExpensesToImport);
                Alert.alert(
                  'M-Pesa Sync Complete! 🎉',
                  `Found and imported ${newExpensesToImport.length} M-Pesa expense${
                    newExpensesToImport.length > 1 ? 's' : ''
                  } directly into your tracker!`,
                  [{ text: 'Awesome' }]
                );
              } else if (!silent) {
                Alert.alert('All Caught Up! ✅', 'No new M-Pesa receipts found in your recent SMS inbox.');
              }
            } catch (err) {
              console.error('Error parsing SMS:', err);
              if (!silent) {
                Alert.alert('Error', 'Failed to process SMS messages.');
              }
            }
          }
        );
      } catch (err) {
        console.error('SMS sync error:', err);
        setIsSyncing(false);
      }
    },
    [expenses, addExpenses]
  );

  // Request SMS Permission, auto-sync and start live listener
  useEffect(() => {
    async function setupPermissionsAndListener() {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
          ]);

          if (granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED) {
            syncMpesaSms(true);
          }
        } catch (err) {
          console.warn('Permission request error:', err);
        }
      }
    }

    setupPermissionsAndListener();

    let subscription: any;
    try {
      if (SmsListener && typeof SmsListener.addListener === 'function') {
        subscription = SmsListener.addListener(
          (message: { originatingAddress: string; body: string; timestamp: number }) => {
            const sender = (message.originatingAddress || '').toUpperCase();
            const body = message.body || '';

            if (sender.includes('MPESA') || /ksh/i.test(body) || /confirmed/i.test(body)) {
              const parsed = parseMPesaSMS(body);
              if (parsed && parsed.amount > 0) {
                const expenseId = `MPESA_${parsed.id}`;
                const suggestedCat = parsed.suggestedCategory || 'Others';

                Alert.alert(
                  'M-Pesa Expense Detected! 📱',
                  `KES ${parsed.amount.toFixed(2)} - ${parsed.description}\nCategory: ${suggestedCat}`,
                  [
                    {
                      text: 'Review & Edit',
                      onPress: () => {
                        setDescription(parsed.description);
                        setAmount(parsed.amount.toString());
                        setCategory(suggestedCat);
                        setDate(parsed.date);
                        setModalVisible(true);
                      },
                      style: 'cancel',
                    },
                    {
                      text: 'Add Now',
                      onPress: () => {
                        addExpense({
                          id: expenseId,
                          description: parsed.description,
                          amount: parsed.amount,
                          category: suggestedCat,
                          date: parsed.date.toISOString(),
                        });
                      },
                      style: 'default',
                    },
                  ]
                );
              }
            }
          }
        );
      }
    } catch (e) {
      console.warn('Could not attach SmsListener:', e);
    }

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  const handleAddExpense = () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      description: description.trim(),
      amount: parsedAmount,
      category: category || 'Others',
      date: date.toISOString(),
    };

    addExpense(newExpense);
    setDescription('');
    setAmount('');
    setCategory(CATEGORIES[0].name);
    setDate(new Date());
    setModalVisible(false);
  };

  const chartConfig = {
    backgroundGradientFrom: theme.card,
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: theme.card,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerBrand}>
          <View style={[styles.brandIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="wallet" size={20} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Welcome Back</Text>
            <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => syncMpesaSms(false)}
            disabled={isSyncing}
            style={[styles.headerIconButton, { backgroundColor: theme.inputBackground }]}
            accessibilityLabel="Sync SMS"
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="sync" size={18} color={theme.text} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={logout}
            style={[styles.headerIconButton, { backgroundColor: theme.dangerBg }]}
            accessibilityLabel="Logout"
          >
            <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card: Financial Balance */}
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>Total Expenses</Text>
              <Text style={[styles.heroTotal, { color: theme.text }]}>{formatCurrency(totalExpenses)}</Text>
            </View>

            {/* Timeframe Pill Selector */}
            <View style={[styles.timeframePill, { backgroundColor: theme.inputBackground }]}>
              <TouchableOpacity
                onPress={() => setTimeframe('month')}
                style={[
                  styles.timeframeOption,
                  timeframe === 'month' && [styles.timeframeOptionActive, { backgroundColor: theme.card }],
                ]}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    { color: timeframe === 'month' ? theme.primary : theme.textSecondary },
                  ]}
                >
                  This Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTimeframe('all')}
                style={[
                  styles.timeframeOption,
                  timeframe === 'all' && [styles.timeframeOptionActive, { backgroundColor: theme.card }],
                ]}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    { color: timeframe === 'all' ? theme.primary : theme.textSecondary },
                  ]}
                >
                  All Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={[styles.metricsRow, { borderTopColor: theme.borderLight }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Transactions</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{filteredExpenses.length}</Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />

            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Top Category</Text>
              <Text style={[styles.metricValue, { color: theme.primary }]} numberOfLines={1}>
                {topCategory.name}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />

            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Average</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {filteredExpenses.length > 0
                  ? formatCurrency(totalExpenses / filteredExpenses.length)
                  : 'KES 0'}
              </Text>
            </View>
          </View>

          {/* Category Pie Chart */}
          {filteredExpenses.length > 0 ? (
            <View style={styles.chartContainer}>
              <Text style={[styles.chartTitle, { color: theme.textSecondary }]}>Spending by Category</Text>
              <PieChart
                data={pieChartData}
                width={screenWidth - 56}
                height={170}
                chartConfig={chartConfig}
                accessor={'population'}
                backgroundColor={'transparent'}
                paddingLeft={'15'}
                absolute
              />
            </View>
          ) : (
            <View style={styles.emptyChartBox}>
              <Ionicons name="pie-chart-outline" size={36} color={theme.textTertiary} />
              <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
                No expenses logged for this period yet.
              </Text>
            </View>
          )}
        </View>

        {/* Quick Action Banner */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => syncMpesaSms(false)}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="cloud-download-outline" size={18} color={theme.primary} />
            )}
            <Text style={[styles.secondaryActionText, { color: theme.text }]}>
              {isSyncing ? 'Scanning...' : 'Sync M-Pesa'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live M-Pesa Sync Banner */}
        <TouchableOpacity
          onPress={() => syncMpesaSms(false)}
          activeOpacity={0.85}
          style={[styles.syncStatusCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.syncStatusLeft}>
            <View style={[styles.syncIconCircle, { backgroundColor: theme.successBg }]}>
              <Ionicons name="phone-portrait-outline" size={22} color={theme.success} />
            </View>
            <View style={styles.syncStatusTextGroup}>
              <View style={styles.syncStatusHeader}>
                <Text style={[styles.syncStatusTitle, { color: theme.text }]}>M-Pesa Smart Reader</Text>
                <View style={[styles.statusBadge, { backgroundColor: theme.successBg }]}>
                  <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                  <Text style={[styles.statusBadgeText, { color: theme.success }]}>Active</Text>
                </View>
              </View>
              <Text style={[styles.syncStatusDesc, { color: theme.textSecondary }]}>
                SMS receipts are automatically tracked in real-time.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </TouchableOpacity>

        {/* Recent Transactions Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
          {expenses.length > 0 && (
            <TouchableOpacity onPress={() => navigation?.navigate('Expenses')}>
              <Text style={[styles.viewAllText, { color: theme.primary }]}>View All ({expenses.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentExpenses.length > 0 ? (
          <View style={[styles.recentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {recentExpenses.map((item, index) => {
              const meta = getCategoryMeta(item.category);
              const isMpesa = item.id.startsWith('MPESA_');
              const isLast = index === recentExpenses.length - 1;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.transactionItem,
                    !isLast && [styles.transactionBorder, { borderBottomColor: theme.borderLight }],
                  ]}
                  onPress={() => navigation?.navigate('Expenses')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconBg, { backgroundColor: meta.lightBg }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>

                  <View style={styles.transactionMiddle}>
                    <Text style={[styles.transactionTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                    <View style={styles.transactionMetaRow}>
                      <Text style={[styles.transactionDate, { color: theme.textSecondary }]}>
                        {new Date(item.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {isMpesa && (
                        <View style={[styles.mpesaBadge, { backgroundColor: theme.successBg }]}>
                          <Text style={[styles.mpesaBadgeText, { color: theme.success }]}>M-PESA</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text style={[styles.transactionAmount, { color: theme.text }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyRecentCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="receipt-outline" size={32} color={theme.textTertiary} />
            <Text style={[styles.emptyRecentText, { color: theme.textSecondary }]}>
              No transactions recorded yet.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modern Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add New Expense</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeModalBtn, { backgroundColor: theme.inputBackground }]}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category Chips */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select Category</Text>
              <View style={styles.categoryChipsGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      onPress={() => setCategory(cat.name)}
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
                        size={16}
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
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus={true}
                />
              </View>

              {/* Description Input */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description</Text>
              <TextInput
                placeholder="What was this expense for?"
                placeholderTextColor={theme.textTertiary}
                style={[styles.textInput, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                value={description}
                onChangeText={setDescription}
              />

              {/* Date Selector */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateSelectorBtn, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                <Text style={[styles.dateSelectorText, { color: theme.text }]}>
                  {date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
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

              {/* Action Buttons */}
              <TouchableOpacity
                onPress={handleAddExpense}
                style={[styles.saveExpenseBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.saveExpenseBtnText}>Save Expense</Text>
              </TouchableOpacity>
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
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroTotal: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  timeframePill: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  timeframeOption: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  timeframeOptionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  timeframeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  emptyChartBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyChartText: {
    fontSize: 13,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  syncStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  syncIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncStatusTextGroup: {
    flex: 1,
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  syncStatusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  syncStatusDesc: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  recentCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  transactionBorder: {
    borderBottomWidth: 1,
  },
  categoryIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionMiddle: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  transactionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transactionDate: {
    fontSize: 12,
  },
  mpesaBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mpesaBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  emptyRecentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentText: {
    fontSize: 13,
    marginTop: 8,
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
  saveExpenseBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 12,
  },
  saveExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
