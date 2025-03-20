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
      
      // Create temporary email using username with @shytext suffix (will not be shown to user or used for login)
      const tempEmail = `${username.trim().toLowerCase()}@shytext.temp`;
      
      // Create user account in Firebase (required for authentication system)
      const userCredential = await createUserWithEmailAndPassword(
        getAuth(),
        tempEmail,
        password.trim()
      );
      
      // Store user profile with username as primary identifier, including @shytext suffix
      const db = getFirestore();
      await setDoc(doc(db, 'profiles', userCredential.user.uid), {
        username: `${username.trim()}@shytext`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      });
      
      // Update the user's display name to include @shytext suffix
      await updateProfile(userCredential.user, {
        displayName: `${username.trim()}@shytext`,
      });
      
      console.log('User registered successfully with username and @shytext suffix');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Account creation error:', err);
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0C0C0C', '#1E1E1E', '#2A2A2A']}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
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
                  <Ionicons name="close" size={22} color="#FFFFFF" />
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
                    <Ionicons name="copy-outline" size={22} color="#FFFFFF" />
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
                  <LinearGradient
                    colors={['#FF5E3A', '#FF2A68']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                    style={styles.gradientButton}
                  >
                    <Ionicons name="settings-outline" size={20} color="#FFFFFF" style={{marginRight: 8}} />
                    <Text style={styles.settingsButtonText}>Go to Settings</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <View style={styles.modalDivider} />
                
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => {
                    closeDeviceNameModal();
                    handleSignup();
                  }}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#388E3C']}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{marginRight: 8}} />
                        <Text style={styles.completeButtonText}>Continue</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
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
                <Ionicons name="alert-circle" size={20} color="#FF6B6B" style={{marginRight: 8}} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIcon} />
                <View style={styles.usernameInputContainer}>
                  <TextInput
                    style={styles.usernameInput}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Choose username"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.usernameSuffix}>@shytext</Text>
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Choose a password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.noteContainer}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(255, 255, 255, 0.6)" style={{marginRight: 8, marginTop: 2}} />
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
              <LinearGradient
                colors={['#FF5E3A', '#FF2A68']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.gradientButton}
              >
                <Text style={styles.primaryButtonText}>Create Account</Text>
              </LinearGradient>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
    backgroundColor: 'rgba(40, 40, 40, 0.6)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 58, 0.2)',
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    padding: 14,
    borderRadius: 18,
    marginBottom: 18,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 58, 0.3)',
    overflow: 'hidden',
  },
  inputIcon: {
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  checkingText: {
    marginTop: 8,
    color: '#BBBBBB',
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableText: {
    marginTop: 8,
    color: '#4CD964',
    fontSize: 14,
  },
  unavailableText: {
    marginTop: 8,
    color: '#FF6B6B',
    fontSize: 14,
  },
  noteContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  noteText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    flex: 1,
  },
  primaryButton: {
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#FF5E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  gradientButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(40, 40, 40, 0.6)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FF5E3A',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: '#FF5E3A',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loginButton: {
    padding: 10,
    alignItems: 'center',
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  loginTextBold: {
    fontWeight: 'bold',
    color: '#FF5E3A',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 58, 0.3)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  modalBody: {
    padding: 16,
    alignItems: 'center',
  },
  modalText: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: 'bold',
  },
  usernameDisplay: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 58, 0.2)',
  },
  usernameText: {
    color: '#FF5E3A',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  copyButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 94, 58, 0.3)',
    borderRadius: 10,
    marginLeft: 12,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionTitle: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 94, 58, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 15,
    flex: 1,
  },
  settingsButton: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    marginTop: 8,
  },
  settingsButtonText: {
    color: '#FFFFFF',
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
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginRight: 5,
  },
  previewValue: {
    color: '#FF5E3A',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    marginVertical: 12,
  },
  completeText: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 18,
    fontSize: 15,
  },
  completeButton: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    marginTop: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  usernameSuffix: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    paddingRight: 16,
  },
}); 