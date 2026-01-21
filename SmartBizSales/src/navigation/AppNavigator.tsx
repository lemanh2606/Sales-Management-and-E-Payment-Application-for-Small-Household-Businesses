// src/navigation/AppNavigator.tsx
import React, {
  FC,
  JSX,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../context/AuthContext";
import CleanupManager from "../utils/cleanupManager"; // 🚀 IMPORT CLEANUP MANAGER

// ========== SCREEN IMPORTS ==========
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
import TopProductsScreen from "../screens/reports/TopProductsScreen";
import ActivityLogScreen from "../screens/settings/ActivityLogScreen";
import PaymentSettingsScreen from "../screens/settings/PaymentSettingsScreen";
import NotificationScreen from "../screens/settings/NotificationScreen";
import FileManagerScreen from "../screens/settings/FileManagerScreen";
import PricingScreen from "../screens/settings/PricingScreen";
import SubscriptionScreen from "../screens/settings/SubscriptionScreen";
import EmployeesScreen from "../screens/employee/EmployeesScreen";
import OrderListScreen from "../screens/orders/OrderListScreen";
import PosShellScreen from "@/screens/pos/PosShellScreen";
import DataExportScreen from "@/screens/settings/DataExportSceen";
import WarehouseListScreen from "../screens/inventory/WarehouseListScreen";
import InventoryVoucherListScreen from "../screens/inventory/InventoryVoucherListScreen";
import WarehouseFormScreen from "../screens/inventory/WarehouseFormScreen";
import InventoryVoucherFormScreen from "../screens/inventory/InventoryVoucherFormScreen";
import InventoryVoucherDetailScreen from "../screens/inventory/InventoryVoucherDetailScreen";
import ProcessExpiredScreen from "../screens/inventory/ProcessExpiredScreen";

// ========== TYPES ==========
export type RootDrawerParamList = {
  Dashboard: undefined;
  SelectStore: undefined;
  StoreSettings: undefined;
  ProductList: undefined;
  Suppliers: undefined;
  ProductGroups: undefined;
  PosOrders: undefined;
  OrderList: undefined;
  CustomerList: undefined;
  TopCustomers: undefined;
  Employees: undefined;
  EmployeeSchedule: undefined;
  LoyaltyConfig: undefined;
  ReportsDashboard: undefined;
  RevenueReport: undefined;
  InventoryReport: undefined;
  TopProductsReport: undefined;
  ProfileScreen: undefined;
  Subscription: undefined;
  SubscriptionPricing: undefined;
  ActivityLog: undefined;
  PaymentMethod: undefined;
  NotificationSettings: undefined;
  ExportData: undefined;
  FileManager: undefined;
  // New screens
  WarehouseList: undefined;
  InventoryVoucherList: undefined;
  WarehouseForm: { warehouse?: any; onRefresh?: () => void };
  InventoryVoucherForm: { onRefresh?: () => void };
  InventoryVoucherDetail: { voucherId: string };
  ProcessExpired: undefined;
};

interface MenuItem {
  key: keyof RootDrawerParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  permission?: string | string[];
}

interface MenuSection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: MenuItem[];
}

interface MenuItemComponentProps {
  item: MenuItem;
  isActive: boolean;
  onPress: () => void;
  isLast: boolean;
}

interface PlaceholderScreenProps {
  title: string;
}

const Drawer = createDrawerNavigator<RootDrawerParamList>();

// ========== UTILITY FUNCTIONS ==========
const hasPermission = (
  menu: string[] = [],
  required?: string | string[]
): boolean => {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];

  return reqs.some((r) => {
    const [resource] = r.split(":");
    return menu.includes(r) || menu.includes(`${resource}:*`);
  });
};

// ========== PLACEHOLDER SCREEN (MEMOIZED) ==========
const PlaceholderScreen = memo<PlaceholderScreenProps>(
  ({ title }): JSX.Element => {
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
);

PlaceholderScreen.displayName = "PlaceholderScreen";

// ========== PLACEHOLDER SCREENS ==========
const PosScreen: FC = () => <PlaceholderScreen title="POS - Bán hàng" />;

// const OrderReconciliationScreen: FC = () => (
//   <PlaceholderScreen title="Đối soát hóa đơn" />
// );

const EmployeeScheduleScreen: FC = () => (
  <PlaceholderScreen title="Lịch làm việc" />
);
const ExportDataScreen: FC = () => <DataExportScreen />;


// ========== MENU TREE ==========
const MENU_TREE: readonly MenuSection[] = [
  {
    title: "CỬA HÀNG",
    icon: "storefront",
    items: [
      { key: "Dashboard", label: "Tổng quan", icon: "speedometer-outline" },
      {
        key: "SelectStore",
        label: "Chọn cửa hàng khác",
        icon: "storefront-outline",
        permission: "store:view",
      },
      {
        key: "StoreSettings",
        label: "Thiết lập cửa hàng",
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
        key: "WarehouseList",
        label: "Kho hàng",
        icon: "business-outline",
        permission: "warehouses:create",
      },
      {
        key: "InventoryVoucherList",
        label: "Phiếu nhập/xuất kho",
        icon: "document-attach-outline",
        permission: "inventory:voucher:create",
      },
      {
        key: "ProductList",
        label: "Danh sách hàng hóa",
        icon: "cube-outline",
        permission: "products:create",
      },
      {
        key: "Suppliers",
        label: "Nhà cung cấp",
        icon: "people-outline",
        permission: "suppliers:create",
      },
      {
        key: "ProductGroups",
        label: "Nhóm hàng hoá",
        icon: "grid-outline",
        permission: "product-groups:create",
      },
    ],
  },
  {
    title: "ĐƠN HÀNG/BÁN HÀNG",
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
        label: "Danh sách đơn hàng",
        icon: "receipt-outline",
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
        label: "Danh sách khách hàng",
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
        label: "Danh sách nhân viên",
        icon: "id-card-outline",
        permission: "store:employee:create",
      },
    ],
  },
  {
    title: "TÍCH ĐIỂM",
    icon: "gift",
    items: [
      {
        key: "LoyaltyConfig",
        label: "Cấu hình tích điểm",
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
        label: "Báo cáo tổng quan",
        icon: "podium-outline",
        permission: "reports:financial:view",
      },
      {
        key: "RevenueReport",
        label: "Báo cáo doanh thu chi tiết",
        icon: "trending-up-outline",
        permission: "reports:revenue:view",
      },
      {
        key: "InventoryReport",
        label: "Báo cáo tồn kho",
        icon: "cube-outline",
        permission: "inventory:stock-check:view",
      },
      {
        key: "TopProductsReport",
        label: "Top sản phẩm bán chạy",
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
        key: "Subscription",
        label: "Gói hiện tại",
        icon: "card-outline",
        permission: "subscription:view",
      },
      {
        key: "SubscriptionPricing",
        label: "Nâng cấp Premium",
        icon: "flash-outline",
        permission: "subscription:view",
      },
      {
        key: "ActivityLog",
        label: "Nhật ký hoạt động",
        icon: "time-outline",
        permission: "settings:activity-log",
      },
      {
        key: "PaymentMethod",
        label: "Thiết lập cổng thanh toán",
        icon: "card-outline",
        permission: "settings:payment-method",
      },
      {
        key: "ProfileScreen",
        label: "Hồ sơ cá nhân",
        icon: "person-outline",
        permission: undefined,
      },
      {
        key: "NotificationSettings",
        label: "Thông báo",
        icon: "notifications-outline",
        permission: undefined,
      },
      {
        key: "ExportData",
        label: "Xuất dữ liệu",
        icon: "download-outline",
        permission: "reports:financial:export",
      },
      {
        key: "FileManager",
        label: "Quản lý file",
        icon: "folder-open-outline",
        permission: "files:view",
      },
    ],
  },
];

// ========== MENU ITEM COMPONENT (MEMOIZED) ==========
const MenuItemComponent = memo<MenuItemComponentProps>(
  ({ item, isActive, onPress, isLast }): JSX.Element => {
    return (
      <TouchableOpacity
        style={[
          styles.menuItem,
          isActive && styles.menuItemActive,
          isLast && styles.menuItemLast,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.menuItemIconWrapper,
            isActive && styles.menuItemIconWrapperActive,
          ]}
        >
          <Ionicons
            name={item.icon}
            size={20}
            color={isActive ? "#10b981" : "#6b7280"}
          />
        </View>

        <Text
          style={[styles.menuItemText, isActive && styles.menuItemTextActive]}
        >
          {item.label}
        </Text>

        {isActive && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    );
  }
);

MenuItemComponent.displayName = "MenuItem";

// ========== CUSTOM DRAWER CONTENT ==========
const CustomDrawerContent = memo<DrawerContentComponentProps>(
  (props): JSX.Element => {
    const { logout, user } = useAuth();

    const [expandedSections, setExpandedSections] = useState<Set<string>>(
      new Set(["CỬA HÀNG"])
    );
    const [showScrollIndicator, setShowScrollIndicator] =
      useState<boolean>(false);

    const scrollViewRef = useRef<ScrollView>(null);
    const bounceAnim = useRef(new Animated.Value(0)).current;

    // Bounce animation
    React.useEffect(() => {
      if (showScrollIndicator) {
        const animation = Animated.loop(
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
        );

        animation.start();

        return () => {
          animation.stop();
          bounceAnim.setValue(0);
        };
      }

      bounceAnim.setValue(0);
    }, [showScrollIndicator, bounceAnim]);

    const translateY = bounceAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8],
    });

    // Memoized handlers
    const handleLogout = useCallback((): void => {
      Alert.alert(
        "Đăng xuất",
        "Bạn có chắc muốn đăng xuất không?",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Đăng xuất",
            style: "destructive",
            onPress: () => {
              CleanupManager.cleanup("AppNavigator");
              logout();
            },
          },
        ],
        { cancelable: true }
      );
    }, [logout]);

    const toggleSection = useCallback((title: string): void => {
      setExpandedSections((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(title)) newSet.delete(title);
        else newSet.add(title);
        return newSet;
      });
    }, []);

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
        const { contentOffset, contentSize, layoutMeasurement } =
          event.nativeEvent;

        const isAtBottom =
          contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;

        setShowScrollIndicator(
          !isAtBottom && contentSize.height > layoutMeasurement.height
        );
      },
      []
    );

    const handleScrollIndicatorPress = useCallback((): void => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, []);

    const menu: string[] = useMemo(() => user?.menu || [], [user?.menu]);
    const nameLabel: string = useMemo(
      () => user?.fullname || user?.username || "Người dùng",
      [user?.fullname, user?.username]
    );
    const roleLabel: string = useMemo(() => user?.role || "—", [user?.role]);
    const userImage: string | undefined = useMemo(
      () => user?.image,
      [user?.image]
    );

    const currentRoute: string = props.state.routes[props.state.index].name;

    // Memoize visible sections
    const visibleSections = useMemo(() => {
      return MENU_TREE.map((section) => {
        const visibleItems = section.items.filter((item) => {
          if (item.key === "SelectStore" && user?.role !== "MANAGER")
            return false;
          return hasPermission(menu, item.permission);
        });

        return { section, visibleItems };
      }).filter(({ visibleItems }) => visibleItems.length > 0);
    }, [menu, user?.role]);

    return (
      <View style={styles.drawerRoot}>
        {/* Header */}
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

          <View style={styles.headerTextContainer}>
            <Text style={styles.name} numberOfLines={1}>
              {nameLabel}
            </Text>

            <View style={styles.roleContainer}>
              <Ionicons name="shield-checkmark" size={12} color="#d1fae5" />
              <Text style={styles.role}>{roleLabel}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Menu */}
        <View style={styles.menuContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.menu}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
          >
            {visibleSections.map(({ section, visibleItems }) => {
              const isExpanded: boolean = expandedSections.has(section.title);

              return (
                <View key={section.title} style={styles.sectionContainer}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(section.title)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionIconCircle}>
                        <Ionicons
                          name={section.icon}
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

                  {isExpanded &&
                    visibleItems.map((item, idx) => (
                      <MenuItemComponent
                        key={item.key}
                        item={item}
                        isActive={currentRoute === item.key}
                        onPress={() => {
                          // 🚀 Log cleanup stats before navigation
                          if (__DEV__) {
                            console.log(
                              "📊 Before navigation:",
                              CleanupManager.getStats()
                            );
                          }
                          // Cast to any to satisfy overloaded navigate signatures for dynamic keys
                          props.navigation.navigate(item.key as any);
                        }}
                        isLast={idx === visibleItems.length - 1}
                      />
                    ))}
                </View>
              );
            })}

            <View style={styles.menuBottomSpacer} />
          </ScrollView>

          {/* Scroll Indicator */}
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

        {/* Logout */}
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
);

CustomDrawerContent.displayName = "CustomDrawerContent";

// ========== APP NAVIGATOR ==========
const AppNavigator: FC = (): JSX.Element => {
  const { user, loading } = useAuth();

  // Loading screen
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#10b981", "#10b981", "#10b981"]}
          style={styles.loadingCircle}
        >
          <ActivityIndicator size="large" color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>Đang tải dữ liệu người dùng...</Text>
      </View>
    );
  }

  const menu: string[] = user?.menu || [];

  // Permission wrapper HOC
  const withPermission = useCallback(
    (
      Component: React.ComponentType<any>,
      requiredPermission?: string | string[]
    ) =>
      (props: any): JSX.Element => {
        if (!hasPermission(menu, requiredPermission)) {
          return <Unauthorized />;
        }
        return <Component {...props} />;
      },
    [menu]
  );

  // Screen options with cleanup
  const screenOptions = useCallback(
    ({ navigation }: any): any => ({
      headerStyle: {
        backgroundColor: "#10b981",
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: "#ffffff",
      headerTitleStyle: { fontWeight: "700", fontSize: 18 },
      drawerActiveBackgroundColor: "transparent",
      drawerActiveTintColor: "transparent",
      drawerInactiveTintColor: "transparent",

      // 🚀 CRITICAL: Unmount screens when navigating away
      unmountOnBlur: true,

      // 🚀 CRITICAL: Freeze inactive screens
      freezeOnBlur: true,

      // 🚀 Cleanup on blur
      listeners: {
        blur: () => {
          if (__DEV__) {
            console.log("🧹 Screen blur - Force cleanup");
          }
          CleanupManager.cleanup();
        },
        focus: () => {
          if (__DEV__) {
            console.log("📊 Screen focus - Stats:", CleanupManager.getStats());
          }
        },
      },

      headerLeft: ({ tintColor }: { tintColor?: string }) => (
        <TouchableOpacity
          onPress={() => navigation.toggleDrawer()}
          style={styles.headerMenuBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={26} color={tintColor} />
        </TouchableOpacity>
      ),
    }),
    []
  );

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(drawerProps: DrawerContentComponentProps) => (
        <CustomDrawerContent {...drawerProps} />
      )}
      screenOptions={screenOptions}
      // 🚀 CRITICAL: Detach inactive screens to save memory
      detachInactiveScreens={true}
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
        component={withPermission(SupplierListScreen, "suppliers:view")}
        options={{ title: "Nhà cung cấp" }}
      />
      <Drawer.Screen
        name="ProductGroups"
        component={withPermission(
          ProductGroupListScreen,
          "product-groups:view"
        )}
        options={{ title: "Nhóm hàng" }}
      />
      <Drawer.Screen
        name="PosOrders"
        component={withPermission(PosShellScreen, "orders:create")}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="OrderList"
        component={withPermission(OrderListScreen, "orders:view")}
        options={{ title: "Đơn hàng" }}
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
        component={withPermission(EmployeesScreen, "store:employee:view")}
        options={{ title: "Nhân viên" }}
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
        options={{ title: "Báo cáo tổng quan" }}
      />
      <Drawer.Screen
        name="RevenueReport"
        component={withPermission(RevenueReportScreen, "reports:revenue:view")}
        options={{ title: "Báo cáo doanh thu chi tiết" }}
      />
      <Drawer.Screen
        name="InventoryReport"
        component={withPermission(
          InventoryReportScreen,
          "inventory:stock-check:view"
        )}
        options={{ title: "Báo cáo tồn kho" }}
      />
      <Drawer.Screen
        name="TopProductsReport"
        component={withPermission(TopProductsScreen, "reports:top-products")}
        options={{ title: "Sản phẩm bán chạy" }}
      />
      <Drawer.Screen
        name="ProfileScreen"
        component={withPermission(ProfileScreen)}
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
        component={withPermission(NotificationScreen)}
        options={{ title: "Thông báo" }}
      />
      <Drawer.Screen
        name="ExportData"
        component={withPermission(ExportDataScreen, "reports:financial:export")}
        options={{ title: "Xuất Dữ Liệu" }}
      />
      <Drawer.Screen
        name="FileManager"
        component={withPermission(FileManagerScreen, "files:view")}
        options={{ title: "Quản lý file" }}
      />
      {/* New screens */}
      <Drawer.Screen
        name="WarehouseList"
        component={withPermission(WarehouseListScreen, "warehouses:view")}
        options={{ title: "Kho hàng" }}
      />
      <Drawer.Screen
        name="InventoryVoucherList"
        component={withPermission(
          InventoryVoucherListScreen,
          "inventory:voucher:view"
        )}
        options={{ title: "Phiếu nhập/xuất kho" }}
      />
      <Drawer.Screen
        name="WarehouseForm"
        component={withPermission(WarehouseFormScreen, "warehouses:view")}
        options={{
          headerShown: false,
          drawerItemStyle: { display: "none" },
        }}
      />
      <Drawer.Screen
        name="InventoryVoucherForm"
        component={withPermission(InventoryVoucherFormScreen, "inventory:voucher:create")}
        options={{
          headerShown: false,
          drawerItemStyle: { display: "none" },
        }}
      />
      <Drawer.Screen
        name="InventoryVoucherDetail"
        component={withPermission(InventoryVoucherDetailScreen, "inventory:voucher:view")}
        options={{
          headerShown: false,
          drawerItemStyle: { display: "none" },
        }}
      />
      <Drawer.Screen
        name="ProcessExpired"
        component={withPermission(ProcessExpiredScreen, "inventory:voucher:create")}
        options={{
          headerShown: false,
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer.Navigator>
  );
};

export default AppNavigator;

// ========== STYLES ==========
const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

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

  headerTextContainer: {
    marginLeft: 14,
    flex: 1,
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

  menuContainer: {
    flex: 1,
    position: "relative",
  },

  menu: {
    flex: 1,
    paddingTop: 12,
  },

  menuContent: {
    paddingBottom: 20,
  },

  menuBottomSpacer: {
    height: 20,
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

  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
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
