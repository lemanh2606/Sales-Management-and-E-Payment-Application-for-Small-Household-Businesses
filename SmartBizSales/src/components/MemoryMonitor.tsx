// src/components/MemoryMonitor.tsx (DEV only)
import React, { FC, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import CleanupManager from "../utils/cleanupManager";

const MemoryMonitor: FC = () => {
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(CleanupManager.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!__DEV__) return null;

  return (
    <View style={styles.monitor}>
      <Text style={styles.text}>⏱ Timers: {stats.timers || 0}</Text>
      <Text style={styles.text}>🔄 Intervals: {stats.intervals || 0}</Text>
      <Text style={styles.text}>📡 Listeners: {stats.listeners || 0}</Text>
      <Text style={styles.text}>🚫 Abort: {stats.abortControllers || 0}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  monitor: {
    position: "absolute",
    top: 50,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 8,
    borderRadius: 8,
    zIndex: 9999,
  },
  text: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "monospace",
  },
});

export default MemoryMonitor;
