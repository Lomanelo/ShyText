import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { auth, verifyPhoneNumber } from '../../src/lib/firebase';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function VerifyScreen() {
  const params = useLocalSearchParams();
  const phoneNumber = params.phoneNumber as string;
  const verificationId = params.verificationId as string;
  
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Create refs for 6 input fields
  const inputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];
  
  // State to track each digit
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  
  // Focus first input on component mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);
  
  // Handle input change for each digit
  const handleCodeDigitChange = (text: string, index: number) => {
    if (text.length > 1) {
      text = text.charAt(0);
    }
    
    // Update the digit at this index
    const newCodeDigits = [...codeDigits];
    newCodeDigits[index] = text;
    setCodeDigits(newCodeDigits);
    
    // Combine digits for the full code
    const fullCode = newCodeDigits.join('');
    setVerificationCode(fullCode);
    
    // Auto-focus next input if a digit was entered
    if (text.length === 1 && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };
  
  // Handle backspace for each input
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && !codeDigits[index]) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For mobile testing, we can use our mock code
      if (Platform.OS !== 'web' && verificationCode === '123456') {
        console.log('Using mock verification success path');
        // Success path for our mock implementation
        router.push('/(auth)/display-name' as any);
        return;
      }
      
      // For web and real implementations, use the verificationId
      const confirmation = { verificationId };
      const result = await verifyPhoneNumber(confirmation, verificationCode);
      
      if (result.success) {
        // Navigate to the next step - display name
        router.push('/(auth)/display-name' as any);
      } else {
        throw new Error(result.error ? (result.error as Error).message : 'Invalid verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    // TODO: Implement resend code functionality
    router.back();
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
          <Text style={styles.title}>Verification</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to {phoneNumber}</Text>
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
            
          <View style={styles.codeInputContainer}>
            {inputRefs.map((ref, index) => (
              <TextInput
                key={index}
                ref={ref}
                style={styles.codeInput}
                keyboardType="number-pad"
                maxLength={1}
                value={codeDigits[index]}
                onChangeText={(text) => handleCodeDigitChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                editable={!loading}
              />
            ))}
          </View>
          
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ff4d4f" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleVerify}
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
                  <Text style={styles.buttonText}>Verify</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Didn't receive a code?</Text>
            <TouchableOpacity onPress={handleResendCode} disabled={loading}>
              <Text style={styles.resendButton}>Try again</Text>
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
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeInput: {
    width: 45,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  resendButton: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
}); 