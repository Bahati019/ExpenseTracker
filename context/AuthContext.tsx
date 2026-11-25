import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  name: string;
  email: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: UserProfile | null;
  login: (credentials?: { email?: string; name?: string }) => Promise<void>;
  register: (name: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = '@auth_user_profile';
const AUTH_LOGGED_IN_KEY = '@auth_is_logged_in';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Restore stored session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedLoggedIn = await AsyncStorage.getItem(AUTH_LOGGED_IN_KEY);
        const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedLoggedIn === 'true') {
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.warn('Failed to restore auth session:', err);
      }
    };

    restoreSession();
  }, []);

  const login = async (credentials?: { email?: string; name?: string }) => {
    try {
      let profileToSet: UserProfile;

      if (credentials?.name && credentials.name.trim()) {
        profileToSet = {
          name: credentials.name.trim(),
          email: credentials?.email?.trim() || '',
        };
      } else if (credentials?.email) {
        // If existing user already has a saved name, keep it
        const savedName = user?.name || credentials.email.split('@')[0];
        // Capitalize first letter of derived name
        const formattedName = savedName.charAt(0).toUpperCase() + savedName.slice(1);
        profileToSet = {
          name: formattedName,
          email: credentials.email.trim(),
        };
      } else if (user) {
        profileToSet = user;
      } else {
        profileToSet = {
          name: 'Charity',
          email: 'charity@example.com',
        };
      }

      setUser(profileToSet);
      setIsLoggedIn(true);

      await AsyncStorage.setItem(AUTH_LOGGED_IN_KEY, 'true');
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(profileToSet));
    } catch (err) {
      console.warn('Login error:', err);
      setIsLoggedIn(true);
    }
  };

  const register = async (name: string, email: string) => {
    try {
      const trimmedName = name.trim() || 'Charity';
      const formattedName = trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1);
      const profile: UserProfile = {
        name: formattedName,
        email: email.trim(),
      };

      setUser(profile);
      setIsLoggedIn(true);

      await AsyncStorage.setItem(AUTH_LOGGED_IN_KEY, 'true');
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn('Register error:', err);
      setIsLoggedIn(true);
    }
  };

  const logout = async () => {
    try {
      setIsLoggedIn(false);
      await AsyncStorage.setItem(AUTH_LOGGED_IN_KEY, 'false');
    } catch (err) {
      console.warn('Logout error:', err);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    try {
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Update profile error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
