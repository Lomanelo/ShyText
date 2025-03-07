// This file sets up a background location service that will be used
// by the application to get location updates even when the app is closed

import RNLocation from 'react-native-location';
import { updateLocation, getCurrentUser } from '../lib/firebase';
// Import MotionService with a try-catch to handle potential import errors
let MotionService = null;
let ActivityType = {
  STILL: 'still',
  WALKING: 'walking',
  RUNNING: 'running',
  VEHICLE: 'vehicle',
  UNKNOWN: 'unknown'
};

try {
  const motionModule = require('./MotionService');
  MotionService = motionModule.default;
  ActivityType = motionModule.ActivityType;
} catch (error) {
  console.warn('Failed to import MotionService:', error);
}

class LocationService {
  static isInitialized = false;
  static locationSubscription = null;
  static motionInitialized = false;
  
  // Configuration presets for different activity types
  static locationConfigs = {
    [ActivityType.STILL]: {
      distanceFilter: 50, // Meters
      desiredAccuracy: {
        ios: 'balanced',
        android: 'balancedPowerAccuracy',
      },
      interval: 60000, // 1 minute
      fastestInterval: 60000, // 1 minute
    },
    [ActivityType.WALKING]: {
      distanceFilter: 10, // Meters
      desiredAccuracy: {
        ios: 'best',
        android: 'highAccuracy',
      },
      interval: 20000, // 20 seconds
      fastestInterval: 15000, // 15 seconds
    },
    [ActivityType.RUNNING]: {
      distanceFilter: 5, // Meters
      desiredAccuracy: {
        ios: 'best',
        android: 'highAccuracy',
      },
      interval: 10000, // 10 seconds
      fastestInterval: 5000, // 5 seconds
    },
    [ActivityType.VEHICLE]: {
      distanceFilter: 25, // Meters
      desiredAccuracy: {
        ios: 'balanced',
        android: 'balancedPowerAccuracy',
      },
      interval: 15000, // 15 seconds
      fastestInterval: 10000, // 10 seconds
    },
    default: {
      distanceFilter: 10, // Meters
      desiredAccuracy: {
        ios: 'best',
        android: 'balancedPowerAccuracy',
      },
      interval: 20000, // 20 seconds
      fastestInterval: 30000, // 30 seconds
      maxWaitTime: 30000, // 30 seconds
    }
  };
  
  // Current motion data
  static currentActivity = ActivityType.UNKNOWN;
  static lastLocationUpdate = null;
  
  // Initialize the location service
  static async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // First configure with default settings
      await this._applyLocationConfig(this.locationConfigs.default);
      
      console.log('Location service initialized');
      this.isInitialized = true;
      
      // Initialize motion service if available
      if (!this.motionInitialized && MotionService) {
        try {
          const motionInitialized = await MotionService.initialize();
          if (motionInitialized) {
            this.motionInitialized = true;
            console.log('Motion service initialized from LocationService');
          }
        } catch (error) {
          console.warn('Motion service initialization failed:', error);
          this.motionInitialized = false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize location service:', error);
      return false;
    }
  }
  
  /**
   * Apply location configuration based on parameters
   */
  static async _applyLocationConfig(config) {
    return RNLocation.configure({
      distanceFilter: config.distanceFilter,
      desiredAccuracy: config.desiredAccuracy,
      // Android-specific
      androidProvider: 'auto',
      interval: config.interval,
      fastestInterval: config.fastestInterval,
      maxWaitTime: config.maxWaitTime || config.interval * 1.5,

      // iOS-specific
      activityType: 'other',
      allowsBackgroundLocationUpdates: true,
      headingFilter: 5,
      headingOrientation: 'portrait',
      pausesLocationUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  }
  
  /**
   * Update location configuration based on activity
   */
  static async updateLocationConfigForActivity(activity) {
    if (!this.isInitialized) return false;
    
    const config = this.locationConfigs[activity] || this.locationConfigs.default;
    console.log(`Updating location config for activity: ${activity}`);
    
    try {
      await this._applyLocationConfig(config);
      this.currentActivity = activity;
      return true;
    } catch (error) {
      console.error('Failed to update location config:', error);
      return false;
    }
  }
  
  // Handle activity changes from motion service
  static handleActivityChange = async (activityData) => {
    try {
      const { activity, confidence } = activityData;
      
      // Only update location config if confidence is high enough
      if (confidence > 0.6 && activity !== this.currentActivity) {
        await this.updateLocationConfigForActivity(activity);
      }
    } catch (error) {
      console.warn('Error handling activity change:', error);
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
      
      // Start motion tracking first to detect activity (if available)
      if (this.motionInitialized && MotionService) {
        try {
          await MotionService.startTracking(this.handleActivityChange);
        } catch (error) {
          console.warn('Failed to start motion tracking:', error);
          this.motionInitialized = false;
        }
      }
      
      // Subscribe to location updates
      this.locationSubscription = RNLocation.subscribeToLocationUpdates(async (locations) => {
        if (locations && locations.length > 0) {
          const location = locations[0];
          console.log('Background location update:', location);
          
          // Update our state
          this.lastLocationUpdate = {
            location,
            timestamp: new Date(),
            activity: this.currentActivity
          };
          
          // Get additional motion data if available
          let motionData = null;
          if (this.motionInitialized && MotionService) {
            try {
              motionData = MotionService.getMotionData();
            } catch (error) {
              console.warn('Error getting motion data:', error);
            }
          }
          
          // Update location in Firebase if user is logged in
          const currentUser = getCurrentUser();
          if (currentUser) {
            try {
              // Include heading and speed if available from motion sensors
              const additionalData = motionData ? {
                heading: motionData.heading || undefined,
                speed: motionData.speed || undefined,
                activity: motionData.activity || undefined
              } : {};
              
              await updateLocation(
                location.latitude, 
                location.longitude,
                additionalData
              );
              console.log('Successfully updated location in background with motion data');
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
      try {
        this.locationSubscription();
      } catch (error) {
        console.warn('Error stopping location subscription:', error);
      }
      this.locationSubscription = null;
      console.log('Background location tracking stopped');
    }
    
    // Stop motion tracking as well (if available)
    if (this.motionInitialized && MotionService) {
      try {
        MotionService.stopTracking();
      } catch (error) {
        console.warn('Error stopping motion tracking:', error);
      }
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
      
      // If we have motion data, enrich the location object
      if (this.motionInitialized && MotionService) {
        try {
          const motionData = MotionService.getMotionData();
          return {
            ...location,
            heading: motionData.heading,
            speed: motionData.speed,
            activity: motionData.activity
          };
        } catch (error) {
          console.warn('Error getting motion data for current location:', error);
          return location;
        }
      }
      
      return location;
    } catch (error) {
      console.error('Failed to get current location:', error);
      return null;
    }
  }
  
  // Get the current activity type
  static getCurrentActivity() {
    return this.currentActivity;
  }
  
  // Get combined location and motion data
  static getLocationAndMotionData() {
    try {
      const motionData = this.motionInitialized && MotionService ? MotionService.getMotionData() : null;
      
      return {
        lastLocation: this.lastLocationUpdate ? this.lastLocationUpdate.location : null,
        lastUpdated: this.lastLocationUpdate ? this.lastLocationUpdate.timestamp : null,
        activity: this.currentActivity,
        motionData: motionData
      };
    } catch (error) {
      console.warn('Error getting location and motion data:', error);
      return {
        lastLocation: this.lastLocationUpdate ? this.lastLocationUpdate.location : null,
        lastUpdated: this.lastLocationUpdate ? this.lastLocationUpdate.timestamp : null,
        activity: ActivityType.UNKNOWN,
        motionData: null
      };
    }
  }
}

export default LocationService; 