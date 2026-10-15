import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import SmsListener from 'react-native-android-sms-listener';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';

import { useAuth } from '../context/AuthContext';
import { useExpenses, Expense } from '../context/ExpenseContext';
import { useThemeColors } from '../theme';
import { parseMPesaSMS } from '../utils/mpesaParser';

const screenWidth = Dimensions.get('window').width;

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#EF4444',
  Transport: '#3B82F6',
  Utilities: '#F59E0B',
  Entertainment: '#10B981',
  Others: '#8B5CF6',
};

export default function DashboardScreen() {
  const { logout } = useAuth();
  const { addExpense, addExpenses, expenses } = useExpenses();
  const theme = useThemeColors();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync past M-Pesa SMS from device inbox
  const syncMpesaSms = useCallback(async (silent = false) => {
    if (Platform.OS !== 'android') return;

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
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'M-Pesa SMS Permission',
            message: 'Expense Tracker needs permission to read SMS to automatically import your M-Pesa receipts.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
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
        maxCount: 100,
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
            const messages: Array<{ _id: string | number; address?: string; body?: string; date?: number }> = JSON.parse(smsListStr);
            const newExpensesToImport: Expense[] = [];
            const existingIds = new Set(expenses.map(e => e.id));

            for (const msg of messages) {
              const body = msg.body || '';
              const address = (msg.address || '').toUpperCase();

              // Filter for M-Pesa messages
              if (address.includes('MPESA') || /confirmed/i.test(body) || /ksh/i.test(body)) {
                const parsed = parseMPesaSMS(body);
                if (parsed && parsed.amount > 0) {
                  const expenseId = `MPESA_${parsed.id}`;

                  // Avoid duplicates by M-Pesa ID or matching exact details
                  const alreadyExists = existingIds.has(expenseId) || expenses.some(
                    e => e.id === expenseId || (e.description.toLowerCase() === parsed.description.toLowerCase() && e.amount === parsed.amount && e.date.substring(0, 10) === parsed.date.toISOString().substring(0, 10))
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
                `Found and imported ${newExpensesToImport.length} M-Pesa expense${newExpensesToImport.length > 1 ? 's' : ''} directly into your tracker!`,
                [{ text: 'Great!' }]
              );
            } else if (!silent) {
              Alert.alert('All Caught Up! ✅', 'No new M-Pesa expenses found in your recent SMS inbox.');
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
  }, [expenses, addExpenses]);

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
            console.log('READ_SMS permission granted, running initial sync');
            // Auto sync past messages on startup
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
        subscription = SmsListener.addListener((message: { originatingAddress: string; body: string; timestamp: number }) => {
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
        });
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
    if (!description || !amount || !category) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      description,
      amount: parseFloat(amount),
      category,
      date: date.toISOString(),
    };

    addExpense(newExpense);

    setDescription('');
    setAmount('');
    setCategory('');
    setDate(new Date());
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.keys(categoryTotals).map((cat) => ({
    name: cat,
    population: categoryTotals[cat],
    color: CATEGORY_COLORS[cat] || '#CBD5E1',
    legendFontColor: theme.textSecondary,
    legendFontSize: 12,
  }));

  const chartConfig = {
    backgroundGradientFrom: theme.background,
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: theme.background,
    backgroundGradientToOpacity: 0.5,
    color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Expense Tracker</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => syncMpesaSms(false)} 
            disabled={isSyncing}
            style={[styles.syncHeaderButton, { backgroundColor: theme.inputBackground }]}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={theme.text} />
            )}
            <Text style={[styles.syncHeaderText, { color: theme.text }]}>Sync</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={[styles.logoutButton, { backgroundColor: theme.dangerBg }]}>
            <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
          <Text style={styles.summaryTitle}>Total Spent</Text>
          <Text style={styles.summaryTotal}>KES {totalExpenses.toFixed(2)}</Text>
          
          {expenses.length > 0 ? (
            <PieChart
              data={pieChartData}
              width={screenWidth - 80}
              height={180}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"0"}
              absolute
            />
          ) : (
            <Text style={styles.noDataText}>No expenses yet. Add one or sync M-Pesa below!</Text>
          )}
        </View>

        {/* Quick Sync Card */}
        <TouchableOpacity 
          onPress={() => syncMpesaSms(false)}
          disabled={isSyncing}
          style={[styles.syncCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.text }]}
        >
          <View style={styles.syncCardLeft}>
            <View style={[styles.syncIconContainer, { backgroundColor: theme.primary + '18' }]}>
              {isSyncing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="cloud-download-outline" size={22} color={theme.primary} />
              )}
            </View>
            <View style={styles.syncTextContainer}>
              <Text style={[styles.syncCardTitle, { color: theme.text }]}>
                {isSyncing ? 'Scanning M-Pesa SMS...' : 'Scan & Sync M-Pesa SMS'}
              </Text>
              <Text style={[styles.syncCardSubtitle, { color: theme.textSecondary }]}>
                Import your recent M-Pesa receipts automatically
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Expense Form Card */}
        <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.text }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Add New Expense</Text>
          <TextInput
            placeholder="Description"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            placeholder="Amount (KES)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
            value={amount}
            onChangeText={setAmount}
          />
          <View style={[styles.pickerContainer, { backgroundColor: theme.inputBackground }]}>
            <Picker
              selectedValue={category}
              onValueChange={(itemValue) => setCategory(itemValue)}
              style={[styles.picker, { color: theme.text }]}
            >
              <Picker.Item label="Select Category" value="" color={theme.textSecondary} />
              <Picker.Item label="Food" value="Food" />
              <Picker.Item label="Transport" value="Transport" />
              <Picker.Item label="Utilities" value="Utilities" />
              <Picker.Item label="Entertainment" value="Entertainment" />
              <Picker.Item label="Others" value="Others" />
            </Picker>
          </View>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[styles.input, styles.dateButton, { backgroundColor: theme.inputBackground }]}
          >
            <Text style={{ color: theme.text }}>{date.toDateString()}</Text>
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

          <TouchableOpacity onPress={handleAddExpense} style={[styles.primaryButton, { backgroundColor: theme.text }]}>
            <Text style={[styles.primaryButtonText, { color: theme.background }]}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'android' ? 60 : 70,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  syncHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  syncHeaderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  summaryTitle: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryTotal: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
  },
  noDataText: {
    color: '#E0E7FF',
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 10,
  },
  syncCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  syncCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  syncIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncTextContainer: {
    flex: 1,
  },
  syncCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  syncCardSubtitle: {
    fontSize: 12,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
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
  dateButton: {
    justifyContent: 'center',
    height: 55,
  },
  primaryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

