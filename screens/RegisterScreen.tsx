import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { login } = useAuth();
  const theme = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    login();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* App Branding */}
        <View style={styles.brandContainer}>
          <View style={[styles.brandIconCircle, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="sparkles" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: theme.text }]}>Get Started</Text>
          <Text style={[styles.brandTagline, { color: theme.textSecondary }]}>
            Create your account to start managing expenses
          </Text>
        </View>

        {/* Register Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Start tracking M-Pesa receipts effortlessly
          </Text>

          {/* Email */}
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
            <Ionicons name="mail-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="name@example.com"
              placeholderTextColor={theme.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Password</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Create a password"
              placeholderTextColor={theme.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Confirm Password</Text>
          <View style={[styles.inputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Re-enter your password"
              placeholderTextColor={theme.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleRegister}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Switch to Login */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.switchRow}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
              <Text style={[styles.linkHighlight, { color: theme.primary }]}>Sign in</Text>
            </Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 13,
  },
  card: {
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  passwordToggle: {
    padding: 6,
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchRow: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
  linkHighlight: {
    fontWeight: '700',
  },
});
