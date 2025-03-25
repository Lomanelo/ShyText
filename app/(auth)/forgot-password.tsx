import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, getFirestore } from 'firebase/firestore';

export default function ForgotPasswordScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fullUsername, setFullUsername] = useState('');

  // Update full username when username changes
  React.useEffect(() => {
    if (username.trim()) {
      // Add @shytext suffix to username if not already included
      if (username.includes('@shytext')) {
        setFullUsername(username.trim());
      } else {
        setFullUsername(`${username.trim()}@shytext`);
      }
    } else {
      setFullUsername('');
    }
  }, [username]);

  const handleBack = () => {
    router.back();
  };

  const handleResetPassword = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      // Validate username
      if (!username.trim()) {
        setError('Please enter your username');
        setLoading(false);
        return;
      }
      
      // Strip @shytext suffix if user included it in their input
      let usernameForQuery = username.trim();
      if (usernameForQuery.includes('@shytext')) {
        usernameForQuery = usernameForQuery.split('@shytext')[0];
      }
      
      // Format the username with the @shytext suffix for the database query
      const formattedUsername = `${usernameForQuery}@shytext`;
      
      // Find the email associated with this username
      const db = getFirestore();
      const usersRef = collection(db, 'profiles');
      const q = query(usersRef, where('username', '==', formattedUsername));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('No account found with this username');
        setLoading(false);
        return;
      }
      
      // Get the email from the user's profile
      const userEmail = querySnapshot.docs[0].data().email;
      
      if (!userEmail) {
        setError('Account error. Please contact support.');
        setLoading(false);
        return;
      }
      
      // Send password reset email to the found email address
      const auth = getAuth();
      await sendPasswordResetEmail(auth, userEmail);
      
      // Show success message
      setSuccess(true);
      setUsername('');
      
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaContainer}>
        <StatusBar style="dark" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={styles.placeholderView} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/translogo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forgot Password</Text>
            
            {!success ? (
              <>
                <Text style={styles.instructions}>
                  Enter your username and we'll send a password reset link to your email address.
                </Text>
                
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} style={{marginRight: 8}} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Username</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="rgba(0,0,0,0.6)" style={styles.inputIcon} />
                    <View style={styles.usernameInputContainer}>
                      <TextInput
                        style={styles.usernameInput}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter your username"
                        placeholderTextColor="rgba(0,0,0,0.4)"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Text style={styles.usernameSuffix}>@shytext</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!username.trim() || loading) && styles.disabledButton
                  ]}
                  onPress={handleResetPassword}
                  disabled={!username.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={60} color={colors.success} />
                </View>
                <Text style={styles.successTitle}>Email Sent!</Text>
                <Text style={styles.successText}>
                  We've sent a password reset link to the email address associated with your account. Please check your inbox and follow the instructions to reset your password.
                </Text>
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={handleBack}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeAreaContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholderView: {
    width: 34,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  card: {
    backgroundColor: colors.lightGray,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  usernameInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  usernameSuffix: {
    fontSize: 16,
    color: colors.darkGray,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  primaryButton: {
    height: 50,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  backToLoginButton: {
    padding: 10,
  },
  backToLoginText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 