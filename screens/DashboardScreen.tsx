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
  Share,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import SmsListener from 'react-native-android-sms-listener';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';

import { useAuth, extractFirstName, getTimeBasedGreeting } from '../context/AuthContext';
import { useExpenses, Expense } from '../context/ExpenseContext';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import {
  CATEGORIES,
  getCategoryMeta,
  formatCurrency,
} from '../theme';
import { parseMPesaSMS } from '../utils/mpesaParser';

const screenWidth = Dimensions.get('window').width;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function DashboardScreen({ navigation }: any) {
  const { logout, user } = useAuth();
  const { addExpense, addExpenses, expenses, budgets } = useExpenses();
  const { theme, themeMode, setThemeMode, isDark } = useTheme();

  // Modals state
  const [modalVisible, setModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  // Add Expense form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Month selection state: defaults to current month & current year
  const [selectedDate, setSelectedDate] = useState<{ month: number; year: number }>(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const now = new Date();
  const isCurrentMonth =
    selectedDate.month === now.getMonth() && selectedDate.year === now.getFullYear();

  const selectedMonthLabel = `${MONTH_NAMES[selectedDate.month]} ${selectedDate.year}`;

  const goToPreviousMonth = () => {
    setSelectedDate((prev) => {
      if (prev.month === 0) {
        return { month: 11, year: prev.year - 1 };
      }
      return { month: prev.month - 1, year: prev.year };
    });
  };

  const goToNextMonth = () => {
    setSelectedDate((prev) => {
      if (prev.month === 11) {
        return { month: 0, year: prev.year + 1 };
      }
      return { month: prev.month + 1, year: prev.year };
    });
  };

  const resetToCurrentMonth = () => {
    setSelectedDate({ month: now.getMonth(), year: now.getFullYear() });
  };

  // Generate list of available selectable months with counts and totals
  const availableMonths = useMemo(() => {
    const map = new Map<string, { month: number; year: number; count: number; total: number }>();

    // Always include current month
    const curKey = `${now.getFullYear()}-${now.getMonth()}`;
    map.set(curKey, {
      month: now.getMonth(),
      year: now.getFullYear(),
      count: 0,
      total: 0,
    });

    // Include previous 5 months by default
    for (let i = 1; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(k)) {
        map.set(k, { month: d.getMonth(), year: d.getFullYear(), count: 0, total: 0 });
      }
    }

    // Populate data from all recorded expenses
    expenses.forEach((e) => {
      const d = new Date(e.date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = map.get(k) || {
        month: d.getMonth(),
        year: d.getFullYear(),
        count: 0,
        total: 0,
      };
      existing.count += 1;
      existing.total += e.amount;
      map.set(k, existing);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [expenses]);

  // Filter expenses strictly for the selected month and year
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expDate = new Date(e.date);
      return (
        expDate.getFullYear() === selectedDate.year && expDate.getMonth() === selectedDate.month
      );
    });
  }, [expenses, selectedDate]);

  // Aggregate monthly stats
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  // Lifetime expenses total
  const lifetimeTotal = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

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

  // Top category percentage breakdown list
  const categoryBreakdownList = useMemo(() => {
    return Object.entries(categoryTotals)
      .map(([cat, amount]) => {
        const meta = getCategoryMeta(cat);
        const percent = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
        return {
          name: cat,
          amount,
          percent,
          color: meta.color,
          icon: meta.icon,
          lightBg: meta.lightBg,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [categoryTotals, totalExpenses]);

  // Smart Contextual Insight generator
  const smartInsight = useMemo(() => {
    if (filteredExpenses.length === 0) {
      return {
        icon: 'sparkles',
        title: 'Fresh Start',
        message: `No spending recorded yet for ${selectedMonthLabel}. Ready to log your first expense?`,
        type: 'info',
      };
    }

    // Check if any category has exceeded budget
    for (const [cat, limit] of Object.entries(budgets)) {
      if (limit > 0 && (categoryTotals[cat] || 0) >= limit) {
        return {
          icon: 'alert-circle',
          title: 'Budget Alert',
          message: `You've exceeded your ${cat} budget of ${formatCurrency(limit)} for this month.`,
          type: 'danger',
        };
      }
    }

    // Check if near limit
    for (const [cat, limit] of Object.entries(budgets)) {
      if (limit > 0 && (categoryTotals[cat] || 0) >= limit * 0.8) {
        return {
          icon: 'warning',
          title: 'Nearing Budget Limit',
          message: `${cat} spending is at ${Math.round(((categoryTotals[cat] || 0) / limit) * 100)}% of your monthly target.`,
          type: 'warning',
        };
      }
    }

    // Top category insight
    if (topCategory.amount > 0 && totalExpenses > 0) {
      const pct = Math.round((topCategory.amount / totalExpenses) * 100);
      return {
        icon: 'bulb',
        title: 'Spending Pattern',
        message: `${topCategory.name} is your biggest expense at ${pct}% of your ${selectedMonthLabel} spending.`,
        type: 'success',
      };
    }

    return {
      icon: 'checkmark-circle',
      title: 'Looking Good',
      message: `You have ${filteredExpenses.length} transactions totaling ${formatCurrency(totalExpenses)} this month.`,
      type: 'info',
    };
  }, [filteredExpenses, selectedMonthLabel, budgets, categoryTotals, topCategory, totalExpenses]);

  // Monthly Pie chart data
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

  // Recent 5 transactions for the selected month
  const recentExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [filteredExpenses]);

  // Export to CSV helper
  const handleExportCSV = async () => {
    try {
      const headers = 'ID,Date,Description,Category,Amount(KES)\n';
      const rows = expenses
        .map((e) => `"${e.id}","${new Date(e.date).toISOString().substring(0, 10)}","${e.description.replace(/"/g, '""')}","${e.category}",${e.amount.toFixed(2)}`)
        .join('\n');
      const csvData = headers + rows;

      await Share.share({
        message: csvData,
        title: 'Expense_Tracker_Export.csv',
      });
    } catch (err: any) {
      Alert.alert('Export', 'CSV data generated:\n' + expenses.length + ' expenses exported.');
    }
  };

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

  // Auto-sync & SMS Listener setup
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

  const greeting = getTimeBasedGreeting();
  const displayName = extractFirstName(user?.name || user?.email || 'Charity');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header with Profile Avatar & Action Icons */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.headerBrand}
          onPress={() => setProfileModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{greeting},</Text>
            <View style={styles.headerNameRow}>
              <Text style={[styles.title, { color: theme.text }]}>{displayName} 👋</Text>
              <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Quick Theme Toggle */}
          <TouchableOpacity
            onPress={() => setThemeMode(isDark ? 'light' : 'dark')}
            style={[styles.headerIconButton, { backgroundColor: theme.inputBackground }]}
            accessibilityLabel="Toggle Theme"
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={18}
              color={isDark ? '#FBBF24' : theme.text}
            />
          </TouchableOpacity>

          {/* Quick Sync SMS */}
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

          {/* Settings Button */}
          <TouchableOpacity
            onPress={() => setProfileModalVisible(true)}
            style={[styles.headerIconButton, { backgroundColor: theme.inputBackground }]}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card: Financial Balance for Selected Month */}
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Month Selector Bar */}
          <View style={[styles.monthNavigatorRow, { backgroundColor: theme.inputBackground }]}>
            <TouchableOpacity
              onPress={goToPreviousMonth}
              style={styles.monthNavBtn}
              accessibilityLabel="Previous Month"
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMonthPickerVisible(true)}
              style={styles.monthSelectorPill}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={15} color={theme.primary} />
              <Text style={[styles.monthSelectorText, { color: theme.text }]}>
                {selectedMonthLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goToNextMonth}
              style={styles.monthNavBtn}
              accessibilityLabel="Next Month"
            >
              <Ionicons name="chevron-forward" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Balance & Month Heading */}
          <View style={styles.heroHeader}>
            <View>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                {isCurrentMonth ? 'This Month Spent' : `${MONTH_NAMES[selectedDate.month]} Spend`}
              </Text>
              <Text style={[styles.heroTotal, { color: theme.text }]}>
                {formatCurrency(totalExpenses)}
              </Text>
            </View>

            {!isCurrentMonth && (
              <TouchableOpacity
                onPress={resetToCurrentMonth}
                style={[styles.todayJumpBadge, { backgroundColor: theme.primaryLight }]}
              >
                <Ionicons name="return-up-back" size={12} color={theme.primary} />
                <Text style={[styles.todayJumpText, { color: theme.primary }]}>This Month</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Metrics Bar for Selected Month */}
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

          {/* Category Pie Chart & Breakdown Bars for Selected Month */}
          {filteredExpenses.length > 0 ? (
            <View style={styles.chartContainer}>
              <Text style={[styles.chartTitle, { color: theme.textSecondary }]}>
                Spending by Category ({MONTH_NAMES[selectedDate.month]})
              </Text>
              <PieChart
                data={pieChartData}
                width={screenWidth - 56}
                height={165}
                chartConfig={chartConfig}
                accessor={'population'}
                backgroundColor={'transparent'}
                paddingLeft={'15'}
                absolute
              />

              {/* Compact Category Allocation Bars */}
              <View style={styles.allocationBarsContainer}>
                {categoryBreakdownList.slice(0, 3).map((item) => (
                  <View key={item.name} style={styles.allocationRow}>
                    <View style={styles.allocationHeader}>
                      <View style={styles.allocationTitleGroup}>
                        <View style={[styles.allocationDot, { backgroundColor: item.color }]} />
                        <Text style={[styles.allocationName, { color: theme.text }]}>
                          {item.name}
                        </Text>
                      </View>
                      <Text style={[styles.allocationAmount, { color: theme.textSecondary }]}>
                        {formatCurrency(item.amount)} ({item.percent}%)
                      </Text>
                    </View>
                    <View style={[styles.allocationTrack, { backgroundColor: theme.inputBackground }]}>
                      <View
                        style={[
                          styles.allocationFill,
                          { width: `${item.percent}%`, backgroundColor: item.color },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyChartBox}>
              <Ionicons name="pie-chart-outline" size={36} color={theme.textTertiary} />
              <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
                No expenses recorded for {selectedMonthLabel}.
              </Text>
            </View>
          )}
        </View>

        {/* Smart Contextual Insight Banner */}
        <View
          style={[
            styles.insightCard,
            {
              backgroundColor:
                smartInsight.type === 'danger'
                  ? theme.dangerBg
                  : smartInsight.type === 'warning'
                  ? theme.warningBg
                  : theme.primaryLight,
              borderColor:
                smartInsight.type === 'danger'
                  ? theme.danger + '30'
                  : smartInsight.type === 'warning'
                  ? theme.warning + '30'
                  : theme.primary + '30',
            },
          ]}
        >
          <View style={styles.insightIconCircle}>
            <Ionicons
              name={smartInsight.icon as any}
              size={20}
              color={
                smartInsight.type === 'danger'
                  ? theme.danger
                  : smartInsight.type === 'warning'
                  ? theme.warning
                  : theme.primary
              }
            />
          </View>
          <View style={styles.insightTextGroup}>
            <Text
              style={[
                styles.insightTitle,
                {
                  color:
                    smartInsight.type === 'danger'
                      ? theme.danger
                      : smartInsight.type === 'warning'
                      ? theme.warning
                      : theme.primary,
                },
              ]}
            >
              {smartInsight.title}
            </Text>
            <Text style={[styles.insightMessage, { color: theme.text }]}>
              {smartInsight.message}
            </Text>
          </View>
        </View>

        {/* Quick Action Row */}
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

        {/* Recent Transactions Section for Selected Month */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {selectedMonthLabel} Activity
          </Text>
          {filteredExpenses.length > 0 && (
            <TouchableOpacity onPress={() => navigation?.navigate('Expenses')}>
              <Text style={[styles.viewAllText, { color: theme.primary }]}>
                View All ({filteredExpenses.length})
              </Text>
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
              No expenses recorded in {selectedMonthLabel}.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Profile & Settings Bottom Sheet Modal */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileModalVisible(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Profile & Settings</Text>
              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={[styles.closeModalBtn, { backgroundColor: theme.inputBackground }]}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* User Identity Card */}
              <View style={[styles.userProfileCard, { backgroundColor: theme.inputBackground }]}>
                <View style={[styles.largeAvatar, { backgroundColor: theme.primary }]}>
                  <Text style={styles.largeAvatarText}>{initial}</Text>
                </View>
                <View style={styles.userProfileInfo}>
                  <Text style={[styles.userProfileName, { color: theme.text }]}>{displayName}</Text>
                  <Text style={[styles.userProfileEmail, { color: theme.textSecondary }]}>
                    {user?.email || 'charity@example.com'}
                  </Text>
                </View>
              </View>

              {/* Theme Selector */}
              <Text style={[styles.sheetSectionTitle, { color: theme.textSecondary }]}>Appearance</Text>
              <View style={[styles.themePillsContainer, { backgroundColor: theme.inputBackground }]}>
                {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => {
                  const isSelected = themeMode === mode;
                  const iconName =
                    mode === 'system' ? 'phone-portrait-outline' : mode === 'light' ? 'sunny-outline' : 'moon-outline';
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.themePill,
                        isSelected && [styles.themePillActive, { backgroundColor: theme.card }],
                      ]}
                      onPress={() => setThemeMode(mode)}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={15}
                        color={isSelected ? theme.primary : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.themePillText,
                          {
                            color: isSelected ? theme.primary : theme.textSecondary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Financial Snapshot */}
              <Text style={[styles.sheetSectionTitle, { color: theme.textSecondary }]}>Financial Snapshot</Text>
              <View style={[styles.statsGrid, { backgroundColor: theme.inputBackground }]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxNumber, { color: theme.text }]}>{expenses.length}</Text>
                  <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Transactions</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxNumber, { color: theme.primary }]}>
                    {formatCurrency(lifetimeTotal)}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Lifetime Spend</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statBox}>
                  <Text style={[styles.statBoxNumber, { color: theme.text }]}>
                    {Object.values(budgets).filter((b) => b > 0).length}
                  </Text>
                  <Text style={[styles.statBoxLabel, { color: theme.textSecondary }]}>Budgets Set</Text>
                </View>
              </View>

              {/* Data Actions */}
              <Text style={[styles.sheetSectionTitle, { color: theme.textSecondary }]}>Data & Sync</Text>
              <TouchableOpacity
                style={[styles.sheetActionRow, { backgroundColor: theme.inputBackground }]}
                onPress={handleExportCSV}
              >
                <View style={styles.sheetActionLeft}>
                  <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                  <Text style={[styles.sheetActionText, { color: theme.text }]}>Export All to CSV</Text>
                </View>
                <Ionicons name="download-outline" size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionRow, { backgroundColor: theme.inputBackground, marginTop: 8 }]}
                onPress={() => {
                  setProfileModalVisible(false);
                  syncMpesaSms(false);
                }}
              >
                <View style={styles.sheetActionLeft}>
                  <Ionicons name="sync-outline" size={20} color={theme.success} />
                  <Text style={[styles.sheetActionText, { color: theme.text }]}>Scan M-Pesa SMS Inbox</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Logout Button */}
              <TouchableOpacity
                style={[styles.logoutSheetBtn, { backgroundColor: theme.dangerBg }]}
                onPress={() => {
                  setProfileModalVisible(false);
                  logout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color={theme.danger} />
                <Text style={[styles.logoutSheetText, { color: theme.danger }]}>Sign Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Select Month Modal */}
      <Modal
        visible={monthPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMonthPickerVisible(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View style={styles.monthModalTitleRow}>
                <Ionicons name="calendar" size={20} color={theme.primary} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Month</Text>
              </View>
              <TouchableOpacity
                onPress={() => setMonthPickerVisible(false)}
                style={[styles.closeModalBtn, { backgroundColor: theme.inputBackground }]}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.monthListScroll}>
              {availableMonths.map((m) => {
                const isSelected =
                  m.month === selectedDate.month && m.year === selectedDate.year;
                const isCurrent =
                  m.month === now.getMonth() && m.year === now.getFullYear();

                return (
                  <TouchableOpacity
                    key={`${m.year}-${m.month}`}
                    style={[
                      styles.monthOptionItem,
                      {
                        backgroundColor: isSelected ? theme.primaryLight : theme.inputBackground,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedDate({ month: m.month, year: m.year });
                      setMonthPickerVisible(false);
                    }}
                  >
                    <View style={styles.monthOptionLeft}>
                      <Text
                        style={[
                          styles.monthOptionTitle,
                          {
                            color: isSelected ? theme.primary : theme.text,
                            fontWeight: isSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {MONTH_NAMES[m.month]} {m.year}
                      </Text>
                      <Text style={[styles.monthOptionSubtitle, { color: theme.textSecondary }]}>
                        {m.count} {m.count === 1 ? 'transaction' : 'transactions'} •{' '}
                        {formatCurrency(m.total)}
                      </Text>
                    </View>

                    <View style={styles.monthOptionRight}>
                      {isCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: theme.successBg }]}>
                          <Text style={[styles.currentBadgeText, { color: theme.success }]}>
                            Current
                          </Text>
                        </View>
                      )}
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modern Add Expense Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
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
                          {
                            color: isSelected ? '#FFFFFF' : theme.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
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
              <View
                style={[
                  styles.amountInputContainer,
                  { backgroundColor: theme.inputBackground, borderColor: theme.border },
                ]}
              >
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
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
              />

              {/* Date Selector */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.dateSelectorBtn,
                  { backgroundColor: theme.inputBackground, borderColor: theme.border },
                ]}
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
                  onChange={(event, selectedDateVal) => {
                    setShowDatePicker(false);
                    if (selectedDateVal) setDate(selectedDateVal);
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
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 19,
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
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  monthNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 5,
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  monthSelectorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
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
  todayJumpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  todayJumpText: {
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  allocationBarsContainer: {
    width: '100%',
    marginTop: 8,
    gap: 8,
  },
  allocationRow: {
    width: '100%',
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  allocationTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allocationName: {
    fontSize: 12,
    fontWeight: '600',
  },
  allocationAmount: {
    fontSize: 11,
  },
  allocationTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  allocationFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyChartBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyChartText: {
    fontSize: 13,
    marginTop: 8,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  insightIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightTextGroup: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  insightMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
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
    marginBottom: 18,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  monthListScroll: {
    maxHeight: 320,
    marginBottom: 12,
  },
  monthOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  monthOptionLeft: {
    flex: 1,
  },
  monthOptionTitle: {
    fontSize: 15,
    marginBottom: 3,
  },
  monthOptionSubtitle: {
    fontSize: 12,
  },
  monthOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  userProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    gap: 14,
  },
  largeAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  userProfileInfo: {
    flex: 1,
  },
  userProfileName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  userProfileEmail: {
    fontSize: 13,
  },
  sheetSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  themePillsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  themePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  themePillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  themePillText: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxNumber: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  sheetActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
  },
  sheetActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 12,
  },
  logoutSheetText: {
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
