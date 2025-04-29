import { StyleSheet, View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { auth } from '../../src/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const handleSignOut = async () => {
    try {
      // Sign out from Firebase
      await auth.signOut();
      
      // Clear any stored user data from AsyncStorage
      await AsyncStorage.removeItem('userHasProfile');
      await AsyncStorage.removeItem('userProfile');
      
      // Navigate back to auth screen
      router.replace('/(auth)');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
      console.error('Sign out error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.profileImageContainer}>
          <Image
            source={{ uri: 'https://via.placeholder.com/150' }}
            style={styles.profileImage}
          />
          <View style={styles.editIconContainer}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.profileName}>John Doe</Text>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="notifications" size={24} color="#fff" />
          <Text style={styles.settingsText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="lock-closed" size={24} color="#fff" />
          <Text style={styles.settingsText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Ionicons name="help-circle" size={24} color="#fff" />
          <Text style={styles.settingsText}>Help</Text>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingsItem, styles.signOutButton]}
          onPress={handleSignOut}>
          <Ionicons name="log-out" size={24} color="#ff4444" />
          <Text style={[styles.settingsText, styles.signOutText]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  settingsSection: {
    marginTop: 20,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingsText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  signOutButton: {
    marginTop: 20,
  },
  signOutText: {
    color: '#ff4444',
  },
});