import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
};

interface ExpenseContextType {
  expenses: Expense[];
  budgets: Record<string, number>;
  addExpense: (expense: Expense) => void;
  addExpenses: (newExpenses: Expense[]) => void;
  removeExpense: (id: string) => void;
  setBudget: (category: string, amount: number) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const EXPENSES_STORAGE_KEY = '@expenses_data';
const BUDGETS_STORAGE_KEY = '@budgets_data';

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Request notification permissions
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    if (Platform.OS !== 'web') {
      requestPermissions();
    }
  }, []);

  // Load from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedExpenses = await AsyncStorage.getItem(EXPENSES_STORAGE_KEY);
        if (storedExpenses) setExpenses(JSON.parse(storedExpenses));

        const storedBudgets = await AsyncStorage.getItem(BUDGETS_STORAGE_KEY);
        if (storedBudgets) setBudgets(JSON.parse(storedBudgets));
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save to storage on change
  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
          await AsyncStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(budgets));
        } catch (e) {
          console.error('Failed to save data', e);
        }
      };
      saveData();
    }
  }, [expenses, budgets, isLoaded]);

  const addExpense = (expense: Expense) => {
    setExpenses((prev) => {
      if (prev.some(e => e.id === expense.id)) return prev;
      const newExpenses = [expense, ...prev];
      
      // Check Budgets
      if (expense.category && budgets[expense.category]) {
        const limit = budgets[expense.category];
        const currentTotal = newExpenses
          .filter(e => e.category === expense.category)
          .reduce((sum, e) => sum + e.amount, 0);
          
        const previousTotal = currentTotal - expense.amount;
        
        if (currentTotal >= limit && previousTotal < limit) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: `Budget Exceeded! 🚨`,
              body: `You have exceeded your ${expense.category} budget of KES ${limit}.`,
            },
            trigger: null,
          });
        } else if (currentTotal >= limit * 0.8 && previousTotal < limit * 0.8) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: `Budget Warning ⚠️`,
              body: `You've used 80% of your ${expense.category} budget (KES ${limit}).`,
            },
            trigger: null,
          });
        }
      }

      return newExpenses;
    });
  };

  const addExpenses = (newItems: Expense[]) => {
    setExpenses((prev) => {
      const existingIds = new Set(prev.map(e => e.id));
      const toAdd = newItems.filter(item => !existingIds.has(item.id));
      if (toAdd.length === 0) return prev;
      return [...toAdd, ...prev];
    });
  };

  const removeExpense = (id: string) => {
    setExpenses((prev) => prev.filter(exp => exp.id !== id));
  };

  const setBudget = (category: string, amount: number) => {
    setBudgets((prev) => ({ ...prev, [category]: amount }));
  };

  if (!isLoaded) return null; // Or a loading spinner

  return (
    <ExpenseContext.Provider value={{ expenses, budgets, addExpense, addExpenses, removeExpense, setBudget }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
};
