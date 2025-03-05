import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { updateRegistrationData } from '../../src/lib/firebase';
import colors from '../../src/theme/colors';

export default function DisplayNameScreen() {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = async () => {
    // Reset error state
    setError(null);
    
    // Validate display name
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update registration data with display name
      const result = updateRegistrationData({
        displayName: displayName.trim()
      });
      
      if (result.success) {
        // Navigate to birthdate screen
        router.push('/(auth)/birthdate' as any);
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
          <Text style={styles.title}>Your name</Text>
          <Text style={styles.subtitle}>How should we call you?</Text>
        </View>
        
        <View style={styles.formContainer}>
          <View style={styles.stepIndicator}>
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepComplete}><Ionicons name="checkmark" size={16} color={colors.background} /></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepActive}><Text style={styles.stepText}>3</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>4</Text></View>
            <View style={styles.stepDivider} />
            <View style={styles.stepInactive}><Text style={styles.stepText}>5</Text></View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={colors.darkGray}
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                setError(null);
              }}
              editable={!loading}
            />
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <Text style={styles.hint}>
              This is how people will see you on the platform
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
  },
  input: {
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
    color: colors.text,
    fontSize: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.mediumGray,
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