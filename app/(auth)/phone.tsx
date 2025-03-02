import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../src/lib/firebase';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import CountryPicker, { Country, CountryCode } from 'react-native-country-picker-modal';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [country, setCountry] = useState<Country>({
    callingCode: ['1'],
    cca2: 'US',
    currency: ['USD'],
    flag: 'flag-us',
    name: 'United States',
    region: 'Americas',
    subregion: 'North America'
  });

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
      
      // For web, we would use RecaptchaVerifier
      // For mobile, we would use the native Firebase SDK
      // This is a simplified example - in a real app, you'd need to use
      // the appropriate Firebase phone auth method for the platform
      
      // For demonstration purposes only:
      // In a real implementation, you would use:
      // const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container');
      // const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
      // setVerificationId(confirmation.verificationId);
      
      // Simulating successful code sending
      setVerificationId('mock-verification-id');
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('Please enter a valid verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create credential with the verification ID and code
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      
      // Sign in with the credential
      await signInWithCredential(auth, credential);
      
      router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
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
    <View style={styles.container}>
      <View style={styles.content}>
        {step === 'phone' ? (
          <>
            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code to get started
            </Text>
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
                  containerButtonStyle={styles.countryPickerContainer}
                  renderFlagButton={() => (
                    <View style={styles.selectedCountry}>
                      <Text style={styles.countryCodeText}>
                        +{country.callingCode[0]}
                      </Text>
                    </View>
                  )}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                placeholder="Phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                value={formatDisplayNumber(phoneNumber)}
                onChangeText={setPhoneNumber}
                editable={!loading}
                maxLength={12}
              />
            </View>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                {error.includes('provider configuration') && (
                  <Text style={styles.errorHint}>
                    The phone service is not properly configured. Please ensure your Twilio "From" number is set correctly in Supabase.
                  </Text>
                )}
                {error.includes('not available') && (
                  <Text style={styles.errorHint}>
                    To enable phone authentication, configure a phone provider in your Supabase project settings.
                  </Text>
                )}
              </View>
            )}
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSendCode}
              disabled={loading}>
              <LinearGradient
                colors={['#007AFF', '#0055FF']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>
                  {loading ? 'Sending...' : 'Send Code'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter verification code</Text>
            <Text style={styles.subtitle}>
              We sent a code to +{country.callingCode[0]} {formatDisplayNumber(phoneNumber)}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#666"
              keyboardType="number-pad"
              value={verificationCode}
              onChangeText={setVerificationCode}
              maxLength={6}
              editable={!loading}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}>
              <LinearGradient
                colors={['#007AFF', '#0055FF']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('phone')}
              disabled={loading}>
              <Text style={styles.backButtonText}>Change phone number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
    textAlign: 'center',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countryPickerButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginRight: 10,
    minWidth: 80,
  },
  countryPickerContainer: {
    alignItems: 'center',
  },
  selectedCountry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    marginBottom: 15,
  },
  errorText: {
    color: '#ff4444',
    marginBottom: 5,
    textAlign: 'center',
  },
  errorHint: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});