import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { isValidEmail } from '../../src/lib/firebase';

const { width } = Dimensions.get('window');

export default function EmailScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    // Reset error state
    setError(null);
    
    // Validate email format
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      // Navigate to password screen with email
      router.push({
        pathname: '/(auth)/password' as any,
        params: { email }
      });
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
          <Text style={styles.title}>Your email</Text>
          <Text style={styles.subtitle}>Enter your email address to get started</Text>
        </View>
        
        <BlurView intensity={20} tint="dark" style={styles.formContainer}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepActive}><Text style={styles.stepText}>1</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>2</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>3</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>4</Text></View>
          </View>
            
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              editable={!loading}
            />
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#ff4d4f" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleContinue}
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
                  <Text style={styles.buttonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.signInButton}>Sign in</Text>
            </TouchableOpacity>
          </View>
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
  },
  input: {
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    color: '#fff',
    fontSize: 16,
    padding: 16,
    marginBottom: 8,
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
  footer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 14,
    marginRight: 8,
  },
  signInButton: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
}); 