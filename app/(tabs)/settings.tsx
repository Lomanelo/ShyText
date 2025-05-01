import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, database } from '../../src/lib/firebase';
import { ref, get } from 'firebase/database';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';

export default function SettingsScreen() {
  const [userData, setUserData] = useState<{
    firstName: string;
    photoURL: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          router.replace('/(auth)');
          return;
        }

        const userProfileRef = ref(database, `profiles/${currentUser.uid}`);
        const snapshot = await get(userProfileRef);

        if (snapshot.exists()) {
          const profileData = snapshot.val();
          setUserData({
            firstName: profileData.firstName || currentUser.displayName || 'User',
            photoURL: profileData.photoURL || currentUser.photoURL
          });
        } else {
          // Fallback to Firebase user data
          setUserData({
            firstName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/(auth)');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <LinearGradient colors={['#f9f1e7', '#f9f1e7']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      
      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.profileImageContainer}>
          <Image
            source={userData?.photoURL ? { uri: userData.photoURL } : require('../../assets/images/icon.png')}
            style={styles.profileImage}
          />
          <View style={styles.editIconContainer}>
            <Ionicons name="camera" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.profileName}>{userData?.firstName || 'User'}</Text>
        <Text style={styles.profileInfo}>Edit your profile details</Text>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsItem}>
          <View style={styles.settingsIconContainer}>
            <Ionicons name="notifications-outline" size={22} color="#222" />
          </View>
          <Text style={styles.settingsText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <View style={styles.settingsIconContainer}>
            <Ionicons name="lock-closed-outline" size={22} color="#222" />
          </View>
          <Text style={styles.settingsText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <View style={styles.settingsIconContainer}>
            <Ionicons name="help-circle-outline" size={22} color="#222" />
          </View>
          <Text style={styles.settingsText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  editIconContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#222',
    borderRadius: 15,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f9f1e7',
  },
  profileName: {
    color: '#222',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileInfo: {
    color: '#666',
    fontSize: 14,
  },
  settingsSection: {
    marginTop: 30,
    paddingHorizontal: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsText: {
    color: '#222',
    fontSize: 16,
    flex: 1,
  },
  signOutButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  signOutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});