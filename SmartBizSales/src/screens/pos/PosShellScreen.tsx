// src/screens/pos/PosShellScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import OrderPOSHomeScreen from "./OrderPOSHomeScreen";
import OrderRefundScreen from "./OrderRefundScreen";
import InventoryLookupScreen from "./InventoryLookupScreen";
import OrderTrackingScreen from "./OrderTrackingScreen";
import EndOfDayReportScreen from "./EndOfDayReportScreen";

type PageType =
  | "pos"
  | "refund"
  | "inventory"
  | "trackingpage"
  | "endofdayreport";

const PosShellScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("POS");
  const [activePage, setActivePage] = useState<PageType>("pos");

  useEffect(() => {
    (async () => {
      const storeRaw = await AsyncStorage.getItem("currentStore");
      const store = storeRaw ? JSON.parse(storeRaw) : null;

      const sid = store?._id || "";
      setStoreId(sid);
      setStoreName(store?.name || "POS");

      if (sid) {
        const saved = await AsyncStorage.getItem(`activePOSPage_${sid}`);
        if (saved) setActivePage(saved as PageType);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (storeId)
        await AsyncStorage.setItem(`activePOSPage_${storeId}`, activePage);
    })();
  }, [activePage, storeId]);

  const menuItems = useMemo(
    () => [
      { key: "pos" as const, icon: "cart-outline", label: "Bán hàng" },
      {
        key: "refund" as const,
        icon: "return-down-back-outline",
        label: "Hoàn hàng",
      },
      { key: "inventory" as const, icon: "cube-outline", label: "Tồn kho" },
      {
        key: "trackingpage" as const,
        icon: "document-text-outline",
        label: "Tra cứu đơn",
      },
      {
        key: "endofdayreport" as const,
        icon: "stats-chart-outline",
        label: "BC cuối ngày",
      },
    ],
    []
  );

  const activeLabel = useMemo(() => {
    const found = menuItems.find((x) => x.key === activePage);
    return found?.label || "POS";
  }, [activePage, menuItems]);

  const renderPage = () => {
    switch (activePage) {
      case "pos":
        return <OrderPOSHomeScreen />;
      case "refund":
        return <OrderRefundScreen />;
      case "inventory":
        return <InventoryLookupScreen />;
      case "trackingpage":
        return <OrderTrackingScreen />;
      case "endofdayreport":
        return <EndOfDayReportScreen />;

      default:
        return null;
    }
  };

  const handleGoHome = useCallback(() => {
    navigation.navigate("Dashboard");
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <LinearGradient
          // đổi qua xanh mint/emerald
          colors={["#10b981", "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.toggleDrawer()}
              style={styles.iconBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="grid-outline" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.storeName} numberOfLines={1}>
                {storeName}
              </Text>
              <View style={styles.subRow}>
                <View style={styles.dot} />
                <Text style={styles.subTitle} numberOfLines={1}>
                  {activeLabel}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleGoHome}
                style={[styles.iconBtn, { marginRight: 10 }]}
                activeOpacity={0.75}
              >
                <Ionicons name="home-outline" size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActivePage("pos")}
                style={styles.iconBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="refresh-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.menuRow}
          >
            {menuItems.map((m) => {
              const active = m.key === activePage;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setActivePage(m.key)}
                  activeOpacity={0.85}
                  style={[
                    styles.menuPill,
                    active ? styles.menuPillActive : styles.menuPillInactive,
                  ]}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={18}
                    color={active ? "#052e2b" : "rgba(255,255,255,0.92)"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.menuText,
                      active ? styles.menuTextActive : styles.menuTextInactive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LinearGradient>

        <View style={styles.content}>{renderPage()}</View>
      </SafeAreaView>
    </View>
  );
};

export default PosShellScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  safe: { flex: 1, backgroundColor: "#10b981" },

  header: {
    paddingTop: Platform.OS === "android" ? 20 : 0,
    paddingBottom: 12,
    shadowColor: "#0b1220",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    // không cần backgroundColor ở đây vì LinearGradient đã vẽ nền,
    // nhưng giữ fallback cho trường hợp gradient lỗi:
    backgroundColor: "#10b981",
  },

  headerRow: {
    paddingHorizontal: 12,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    // bỏ backgroundColor để nhìn đúng gradient (nếu muốn nền phẳng thì set "#10b981")
    backgroundColor: "transparent",
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  headerCenter: { flex: 1, paddingHorizontal: 12 },
  storeName: { color: "#fff", fontWeight: "900", fontSize: 16 },
  subRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.85)",
    marginRight: 8,
  },
  subTitle: { color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 12 },

  headerActions: { flexDirection: "row", alignItems: "center" },

  menuRow: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 2 },
  menuPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
  },
  menuPillInactive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  menuPillActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },

  menuText: { fontWeight: "800", fontSize: 13 },
  menuTextInactive: { color: "rgba(255,255,255,0.92)" },
  menuTextActive: { color: "#052e2b" },

  content: { flex: 1, backgroundColor: "#f8fafc" },
});
