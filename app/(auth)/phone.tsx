import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { auth, sendVerificationCode, initRecaptchaVerifier } from '../../src/lib/firebase';
import CountryPicker, { Country, CountryCode } from 'react-native-country-picker-modal';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [country, setCountry] = useState<Country>({
    callingCode: ['1'],
    cca2: 'US' as CountryCode,
    currency: ['USD'],
    flag: 'flag-us',
    name: 'United States',
    region: 'Americas',
    subregion: 'North America'
  });
  const recaptchaContainerRef = useRef(null);

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    return cleaned;
  };

  const handleSendCode = async () => {
    const cleaned = formatPhoneNumber(phoneNumber);
    if (!cleaned || cleaned.length < 7) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fullPhoneNumber = `+${country.callingCode[0]}${cleaned}`;
      
      // For web, initialize recaptcha
      let verifier = null;
      if (Platform.OS === 'web') {
        verifier = initRecaptchaVerifier('recaptcha-container');
      }
      
      const result = await sendVerificationCode(fullPhoneNumber, verifier);
      
      if (result.success && result.confirmationResult) {
        // For mobile, store verification info using AsyncStorage in a real app
        // For demo/testing, we'll use mock values
        if (Platform.OS !== 'web') {
          // In a real app, you would store the verification ID
          // In our mock implementation, we know the test code is 123456
          console.log('Using mock verification flow for mobile');
        }
        
        // Navigate to verify screen with simplified params
        router.push({
          pathname: '/(auth)/verify' as any,
          params: {
            phoneNumber: fullPhoneNumber,
            // For both web and mobile, we pass verificationId
            verificationId: result.confirmationResult.verificationId
          }
        });
      } else {
        throw new Error(result.error ? (result.error as Error).message : 'Failed to send verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayNumber = (number: string) => {
    const cleaned = formatPhoneNumber(number);
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const onSelectCountry = (selectedCountry: Country) => {
    setCountry(selectedCountry);
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
          <Text style={styles.title}>Sign Up</Text>
          <Text style={styles.subtitle}>Enter your phone number to get started</Text>
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
            
          <View style={styles.phoneInputContainer}>
            <TouchableOpacity
              style={styles.countryPickerButton}
              onPress={() => setShowCountryPicker(true)}>
              <CountryPicker
                countryCode={country.cca2 as CountryCode}
                withFlag
                withCallingCode
                withFilter
                withAlphaFilter
                onSelect={onSelectCountry}
                visible={showCountryPicker}
                onClose={() => setShowCountryPicker(false)}
                renderFlagButton={() => (
                  <View style={styles.selectedCountry}>
                    <Text style={styles.countryFlag}>{country.flag}</Text>
                    <Text style={styles.countryCodeText}>
                      +{country.callingCode[0]}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8a8a8a" />
                  </View>
                )}
              />
            </TouchableOpacity>
            
            <TextInput
              style={styles.phoneInput}
              placeholder="Your phone number"
              placeholderTextColor="#8a8a8a"
              keyboardType="phone-pad"
              value={formatDisplayNumber(phoneNumber)}
              onChangeText={setPhoneNumber}
              editable={!loading}
              maxLength={12}
            />
          </View>
          
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ff4d4f" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          {Platform.OS === 'web' && <div id="recaptcha-container" ref={recaptchaContainerRef} />}
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleSendCode}
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
          
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By continuing, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
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
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countryPickerButton: {
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    minWidth: 100,
  },
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryFlag: {
    fontSize: 16,
    marginRight: 8,
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 16,
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
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
  termsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  termsText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
  termsLink: {
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
});