// src/screens/app/DashboardScreen.js
import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const navigation = useNavigation();

  // Thêm hamburger vào header (left)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.toggleDrawer()}
          style={styles.headerButton}
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu" size={26} color="#0b84ff" />
        </TouchableOpacity>
      ),
      headerTitle: 'Dashboard',
      headerTitleStyle: { fontWeight: '700', color: '#0f172a' },
    });
  }, [navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to SmartBiz Dashboard 🎯</Text>
      <Text style={styles.subtitle}>
        Đây là trung tâm điều khiển — nơi bạn xem doanh thu, sản phẩm, đơn hàng và thống kê.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Doanh thu hôm nay</Text>
        <Text style={styles.cardValue}>₫12,500,000</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sản phẩm tồn kho</Text>
        <Text style={styles.cardValue}>148</Text>
      </View>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Xem chi tiết ➜</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 8,
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0b84ff',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    color: '#444',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0b84ff',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#0b84ff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
