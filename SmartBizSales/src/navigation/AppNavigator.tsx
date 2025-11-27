// src/navigation/AppNavigator.tsx
import React, { JSX, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import type { DrawerNavigationOptions } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../context/AuthContext";
import DashboardScreen from "../screens/home/DashboardScreen";
import SelectStoreScreen from "../screens/store/SelectStoreScreen";
import Unauthorized from "../screens/misc/Unauthorized";

import ProductListScreen from "../screens/product/ProductListScreen";
import CustomerListScreen from "../screens/customer/CustomerListScreen";
import StoreSettingsScreen from "../screens/store/StoreSettingsScreen";
import SupplierListScreen from "../screens/supplier/SupplierListScreen";
import ProductGroupListScreen from "../screens/productGroup/ProductGroupListScreen";
import ProfileScreen from "../screens/settings/ProfileScreen";
import LoyaltyConfigScreen from "../screens/loyalty/LoyaltyConfigScreen";
import TopCustomersScreen from "../screens/customer/TopCustomersScreen";
import ReportsDashboardScreen from "../screens/reports/ReportsDashboardScreen";
import RevenueReportScreen from "../screens/reports/RevenueReportScreen";
import InventoryReportScreen from "../screens/reports/InventoryReportScreen";
import TaxDeclarationScreen from "../screens/reports/TaxDeclarationScreen";
import TopProductsScreen from "../screens/reports/TopProductsScreen";
import ActivityLogScreen from "../screens/settings/ActivityLogScreen";
import PaymentSettingsScreen from "../screens/settings/PaymentSettingsScreen";
import NotificationScreen from "../screens/settings/NotificationScreen";
import FileManagerScreen from "../screens/settings/FileManagerScreen";
import PricingScreen from "../screens/settings/PricingScreen";
import SubscriptionScreen from "../screens/settings/SubscriptionScreen";

// ========== TYPES ==========
export type RootDrawerParamList = {
  Dashboard: any;
  SelectStore: any;
  StoreSettings: any;
  ProductList: any;
  Suppliers: any;
  ProductGroups: any;
  PosOrders: any;
  OrderList: any;
  OrderReconciliation: any;
  CustomerList: any;
  TopCustomers: any;
  Employees: any;
  EmployeeSchedule: any;
  LoyaltyConfig: any;
  ReportsDashboard: any;
  RevenueReport: any;
  InventoryReport: any;
  TaxReport: any;
  TopProductsReport: any;
  ProfileScreen: any;
  Subscription: any;
  SubscriptionPricing: any;
  ActivityLog: any;
  PaymentMethod: any;
  NotificationSettings: any;
  ExportData: any;
  FileManager: any;
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

// --- Check quyền menu chuẩn ---
function hasPermission(
  menu: string[] = [],
  required?: string | string[]
): boolean {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.some((r) => {
    const [resource] = r.split(":");
    return menu.includes(r) || menu.includes(`${resource}:*`);
  });
}

// ========== PLACEHOLDER SCREENS ==========
function PlaceholderScreen({ title }: { title: string }): JSX.Element {
  return (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderIconCircle}>
        <Ionicons name="construct-outline" size={48} color="#10b981" />
      </View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderDesc}>
        Màn hình này đang được phát triển cho ứng dụng di động.
      </Text>
    </View>
  );
}

const PosScreen = () => <PlaceholderScreen title="POS - Bán hàng" />;
const OrderListScreen = () => <PlaceholderScreen title="Danh sách đơn hàng" />;
const OrderReconciliationScreen = () => (
  <PlaceholderScreen title="Đối soát hóa đơn" />
);
// const TopCustomersScreen = () => <PlaceholderScreen title="Khách VIP" />;
const EmployeesScreen = () => <PlaceholderScreen title="Nhân viên" />;
const EmployeeScheduleScreen = () => (
  <PlaceholderScreen title="Lịch làm việc" />
);

// const SubscriptionScreen = () => <PlaceholderScreen title="Gói hiện tại" />;
// const SubscriptionPricingScreen = () => (
//   <PlaceholderScreen title="Nâng cấp Premium" />
// );

const ExportDataScreen = () => <PlaceholderScreen title="Xuất dữ liệu" />;
// const FileManagerScreen = () => <PlaceholderScreen title="Quản lý file" />;

// ========== MENU TREE ==========
interface MenuItem {
  key: keyof RootDrawerParamList;
  label: string;
  icon: string;
  permission?: string | string[];
}

interface MenuSection {
  title: string;
  icon: string;
  items: MenuItem[];
}

const MENU_TREE: MenuSection[] = [
  {
    title: "CỬA HÀNG",
    icon: "storefront",
    items: [
      { key: "Dashboard", label: "Tổng quan", icon: "speedometer-outline" },
      {
        key: "SelectStore",
        label: "Chọn cửa hàng",
        icon: "storefront-outline",
        permission: "store:view",
      },
      {
        key: "StoreSettings",
        label: "Thiết lập CH",
        icon: "settings-outline",
        permission: "store:update",
      },
    ],
  },
  {
    title: "QUẢN LÝ KHO",
    icon: "cube",
    items: [
      {
        key: "ProductList",
        label: "Hàng hóa",
        icon: "cube-outline",
        permission: "products:view",
      },
      { key: "Suppliers", label: "Nhà cung cấp", icon: "business-outline" },
      {
        key: "ProductGroups",
        label: "Nhóm hàng",
        icon: "grid-outline",
        permission: "products:view",
      },
    ],
  },
  {
    title: "ĐƠN HÀNG",
    icon: "cart",
    items: [
      {
        key: "PosOrders",
        label: "POS - Bán hàng",
        icon: "cash-outline",
        permission: "orders:create",
      },
      {
        key: "OrderList",
        label: "DS đơn hàng",
        icon: "receipt-outline",
        permission: "orders:view",
      },
      {
        key: "OrderReconciliation",
        label: "Đối soát HĐ",
        icon: "document-text-outline",
        permission: "orders:view",
      },
    ],
  },
  {
    title: "KHÁCH HÀNG",
    icon: "people",
    items: [
      {
        key: "CustomerList",
        label: "DS khách hàng",
        icon: "people-outline",
        permission: "customers:search",
      },
      {
        key: "TopCustomers",
        label: "Khách VIP",
        icon: "star-outline",
        permission: "customers:top-customers",
      },
    ],
  },
  {
    title: "NHÂN VIÊN",
    icon: "people-circle",
    items: [
      {
        key: "Employees",
        label: "Nhân viên",
        icon: "id-card-outline",
        permission: "employees:view",
      },
      {
        key: "EmployeeSchedule",
        label: "Lịch làm việc",
        icon: "calendar-outline",
        permission: "employees:assign",
      },
    ],
  },
  {
    title: "TÍCH ĐIỂM",
    icon: "gift",
    items: [
      {
        key: "LoyaltyConfig",
        label: "Cấu hình",
        icon: "gift-outline",
        permission: "loyalty:manage",
      },
    ],
  },
  {
    title: "BÁO CÁO",
    icon: "stats-chart",
    items: [
      {
        key: "ReportsDashboard",
        label: "BC tổng quan",
        icon: "podium-outline",
        permission: "reports:financial:view",
      },
      {
        key: "RevenueReport",
        label: "BC doanh thu",
        icon: "trending-up-outline",
        permission: "reports:revenue:view",
      },
      {
        key: "InventoryReport",
        label: "BC tồn kho",
        icon: "cube-outline",
        permission: "inventory:stock-check:view",
      },
      {
        key: "TaxReport",
        label: "Kê khai thuế",
        icon: "newspaper-outline",
        permission: "tax:preview",
      },
      {
        key: "TopProductsReport",
        label: "Top SP",
        icon: "trophy-outline",
        permission: "reports:top-products",
      },
    ],
  },
  {
    title: "CẤU HÌNH",
    icon: "settings",
    items: [
      {
        key: "ProfileScreen",
        label: "Hồ sơ cá nhân",
        icon: "person-outline",
        permission: "users:view",
      },
      {
        key: "Subscription",
        label: "Gói hiện tại",
        icon: "card-outline",
        permission: "subscription:view",
      },
      {
        key: "SubscriptionPricing",
        label: "Nâng cấp",
        icon: "flash-outline",
        permission: "subscription:view",
      },
      {
        key: "ActivityLog",
        label: "Nhật ký",
        icon: "time-outline",
        permission: "settings:activity-log",
      },
      {
        key: "PaymentMethod",
        label: "Thanh toán",
        icon: "card-outline",
        permission: "settings:payment-method",
      },
      {
        key: "NotificationSettings",
        label: "Thông báo",
        icon: "notifications-outline",
        permission: "notifications:view",
      },
      {
        key: "ExportData",
        label: "Xuất dữ liệu",
        icon: "download-outline",
        permission: "data:export",
      },
      {
        key: "FileManager",
        label: "Quản lý file",
        icon: "folder-open-outline",
        permission: "file:view",
      },
    ],
  },
];

// ========== CUSTOM DRAWER CONTENT ==========
type CustomDrawerProps = DrawerContentComponentProps;

function CustomDrawerContent(props: CustomDrawerProps): JSX.Element {
  const { logout, user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["CỬA HÀNG", "QUẢN LÝ KHO"])
  );

  // ✅ Scroll indicator state
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // ✅ Bounce animation for arrow
  React.useEffect(() => {
    if (showScrollIndicator) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      bounceAnim.setValue(0);
    }
  }, [showScrollIndicator]);

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const handleLogout = () => {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc muốn đăng xuất không?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: logout },
      ],
      { cancelable: true }
    );
  };

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  // ✅ Handle scroll event
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
    setShowScrollIndicator(
      !isAtBottom && contentSize.height > layoutMeasurement.height
    );
  };

  // ✅ Handle scroll indicator press
  const handleScrollIndicatorPress = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const menu = user?.menu || [];
  const nameLabel = user?.fullname || user?.username || "Người dùng";
  const roleLabel = user?.role || "—";
  const userImage = user?.image;
  const currentRoute = props.state.routes[props.state.index].name;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Gradient Header with User Image */}
      <LinearGradient
        colors={["#10b981", "#059669", "#047857"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatarWrapper}>
          {userImage ? (
            <Image source={{ uri: userImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color="#fff" />
            </View>
          )}
          <View style={styles.onlineBadge} />
        </View>
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {nameLabel}
          </Text>
          <View style={styles.roleContainer}>
            <Ionicons name="shield-checkmark" size={12} color="#d1fae5" />
            <Text style={styles.role}>{roleLabel}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tree Menu with Scroll Indicator */}
      <View style={{ flex: 1, position: "relative" }}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.menu}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {MENU_TREE.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (item.key === "SelectStore" && user?.role !== "MANAGER")
                return false;
              return hasPermission(menu, item.permission);
            });

            if (visibleItems.length === 0) return null;

            const isExpanded = expandedSections.has(section.title);

            return (
              <View key={section.title} style={styles.sectionContainer}>
                {/* Section Header */}
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.title)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <View style={styles.sectionIconCircle}>
                      <Ionicons
                        name={section.icon as any}
                        size={16}
                        color="#10b981"
                      />
                    </View>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-down" : "chevron-forward"}
                    size={18}
                    color="#10b981"
                  />
                </TouchableOpacity>

                {/* Section Items */}
                {isExpanded &&
                  visibleItems.map((item, idx) => {
                    const isActive = currentRoute === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.menuItem,
                          isActive && styles.menuItemActive,
                          idx === visibleItems.length - 1 &&
                            styles.menuItemLast,
                        ]}
                        onPress={() =>
                          props.navigation.navigate(item.key as any)
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.menuItemIconWrapper,
                            isActive && styles.menuItemIconWrapperActive,
                          ]}
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={20}
                            color={isActive ? "#10b981" : "#6b7280"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.menuItemText,
                            isActive && styles.menuItemTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isActive && <View style={styles.activeIndicator} />}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ✅ Scroll Indicator - Floating Arrow */}
        {showScrollIndicator && (
          <TouchableOpacity
            style={styles.scrollIndicator}
            onPress={handleScrollIndicatorPress}
            activeOpacity={0.7}
          >
            <Animated.View
              style={[
                styles.scrollIndicatorInner,
                { transform: [{ translateY }] },
              ]}
            >
              <Ionicons name="chevron-down" size={24} color="#10b981" />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>

      {/* Gradient Logout Button */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#ef4444", "#dc2626"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.copy}>© 2025 Smallbiz-Sales</Text>
      </View>
    </View>
  );
}

// ========== APP NAVIGATOR ==========
export default function AppNavigator(): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Đang tải dữ liệu người dùng...</Text>
      </View>
    );
  }

  const menu = user?.menu || [];

  const withPermission =
    (
      Component: React.ComponentType<any>,
      requiredPermission?: string | string[]
    ) =>
    (props: any) => {
      if (!hasPermission(menu, requiredPermission)) {
        return <Unauthorized />;
      }
      return <Component {...props} />;
    };

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }): DrawerNavigationOptions => ({
        headerStyle: {
          backgroundColor: "#10b981",
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },
        drawerActiveBackgroundColor: "transparent",
        drawerActiveTintColor: "transparent",
        drawerInactiveTintColor: "transparent",
        headerLeft: ({ tintColor }) => (
          <TouchableOpacity
            onPress={() => navigation.toggleDrawer()}
            style={styles.headerMenuBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="grid-outline" size={26} color={tintColor} />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="Dashboard"
        component={withPermission(DashboardScreen)}
        options={{ title: "Tổng quan" }}
      />
      <Drawer.Screen
        name="SelectStore"
        component={withPermission(SelectStoreScreen, "store:view")}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="StoreSettings"
        component={withPermission(StoreSettingsScreen, "store:update")}
        options={{ title: "Thiết lập cửa hàng" }}
      />
      <Drawer.Screen
        name="ProductList"
        component={withPermission(ProductListScreen, "products:view")}
        options={{ title: "Hàng hóa" }}
      />
      <Drawer.Screen
        name="Suppliers"
        component={withPermission(SupplierListScreen)}
        options={{ title: "Nhà cung cấp" }}
      />
      <Drawer.Screen
        name="ProductGroups"
        component={withPermission(ProductGroupListScreen, "products:view")}
        options={{ title: "Nhóm hàng" }}
      />
      <Drawer.Screen
        name="PosOrders"
        component={withPermission(PosScreen, "orders:create")}
        options={{ title: "POS" }}
      />
      <Drawer.Screen
        name="OrderList"
        component={withPermission(OrderListScreen, "orders:view")}
        options={{ title: "Đơn hàng" }}
      />
      <Drawer.Screen
        name="OrderReconciliation"
        component={withPermission(OrderReconciliationScreen, "orders:view")}
        options={{ title: "Đối soát HĐ" }}
      />
      <Drawer.Screen
        name="CustomerList"
        component={withPermission(CustomerListScreen, "customers:search")}
        options={{ title: "Khách hàng" }}
      />
      <Drawer.Screen
        name="TopCustomers"
        component={withPermission(
          TopCustomersScreen,
          "customers:top-customers"
        )}
        options={{ title: "Khách VIP" }}
      />
      <Drawer.Screen
        name="Employees"
        component={withPermission(EmployeesScreen, "employees:view")}
        options={{ title: "Nhân viên" }}
      />
      <Drawer.Screen
        name="EmployeeSchedule"
        component={withPermission(EmployeeScheduleScreen, "employees:assign")}
        options={{ title: "Lịch LV" }}
      />
      <Drawer.Screen
        name="LoyaltyConfig"
        component={withPermission(LoyaltyConfigScreen, "loyalty:manage")}
        options={{ title: "Tích điểm" }}
      />
      <Drawer.Screen
        name="ReportsDashboard"
        component={withPermission(
          ReportsDashboardScreen,
          "reports:financial:view"
        )}
        options={{ title: "BC tổng quan" }}
      />
      <Drawer.Screen
        name="RevenueReport"
        component={withPermission(RevenueReportScreen, "reports:revenue:view")}
        options={{ title: "BC doanh thu" }}
      />
      <Drawer.Screen
        name="InventoryReport"
        component={withPermission(
          InventoryReportScreen,
          "inventory:stock-check:view"
        )}
        options={{ title: "BC tồn kho" }}
      />
      <Drawer.Screen
        name="TaxReport"
        component={withPermission(TaxDeclarationScreen, "tax:preview")}
        options={{ title: "Thuế" }}
      />
      <Drawer.Screen
        name="TopProductsReport"
        component={withPermission(TopProductsScreen, "reports:top-products")}
        options={{ title: "Top SP" }}
      />
      <Drawer.Screen
        name="ProfileScreen"
        component={withPermission(ProfileScreen, "users:view")}
        options={{ title: "Hồ sơ" }}
      />
      <Drawer.Screen
        name="Subscription"
        component={withPermission(SubscriptionScreen, "subscription:view")}
        options={{ title: "Gói hiện tại" }}
      />
      <Drawer.Screen
        name="SubscriptionPricing"
        component={withPermission(PricingScreen, "subscription:view")}
        options={{ title: "Nâng cấp" }}
      />
      <Drawer.Screen
        name="ActivityLog"
        component={withPermission(ActivityLogScreen, "settings:activity-log")}
        options={{ title: "Nhật ký" }}
      />
      <Drawer.Screen
        name="PaymentMethod"
        component={withPermission(
          PaymentSettingsScreen,
          "settings:payment-method"
        )}
        options={{ title: "Thanh toán" }}
      />
      <Drawer.Screen
        name="NotificationSettings"
        component={withPermission(NotificationScreen, "notifications:view")}
        options={{ title: "Thông báo" }}
      />
      <Drawer.Screen
        name="ExportData"
        component={withPermission(ExportDataScreen, "data:export")}
        options={{ title: "Xuất DL" }}
      />
      <Drawer.Screen
        name="FileManager"
        component={withPermission(FileManagerScreen, "file:view")}
        options={{ title: "Quản lý file" }}
      />
    </Drawer.Navigator>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    paddingTop: 24,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#10b981",
  },
  name: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 17,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  role: {
    color: "#d1fae5",
    fontSize: 12,
    fontWeight: "600",
  },
  menu: {
    flex: 1,
    paddingTop: 12,
  },
  scrollIndicator: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 50,
    padding: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#d1fae5",
  },
  scrollIndicatorInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  sectionContainer: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 10,
    position: "relative",
  },
  menuItemLast: {
    marginBottom: 8,
  },
  menuItemActive: {
    backgroundColor: "#ecfdf5",
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  menuItemIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemIconWrapperActive: {
    backgroundColor: "#d1fae5",
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    flex: 1,
  },
  menuItemTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  bottom: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  logoutBtn: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  logoutGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  copy: {
    marginTop: 12,
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#f8fafc",
  },
  placeholderIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  placeholderDesc: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
  },
  headerMenuBtn: {
    marginLeft: 15,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
});
