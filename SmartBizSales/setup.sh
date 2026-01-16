#!/bin/bash
echo "🚀 Installing dependencies..."

# Core dependencies
expo install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
expo install react-native-screens react-native-safe-area-context
expo install react-native-gesture-handler
expo install @react-native-async-storage/async-storage
expo install react-native-modal
expo install @expo/vector-icons
expo install react-native-toast-message
expo install react-native-flash-message
expo install expo-file-system
expo install expo-document-picker

# TypeScript
npm install --save-dev @types/react @types/react-native typescript

echo " All dependencies installed successfully!"
echo "📱 Run: expo start"