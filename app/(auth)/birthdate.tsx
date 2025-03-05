import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { updateRegistrationData } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';

export default function BirthdateScreen() {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const monthInputRef = useRef<TextInput>(null);
  const yearInputRef = useRef<TextInput>(null);
  
  const handleBack = () => {
    router.back();
  };
  
  const handleContinue = async () => {
    // Reset error state
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
    
    // Calculate age
    const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    // Check if user is at least 18
    if (age < 18) {
      setError('You must be at least 18 years old to use this app');
      return;
    }
    
    setLoading(true);
    
    try {
      // Format birthdate as YYYY-MM-DD (ISO format for better compatibility)
      const formattedDay = day.padStart(2, '0');
      const formattedMonth = month.padStart(2, '0');
      // This format ensures the date will be correctly parsed in JavaScript
      const isoFormattedDate = `${year}-${formattedMonth}-${formattedDay}`;
      
      // Update registration data with birthdate
      const result = updateRegistrationData({
        birthDate: isoFormattedDate
      });
      
      if (result.success) {
        // Navigate to profile image screen
        router.push('/(auth)/profile-image' as any);
      } else {
        throw new Error(result.error ? result.error.toString() : 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
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
      
      // Dismiss keyboard when 4 digits are entered
      if (formattedText.length === 4) {
        Keyboard.dismiss();
      }
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
          <Text style={styles.title}>Your birthdate</Text>
          <Text style={styles.subtitle}>When were you born?</Text>
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepActive}><Text style={styles.stepText}>4</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>5</Text></View>
          </View>
          
          <View style={styles.dateContainer}>
            <Text style={styles.label}>Date of Birth (DD/MM/YYYY)</Text>
            
            <View style={styles.dateInputs}>
              {/* Day Input */}
              <View style={styles.dateInputWrapper}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="DD"
                  placeholderTextColor={colors.darkGray}
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
                  placeholderTextColor={colors.darkGray}
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
                  placeholderTextColor={colors.darkGray}
                  value={year}
                  onChangeText={handleYearChange}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!loading}
                  returnKeyType="done"
                />
                <Text style={styles.dateLabel}>Year</Text>
              </View>
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <Text style={styles.hint}>
              You must be at least 18 years old to use this app
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
  dateContainer: {
    marginBottom: 24,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '600',
  },
  dateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dateInputWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  dateInput: {
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
    color: colors.text,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '600',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  dateLabel: {
    color: colors.darkGray,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  dateSeparator: {
    color: colors.text,
    fontSize: 24,
    marginHorizontal: 8,
    fontWeight: 'bold',
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
  hint: {
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