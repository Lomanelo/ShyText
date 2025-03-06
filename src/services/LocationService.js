// This file sets up a background location service that will be used
// by the application to get location updates even when the app is closed

import RNLocation from 'react-native-location';
import { updateLocation, getCurrentUser } from '../lib/firebase';

class LocationService {
  static isInitialized = false;
  static locationSubscription = null;
  
  // Initialize the location service
  static async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Configure the library
      RNLocation.configure({
        distanceFilter: 10, // Minimum distance in meters between location updates (increased for battery saving)
        desiredAccuracy: {
          ios: 'best',
          android: 'balancedPowerAccuracy',
        },
        // Android-specific
        androidProvider: 'auto',
        interval: 20000, // Milliseconds between active location updates (increased for battery saving)
        fastestInterval: 30000, // Milliseconds between location updates from all apps (increased for battery saving)
        maxWaitTime: 30000, // Max time to wait for location in milliseconds (increased for battery saving)

        // iOS-specific
        activityType: 'other',
        allowsBackgroundLocationUpdates: true, // Enable background location updates
        headingFilter: 5, // Minimum angular change in degrees for heading updates
        headingOrientation: 'portrait',
        pausesLocationUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
      
      console.log('Location service initialized');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize location service:', error);
      return false;
    }
  }
  
  // Start tracking location in the background
  static async startBackgroundTracking() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    try {
      // Check if we already have permission
      const permissionGranted = await RNLocation.checkPermission({
        ios: 'always',
        android: {
          detail: 'fine',
        },
      });
      
      if (!permissionGranted) {
        console.log('Location permission not granted, requesting...');
        // We need to request permission
        const newPermission = await RNLocation.requestPermission({
          ios: 'always', // We need 'always' for background on iOS
          android: {
            detail: 'fine',
            rationale: {
              title: 'Background Location Permission',
              message: 'ShyText needs access to your location in the background to help you discover nearby users even when the app is closed.',
              buttonPositive: 'OK',
              buttonNegative: 'Cancel',
            },
          },
        });
        
        if (!newPermission) {
          console.error('Location permission denied');
          return false;
        }
      }
      
      // Start tracking location
      if (this.locationSubscription) {
        // Unsubscribe from previous tracking if any
        this.stopBackgroundTracking();
      }
      
      // Subscribe to location updates
      this.locationSubscription = RNLocation.subscribeToLocationUpdates(async (locations) => {
        if (locations && locations.length > 0) {
          const location = locations[0];
          console.log('Background location update:', location);
          
          // Update location in Firebase if user is logged in
          const currentUser = getCurrentUser();
          if (currentUser) {
            try {
              await updateLocation(location.latitude, location.longitude);
              console.log('Successfully updated location in background');
            } catch (error) {
              console.error('Failed to update location in background:', error);
            }
          }
        }
      });
      
      console.log('Background location tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start background location tracking:', error);
      return false;
    }
  }
  
  // Stop background location tracking
  static stopBackgroundTracking() {
    if (this.locationSubscription) {
      RNLocation.unsubscribeFromLocationUpdates(this.locationSubscription);
      this.locationSubscription = null;
      console.log('Background location tracking stopped');
    }
  }
  
  // Get the current location once
  static async getCurrentLocation() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }
    
    try {
      const location = await RNLocation.getLatestLocation({ timeout: 10000 });
      return location;
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }
}

export default LocationService; 