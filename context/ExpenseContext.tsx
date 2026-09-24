import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
};

interface ExpenseContextType {
  expenses: Expense[];
  addExpense: (expense: Expense) => void;
  removeExpense: (id: string) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const EXPENSES_STORAGE_KEY = '@expenses_data';

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const storedExpenses = await AsyncStorage.getItem(EXPENSES_STORAGE_KEY);
        if (storedExpenses) {
          setExpenses(JSON.parse(storedExpenses));
        }
      } catch (e) {
        console.error('Failed to load expenses', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadExpenses();
  }, []);

  // Save to storage on change
  useEffect(() => {
    if (isLoaded) {
      const saveExpenses = async () => {
        try {
          await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
        } catch (e) {
          console.error('Failed to save expenses', e);
        }
      };
      saveExpenses();
    }
  }, [expenses, isLoaded]);

  const addExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  const removeExpense = (id: string) => {
    setExpenses((prev) => prev.filter(exp => exp.id !== id));
  };

  if (!isLoaded) return null; // Or a loading spinner

  return (
    <ExpenseContext.Provider value={{ expenses, addExpense, removeExpense }}>
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
