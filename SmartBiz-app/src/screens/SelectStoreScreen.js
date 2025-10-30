// src/screens/SelectStoreScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SelectStoreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Store</Text>
      <Text style={styles.sub}>If you are a manager with multiple stores, let them choose one here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:20 },
  title: { fontSize:18, fontWeight:'700', marginBottom:8 },
  sub: { color:'#666', textAlign:'center' },
});
