import React from 'react';
import { StyleSheet, View } from 'react-native';
import NearbyConnectionsComponent from '../components/NearbyConnections';

export default function NearbyScreen() {
  return (
    <View style={styles.container}>
      <NearbyConnectionsComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
}); 