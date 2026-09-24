import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useThemeColors } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const theme = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.text }]}>
        <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Login to manage your expenses</Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={login}>
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={[styles.linkText, { color: theme.textSecondary }]}>
            Don't have an account? <Text style={[styles.linkHighlight, { color: theme.primary }]}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20 
  },
  card: {
    borderRadius: 16,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center'
  },
  input: { 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: { 
    textAlign: 'center', 
    fontSize: 14 
  },
  linkHighlight: {
    fontWeight: '600',
  }
});
