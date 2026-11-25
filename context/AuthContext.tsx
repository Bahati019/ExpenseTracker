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

/**
 * Common first names (English, Christian & Kenyan) to reliably detect
 * and extract the first name from concatenated email usernames (e.g. "charitybahati19" -> "Charity")
 */
const COMMON_NAMES = [
  'charity', 'faith', 'mercy', 'grace', 'joy', 'hope', 'peace', 'patience',
  'mary', 'jane', 'sarah', 'esther', 'ruth', 'naomi', 'hannah', 'rebecca',
  'rachel', 'leah', 'miriam', 'deborah', 'lydia', 'dorcas', 'priscilla',
  'sharon', 'brenda', 'carol', 'caroline', 'cynthia', 'daisy', 'diana',
  'elizabeth', 'emily', 'fiona', 'gloria', 'helen', 'irene', 'ivy',
  'jackline', 'janet', 'joan', 'judith', 'juliet', 'karen', 'laura',
  'lillian', 'lucy', 'millicent', 'monica', 'nancy', 'patricia', 'pauline',
  'rose', 'salome', 'stella', 'susan', 'teresa', 'valerie', 'veronica',
  'vivian', 'winfred', 'winnie', 'yvonne', 'agnes', 'alice', 'beatrice',
  'catherine', 'christine', 'dorothy', 'florence', 'gladys', 'hilda',
  'john', 'peter', 'james', 'david', 'paul', 'joseph', 'daniel', 'samuel',
  'michael', 'george', 'brian', 'kevin', 'victor', 'dennis', 'collins',
  'stephen', 'antony', 'anthony', 'charles', 'edwin', 'eric', 'felix',
  'ian', 'kenneth', 'mark', 'martin', 'matthew', 'philip', 'richard',
  'robert', 'simon', 'thomas', 'vincent', 'william', 'allan', 'alex',
  'bernard', 'boniface', 'caleb', 'christopher', 'edward', 'emmanuel',
  'francis', 'geoffrey', 'gideon', 'henry', 'isaac', 'jackson', 'jacob',
  'joshua', 'kelvin', 'lawrence', 'moses', 'nathan', 'nicholas', 'patrick'
];

/**
 * Intelligently extracts just the first name from an email or full name.
 * Handles:
 * - "charitybahati19@gmail.com" -> "Charity"
 * - "charity.bahati@..." -> "Charity"
 * - "charity_b@..." -> "Charity"
 * - "Charity Bahati" -> "Charity"
 * - "charity19" -> "Charity"
 */
export function extractFirstName(input?: string): string {
  if (!input || !input.trim()) return 'Charity';

  const raw = input.trim();

  // If input is an email, take the part before @
  let username = raw.includes('@') ? raw.split('@')[0] : raw;

  // If input has spaces (e.g. "Charity Bahati"), take the first word
  if (username.includes(' ')) {
    const firstWord = username.split(/\s+/)[0];
    return capitalize(firstWord.replace(/[^A-Za-z]/g, ''));
  }

  // If separated by dots, underscores, hyphens (e.g. "charity.bahati" or "charity_19")
  const splitByDelim = username.split(/[._\-+]/);
  if (splitByDelim.length > 1) {
    const firstPart = splitByDelim[0].replace(/\d+/g, '');
    if (firstPart.length >= 2) {
      return capitalize(firstPart);
    }
  }

  // Remove trailing numbers (e.g. "charitybahati19" -> "charitybahati", "charity19" -> "charity")
  const strippedDigits = username.replace(/\d+$/g, '');
  const lower = strippedDigits.toLowerCase();

  // Check against common first names list to separate compound usernames like "charitybahati"
  for (const name of COMMON_NAMES) {
    if (lower.startsWith(name)) {
      return capitalize(name);
    }
  }

  // Remove any remaining numbers
  const lettersOnly = strippedDigits.replace(/\d+/g, '');
  if (lettersOnly.length >= 2) {
    return capitalize(lettersOnly);
  }

  return capitalize(raw);
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Returns dynamic greeting based on local time:
 * - 00:00 - 11:59: "Good morning"
 * - 12:00 - 16:59: "Good afternoon"
 * - 17:00 - 23:59: "Good evening"
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  } else if (hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

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
          const parsed = JSON.parse(storedUser);
          // Ensure first name formatting is applied
          const cleanName = extractFirstName(parsed.name || parsed.email);
          setUser({
            name: cleanName,
            email: parsed.email || '',
          });
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
          name: extractFirstName(credentials.name),
          email: credentials?.email?.trim() || '',
        };
      } else if (credentials?.email) {
        const cleanName = extractFirstName(credentials.email);
        profileToSet = {
          name: cleanName,
          email: credentials.email.trim(),
        };
      } else if (user) {
        profileToSet = {
          name: extractFirstName(user.name || user.email),
          email: user.email,
        };
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
      const cleanName = extractFirstName(name || email);
      const profile: UserProfile = {
        name: cleanName,
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
    const updated = {
      ...user,
      ...data,
      name: data.name ? extractFirstName(data.name) : user.name,
    };
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
