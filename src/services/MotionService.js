import { Accelerometer, Gyroscope, Magnetometer, DeviceMotion, Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

// Define activity types
export const ActivityType = {
  STILL: 'still',
  WALKING: 'walking',
  RUNNING: 'running',
  VEHICLE: 'vehicle',
  UNKNOWN: 'unknown'
};

class MotionService {
  // Class variables
  static isInitialized = false;
  static subscriptions = {
    accelerometer: null,
    gyroscope: null,
    magnetometer: null,
    deviceMotion: null,
    pedometer: null
  };
  
  // Sensor data
  static sensorData = {
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 },
    deviceMotion: null,
    stepCount: 0,
    lastStepTimestamp: 0
  };
  
  // Activity detection
  static activityData = {
    currentActivity: ActivityType.UNKNOWN,
    confidence: 0,
    lastActivityChange: new Date(),
    movementIntensity: 0
  };
  
  // Additional motion-related metadata
  static motionMetadata = {
    isMoving: false,
    heading: 0,
    speed: 0,
    lastUpdate: new Date()
  };
  
  // Callback function for activity changes
  static onActivityChangeCallback = null;
  
  // Update rates (in ms)
  static updateIntervals = {
    accelerometer: 1000, // 1 second
    gyroscope: 1000,
    magnetometer: 1000,
    deviceMotion: 1000
  };
  
  // Available sensors
  static availableSensors = {
    accelerometer: false,
    gyroscope: false,
    magnetometer: false,
    deviceMotion: false,
    pedometer: false
  };
  
  /**
   * Initialize the motion service and start sensors
   */
  static async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Check if sensors are available
      try {
        this.availableSensors.accelerometer = await Accelerometer.isAvailableAsync();
      } catch (e) {
        console.warn('Accelerometer not available:', e.message);
      }
      
      try {
        this.availableSensors.gyroscope = await Gyroscope.isAvailableAsync();
      } catch (e) {
        console.warn('Gyroscope not available:', e.message);
      }
      
      try {
        this.availableSensors.magnetometer = await Magnetometer.isAvailableAsync();
      } catch (e) {
        console.warn('Magnetometer not available:', e.message);
      }
      
      try {
        this.availableSensors.deviceMotion = await DeviceMotion.isAvailableAsync();
      } catch (e) {
        console.warn('DeviceMotion not available:', e.message);
      }
      
      try {
        this.availableSensors.pedometer = await Pedometer.isAvailableAsync();
      } catch (e) {
        console.warn('Pedometer not available:', e.message);
        this.availableSensors.pedometer = false;
      }
      
      console.log('Sensors available:', this.availableSensors);
      
      // Set the update intervals
      if (this.availableSensors.accelerometer) {
        Accelerometer.setUpdateInterval(this.updateIntervals.accelerometer);
      }
      
      if (this.availableSensors.gyroscope) {
        Gyroscope.setUpdateInterval(this.updateIntervals.gyroscope);
      }
      
      if (this.availableSensors.magnetometer) {
        Magnetometer.setUpdateInterval(this.updateIntervals.magnetometer);
      }
      
      if (this.availableSensors.deviceMotion) {
        DeviceMotion.setUpdateInterval(this.updateIntervals.deviceMotion);
      }
      
      this.isInitialized = true;
      console.log('Motion service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize motion service:', error);
      return false;
    }
  }
  
  /**
   * Start tracking movement and activity
   */
  static async startTracking(onActivityChange = null) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    this.onActivityChangeCallback = onActivityChange;
    
    try {
      // Start accelerometer subscription
      this.stopTracking(); // Clear any existing subscriptions
      
      // Subscribe to accelerometer
      if (this.availableSensors.accelerometer) {
        this.subscriptions.accelerometer = Accelerometer.addListener(data => {
          this.sensorData.accelerometer = data;
          this._detectMovementFromAccelerometer(data);
        });
      }
      
      // Subscribe to gyroscope
      if (this.availableSensors.gyroscope) {
        this.subscriptions.gyroscope = Gyroscope.addListener(data => {
          this.sensorData.gyroscope = data;
          this._refineMovementWithGyroscope(data);
        });
      }
      
      // Subscribe to magnetometer
      if (this.availableSensors.magnetometer) {
        this.subscriptions.magnetometer = Magnetometer.addListener(data => {
          this.sensorData.magnetometer = data;
          this._updateHeadingFromMagnetometer(data);
        });
      }
      
      // Subscribe to device motion (combines multiple sensors)
      if (this.availableSensors.deviceMotion) {
        this.subscriptions.deviceMotion = DeviceMotion.addListener(data => {
          this.sensorData.deviceMotion = data;
          this._processDeviceMotion(data);
        });
      }
      
      // Subscribe to pedometer if available
      if (this.availableSensors.pedometer) {
        try {
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - 1);
          
          this.subscriptions.pedometer = Pedometer.watchStepCount(result => {
            const now = Date.now();
            const timeDiff = now - this.sensorData.lastStepTimestamp;
            
            if (this.sensorData.lastStepTimestamp > 0 && timeDiff > 0) {
              // Calculate step frequency (steps per second)
              const stepsPerSecond = 1000 / timeDiff;
              this._updateActivityBasedOnSteps(stepsPerSecond);
            }
            
            this.sensorData.stepCount = result.steps;
            this.sensorData.lastStepTimestamp = now;
          });
        } catch (e) {
          console.warn('Error starting pedometer:', e.message);
        }
      }
      
      console.log('Motion tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start motion tracking:', error);
      this.stopTracking(); // Clean up any partial subscriptions
      return false;
    }
  }
  
  /**
   * Stop tracking movement and activity
   */
  static stopTracking() {
    // Remove all sensor subscriptions
    Object.keys(this.subscriptions).forEach(sensor => {
      if (this.subscriptions[sensor]) {
        try {
          this.subscriptions[sensor].remove();
        } catch (e) {
          console.warn(`Error removing ${sensor} subscription:`, e.message);
        }
        this.subscriptions[sensor] = null;
      }
    });
    
    console.log('Motion tracking stopped');
  }
  
  /**
   * Get the current motion and activity data
   */
  static getMotionData() {
    return {
      activity: this.activityData.currentActivity,
      confidence: this.activityData.confidence,
      isMoving: this.motionMetadata.isMoving,
      heading: this.motionMetadata.heading,
      speed: this.motionMetadata.speed,
      movementIntensity: this.activityData.movementIntensity
    };
  }
  
  /**
   * Update activity based on accelerometer data
   */
  static _detectMovementFromAccelerometer(data) {
    // Calculate the magnitude of acceleration
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    
    // Earth's gravity is approximately 9.8 m/s²
    // We subtract it to get the "dynamic" acceleration
    const dynamicAcceleration = Math.abs(magnitude - 9.8);
    
    // Update movement intensity (with some smoothing)
    this.activityData.movementIntensity = 
      this.activityData.movementIntensity * 0.7 + dynamicAcceleration * 0.3;
    
    // Determine if the user is moving based on the movement intensity
    const wasMoving = this.motionMetadata.isMoving;
    this.motionMetadata.isMoving = this.activityData.movementIntensity > 0.5;
    
    // If movement state changed, update activity
    if (wasMoving !== this.motionMetadata.isMoving) {
      if (this.motionMetadata.isMoving) {
        // Just started moving, but don't know what activity yet
        this._updateActivity(ActivityType.UNKNOWN, 0.5);
      } else {
        // Stopped moving
        this._updateActivity(ActivityType.STILL, 0.8);
      }
    }
    
    // Perform activity classification based on movement intensity
    if (this.motionMetadata.isMoving) {
      this._classifyActivityFromIntensity();
    }
  }
  
  /**
   * Refine movement detection using gyroscope data
   */
  static _refineMovementWithGyroscope(data) {
    // Calculate rotational velocity magnitude
    const rotationMagnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    
    // Use rotation to help determine if in a vehicle
    // Vehicles often have significant rotation when turning
    if (rotationMagnitude > 1.5 && this.motionMetadata.isMoving && 
        this.activityData.movementIntensity > 2) {
      // High rotation + high movement intensity could indicate vehicle movement
      if (this.activityData.currentActivity !== ActivityType.VEHICLE) {
        this._updateActivity(ActivityType.VEHICLE, 0.6);
      }
    }
  }
  
  /**
   * Update heading based on magnetometer data
   */
  static _updateHeadingFromMagnetometer(data) {
    // Calculate heading (simplified - in a real app you'd want to
    // combine with accelerometer data for tilt compensation)
    const heading = Math.atan2(data.y, data.x) * 180 / Math.PI;
    this.motionMetadata.heading = (heading + 360) % 360;
  }
  
  /**
   * Process combined device motion data
   */
  static _processDeviceMotion(data) {
    // Device motion provides pre-processed orientation and motion data
    if (data.acceleration) {
      // Use user acceleration (gravity removed) to better detect movement
      const userAcceleration = data.acceleration;
      const accelerationMagnitude = Math.sqrt(
        userAcceleration.x * userAcceleration.x +
        userAcceleration.y * userAcceleration.y +
        userAcceleration.z * userAcceleration.z
      );
      
      // Update speed estimate based on acceleration (very simplified)
      // In a real app, you'd want to integrate acceleration over time
      // This is just a rough approximation
      this.motionMetadata.speed = Math.max(0, this.motionMetadata.speed + accelerationMagnitude * 0.1);
      
      // Apply a decay factor to speed so it decreases when not accelerating
      this.motionMetadata.speed *= 0.95;
    }
    
    // Can also use quaternion or rotation data for more accurate orientation
  }
  
  /**
   * Update activity based on step frequency
   */
  static _updateActivityBasedOnSteps(stepsPerSecond) {
    if (stepsPerSecond > 2.5) {
      // Running is typically > 2.5 steps per second
      this._updateActivity(ActivityType.RUNNING, 0.8);
    } else if (stepsPerSecond > 0.5) {
      // Walking is typically 0.5-2.5 steps per second
      this._updateActivity(ActivityType.WALKING, 0.8);
    }
  }
  
  /**
   * Classify activity type from movement intensity
   */
  static _classifyActivityFromIntensity() {
    const intensity = this.activityData.movementIntensity;
    
    if (intensity > 5) {
      // High intensity - likely running or in vehicle
      if (this.activityData.currentActivity !== ActivityType.RUNNING && 
          this.activityData.currentActivity !== ActivityType.VEHICLE) {
        // Need pedometer data to distinguish between running and vehicle
        // For now, use a simple heuristic based on consistency of motion
        const accelData = this.sensorData.accelerometer;
        const consistencyFactor = this._calculateConsistencyFactor(accelData);
        
        if (consistencyFactor > 0.7) {
          this._updateActivity(ActivityType.VEHICLE, 0.7);
        } else {
          this._updateActivity(ActivityType.RUNNING, 0.6);
        }
      }
    } else if (intensity > 1) {
      // Medium intensity - likely walking
      if (this.activityData.currentActivity !== ActivityType.WALKING) {
        this._updateActivity(ActivityType.WALKING, 0.7);
      }
    } else if (intensity < 0.3) {
      // Very low intensity - likely still
      if (this.activityData.currentActivity !== ActivityType.STILL) {
        this._updateActivity(ActivityType.STILL, 0.8);
      }
    }
  }
  
  /**
   * Calculate how consistent the motion is (helps distinguish vehicle from other motion)
   * Vehicle motion tends to be more consistent than walking/running
   */
  static _calculateConsistencyFactor() {
    // This is a simplified placeholder.
    // A real implementation would track acceleration values over time
    // and calculate variance or other statistical measures
    
    // For now, return a dummy value that makes vehicle detection less likely
    return 0.5;
  }
  
  /**
   * Update the current activity and notify listeners
   */
  static _updateActivity(activity, confidence) {
    const now = new Date();
    const timeSinceLastChange = now - this.activityData.lastActivityChange;
    
    // Only update activity if confidence is higher or enough time has passed
    if (activity !== this.activityData.currentActivity && 
        (confidence > this.activityData.confidence || timeSinceLastChange > 5000)) {
      
      const previousActivity = this.activityData.currentActivity;
      this.activityData.currentActivity = activity;
      this.activityData.confidence = confidence;
      this.activityData.lastActivityChange = now;
      
      console.log(`Activity changed: ${previousActivity} -> ${activity} (confidence: ${confidence.toFixed(2)})`);
      
      // Notify listener if available
      if (this.onActivityChangeCallback) {
        this.onActivityChangeCallback({
          activity,
          confidence,
          previousActivity
        });
      }
    }
  }
}

export default MotionService; 