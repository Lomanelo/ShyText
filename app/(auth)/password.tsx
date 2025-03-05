import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { isValidPassword, storeCredentials } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';

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

  const handleContinue = async () => {
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
      // Store credentials for later registration
      const result = storeCredentials(email, password);
      
      if (result.success) {
        // Navigate to display name screen
        router.push('/(auth)/display-name' as any);
      } else {
        throw new Error('Failed to store credentials');
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
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={[colors.background, colors.lightGray]}
        style={styles.background}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Create password</Text>
          <Text style={styles.subtitle}>Choose a secure password for your account</Text>
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepActive}><Text style={styles.stepText}>2</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>3</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>4</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>5</Text></View>
          </View>
            
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={colors.darkGray}
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
                  color={colors.darkGray} 
                />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                placeholderTextColor={colors.darkGray}
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
                  color={colors.darkGray} 
                />
              </TouchableOpacity>
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleContinue}
            disabled={loading}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}>
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.background} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.darkGray,
    textAlign: 'center',
  },
  formContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.mediumGray,
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepComplete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepInactive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mediumGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepDivider: {
    width: 20,
    height: 1,
    backgroundColor: colors.mediumGray,
    marginHorizontal: 5,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
    marginTop: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.lightGray,
    height: 56,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  passwordInput: {
    flex: 1,
    color: colors.text,
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
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    marginLeft: 8,
    fontSize: 14,
  },
  passwordHint: {
    color: colors.darkGray,
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
    color: colors.background,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
}); 