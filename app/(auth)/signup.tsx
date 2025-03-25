import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Image,
  Modal,
  Clipboard,
  Linking
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import colors from '../../src/theme/colors';
import * as DeviceInfo from 'react-native-device-info';
import BleService from '../../src/services/BleService';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [showDeviceNameModal, setShowDeviceNameModal] = useState(false);
  const [fullUsername, setFullUsername] = useState('');
  
  // Get the device name on component mount
  useEffect(() => {
    const getDeviceName = async () => {
      try {
        const deviceName = await DeviceInfo.getDeviceName();
        setDeviceName(deviceName);
      } catch (err) {
        console.error('Error getting device name:', err);
      }
    };
    
    getDeviceName();
  }, []);

  // Update full username when username changes
  useEffect(() => {
    if (username.trim()) {
      // Add @shytext suffix to username
      setFullUsername(`${username.trim()}@shytext`);
    } else {
      setFullUsername('');
    }
  }, [username]);

  // Handle username validation
  const validateUsername = (username: string) => {
    // Username should be alphanumeric and may include underscores
    const regex = /^[a-zA-Z0-9_]+$/;
    return regex.test(username);
  };

  // Open device name instructions modal
  const openDeviceNameModal = () => {
    setShowDeviceNameModal(true);
  };

  // Close device name instructions modal
  const closeDeviceNameModal = () => {
    setShowDeviceNameModal(false);
  };

  // Copy username to clipboard
  const copyUsernameToClipboard = () => {
    if (fullUsername) {
      Clipboard.setString(fullUsername);
      Alert.alert('Copied!', `"${fullUsername}" has been copied to clipboard.`);
    }
  };

  // Navigate to device settings
  const navigateToDeviceSettings = () => {
    try {
      // For iOS
      if (Platform.OS === 'ios') {
        // Try multiple URL formats for iOS
        Promise.any([
          Linking.openURL('App-prefs:Bluetooth'),
          Linking.openURL('app-settings:'),
          Linking.openURL('prefs:root=Bluetooth'),
          Linking.openURL('prefs:root=General&path=About')
        ]).catch(error => {
          console.error('Could not open settings URLs:', error);
          Alert.alert(
            'Settings Navigation Failed',
            'Please navigate manually to Settings > General > About > Name to change your device name.'
          );
        });
      } 
      // For Android
      else {
        Linking.openSettings();
      }
    } catch (error) {
      console.error('Failed to open settings:', error);
      Alert.alert(
        'Settings Navigation Failed',
        Platform.OS === 'ios' 
          ? 'Please navigate manually to Settings > General > About > Name to change your device name.'
          : 'Please navigate manually to Settings > About Phone > Device Name to change your device name.'
      );
    }
    
    // Close the modal after attempting to navigate
    closeDeviceNameModal();
  };

  // Handle signup
  const handleSignup = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Validate inputs
      if (!username.trim()) {
        setError('Please enter a username');
        setLoading(false);
        return;
      }
      
      if (!validateUsername(username)) {
        setError('Username can only contain letters, numbers, and underscores');
        setLoading(false);
        return;
      }

      if (!email.trim()) {
        setError('Please enter your email');
        setLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }
      
      if (!password.trim()) {
        setError('Please enter a password');
        setLoading(false);
        return;
      }
      
      if (password.trim().length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      
      // Check if username is already taken
      const db = getFirestore();
      const usersRef = collection(db, 'profiles');
      // Check for the username with @shytext suffix
      const usernameWithSuffix = `${username.trim()}@shytext`;
      const q = query(usersRef, where('username', '==', usernameWithSuffix));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('Username is already taken');
        setLoading(false);
        return;
      }
      
      // Create user account
      await createUserAccount();
      
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to sign up');
      setLoading(false);
    }
  };

  // Function to validate device name and create account
  const validateAndCreateAccount = () => {
    // We no longer verify the device name matches username
    // Just open the modal to inform the user about device name requirements
    openDeviceNameModal();
  };

  // Separate function to create the user account
  const createUserAccount = async () => {
    try {
      setLoading(true);
      
      // Create user account in Firebase with provided email
      const userCredential = await createUserWithEmailAndPassword(
        getAuth(),
        email.trim().toLowerCase(),
        password.trim()
      );
      
      // Store user profile with username as primary identifier, including @shytext suffix
      const db = getFirestore();
      await setDoc(doc(db, 'profiles', userCredential.user.uid), {
        username: `${username.trim()}@shytext`,
        email: email.trim().toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      });
      
      // Update the user's display name to include @shytext suffix
      await updateProfile(userCredential.user, {
        displayName: `${username.trim()}@shytext`,
      });
      
      console.log('User registered successfully with username and @shytext suffix');
      
      // Using push instead of replace to avoid being overridden by auth redirect
      console.log('Navigating to profile image upload screen');
      router.push('/(auth)/profile-image');
      
      // Delay setting loading to false to ensure the navigation happens
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (err: any) {
      console.error('Account creation error:', err);
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaContainer}>
        <StatusBar style="dark" />
        
        {/* Device Name Instructions Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showDeviceNameModal}
          onRequestClose={closeDeviceNameModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeDeviceNameModal} style={styles.closeButton}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  Change device name to:
                </Text>
                
                <View style={styles.usernameDisplay}>
                  <Text style={styles.usernameText}>{fullUsername}</Text>
                  <TouchableOpacity 
                    style={styles.copyButton}
                    onPress={copyUsernameToClipboard}
                  >
                    <Ionicons name="copy-outline" size={22} color={colors.background} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.instructionTitle}>Quick steps:</Text>
                
                {Platform.OS === 'ios' ? (
                  <View style={styles.instructionsContainer}>
                    <View style={styles.instructionRow}>
                      <View style={styles.instructionNumber}><Text style={styles.numberText}>1</Text></View>
                      <Text style={styles.instructionText}>Settings → General → About → Name</Text>
                    </View>
                    <View style={styles.instructionRow}>
                      <View style={styles.instructionNumber}><Text style={styles.numberText}>2</Text></View>
                      <Text style={styles.instructionText}>Copy & paste your username</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.instructionsContainer}>
                    <View style={styles.instructionRow}>
                      <View style={styles.instructionNumber}><Text style={styles.numberText}>1</Text></View>
                      <Text style={styles.instructionText}>Settings → About Phone → Device Name</Text>
                    </View>
                    <View style={styles.instructionRow}>
                      <View style={styles.instructionNumber}><Text style={styles.numberText}>2</Text></View>
                      <Text style={styles.instructionText}>Copy & paste your username</Text>
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={navigateToDeviceSettings}
                >
                  <Text style={styles.settingsButtonText}>Go to Settings</Text>
                </TouchableOpacity>
                
                <View style={styles.modalDivider} />
                
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => {
                    closeDeviceNameModal();
                    handleSignup();
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.background} style={{marginRight: 8}} />
                      <Text style={styles.completeButtonText}>Continue</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
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
            <Text style={styles.cardTitle}>Sign Up</Text>
            
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
                    placeholder="Choose username"
                    placeholderTextColor="rgba(0,0,0,0.4)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.usernameSuffix}>@shytext</Text>
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="rgba(0,0,0,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="rgba(0,0,0,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Choose a password"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.noteContainer}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(0,0,0,0.6)" style={{marginRight: 8, marginTop: 2}} />
              <Text style={styles.noteText}>
                Your device name must match your username@shytext
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!username || loading || !password.trim() || password.length < 6) && styles.disabledButton
              ]}
              onPress={validateAndCreateAccount}
              disabled={!username || loading || !password.trim() || password.length < 6}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.replace('/(auth)')}
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginTextBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
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
    width: 34, // to balance the back button width
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
    marginBottom: 16,
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
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  checkingText: {
    marginTop: 8,
    color: colors.darkGray,
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableText: {
    marginTop: 8,
    color: colors.success,
    fontSize: 14,
  },
  unavailableText: {
    marginTop: 8,
    color: colors.error,
    fontSize: 14,
  },
  noteContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: colors.mediumGray,
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  noteText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
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
  loginButton: {
    padding: 10,
    alignItems: 'center',
  },
  loginText: {
    color: colors.darkGray,
    fontSize: 14,
  },
  loginTextBold: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
  },
  modalBody: {
    padding: 16,
    alignItems: 'center',
  },
  modalText: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: 'bold',
  },
  usernameDisplay: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },
  usernameText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  copyButton: {
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginLeft: 12,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 0,
  },
  instructionsContainer: {
    width: '100%',
    marginBottom: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numberText: {
    color: colors.background,
    fontWeight: 'bold',
  },
  instructionText: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  settingsButton: {
    width: '100%',
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  settingsButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  usernamePreview: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  previewLabel: {
    color: colors.darkGray,
    fontSize: 14,
    marginRight: 5,
  },
  previewValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.mediumGray,
    width: '100%',
    marginVertical: 12,
  },
  completeText: {
    color: colors.text,
    textAlign: 'center',
    marginBottom: 18,
    fontSize: 15,
  },
  completeButton: {
    width: '100%',
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  completeButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    color: colors.darkGray,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
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
}); 