import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Dimensions, Platform, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { completeUserProfile, getCurrentUser } from '../../src/lib/firebase';

const { width } = Dimensions.get('window');

export default function BirthdateScreen() {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const params = useLocalSearchParams();
  const displayName = params.displayName as string || '';
  
  const monthInputRef = useRef<TextInput>(null);
  const yearInputRef = useRef<TextInput>(null);

  const handleBack = () => {
    Keyboard.dismiss();
    router.back();
  };

  const validateDay = (value: string): boolean => {
    const dayNum = parseInt(value, 10);
    return !isNaN(dayNum) && dayNum >= 1 && dayNum <= 31;
  };

  const validateMonth = (value: string): boolean => {
    const monthNum = parseInt(value, 10);
    return !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12;
  };

  const validateYear = (value: string): boolean => {
    const yearNum = parseInt(value, 10);
    const currentYear = new Date().getFullYear();
    return !isNaN(yearNum) && yearNum >= 1900 && yearNum <= currentYear;
  };

  const isValidDate = (day: string, month: string, year: string): boolean => {
    if (!day || !month || !year) return false;
    
    const d = parseInt(day, 10);
    const m = parseInt(month, 10) - 1; // JavaScript months are 0-indexed
    const y = parseInt(year, 10);
    
    const date = new Date(y, m, d);
    
    return date.getDate() === d && 
           date.getMonth() === m && 
           date.getFullYear() === y;
  };

  const isOver18 = (day: string, month: string, year: string): boolean => {
    const birthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18;
  };

  const handleDayChange = (text: string) => {
    // Allow only numbers
    const formattedText = text.replace(/[^0-9]/g, '');
    
    if (formattedText.length <= 2) {
      setDay(formattedText);
      
      // Auto-advance to month input when 2 digits are entered
      if (formattedText.length === 2 && validateDay(formattedText)) {
        monthInputRef.current?.focus();
      }
    }
  };

  const handleMonthChange = (text: string) => {
    // Allow only numbers
    const formattedText = text.replace(/[^0-9]/g, '');
    
    if (formattedText.length <= 2) {
      setMonth(formattedText);
      
      // Auto-advance to year input when 2 digits are entered
      if (formattedText.length === 2 && validateMonth(formattedText)) {
        yearInputRef.current?.focus();
      }
    }
  };

  const handleYearChange = (text: string) => {
    // Allow only numbers
    const formattedText = text.replace(/[^0-9]/g, '');
    
    if (formattedText.length <= 4) {
      setYear(formattedText);
    }
  };

  const handleSubmit = async () => {
    // Dismiss keyboard
    Keyboard.dismiss();
    
    // Clear any existing errors
    setError(null);
    
    // Validate all fields are filled
    if (!day || !month || !year) {
      setError('Please enter your complete date of birth');
      return;
    }
    
    // Validate individual fields
    if (!validateDay(day)) {
      setError('Please enter a valid day (1-31)');
      return;
    }
    
    if (!validateMonth(month)) {
      setError('Please enter a valid month (1-12)');
      return;
    }
    
    if (!validateYear(year)) {
      setError('Please enter a valid year (1900-present)');
      return;
    }
    
    // Check if the date is valid (e.g., February 31 is not valid)
    if (!isValidDate(day, month, year)) {
      setError('Please enter a valid date');
      return;
    }
    
    // Check if the user is at least 18 years old
    if (!isOver18(day, month, year)) {
      setError('You must be at least 18 years old to sign up');
      return;
    }
    
    setLoading(true);
    
    try {
      // Format the date as ISO string (YYYY-MM-DD)
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Get current user
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      
      // Complete the user profile with collected information
      const result = await completeUserProfile(currentUser.uid, {
        displayName,
        birthDate: formattedDate,
      });
      
      if (result.success) {
        // Navigate to final profile image screen with display name
        router.push({
          pathname: '/(auth)/profile-image' as any,
          params: { displayName }
        });
      } else {
        setError('Failed to save your information. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (year.length === 4) {
      Keyboard.dismiss();
    }
  }, [year]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1e1e2e', '#121218']}
        style={styles.background}
      />
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Your birthdate</Text>
            <Text style={styles.subtitle}>When were you born?</Text>
          </View>
          
          <BlurView intensity={20} tint="dark" style={styles.formContainer}>
            <View style={styles.stepIndicator}>
              <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color="#fff" /></View>
              <View style={styles.stepDivider} />
              <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color="#fff" /></View>
              <View style={styles.stepDivider} />
              <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color="#fff" /></View>
              <View style={styles.stepDivider} />
              <View style={styles.stepActive}><Text style={styles.stepText}>4</Text></View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Date of Birth (DD/MM/YYYY)</Text>
              
              <View style={styles.dateInputs}>
                {/* Day Input */}
                <View style={styles.dateInputWrapper}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="DD"
                    placeholderTextColor="#9ca3af"
                    value={day}
                    onChangeText={handleDayChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={!loading}
                    onBlur={() => {
                      // Format day with leading zero if needed
                      if (day.length === 1) {
                        setDay(day.padStart(2, '0'));
                      }
                    }}
                    returnKeyType="next"
                  />
                  <Text style={styles.dateLabel}>Day</Text>
                </View>
                
                <Text style={styles.dateSeparator}>/</Text>
                
                {/* Month Input */}
                <View style={styles.dateInputWrapper}>
                  <TextInput
                    ref={monthInputRef}
                    style={styles.dateInput}
                    placeholder="MM"
                    placeholderTextColor="#9ca3af"
                    value={month}
                    onChangeText={handleMonthChange}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={!loading}
                    onBlur={() => {
                      // Format month with leading zero if needed
                      if (month.length === 1) {
                        setMonth(month.padStart(2, '0'));
                      }
                    }}
                    returnKeyType="next"
                    onSubmitEditing={() => yearInputRef.current?.focus()}
                  />
                  <Text style={styles.dateLabel}>Month</Text>
                </View>
                
                <Text style={styles.dateSeparator}>/</Text>
                
                {/* Year Input */}
                <View style={styles.dateInputWrapper}>
                  <TextInput
                    ref={yearInputRef}
                    style={styles.dateInput}
                    placeholder="YYYY"
                    placeholderTextColor="#9ca3af"
                    value={year}
                    onChangeText={handleYearChange}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!loading}
                    onBlur={() => {
                      // Validate the year when finished typing
                      if (year.length > 0 && !validateYear(year)) {
                        setError('Please enter a valid year (1900-present)');
                      } else {
                        // If valid year, dismiss keyboard
                        Keyboard.dismiss();
                      }
                    }}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                      if (day && month && year) {
                        handleSubmit();
                      }
                    }}
                  />
                  <Text style={styles.dateLabel}>Year</Text>
                </View>
              </View>
              
              {!error && (
                <Text style={styles.helperText}>
                  You must be at least 18 years old to use this app
                </Text>
              )}
              
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#ff4d4f" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSubmit}
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
                    <Text style={styles.buttonText}>Complete</Text>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      </TouchableWithoutFeedback>
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
    marginBottom: 12,
    fontWeight: '600',
  },
  dateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInput: {
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 42, 60, 0.8)',
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  dateLabel: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  dateSeparator: {
    color: '#fff',
    fontSize: 24,
    marginHorizontal: 8,
    fontWeight: 'bold',
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    padding: 10,
  },
});