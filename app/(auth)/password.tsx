import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { isValidPassword, registerWithEmail } from '../../src/lib/firebase';

const { width } = Dimensions.get('window');

export default function PasswordScreen() {
  const params = useLocalSearchParams();
  const email = params.email as string;
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleRegister = async () => {
    // Reset error state
    setError(null);
    
    // Check if passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password strength
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      return;
    }
    
    setLoading(true);
    
    try {
      // Register user with email and password
      const result = await registerWithEmail(email, password);
      
      if (result.success) {
        // Navigate to display name screen
        router.push('/(auth)/display-name' as any);
      } else {
        const errorMessage = result.error instanceof Error 
          ? result.error.message 
          : 'Failed to create account. Please try again.';
        
        if (errorMessage.includes('email-already-in-use')) {
          setError('This email is already registered. Please sign in.');
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1e1e2e', '#121218']}
        style={styles.background}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Create password</Text>
          <Text style={styles.subtitle}>Choose a secure password for your account</Text>
        </View>
        
        <BlurView intensity={20} tint="dark" style={styles.formContainer}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color="#fff" /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepActive}><Text style={styles.stepText}>2</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>3</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>4</Text></View>
          </View>
            
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setPasswordVisible(!passwordVisible)}>
                <Ionicons 
                  name={passwordVisible ? "eye-off" : "eye"} 
                  size={20} 
                  color="#9ca3af" 
                />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!confirmPasswordVisible}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setError(null);
                }}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
                <Ionicons 
                  name={confirmPasswordVisible ? "eye-off" : "eye"} 
                  size={20} 
                  color="#9ca3af" 
                />
              </TouchableOpacity>
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#ff4d4f" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleRegister}
            disabled={loading}>
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121218',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 30,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  formContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 24,
    backgroundColor: 'rgba(30, 30, 46, 0.6)',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  stepActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepComplete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepInactive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepDivider: {
    width: 24,
    height: 1,
    backgroundColor: '#2a2a3c',
    marginHorizontal: 5,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
    marginTop: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    height: 56,
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(254, 226, 226, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: '#ff4d4f',
    marginLeft: 8,
    fontSize: 14,
  },
  passwordHint: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 8,
  },
  button: {
    height: 54,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
}); 