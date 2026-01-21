// src/screens/pos/OrderPOSHomeScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { printBill } from "../../utils/printBill";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Share,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";

/** =========================================================
 *  Design tokens (Professional Design System)
 *  ========================================================= */
const COLORS = {
  // Primary colors
  primary: "#2563eb",
  primaryLight: "#3b82f6",
  primaryDark: "#1d4ed8",
  
  // Background & surfaces
  bg: "#f8fafc",
  surface: "#ffffff",
  card: "#ffffff",
  cardSecondary: "#f1f5f9",
  stroke: "#e2e8f0",
  
  // Text colors
  text: "#0f172a",
  textStrong: "#0b1220",
  textSecondary: "#475569",
  muted: "#64748b",
  placeholder: "#94a3b8",
  
  // Status colors
  success: "#16a34a",
  successLight: "#dcfce7",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  danger: "#ef4444",
  dangerLight: "#fee2e2",
  info: "#0ea5e9",
  infoLight: "#e0f2fe",
  
  // UI elements
  chip: "#f1f5f9",
  chipActive: "#dbeafe",
  white: "#ffffff",
  black: "#000000",
};

const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 999,
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const TYPOGRAPHY = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  android: {
    elevation: 4,
  },
});

const SHADOW_LG = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  android: {
    elevation: 8,
  },
});

/** =========================================================
 *  UI Components (Memoized for Performance)
 *  ========================================================= */
const Divider = React.memo(({ style }: { style?: any }) => (
  <View style={[{ height: 1, backgroundColor: COLORS.stroke }, style]} />
));

const Section = React.memo(({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <View style={styles.sectionContainer}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
    <View style={styles.sectionContent}>{children}</View>
  </View>
));

const Badge = React.memo(({ value, color = COLORS.primary }: { value: number | string; color?: string }) => (
  <View style={[styles.badge, { backgroundColor: color + "20" }]}>
    <Text style={[styles.badgeText, { color }]}>{value}</Text>
  </View>
));

const Card = React.memo(({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.card, style]}>{children}</View>
));

const IconButton = React.memo(({
  icon,
  onPress,
  size = 24,
  color = COLORS.primary,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: any;
}) => (
  <TouchableOpacity onPress={onPress} style={[styles.iconButton, style]} hitSlop={8}>
    <Ionicons name={icon} size={size} color={color} />
  </TouchableOpacity>
));

/** =========================================================
 *  Enhanced Button Component
 *  ========================================================= */
const Button = React.memo(({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  style,
  fullWidth = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  loading?: boolean;
  style?: any;
  fullWidth?: boolean;
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return { bg: COLORS.primary, text: COLORS.white, border: COLORS.primary };
      case "secondary":
        return { bg: COLORS.cardSecondary, text: COLORS.text, border: COLORS.stroke };
      case "outline":
        return { bg: "transparent", text: COLORS.primary, border: COLORS.primary };
      case "danger":
        return { bg: COLORS.danger, text: COLORS.white, border: COLORS.danger };
      case "success":
        return { bg: COLORS.success, text: COLORS.white, border: COLORS.success };
      case "ghost":
        return { bg: "transparent", text: COLORS.text, border: "transparent" };
      default:
        return { bg: COLORS.primary, text: COLORS.white, border: COLORS.primary };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return { paddingVertical: 8, paddingHorizontal: 12, fontSize: 12 };
      case "md":
        return { paddingVertical: 12, paddingHorizontal: 16, fontSize: 14 };
      case "lg":
        return { paddingVertical: 16, paddingHorizontal: 20, fontSize: 16 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 16, fontSize: 14 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.buttonBase,
        {
          backgroundColor: variantStyles.bg,
          borderColor: variantStyles.border,
          borderWidth: variant === "outline" ? 1 : 0,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          width: fullWidth ? "100%" : undefined,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.text} />
      ) : (
        <View style={styles.buttonContent}>
          {icon && iconPosition === "left" && (
            <Ionicons name={icon} size={sizeStyles.fontSize} color={variantStyles.text} style={styles.buttonIcon} />
          )}
          <Text
            style={[
              styles.buttonText,
              {
                color: variantStyles.text,
                fontSize: sizeStyles.fontSize,
                fontWeight: size === "lg" ? "700" : "600",
              },
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && (
            <Ionicons name={icon} size={sizeStyles.fontSize} color={variantStyles.text} style={styles.buttonIcon} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

/** =========================================================
 *  Enhanced Input Component
 *  ========================================================= */
const Input = React.memo(({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry,
  keyboardType = "default",
  multiline,
  numberOfLines,
  style,
  leftIcon,
  rightIcon,
  editable = true,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  editable?: boolean;
}) => (
  <View style={styles.inputContainer}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View style={[styles.inputWrapper, error && styles.inputError, !editable && styles.inputDisabled]}>
      {leftIcon && <Ionicons name={leftIcon} size={20} color={COLORS.muted} style={styles.inputLeftIcon} />}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
        style={[styles.inputField, multiline && { height: numberOfLines ? numberOfLines * 24 : 100 }, style]}
      />
      {rightIcon && <Ionicons name={rightIcon} size={20} color={COLORS.muted} style={styles.inputRightIcon} />}
    </View>
    {error && <Text style={styles.inputErrorText}>{error}</Text>}
  </View>
));

/** =========================================================
 *  Types
 *  ========================================================= */
type PaymentMethod = "cash" | "qr";
type SaleType = "NORMAL" | "AT_COST" | "VIP" | "CLEARANCE" | "FREE";

type ProductBatch = {
  batch_no: string;
  expiry_date: string | null;
  cost_price: any;
  selling_price?: any;
  quantity: number;
  created_at?: string;
};

type Product = {
  _id: string;
  name: string;
  sku: string;
  price: any;
  cost_price: any;
  stock_quantity: number;
  unit: string;
  image?: { url: string };
  batches?: ProductBatch[];
  tax_rate?: number;
};

type Customer = {
  _id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
  email?: string;
  address?: string;
};

type Employee = {
  _id: string;
  fullName: string;
  phone?: string;
  user_id?: {
    _id: string;
    username: string;
    role?: string;
    email?: string;
    phone?: string;
    menu?: string[];
  } | null;
};

type VirtualOwner = {
  _id: "virtual-owner";
  fullName: string;
  isOwner: true;
};

type RealEmployee = Employee & { isOwner?: false };
type Seller = RealEmployee | VirtualOwner;

type CartItem = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  image?: { url: string };
  price: any;
  cost_price?: any;
  overridePrice?: number | null;
  saleType?: SaleType;
  quantity: number;
  subtotal: string;
  tax_rate?: number;
  stock_quantity?: number;
  batchId?: string | null;
  batchCode?: string | null;
  expiryDate?: string | null;
};

type OrderTab = {
  key: string;
  cart: CartItem[];
  customer: Customer | null;
  employeeId: string | null;
  usedPoints: number;
  usedPointsEnabled: boolean;
  isVAT: boolean;
  paymentMethod: PaymentMethod;
  cashReceived: number;
  pendingOrderId: string | null;
  orderCreatedPaymentMethod: PaymentMethod | null;
  orderCreatedAt: string;
  orderPrintCount: number;
  orderEarnedPoints: number;
  isPaid: boolean;
  qrImageUrl: string | null;
  qrPayload: string | null;
  qrExpiryTs: number | null;
  savedQrImageUrl: string | null;
  savedQrPayload: string | null;
  savedQrExpiryTs: number | null;
  companyName: string;
  taxCode: string;
  companyAddress: string;
};

type OrderResponse = {
  message: string;
  order: {
    _id: string;
    qrExpiry?: string;
    paymentMethod: PaymentMethod;
    createdAt?: string;
    printCount?: number;
    earnedPoints?: number;
  };
  qrDataURL?: string;
  paymentLinkUrl?: string | null;
};

type LoyaltyConfig = {
  isActive?: boolean;
  vndPerPoint?: number;
  minPointsToRedeem?: number;
};

const SALE_TYPE_LABEL: Record<SaleType, string> = {
  NORMAL: "Giá niêm yết",
  VIP: "Giá ưu đãi",
  AT_COST: "Giá vốn",
  CLEARANCE: "Xả kho",
  FREE: "Miễn phí",
};

/** =========================================================
 *  Helper Functions
 *  ========================================================= */
const debounce = <F extends (...args: any[]) => any>(func: F, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const getPriceNumber = (price: any): number => {
  if (!price) return 0;
  if (price?.$numberDecimal) return parseFloat(price.$numberDecimal);
  if (price?.numberDecimal) return parseFloat(price.numberDecimal);
  if (typeof price === "string") return parseFloat(price) || 0;
  if (typeof price === "number") return price;
  return 0;
};

const formatPrice = (price: any): string => {
  const num = getPriceNumber(price);
  return `${Math.max(0, Math.round(num)).toLocaleString("vi-VN")}đ`;
};

const normalizeText = (s: string) => {
  const str = (s || "").toLowerCase().trim();
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const splitQuery = (s: string) => normalizeText(s).split(" ").filter(Boolean);

const matchScore = (nameOrSku: string, query: string) => {
  const t = normalizeText(nameOrSku);
  const q = normalizeText(query);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.includes(q)) return 80;
  const qTokens = splitQuery(q);
  const tTokens = new Set(splitQuery(t));
  const hit = qTokens.filter((x) => tTokens.has(x)).length;
  return hit > 0 ? 30 + hit * 10 : 0;
};

const getItemUnitPrice = (item: CartItem): number => {
  if (item.overridePrice !== null && item.overridePrice !== undefined) {
    return Number(item.overridePrice) || 0;
  }
  const base = getPriceNumber(item.price);
  const cost = getPriceNumber(item.cost_price);
  const saleType = item.saleType || "NORMAL";
  
  switch (saleType) {
    case "NORMAL":
      return base;
    case "VIP":
      return base;
    case "AT_COST":
      return cost || base;
    case "CLEARANCE":
      return cost || base;
    case "FREE":
      return 0;
    default:
      return base;
  }
};

const makeEmptyTab = (key: string, defaultEmployeeId: string | null): OrderTab => ({
  key,
  cart: [],
  customer: null,
  employeeId: defaultEmployeeId,
  usedPoints: 0,
  usedPointsEnabled: false,
  isVAT: false,
  paymentMethod: "cash",
  cashReceived: 0,
  pendingOrderId: null,
  orderCreatedPaymentMethod: null,
  orderCreatedAt: "",
  orderPrintCount: 0,
  orderEarnedPoints: 0,
  isPaid: false,
  qrImageUrl: null,
  qrPayload: null,
  qrExpiryTs: null,
  savedQrImageUrl: null,
  savedQrPayload: null,
  savedQrExpiryTs: null,
  companyName: "",
  taxCode: "",
  companyAddress: "",
});

const clampInt = (raw: string, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(parseInt(raw || "0", 10) || 0);
  return Math.max(min, Math.min(max, n));
};

/** =========================================================
 *  Main Screen Component
 *  ========================================================= */
const OrderPOSHomeScreen: React.FC = () => {
  // ===== State Management =====
  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("Cửa hàng");
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  
  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = useState<Seller | null>(null);
  const [loyaltySetting, setLoyaltySetting] = useState<LoyaltyConfig | null>(null);
  const [isStoreEmpty, setIsStoreEmpty] = useState(false);
  const [hasCheckedEmpty, setHasCheckedEmpty] = useState(false);
  
  // Order tabs
  const [orders, setOrders] = useState<OrderTab[]>([makeEmptyTab("1", null)]);
  const [activeTab, setActiveTab] = useState("1");
  
  // Search states
  const [searchProduct, setSearchProduct] = useState("");
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Customer states
  const [phoneInput, setPhoneInput] = useState("");
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [newCustomerModal, setNewCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  
  // Modal states
  const [employeeModal, setEmployeeModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const [priceEditModal, setPriceEditModal] = useState<{
    visible: boolean;
    item?: CartItem;
    tempSaleType?: SaleType;
    tempOverridePrice?: number | null;
  }>({ visible: false });
  
  const [qrRemainingSec, setQrRemainingSec] = useState<number | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const storeIdRef = useRef<string | null>(null);
  const authHeadersRef = useRef<any>(undefined);
  const selectingProductRef = useRef(false);
  const selectingCustomerRef = useRef(false);
  
  // Current user and storage
  const currentUserId = loggedInUser?.id || loggedInUser?._id || "anonymous";
  const CART_STORAGE_KEY = `pos_cart_${storeId}_${currentUserId}`;
  
  // Auth headers
  const authHeaders = useMemo(() => 
    token ? { Authorization: `Bearer ${token}` } : undefined, 
    [token]
  );
  
  // Current tab
  const currentTab = useMemo(
    () => orders.find((t) => t.key === activeTab)!,
    [orders, activeTab]
  );
  
  // ===== Calculations =====
  const subtotal = useMemo(
    () => currentTab.cart.reduce(
      (sum, item) => sum + getItemUnitPrice(item) * item.quantity,
      0
    ),
    [currentTab.cart]
  );
  
  const discount = useMemo(() => {
    const vndPerPoint = loyaltySetting?.vndPerPoint || 0;
    return currentTab.usedPointsEnabled ? (currentTab.usedPoints || 0) * vndPerPoint : 0;
  }, [currentTab.usedPointsEnabled, currentTab.usedPoints, loyaltySetting?.vndPerPoint]);
  
  const beforeTax = Math.max(subtotal - discount, 0);
  
  const vatAmount = useMemo(() => {
    return currentTab.cart.reduce((sum, item) => {
      const itemPrice = getItemUnitPrice(item);
      const itemTaxRate = item.tax_rate !== undefined && item.tax_rate !== null 
        ? Number(item.tax_rate) 
        : 0;
      const effectiveRate = itemTaxRate === -1 ? 0 : itemTaxRate;
      return sum + (itemPrice * item.quantity * effectiveRate) / 100;
    }, 0);
  }, [currentTab.cart]);
  
  const totalAmount = beforeTax + vatAmount;
  const changeAmount = useMemo(
    () => Math.max(0, (currentTab.cashReceived || 0) - totalAmount),
    [currentTab.cashReceived, totalAmount]
  );
  
  const employeeLabel = useMemo(() => {
    if (currentUserEmployee?.isOwner && currentTab.employeeId === null) {
      return `${currentUserEmployee.fullName} (Chủ cửa hàng)`;
    }
    const e = employees.find((x) => x._id === currentTab.employeeId);
    return e?.fullName || "Chưa chọn";
  }, [currentUserEmployee, currentTab.employeeId, employees]);
  
  // ===== Effects =====
  useEffect(() => {
    storeIdRef.current = storeId;
  }, [storeId]);
  
  useEffect(() => {
    authHeadersRef.current = authHeaders;
  }, [authHeaders]);
  
  // Initialize
  useEffect(() => {
    (async () => {
      try {
        const [csRaw, tkn, usrRaw] = await Promise.all([
          AsyncStorage.getItem("currentStore"),
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("user"),
        ]);
        
        const cs = csRaw ? JSON.parse(csRaw) : null;
        const usr = usrRaw ? JSON.parse(usrRaw) : null;
        
        if (!cs?._id) {
          Alert.alert("Lỗi", "Không tìm thấy thông tin cửa hàng");
          setLoadingInit(false);
          return;
        }
        
        setStoreId(cs._id);
        setStoreName(cs.name || "Cửa hàng");
        setStoreInfo(cs);
        setToken(tkn);
        setLoggedInUser(usr);
      } catch (error) {
        Alert.alert("Lỗi", "Không thể tải dữ liệu khởi tạo");
        console.error("Init error:", error);
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);
  
  // Load data
  useEffect(() => {
    if (!storeId) return;
    loadEmployees();
    loadLoyaltySetting();
    checkStoreProducts();
  }, [storeId]);
  
  // Cart persistence
  useEffect(() => {
    if (!storeId || !currentUserId) return;
    
    (async () => {
      try {
        const savedData = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.orders && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
            setOrders(parsed.orders);
            if (parsed.activeTab) setActiveTab(parsed.activeTab);
          }
        }
      } catch (err) {
        console.error("Lỗi đọc cart:", err);
      }
    })();
  }, [storeId, currentUserId]);
  
  useEffect(() => {
    if (!storeId || !currentUserId) return;
    
    const hasItems = orders.some(
      (tab) => tab.cart.length > 0 || tab.customer || tab.pendingOrderId
    );
    
    if (hasItems) {
      (async () => {
        try {
          const dataToSave = {
            orders,
            activeTab,
            userId: currentUserId,
            savedAt: new Date().toISOString(),
          };
          await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (err) {
          console.error("Lỗi lưu cart:", err);
        }
      })();
    }
  }, [orders, activeTab, storeId, currentUserId]);
  
  // QR countdown
  useEffect(() => {
    if (!qrModal) return;
    
    let countdownId: NodeJS.Timeout | null = null;
    const expiry = currentTab.qrExpiryTs;
    
    if (expiry) {
      const tick = () => {
        const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setQrRemainingSec(diff);
        
        if (diff <= 0) {
          updateOrderTab((t) => {
            t.qrImageUrl = null;
            t.qrPayload = null;
            t.qrExpiryTs = null;
          });
          Alert.alert("Hết hạn", "QR đã hết hạn");
        }
      };
      
      tick();
      countdownId = setInterval(tick, 1000);
    }
    
    return () => {
      if (countdownId) clearInterval(countdownId);
    };
  }, [qrModal, currentTab.qrExpiryTs]);
  

  // ===== API Functions =====
  const loadEmployees = useCallback(async () => {
    if (!storeId) return;
    
    try {
      const user = loggedInUser;
      if (!user?.id && !user?._id) return;
      
      const userId = user?.id || user?._id;
      const role = user?.role;
      
      // STAFF: create employee from user data
      if (role === "STAFF") {
        const staffEmployee: Seller = {
          _id: userId,
          fullName: user?.fullname || user?.fullName || user?.username || "Nhân viên",
          user_id: {
            _id: userId,
            username: user?.username || "staff",
            role,
            email: user?.email,
            phone: user?.phone,
            menu: user?.menu,
          },
        };
        
        setCurrentUserEmployee(staffEmployee);
        setEmployees([staffEmployee as Employee]);
        setOrders(prev => prev.map(t => ({ ...t, employeeId: userId })));
        return;
      }
      
      // MANAGER/OWNER: load employees list
      const res: any = await apiClient.get(`/stores/${storeId}/employees`, {
        params: { deleted: "false" },
        headers: authHeaders,
      });
      
      const employeesList: Employee[] = res?.data?.employees || res?.data?.data?.employees || [];
      setEmployees(Array.isArray(employeesList) ? employeesList : []);
      
      if (role === "MANAGER" || role === "OWNER") {
        const virtualOwner: VirtualOwner = {
          _id: "virtual-owner",
          fullName: user?.fullname || user?.fullName || user?.username || "Chủ cửa hàng",
          isOwner: true,
        };
        
        setCurrentUserEmployee(virtualOwner);
        setOrders(prev => prev.map(t => ({ ...t, employeeId: null })));
      }
    } catch (error) {
      console.error("Lỗi tải nhân viên:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách nhân viên");
    }
  }, [storeId, loggedInUser, authHeaders]);
  
  const loadLoyaltySetting = useCallback(async () => {
    if (!storeId) return;
    
    try {
      const res: any = await apiClient.get(`/loyaltys/config/${storeId}`, {
        headers: authHeaders,
      });
      
      if (res?.data?.isConfigured && res?.data?.config?.isActive) {
        setLoyaltySetting(res.data.config);
      } else {
        setLoyaltySetting(null);
      }
    } catch (error) {
      console.error("Lỗi tải cài đặt loyalty:", error);
      setLoyaltySetting(null);
    }
  }, [storeId, authHeaders]);
  
  const checkStoreProducts = useCallback(async () => {
    if (!storeId) return;
    
    try {
      const res: any = await apiClient.get(`/products/store/${storeId}`, {
        params: { limit: 1 },
        headers: authHeaders,
      });
      
      const products = res?.data?.products || [];
      const isEmpty = products.length === 0;
      setIsStoreEmpty(isEmpty);
      setHasCheckedEmpty(true);
      
      if (isEmpty) {
        const isOwner = loggedInUser?.role === "OWNER" || loggedInUser?.role === "MANAGER";
        Alert.alert(
          "Kho hàng trống",
          isOwner
            ? "Cửa hàng của bạn chưa có sản phẩm nào. Vui lòng nhập hàng trước khi bán."
            : "Cửa hàng chưa có sản phẩm nào. Vui lòng báo chủ cửa hàng.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Lỗi kiểm tra kho hàng:", error);
    }
  }, [storeId, authHeaders, loggedInUser]);
  
  // ===== Cart Functions =====
  const updateOrderTab = useCallback(
    (updater: (tab: OrderTab) => void, key = activeTab) => {
      setOrders((prev) =>
        prev.map((tab) => {
          if (tab.key !== key) return tab;
          const clone: OrderTab = { ...tab, cart: [...tab.cart] };
          updater(clone);
          return clone;
        })
      );
    },
    [activeTab]
  );
  
  const resetCurrentTab = useCallback(() => {
    updateOrderTab((tab) => {
      const defaultEmployeeId = currentUserEmployee?.isOwner 
        ? null 
        : currentUserEmployee?._id || null;
      
      const fresh = makeEmptyTab(tab.key, defaultEmployeeId);
      Object.assign(tab, fresh);
    });
    
    setPhoneInput("");
    setFoundCustomers([]);
    setShowCustomerDropdown(false);
    setSearchProduct("");
    setSearchedProducts([]);
    setShowProductDropdown(false);
    
    // Clear saved cart
    (async () => {
      try {
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
      } catch (err) {
        console.error("Lỗi xóa cart:", err);
      }
    })();
  }, [updateOrderTab, currentUserEmployee, storeId, loggedInUser]);
  
  const addNewOrderTab = useCallback(() => {
    const maxKey = orders.reduce(
      (m, t) => Math.max(m, parseInt(t.key, 10) || 0),
      0
    );
    const newKey = String(maxKey + 1);
    const defaultEmployeeId = currentUserEmployee?.isOwner 
      ? null 
      : currentUserEmployee?._id || null;
    
    setOrders((prev) => [...prev, makeEmptyTab(newKey, defaultEmployeeId)]);
    setActiveTab(newKey);
  }, [orders, currentUserEmployee]);
  
  const removeOrderTab = useCallback((key: string) => {
    if (orders.length <= 1) return;
    
    setOrders((prev) => {
      const next = prev.filter((t) => t.key !== key);
      const nextActive = activeTab === key ? next[0]?.key : activeTab;
      if (nextActive) setActiveTab(nextActive);
      return next;
    });
  }, [orders, activeTab]);
  
  const getAvailableStock = useCallback((product: Product) => {
    if (!product.batches || product.batches.length === 0) {
      return product.stock_quantity;
    }
    
    const available = product.batches.reduce((sum: number, b: ProductBatch) => {
      const isExpired = !!(b.expiry_date && new Date(b.expiry_date) < new Date());
      return isExpired ? sum : sum + (b.quantity || 0);
    }, 0);
    
    return available;
  }, []);
  
  const searchProductDebounced = useMemo(
    () =>
      debounce(async (query: string) => {
        const sid = storeIdRef.current;
        const headers = authHeadersRef.current;
        
        const q = query.trim();
        if (!sid || q.length < 1) {
          setProductSearchLoading(false);
          setProductSearchError(null);
          setSearchedProducts([]);
          return;
        }
        
        setProductSearchLoading(true);
        setProductSearchError(null);
        
        try {
          const res: any = await apiClient.get(`/products/search`, {
            params: { query: q, storeId: sid },
            headers,
          });
          
          const list = res?.data?.products || [];
          setSearchedProducts(Array.isArray(list) ? list : []);
        } catch (e: any) {
          setSearchedProducts([]);
          setProductSearchError(
            e?.response?.data?.message || "Không tìm được sản phẩm"
          );
        } finally {
          setProductSearchLoading(false);
        }
      }, 300),
    []
  );
  
  useEffect(() => {
    searchProductDebounced(searchProduct);
  }, [searchProduct, searchProductDebounced]);
  
  const addToCart = useCallback((product: Product) => {
    const availableStock = getAvailableStock(product);
    
    if (availableStock <= 0) {
      const hasExpired = product.batches && product.batches.some(
        (b) => b.expiry_date && new Date(b.expiry_date) < new Date()
      );
      
      Alert.alert(
        hasExpired ? "Hàng hết hạn" : "Hết hàng",
        hasExpired
          ? `Sản phẩm "${product.name}" chỉ còn lô đã hết hạn.`
          : `Sản phẩm "${product.name}" đã hết hàng.`
      );
      return;
    }
    
    // Select best batch (FEFO)
    let selectedBatchId: string | null = null;
    let selectedBatchName: string | null = null;
    let selectedBatchExpiry: string | null = null;
    
    if (product.batches && product.batches.length > 0) {
      const now = new Date();
      const validBatches = product.batches.filter(b => {
        const isExpired = b.expiry_date && new Date(b.expiry_date) < now;
        return (b.quantity || 0) > 0 && !isExpired;
      });
      
      if (validBatches.length > 0) {
        // Sort by expiry date (nearest first)
        validBatches.sort((a, b) => {
          if (a.expiry_date && b.expiry_date) {
            return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
          }
          if (a.expiry_date) return -1;
          if (b.expiry_date) return 1;
          return 0;
        });
        
        const bestBatch = validBatches[0];
        selectedBatchId = bestBatch.batch_no;
        selectedBatchName = bestBatch.batch_no;
        selectedBatchExpiry = bestBatch.expiry_date;
      }
    }
    
    const priceNum = getPriceNumber(product.price);
    
    updateOrderTab((tab) => {
      let existingIndex = -1;
      
      if (selectedBatchId) {
        existingIndex = tab.cart.findIndex(
          (item) => item.productId === product._id && item.batchId === selectedBatchId
        );
      } else {
        existingIndex = tab.cart.findIndex(
          (item) => item.productId === product._id && !item.batchId
        );
      }
      
      if (existingIndex !== -1) {
        const existing = tab.cart[existingIndex];
        const newQty = existing.quantity + 1;
        
        if (newQty > availableStock) {
          Alert.alert("Vượt tồn kho", `Chỉ còn ${availableStock} sản phẩm.`);
          return;
        }
        
        const newCart = [...tab.cart];
        newCart[existingIndex] = {
          ...existing,
          quantity: newQty,
          subtotal: (newQty * getItemUnitPrice(existing)).toFixed(2),
        };
        tab.cart = newCart;
      } else {
        tab.cart = [
          ...tab.cart,
          {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            image: product.image,
            price: product.price,
            cost_price: product.cost_price,
            unit: product.unit,
            tax_rate: product.tax_rate,
            quantity: 1,
            overridePrice: null,
            saleType: "NORMAL",
            subtotal: priceNum.toFixed(2),
            stock_quantity: availableStock,
            batchId: selectedBatchId,
            batchCode: selectedBatchName,
            expiryDate: selectedBatchExpiry,
          },
        ];
      }
    });
    
    setSearchProduct("");
    setSearchedProducts([]);
    setShowProductDropdown(false);
    Keyboard.dismiss();
  }, [updateOrderTab, getAvailableStock]);
  
  const updateQuantity = useCallback((id: string, batchId: string | null | undefined, qty: number) => {
    updateOrderTab((tab) => {
      const isMatch = (i: CartItem) => 
        i.productId === id && ((!batchId && !i.batchId) || (batchId && i.batchId === batchId));
      
      const item = tab.cart.find(isMatch);
      if (!item) return;
      
      if (qty <= 0) {
        tab.cart = tab.cart.filter((i) => !isMatch(i));
      } else {
        const maxStock = item.stock_quantity ?? 
          searchedProducts.find((p) => p._id === id)?.stock_quantity ?? 
          9999;
        
        if (qty > maxStock) {
          Alert.alert("Vượt tồn kho", `"${item.name}" chỉ còn ${maxStock} sản phẩm.`);
          const cappedQty = maxStock;
          tab.cart = tab.cart.map((i) =>
            isMatch(i)
              ? {
                  ...i,
                  quantity: cappedQty,
                  subtotal: (getItemUnitPrice(i) * cappedQty).toFixed(2),
                }
              : i
          );
          return;
        }
        
        tab.cart = tab.cart.map((i) =>
          isMatch(i)
            ? {
                ...i,
                quantity: qty,
                subtotal: (getItemUnitPrice(i) * qty).toFixed(2),
              }
            : i
        );
      }
    });
  }, [updateOrderTab, searchedProducts]);
  
  const removeItem = useCallback((productId: string, batchId: string | null | undefined) => {
    updateOrderTab((tab) => {
      const isMatch = (i: CartItem) => 
        i.productId === productId && ((!batchId && !i.batchId) || (batchId && i.batchId === batchId));
      tab.cart = tab.cart.filter((i) => !isMatch(i));
    });
  }, [updateOrderTab]);
  
  // ===== Customer Functions =====
  const searchCustomerDebounced = useMemo(
    () =>
      debounce(async (phone: string) => {
        const sid = storeIdRef.current;
        const headers = authHeadersRef.current;
        
        const p = phone.trim();
        if (!sid || p.length < 3) {
          setFoundCustomers([]);
          return;
        }
        
        try {
          const res: any = await apiClient.get(`/customers/search`, {
            params: { query: p, storeId: sid },
            headers,
          });
          
          const list = res?.data?.customers || [];
          setFoundCustomers(Array.isArray(list) ? list : []);
        } catch {
          setFoundCustomers([]);
          setNewCustomerName("");
          setNewCustomerPhone(p);
          setNewCustomerModal(true);
        }
      }, 300),
    []
  );
  
  const onChangePhoneInput = useCallback((val: string) => {
    setPhoneInput(val);
    
    if (!val.trim()) {
      setFoundCustomers([]);
      updateOrderTab((t) => {
        t.customer = null;
        t.usedPoints = 0;
        t.usedPointsEnabled = false;
      });
      return;
    }
    
    setShowCustomerDropdown(true);
    searchCustomerDebounced(val);
  }, [updateOrderTab, searchCustomerDebounced]);
  
  const selectCustomer = useCallback((c: Customer) => {
    updateOrderTab((t) => {
      t.customer = c;
      t.usedPoints = 0;
      t.usedPointsEnabled = false;
    });
    
    setPhoneInput(c.phone);
    setFoundCustomers([]);
    setShowCustomerDropdown(false);
  }, [updateOrderTab]);
  
  const createCustomer = useCallback(async () => {
    if (!storeId) return;
    
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();
    
    if (!name || !phone) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên và số điện thoại");
      return;
    }
    
    try {
      const res: any = await apiClient.post(
        `/customers`,
        { storeId, name, phone, email: newCustomerEmail || undefined },
        { headers: authHeaders }
      );
      
      const created: Customer = res?.data?.customer || res?.data?.data?.customer || res?.data;
      if (!created?._id) throw new Error("Tạo khách hàng thất bại");
      
      selectCustomer(created);
      setNewCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      
      Alert.alert("Thành công", "Đã tạo khách hàng mới");
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Không thể tạo khách hàng"
      );
    }
  }, [storeId, newCustomerName, newCustomerPhone, newCustomerEmail, authHeaders, selectCustomer]);
  
  // ===== Order Functions =====
  const createOrder = useCallback(async () => {
    if (!storeId) return;
    
    if (currentTab.cart.length === 0) {
      Alert.alert("Giỏ hàng trống", "Vui lòng thêm sản phẩm vào giỏ");
      return;
    }
    
    const sendEmployeeId = currentTab.employeeId === "virtual-owner" ? null : currentTab.employeeId;
    setLoading(true);
    
    try {
      const items = currentTab.cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        saleType: item.saleType ?? "NORMAL",
        ...(item.overridePrice !== null && item.overridePrice !== undefined
          ? { customPrice: item.overridePrice }
          : {}),
      }));
      
      const payload: any = {
        storeId,
        employeeId: sendEmployeeId,
        items,
        paymentMethod: currentTab.paymentMethod,
        isVATInvoice: currentTab.isVAT,
        orderId: currentTab.pendingOrderId || undefined,
        vatAmount,
        discountAmount: discount,
        beforeTaxAmount: beforeTax,
        totalAmount,
        grossAmount: subtotal + vatAmount,
      };
      
      if (currentTab.customer) {
        payload.customerInfo = {
          phone: currentTab.customer.phone,
          name: currentTab.customer.name,
        };
      }
      
      if (currentTab.isVAT) {
        payload.vatInfo = {
          companyName: currentTab.companyName,
          taxCode: currentTab.taxCode,
          companyAddress: currentTab.companyAddress,
        };
      }
      
      if (currentTab.usedPointsEnabled && currentTab.usedPoints > 0) {
        payload.usedPoints = currentTab.usedPoints;
      }
      
      const res: any = await apiClient.post<OrderResponse>(`/orders`, payload, {
        headers: authHeaders,
      });
      
      const order = res?.data?.order;
      const orderId = order?._id;
      if (!orderId) throw new Error("Không lấy được orderId");
      
      updateOrderTab((tab) => {
        tab.pendingOrderId = orderId;
        tab.orderCreatedAt = order?.createdAt || "";
        tab.orderPrintCount = typeof order?.printCount === "number" ? order.printCount : 0;
        tab.orderEarnedPoints = order?.earnedPoints ?? 0;
        tab.orderCreatedPaymentMethod = currentTab.paymentMethod;
        
        if (currentTab.paymentMethod === "qr" && res?.data?.qrDataURL) {
          tab.qrImageUrl = res.data.qrDataURL;
          tab.savedQrImageUrl = res.data.qrDataURL;
          tab.qrPayload = (order as any)?.paymentRef;
          tab.qrExpiryTs = order?.qrExpiry
            ? new Date(order.qrExpiry).getTime()
            : null;
          tab.savedQrExpiryTs = order?.qrExpiry
            ? new Date(order.qrExpiry).getTime()
            : null;
        }
      });
      
      if (currentTab.paymentMethod === "cash") {
        // Tiền mặt: Chỉ thông báo đơn hàng đã tạo, mở modal để xác nhận thanh toán/in
        // Alert.alert("Thành công", "Đã tạo đơn hàng chờ thanh toán.", [
        //   {
        //     text: "OK",
        //     // onPress: () => setBillModal(true),
        //   },
        // ]);
      } else {
        setQrModal(true);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || "Lỗi tạo đơn";
      
      if (currentTab.paymentMethod === "qr" && errorMessage.includes("PayOS")) {
        Alert.alert(
          "Chưa tích hợp thanh toán",
          "Vui lòng cấu hình PayOS trong phần cài đặt thanh toán"
        );
      } else {
        Alert.alert("Lỗi", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [
    storeId,
    currentTab,
    authHeaders,
    vatAmount,
    discount,
    beforeTax,
    totalAmount,
    subtotal,
    updateOrderTab,
  ]);
  
  const confirmPaidCash = useCallback(async () => {
    if (!currentTab.pendingOrderId) {
      Alert.alert("Lỗi", "Không tìm thấy đơn hàng");
      return;
    }
    
    try {
      await apiClient.post(
        `/orders/${currentTab.pendingOrderId}/set-paid-cash`,
        {},
        { headers: authHeaders }
      );
      
      Alert.alert(
        "Thành công",
        "Đã xác nhận thanh toán. Bạn có muốn in hóa đơn không?",
        [
          { 
            text: "Không", 
            style: "cancel", 
            onPress: () => {
              setBillModal(false);
              setQrModal(false);
              resetCurrentTab();
            } 
          },
          { 
            text: "In hóa đơn", 
            onPress: () => {
              triggerPrint(currentTab.pendingOrderId!, true);
            } 
          },
        ]
      );
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Lỗi xác nhận thanh toán"
      );
    }
  }, [currentTab.pendingOrderId, authHeaders]);
  
  const triggerPrint = useCallback(async (orderIdInput: string, shouldReset: boolean = false) => {
    if (isPrinting) return;
    
    setIsPrinting(true);
    
    try {
      // 1. Lấy thông tin chi tiết đơn hàng để in
      // Nếu là pending order hiện tại, dùng luôn dữ liệu hiện tại
      // Nhưng tốt nhất nên gọi API lấy dữ liệu chuẩn từ server để đảm bảo chính xác (số lần in, ngày tạo, v.v.)
      
      let printData: any = null;
      
      // Check if we can use currentTab data if it matches
      if (currentTab.pendingOrderId === orderIdInput) {
        // Prepare local data
          printData = {
            storeName: storeName || "Cửa hàng",
            storeAddress: storeInfo?.address || "",
            storePhone: storeInfo?.phone || "",
            storeTaxCode: storeInfo?.taxCode || "",
            
            orderId: orderIdInput || "",
            createdAt: currentTab.orderCreatedAt || new Date(),
            employeeName: employeeLabel || "Nhân viên",
            
            customerName: currentTab.customer?.name || "Khách vãng lai",
            customerPhone: currentTab.customer?.phone || "",
            companyName: currentTab.companyName || "",
            taxCode: currentTab.taxCode || "",
            companyAddress: currentTab.companyAddress || "",
            
            paymentMethod: currentTab.paymentMethod || "cash",
            isVAT: !!currentTab.isVAT,
            printCount: currentTab.orderPrintCount || 0,
            
            items: (currentTab.cart || []).map(item => ({
              name: item.name || "Sản phẩm",
              unit: item.unit || "",
              quantity: item.quantity || 0,
              price: getItemUnitPrice(item) || 0,
              subtotal: parseFloat(item.subtotal || "0") || 0,
            })),
            
            subtotal: subtotal || 0,
            discount: discount || 0,
            vatAmount: vatAmount || 0,
            totalAmount: totalAmount || 0,
          };
      } else {
        // Fetch order details if local data is not available or doesn't match
        try {
          const res: any = await apiClient.get(`/orders/${orderIdInput}`, { headers: authHeaders });
          const order = res?.data?.order;
          
          if (order) {
            printData = {
              storeName: storeName || "Cửa hàng",
              storeAddress: storeInfo?.address || "",
              storePhone: storeInfo?.phone || "",
              storeTaxCode: storeInfo?.taxCode || "",
              
              orderId: order._id || orderIdInput || "",
              createdAt: order.createdAt || new Date(),
              employeeName: employeeLabel || "Nhân viên",
              
              customerName: order.customerInfo?.name || "Khách vãng lai",
              customerPhone: order.customerInfo?.phone || "",
              companyName: order.vatInfo?.companyName || "",
              taxCode: order.vatInfo?.taxCode || "",
              companyAddress: order.vatInfo?.companyAddress || "",
              
              paymentMethod: order.paymentMethod || "cash",
              isVAT: !!order.isVATInvoice,
              printCount: order.printCount || 0,
              
              items: (order.items || []).map((item: any) => ({
                name: item.name || item.product?.name || "Sản phẩm",
                unit: item.unit || item.product?.unit || "",
                quantity: item.quantity || 0,
                price: item.price || 0,
                subtotal: (item.quantity || 0) * (item.price || 0),
              })),
              
              subtotal: order.subTotal || order.totalAmount || 0,
              discount: order.discountAmount || 0,
              vatAmount: order.vatAmount || 0,
              totalAmount: order.totalAmount || 0,
            };
          }
        } catch (fetchErr) {
          console.error("Lỗi lấy thông tin đơn hàng để in:", fetchErr);
          // throw fetchErr; // Let the main catch handle it, or handle specific error here
          Alert.alert("Lỗi", "Không thể lấy thông tin chi tiết đơn hàng để in.");
          return;
        }
      }

      if (printData) {
        await printBill(printData);
        
        // Gọi API để server biết đã in (tăng printCount)
        await apiClient.post(
          `/orders/${orderIdInput}/print-bill`,
          {},
          { headers: authHeaders }
        );
        
        // Update print count locally if needed
        updateOrderTab(t => t.orderPrintCount = (t.orderPrintCount || 0) + 1);

        if (shouldReset) {
            resetCurrentTab();
        }
      }
      
    } catch (err: any) {
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "Lỗi in hóa đơn"
      );
    } finally {
      setIsPrinting(false);
    }
  }, [
    authHeaders, 
    isPrinting, 
    currentTab, 
    storeName, 
    storeInfo, 
    employeeLabel, 
    subtotal, 
    discount, 
    vatAmount, 
    totalAmount,
    vatAmount, 
    totalAmount,
    updateOrderTab,
    resetCurrentTab
  ]);
  
  // ===== UI Helpers =====
  const openPriceModal = useCallback((record: CartItem) => {
    const realItem = currentTab.cart.find((i) => 
      i.productId === record.productId && 
      ((record.batchId && i.batchId === record.batchId) || (!record.batchId && !i.batchId))
    ) || record;
    
    setPriceEditModal({
      visible: true,
      item: realItem,
      tempSaleType: realItem.saleType || "NORMAL",
      tempOverridePrice: realItem.overridePrice ?? null,
    });
  }, [currentTab.cart]);
  
  const applyPriceEdit = useCallback(() => {
    if (!priceEditModal.item || !priceEditModal.tempSaleType) return;
    
    const item = priceEditModal.item;
    const st = priceEditModal.tempSaleType;
    let override: number | null = priceEditModal.tempOverridePrice ?? null;
    
    if (st === "NORMAL") override = null;
    if (st === "FREE") override = 0;
    if (st === "AT_COST") override = getPriceNumber(item.cost_price || item.price);
    
    const finalUnit = st === "NORMAL"
      ? getPriceNumber(item.price)
      : (override ?? getPriceNumber(item.price));
    const newSubtotal = (finalUnit * item.quantity).toFixed(2);
    
    updateOrderTab((tab) => {
      tab.cart = tab.cart.map((i) => {
        const isMatch = i.productId === item.productId && 
          ((item.batchId && i.batchId === item.batchId) || (!item.batchId && !i.batchId));
        return isMatch
          ? { ...i, saleType: st, overridePrice: override, subtotal: newSubtotal }
          : i;
      });
    });
    
    setPriceEditModal({ visible: false });
  }, [priceEditModal, updateOrderTab]);
  
  const computeTempUnitPrice = useCallback(() => {
    const item = priceEditModal.item;
    if (!item) return 0;
    
    const st = priceEditModal.tempSaleType || "NORMAL";
    if (st === "FREE") return 0;
    if (st === "AT_COST") return getPriceNumber(item.cost_price || item.price);
    
    if (
      priceEditModal.tempOverridePrice !== null &&
      priceEditModal.tempOverridePrice !== undefined
    ) {
      return Number(priceEditModal.tempOverridePrice) || 0;
    }
    return getPriceNumber(item.price);
  }, [priceEditModal]);
  
  const handleNumpadPress = useCallback((val: string) => {
    updateOrderTab((t) => {
      let currentStr = String(t.cashReceived || 0);
      if (currentStr === "0") currentStr = "";
      
      if (val === "C") {
        t.cashReceived = 0;
        return;
      }
      
      if (val === "BACK") {
        const newStr = currentStr.slice(0, -1);
        t.cashReceived = newStr ? parseInt(newStr) : 0;
        return;
      }
      
      let nextStr = currentStr;
      if (val === "000") {
        if (currentStr.length === 0) return;
        nextStr += "000";
      } else {
        nextStr += val;
      }
      
      if (nextStr.length > 11) return;
      
      t.cashReceived = parseInt(nextStr);
    });
  }, [updateOrderTab]);
  
  // Polling check QR Payment (Auto like Web)
  useEffect(() => {
    const orderCode = currentTab.qrPayload;
    if (
      !orderCode ||
      !currentTab.qrImageUrl ||
      !currentTab.pendingOrderId ||
      currentTab.isPaid
    ) {
      return;
    }

    let isActive = true;
    const pendingOrderId = currentTab.pendingOrderId;

    const checkPayment = async () => {
      if (!storeId || !orderCode) return;
      
      try {
        const res: any = await apiClient.get(
          `/orders/pos/payment-status/${orderCode}`,
          { 
            params: { storeId },
            headers: authHeaders 
          }
        );

        if (
          isActive &&
          res?.data?.success &&
          String(res?.data?.status).toUpperCase() === "PAID"
        ) {
          // Stop polling
          clearInterval(pollId);

          // Update local state
          updateOrderTab((tab) => {
            tab.isPaid = true;
          });

          // Show success and ask to print
          Alert.alert(
            "Thành công",
            "Đã nhận thanh toán QR! Bạn có muốn in hóa đơn không?",
            [
              { 
                text: "Không", 
                style: "cancel",
                onPress: () => {
                  setQrModal(false);
                  setBillModal(false);
                  resetCurrentTab();
                }
              },
              {
                text: "In hóa đơn",
                onPress: () => {
                  setQrModal(false);
                  triggerPrint(pendingOrderId, true); // Pass true to reset after print
                },
              },
            ]
          );
        }
      } catch (e) {
        // ignore
      }
    };

    const pollId = setInterval(checkPayment, 3000);

    return () => {
      isActive = false;
      clearInterval(pollId);
    };
  }, [
    currentTab.qrPayload,
    currentTab.qrImageUrl,
    currentTab.pendingOrderId,
    currentTab.isPaid,
    storeId,
    authHeaders,
    updateOrderTab,
    triggerPrint
  ]);

  // ===== Animation Values =====
  const HEADER_MAX = 180;
  const HEADER_MIN = 90;
  const SCROLL_DISTANCE = HEADER_MAX - HEADER_MIN;
  
  const headerHeight = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [HEADER_MAX, HEADER_MIN],
    extrapolate: "clamp",
  });
  
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE],
    outputRange: [0, -40],
    extrapolate: "clamp",
  });
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE / 2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  
  // ===== Loading State =====
  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải ứng dụng...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // ===== Cart Item Component =====
  const CartItemRow = React.memo(({ item }: { item: CartItem }) => {
    const unitPrice = getItemUnitPrice(item);
    const amount = unitPrice * item.quantity;
    const isCustom = (item.saleType && item.saleType !== "NORMAL") || item.overridePrice !== null;
    
    return (
      <Card style={styles.cartItemCard}>
        <View style={styles.cartItemHeader}>
          <View style={styles.cartItemImageContainer}>
            {item.image?.url ? (
              <Image source={{ uri: item.image.url }} style={styles.cartItemImage} />
            ) : (
              <View style={styles.cartItemImagePlaceholder}>
                <Ionicons name="cube-outline" size={24} color={COLORS.muted} />
              </View>
            )}
          </View>
          
          <View style={styles.cartItemInfo}>
            <Text style={styles.cartItemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.cartItemMeta}>
              <Text style={styles.cartItemSku}>{item.sku}</Text>
              <Text style={styles.cartItemUnit}>• {item.unit}</Text>
              {item.batchCode && (
                <Text style={styles.cartItemBatch}>• Lô: {item.batchCode}</Text>
              )}
            </View>
            
            {item.expiryDate && (
              <Text style={styles.cartItemExpiry}>
                HSD: {new Date(item.expiryDate).toLocaleDateString("vi-VN")}
              </Text>
            )}
            
            {item.tax_rate !== undefined && item.tax_rate !== 0 && (
              <View style={styles.taxBadge}>
                <Ionicons name="receipt-outline" size={12} color={COLORS.warning} />
                <Text style={styles.taxText}>
                  Thuế: {item.tax_rate === -1 ? "Ko thuế" : `${item.tax_rate}%`}
                </Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.priceEditButton}
            onPress={() => openPriceModal(item)}
          >
            <Text style={styles.priceEditText}>
              {formatPrice(unitPrice)}
              {isCustom && <Text style={styles.customPriceIndicator}> *</Text>}
            </Text>
            <Ionicons name="create-outline" size={14} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.cartItemFooter}>
          <View style={styles.quantityControls}>
            {[5, 10, 20].map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.quickQuantityButton}
                onPress={() => updateQuantity(item.productId, item.batchId, q)}
              >
                <Text style={styles.quickQuantityText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.productId, item.batchId, item.quantity - 1)}
            >
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            
            <View style={styles.quantityValueContainer}>
              <Text style={styles.quantityValue}>{item.quantity}</Text>
            </View>
            
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.productId, item.batchId, item.quantity + 1)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.cartItemActions}>
            <Text style={styles.cartItemSubtotal}>{formatPrice(amount)}</Text>
            <IconButton
              icon="trash-outline"
              onPress={() => removeItem(item.productId, item.batchId)}
              color={COLORS.danger}
              style={styles.removeButton}
            />
          </View>
        </View>
      </Card>
    );
  });
  
  return (
    <View style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      {/* Search Backdrop */}
      {isSearchFocused && (
        <Pressable
          style={styles.searchBackdrop}
          onPress={() => {
            setShowProductDropdown(false);
            setIsSearchFocused(false);
            Keyboard.dismiss();
          }}
        />
      )}
      
      {/* Sticky Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }}>
          <View style={styles.headerTop}>
            <View style={styles.storeInfoContainer}>
              <Text style={styles.storeName} numberOfLines={1}>
                {storeName}
              </Text>
              <Text style={styles.storeSubtitle}>POS • Bán hàng chuyên nghiệp</Text>
            </View>
            
            <Button
              title="Reset"
              variant="ghost"
              onPress={() => {
                Alert.alert(
                  "Xác nhận",
                  "Bạn có chắc muốn reset đơn hàng hiện tại?",
                  [
                    { text: "Hủy", style: "cancel" },
                    { text: "Reset", onPress: resetCurrentTab, style: "destructive" },
                  ]
                );
              }}
              icon="refresh-outline"
              size="sm"
            />
          </View>
          
          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScrollView}
            contentContainerStyle={styles.tabsContentContainer}
          >
            {orders.map((t) => {
              const active = t.key === activeTab;
              return (
                <View key={t.key} style={styles.tabWrapper}>
                  <TouchableOpacity
                    style={[styles.tabButton, active && styles.tabButtonActive]}
                    onPress={() => setActiveTab(t.key)}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      Đơn {t.key}
                    </Text>
                  </TouchableOpacity>
                  
                  {orders.length > 1 && (
                    <TouchableOpacity
                      style={styles.tabCloseButton}
                      onPress={() => removeOrderTab(t.key)}
                    >
                      <Ionicons
                        name="close"
                        size={14}
                        color={active ? COLORS.primary : COLORS.muted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            
            <TouchableOpacity style={styles.addTabButton} onPress={addNewOrderTab}>
              <Ionicons name="add" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
        
        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={[styles.searchContainer, isSearchFocused && styles.searchContainerFocused]}>
            <Ionicons
              name="search"
              size={20}
              color={isSearchFocused ? COLORS.primary : COLORS.muted}
            />
            
            <TextInput
              value={searchProduct}
              onChangeText={(text) => {
                setSearchProduct(text);
                setShowProductDropdown(true);
              }}
              onFocus={() => {
                setShowProductDropdown(true);
                setIsSearchFocused(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (!selectingProductRef.current) {
                    setShowProductDropdown(false);
                  }
                }, 180);
              }}
              placeholder="Tìm sản phẩm, mã SKU..."
              placeholderTextColor={COLORS.placeholder}
              style={styles.searchInput}
              returnKeyType="search"
            />
            
            {searchProduct.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchProduct("");
                  setSearchedProducts([]);
                  setShowProductDropdown(false);
                }}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.searchActionButton}
              onPress={() => Alert.alert("Thông báo", "Chức năng quét mã đang phát triển")}
            >
              <Ionicons name="barcode-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          {/* Product Dropdown */}
          {showProductDropdown && searchedProducts.length > 0 && (
            <View style={styles.productDropdown}>
              <ScrollView style={styles.dropdownScrollView} keyboardShouldPersistTaps="always">
                {searchedProducts.map((p) => {
                  const avail = getAvailableStock(p);
                  const isOut = avail <= 0;
                  
                  return (
                    <TouchableOpacity
                      key={p._id}
                      onPress={() => !isOut && addToCart(p)}
                      onPressIn={() => (selectingProductRef.current = true)}
                      onPressOut={() => (selectingProductRef.current = false)}
                      style={[styles.productItem, isOut && styles.productItemDisabled]}
                      disabled={isOut}
                    >
                      <View style={styles.productItemImageContainer}>
                        {p.image?.url ? (
                          <Image source={{ uri: p.image.url }} style={styles.productItemImage} />
                        ) : (
                          <View style={styles.productItemImagePlaceholder}>
                            <Ionicons name="cube" size={20} color={COLORS.muted} />
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.productItemInfo}>
                        <Text style={styles.productItemName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.productItemSku}>{p.sku}</Text>
                      </View>
                      
                      <View style={styles.productItemRight}>
                        <Text style={styles.productItemPrice}>
                          {formatPrice(p.price)}
                        </Text>
                        <View style={[styles.stockBadge, isOut && styles.stockBadgeOut]}>
                          <Text style={[styles.stockText, isOut && styles.stockTextOut]}>
                            {isOut ? "Hết" : avail}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </Animated.View>
      
      {/* Main Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Quick Info Bar */}
          <View style={styles.quickInfoBar}>
            <TouchableOpacity
              style={styles.employeeSelector}
              onPress={() => setEmployeeModal(true)}
            >
              <View style={styles.employeeIconContainer}>
                <Ionicons name="person-outline" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeLabel}>NHÂN VIÊN</Text>
                <Text style={styles.employeeName} numberOfLines={1}>
                  {employeeLabel}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={COLORS.muted} />
            </TouchableOpacity>
            
            <View style={styles.customerInfo}>
              <View style={styles.customerIconContainer}>
                <Ionicons name="people-outline" size={20} color={COLORS.text} />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerLabel}>KHÁCH HÀNG</Text>
                <Text style={styles.customerName} numberOfLines={1}>
                  {currentTab.customer ? currentTab.customer.name : "Khách vãng lai"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeCustomerButton}
                onPress={() => setNewCustomerModal(true)}
              >
                <Text style={styles.changeCustomerText}>ĐỔI</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Loyalty Points */}
          {loyaltySetting?.isActive && currentTab.customer && (
            <View style={styles.loyaltyCard}>
              <Ionicons name="gift-outline" size={20} color={COLORS.warning} />
              <Text style={styles.loyaltyText}>
                Có {currentTab.customer.loyaltyPoints?.toLocaleString("vi-VN") || 0} điểm
              </Text>
              
              <TouchableOpacity
                style={[styles.loyaltyToggle, currentTab.usedPointsEnabled && styles.loyaltyToggleActive]}
                onPress={() =>
                  updateOrderTab((t) => {
                    const nextState = !t.usedPointsEnabled;
                    t.usedPointsEnabled = nextState;
                    if (nextState) {
                      t.usedPoints = t.customer?.loyaltyPoints || 0;
                    } else {
                      t.usedPoints = 0;
                    }
                  })
                }
              >
                <Text
                  style={[
                    styles.loyaltyToggleText,
                    currentTab.usedPointsEnabled && styles.loyaltyToggleTextActive,
                  ]}
                >
                  {currentTab.usedPointsEnabled ? "BẬT" : "TẮT"}
                </Text>
              </TouchableOpacity>
              
              {currentTab.usedPointsEnabled && (
                <View style={styles.pointsInputContainer}>
                  <TextInput
                    value={String(currentTab.usedPoints || 0)}
                    onChangeText={(txt) => {
                      const max = currentTab.customer?.loyaltyPoints || 0;
                      const n = clampInt(txt, 0, max);
                      updateOrderTab((t) => (t.usedPoints = n));
                    }}
                    keyboardType="numeric"
                    style={styles.pointsInput}
                    placeholder="0"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      updateOrderTab((t) => (t.usedPoints = t.customer?.loyaltyPoints || 0))
                    }
                  >
                    <Text style={styles.maxPointsText}>MAX</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          
          {/* Cart Section */}
          <Section
            title="Giỏ hàng"
            subtitle={`${currentTab.cart.length} sản phẩm`}
            right={<Badge value={currentTab.cart.length} />}
          >
            {currentTab.cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={48} color={COLORS.muted} />
                <Text style={styles.emptyCartText}>Chưa có sản phẩm</Text>
                <Text style={styles.emptyCartSubtext}>
                  Tìm kiếm và thêm sản phẩm vào giỏ hàng
                </Text>
              </View>
            ) : (
              <FlatList
                data={currentTab.cart}
                keyExtractor={(i) => `${i.productId}_${i.batchId || 'nobatch'}`}
                scrollEnabled={false}
                renderItem={({ item }) => <CartItemRow item={item} />}
                ItemSeparatorComponent={() => <View style={styles.cartItemSeparator} />}
              />
            )}
          </Section>
          
          {/* Payment Section */}
          <Section title="Thanh toán" subtitle="Tổng kết đơn hàng">
            {/* Price Breakdown */}
            <View style={styles.priceBreakdown}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tạm tính</Text>
                <Text style={styles.priceValue}>{formatPrice(subtotal)}</Text>
              </View>
              
              {vatAmount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: COLORS.warning }]}>
                    Thuế GTGT (Tự động)
                  </Text>
                  <Text style={[styles.priceValue, { color: COLORS.warning }]}>
                    +{formatPrice(vatAmount)}
                  </Text>
                </View>
              )}
              
              {discount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: COLORS.success }]}>
                    Giảm giá điểm
                  </Text>
                  <Text style={[styles.priceValue, { color: COLORS.success }]}>
                    -{formatPrice(discount)}
                  </Text>
                </View>
              )}
              
              <Divider style={styles.priceDivider} />
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>THANH TOÁN</Text>
                <Text style={styles.totalAmount}>{formatPrice(totalAmount)}</Text>
              </View>
            </View>
            
            {/* VAT Toggle */}
            <View style={styles.vatToggleContainer}>
              <Text style={styles.vatLabel}>Cung cấp hóa đơn VAT</Text>
              <TouchableOpacity
                style={[styles.vatToggle, currentTab.isVAT && styles.vatToggleActive]}
                onPress={() => updateOrderTab((t) => (t.isVAT = !t.isVAT))}
              >
                <Text
                  style={[styles.vatToggleText, currentTab.isVAT && styles.vatToggleTextActive]}
                >
                  {currentTab.isVAT ? "BẬT" : "TẮT"}
                </Text>
              </TouchableOpacity>
            </View>
            
            {currentTab.isVAT && (
              <View style={styles.vatInfoContainer}>
                <Input
                  value={currentTab.companyName}
                  onChangeText={(text) => updateOrderTab((t) => (t.companyName = text))}
                  placeholder="Tên công ty"
                  style={styles.vatInput}
                />
                <Input
                  value={currentTab.taxCode}
                  onChangeText={(text) => updateOrderTab((t) => (t.taxCode = text))}
                  placeholder="Mã số thuế"
                  style={styles.vatInput}
                />
                <Input
                  value={currentTab.companyAddress}
                  onChangeText={(text) => updateOrderTab((t) => (t.companyAddress = text))}
                  placeholder="Địa chỉ"
                  multiline
                  numberOfLines={2}
                  style={styles.vatInput}
                />
              </View>
            )}
            
            {/* Payment Method */}
            <Text style={styles.paymentMethodLabel}>Phương thức thanh toán</Text>
            <View style={styles.paymentMethodContainer}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  currentTab.paymentMethod === "cash" && styles.paymentMethodButtonActive,
                ]}
                onPress={() => updateOrderTab((t) => (t.paymentMethod = "cash"))}
              >
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color={currentTab.paymentMethod === "cash" ? COLORS.primary : COLORS.text}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    currentTab.paymentMethod === "cash" && styles.paymentMethodTextActive,
                  ]}
                >
                  Tiền mặt
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentMethodButton,
                  currentTab.paymentMethod === "qr" && styles.paymentMethodButtonActive,
                ]}
                onPress={() => updateOrderTab((t) => (t.paymentMethod = "qr"))}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={20}
                  color={currentTab.paymentMethod === "qr" ? COLORS.primary : COLORS.text}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    currentTab.paymentMethod === "qr" && styles.paymentMethodTextActive,
                  ]}
                >
                  QR
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Cash Payment Section */}
            {currentTab.paymentMethod === "cash" && (
              <View style={styles.cashPaymentContainer}>
                <Text style={styles.cashReceivedLabel}>Tiền khách đưa</Text>
                
                <View style={styles.cashAmountContainer}>
                  <Text style={styles.cashAmountText}>
                    {formatPrice(currentTab.cashReceived || 0)}
                  </Text>
                </View>
                
                {/* Quick Amount Suggestions */}
                <View style={styles.quickAmountsContainer}>
                  {[totalAmount, 50000, 100000, 200000, 500000].map((amt, idx) => {
                    if (amt <= 0) return null;
                    if (idx > 0 && amt === totalAmount) return null;
                    
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.quickAmountButton}
                        onPress={() => updateOrderTab((t) => (t.cashReceived = amt))}
                      >
                        <Text style={styles.quickAmountText}>{formatPrice(amt)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                {/* Numpad */}
                <View style={styles.numpadContainer}>
                  {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, i) => (
                    <View key={i} style={styles.numpadRow}>
                      {row.map((n) => (
                        <TouchableOpacity
                          key={n}
                          style={styles.numpadButton}
                          onPress={() => handleNumpadPress(n)}
                        >
                          <Text style={styles.numpadButtonText}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  
                  <View style={styles.numpadRow}>
                    <TouchableOpacity
                      style={[styles.numpadButton, styles.numpadActionButton]}
                      onPress={() => handleNumpadPress('C')}
                    >
                      <Text style={styles.numpadActionText}>XOÁ</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.numpadButton}
                      onPress={() => handleNumpadPress('0')}
                    >
                      <Text style={styles.numpadButtonText}>0</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.numpadButton}
                      onPress={() => handleNumpadPress('000')}
                    >
                      <Text style={styles.numpadButtonText}>000</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Change Amount */}
                <View
                  style={[
                    styles.changeContainer,
                    {
                      backgroundColor: changeAmount >= 0 ? COLORS.successLight : COLORS.dangerLight,
                      borderColor: changeAmount >= 0 ? COLORS.success : COLORS.danger,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.changeLabel,
                      { color: changeAmount >= 0 ? COLORS.success : COLORS.danger },
                    ]}
                  >
                    Tiền thừa
                  </Text>
                  <Text
                    style={[
                      styles.changeAmountText,
                      { color: changeAmount >= 0 ? COLORS.success : COLORS.danger },
                    ]}
                  >
                    {changeAmount >= 0
                      ? formatPrice(changeAmount)
                      : `-${formatPrice(Math.abs(changeAmount))}`}
                  </Text>
                </View>
                
                {/* Confirm Cash Payment */}
                {currentTab.pendingOrderId && !currentTab.isPaid && (
                  <Button
                    title="Xác nhận đã thu tiền"
                    variant="danger"
                    onPress={confirmPaidCash}
                    style={styles.confirmPaymentButton}
                    fullWidth
                  />
                )}
              </View>
            )}
          </Section>
          
          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      
      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomBarLabel}>Khách phải trả</Text>
          <Text style={styles.bottomBarTotal}>{formatPrice(totalAmount)}</Text>
          <Text style={styles.bottomBarSubtext}>
            {currentTab.pendingOrderId
              ? `Mã đơn: ${currentTab.pendingOrderId.slice(-8)}`
              : "Chưa tạo đơn"}
          </Text>
        </View>
        
        <View style={styles.bottomBarRight}>
          <View style={styles.paymentMethodChips}>
            <TouchableOpacity
              style={[
                styles.paymentMethodChip,
                currentTab.paymentMethod === "cash" && styles.paymentMethodChipActive,
              ]}
              onPress={() => updateOrderTab((t) => (t.paymentMethod = "cash"))}
            >
              <Text
                style={[
                  styles.paymentMethodChipText,
                  currentTab.paymentMethod === "cash" && styles.paymentMethodChipTextActive,
                ]}
              >
                CASH
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.paymentMethodChip,
                currentTab.paymentMethod === "qr" && styles.paymentMethodChipActive,
              ]}
              onPress={() => updateOrderTab((t) => (t.paymentMethod = "qr"))}
            >
              <Text
                style={[
                  styles.paymentMethodChipText,
                  currentTab.paymentMethod === "qr" && styles.paymentMethodChipTextActive,
                ]}
              >
                QR
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <Button
              title="Hóa đơn"
              variant="outline"
              disabled={!currentTab.pendingOrderId}
              onPress={() => setBillModal(true)}
              style={styles.billButton}
            />
            
            <Button
              title={loading ? "Đang xử lý..." : 
                currentTab.pendingOrderId
                  ? currentTab.paymentMethod === "qr"
                    ? "Cập nhật QR"
                    : "Cập nhật đơn"
                  : currentTab.paymentMethod === "qr"
                  ? "Tạo QR"
                  : "Tạo đơn"}
              variant="primary"
              disabled={currentTab.cart.length === 0}
              onPress={createOrder}
              loading={loading}
              style={styles.createOrderButton}
            />
          </View>
          
          {currentTab.pendingOrderId &&
            currentTab.paymentMethod === "qr" &&
            !currentTab.qrImageUrl && (
              <Button
                title="Tiếp tục QR"
                variant="outline"
                onPress={() => {
                  if (currentTab.savedQrImageUrl) {
                    updateOrderTab((tab) => {
                      tab.qrImageUrl = tab.savedQrImageUrl;
                      tab.qrPayload = tab.savedQrPayload;
                      tab.qrExpiryTs = tab.savedQrExpiryTs;
                    });
                    setQrModal(true);
                  } else {
                    Alert.alert("Thông báo", "Không có QR đã lưu, vui lòng tạo QR mới.");
                  }
                }}
                style={styles.continueQrButton}
                fullWidth
              />
            )}
        </View>
      </View>
      
      {/* Modals */}
      
      {/* Employee Modal */}
      <Modal
        visible={employeeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEmployeeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Chọn nhân viên bán hàng</Text>
            <Text style={styles.modalSubtitle}>
              Chọn người thực hiện đơn hàng
            </Text>
            
            <ScrollView style={styles.modalScrollView}>
              {currentUserEmployee?.isOwner && (
                <TouchableOpacity
                  style={styles.employeeItem}
                  onPress={() => {
                    updateOrderTab((t) => (t.employeeId = null));
                    setEmployeeModal(false);
                  }}
                >
                  <View style={styles.employeeItemContent}>
                    <Ionicons name="star" size={20} color={COLORS.warning} />
                    <View style={styles.employeeItemInfo}>
                      <Text style={styles.employeeItemName}>
                        {currentUserEmployee.fullName} (Chủ cửa hàng)
                      </Text>
                      <Text style={styles.employeeItemHint}>
                        Gửi employeeId = null
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.employeeItemAction}>Chọn</Text>
                </TouchableOpacity>
              )}
              
              {employees.map((e) => (
                <TouchableOpacity
                  key={e._id}
                  style={styles.employeeItem}
                  onPress={() => {
                    updateOrderTab((t) => (t.employeeId = e._id));
                    setEmployeeModal(false);
                  }}
                >
                  <View style={styles.employeeItemContent}>
                    <Ionicons
                      name="person-circle"
                      size={20}
                      color={currentUserEmployee?._id === e._id ? COLORS.primary : COLORS.text}
                    />
                    <View style={styles.employeeItemInfo}>
                      <Text style={styles.employeeItemName}>
                        {e.fullName}
                        {currentUserEmployee?._id === e._id ? " (Bạn)" : ""}
                      </Text>
                      <Text style={styles.employeeItemHint}>ID: {e._id}</Text>
                    </View>
                  </View>
                  <Text style={styles.employeeItemAction}>Chọn</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Button
              title="Đóng"
              variant="outline"
              onPress={() => setEmployeeModal(false)}
              style={styles.modalCloseButton}
              fullWidth
            />
          </View>
        </View>
      </Modal>
      
      {/* Customer Modal */}
      <Modal
        visible={newCustomerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNewCustomerModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, styles.customerModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tìm kiếm khách hàng</Text>
                <IconButton
                  icon="close"
                  onPress={() => setNewCustomerModal(false)}
                  color={COLORS.muted}
                />
              </View>
              
              {/* Search */}
              <View style={styles.customerSearchContainer}>
                <Ionicons name="search" size={20} color={COLORS.muted} />
                <TextInput
                  value={phoneInput}
                  onChangeText={onChangePhoneInput}
                  placeholder="Tìm theo tên hoặc SĐT..."
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.customerSearchInput}
                  autoFocus
                />
                {phoneInput.length > 0 && (
                  <IconButton
                    icon="close-circle"
                    onPress={() => onChangePhoneInput("")}
                    color={COLORS.muted}
                  />
                )}
              </View>
              
              {/* Results */}
              <View style={styles.customerResultsContainer}>
                {foundCustomers.length > 0 ? (
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {foundCustomers.map((c) => (
                      <TouchableOpacity
                        key={c._id}
                        style={styles.customerResultItem}
                        onPress={() => {
                          selectCustomer(c);
                          setNewCustomerModal(false);
                        }}
                      >
                        <View style={styles.customerResultContent}>
                          <Ionicons name="person" size={20} color={COLORS.primary} />
                          <View style={styles.customerResultInfo}>
                            <Text style={styles.customerResultName}>{c.name}</Text>
                            <Text style={styles.customerResultPhone}>{c.phone}</Text>
                          </View>
                        </View>
                        {c._id === currentTab.customer?._id ? (
                          <Text style={styles.customerSelectedText}>Đang chọn</Text>
                        ) : (
                          <Text style={styles.customerSelectText}>Chọn</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Ionicons name="people-outline" size={48} color={COLORS.muted} />
                    <Text style={styles.noResultsText}>Không tìm thấy khách hàng</Text>
                  </View>
                )}
              </View>
              
              <Divider style={styles.modalDivider} />
              
              {/* Create New Customer */}
              <Text style={styles.createCustomerTitle}>Tạo khách hàng mới</Text>
              
              <View style={styles.createCustomerForm}>
                <Input
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                  placeholder="Tên khách hàng"
                  style={styles.customerFormInput}
                />
                <Input
                  value={newCustomerPhone}
                  onChangeText={setNewCustomerPhone}
                  placeholder="Số điện thoại"
                  keyboardType="phone-pad"
                  style={styles.customerFormInput}
                />
                <Input
                  value={newCustomerEmail}
                  onChangeText={setNewCustomerEmail}
                  placeholder="Email (tùy chọn)"
                  keyboardType="email-address"
                  style={styles.customerFormInput}
                />
              </View>
              
              <Button
                title="Tạo khách hàng"
                variant="primary"
                onPress={createCustomer}
                style={styles.createCustomerButton}
                fullWidth
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* QR Modal */}
      <Modal
        visible={qrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>QR Thanh Toán</Text>
            <Text style={styles.modalSubtitle}>
              Khách hàng quét mã để thanh toán
            </Text>
            
            {qrRemainingSec !== null && (
              <View style={styles.qrCountdownContainer}>
                <Text style={styles.qrCountdownText}>
                  Còn lại:{" "}
                  {Math.floor(qrRemainingSec / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(qrRemainingSec % 60).toString().padStart(2, "0")}
                </Text>
              </View>
            )}
            
            <View style={styles.qrContainer}>
              {currentTab.qrImageUrl ? (
                <Image
                  source={{ uri: currentTab.qrImageUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.noQrText}>Không có QR</Text>
              )}
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Đóng"
                variant="outline"
                onPress={() => setQrModal(false)}
                style={styles.modalActionButton}
              />
              
              {currentTab.pendingOrderId && (
                <Button
                  title={currentTab.isPaid ? "In hóa đơn" : "In hóa đơn (Xác nhận)"}
                  variant={currentTab.isPaid ? "success" : "primary"}
                  onPress={() => {
                    setQrModal(false);
                    triggerPrint(currentTab.pendingOrderId!, true);
                  }}
                  loading={isPrinting}
                  style={styles.modalActionButton}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Bill Modal */}
      <Modal
        visible={billModal}
        transparent
        animationType="fade"
        onRequestClose={() => setBillModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Hóa Đơn</Text>
            <Text style={styles.modalSubtitle}>
              {currentTab.pendingOrderId
                ? `Mã đơn: ${currentTab.pendingOrderId}`
                : "Chưa có đơn"}
            </Text>
            
            <View style={styles.billInfoContainer}>
              <View style={styles.billInfoRow}>
                <Text style={styles.billInfoLabel}>Khách hàng</Text>
                <Text style={styles.billInfoValue}>
                  {currentTab.customer?.name || "Khách vãng lai"}
                </Text>
              </View>
              
              <View style={styles.billInfoRow}>
                <Text style={styles.billInfoLabel}>SĐT</Text>
                <Text style={styles.billInfoValue}>
                  {currentTab.customer?.phone || "---"}
                </Text>
              </View>
              
              <View style={styles.billInfoRow}>
                <Text style={styles.billInfoLabel}>Tổng thanh toán</Text>
                <Text style={styles.billTotalAmount}>{formatPrice(totalAmount)}</Text>
              </View>
            </View>
            
            <Text style={styles.billProductsTitle}>Danh sách sản phẩm</Text>
            
            <ScrollView style={styles.billProductsContainer}>
              {currentTab.cart.map((item, index) => (
                <View key={`${item.productId}_${index}`} style={styles.billProductItem}>
                  <Text style={styles.billProductName}>{item.name}</Text>
                  <Text style={styles.billProductDetails}>
                    {item.quantity} × {formatPrice(getItemUnitPrice(item))} ={" "}
                    {formatPrice(getItemUnitPrice(item) * item.quantity)}
                  </Text>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <Button
                title="Đóng"
                variant="outline"
                onPress={() => {
                  setBillModal(false);
                  resetCurrentTab();
                }}
                style={styles.modalActionButton}
              />
              
              {currentTab.pendingOrderId && (
                <Button
                  title="In"
                  variant="primary"
                  onPress={() => triggerPrint(currentTab.pendingOrderId!)}
                  loading={isPrinting}
                  style={styles.modalActionButton}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Price Edit Modal */}
      <Modal
        visible={priceEditModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceEditModal({ visible: false })}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Tùy chỉnh giá</Text>
            
            {priceEditModal.item && (
              <>
                <Text style={styles.modalSubtitle}>{priceEditModal.item.name}</Text>
                <Text style={styles.priceEditHint}>
                  Số lượng: {priceEditModal.item.quantity} {priceEditModal.item.unit}
                </Text>
                
                <Text style={styles.priceTypeLabel}>Loại giá</Text>
                
                <View style={styles.priceTypeContainer}>
                  {(["NORMAL", "VIP", "AT_COST", "CLEARANCE", "FREE"] as SaleType[]).map((st) => {
                    const active = (priceEditModal.tempSaleType || "NORMAL") === st;
                    
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[styles.priceTypeButton, active && styles.priceTypeButtonActive]}
                        onPress={() => {
                          setPriceEditModal((prev) => {
                            const item = prev.item!;
                            let nextOverride = prev.tempOverridePrice ?? null;
                            
                            if (st === "FREE") nextOverride = 0;
                            if (st === "AT_COST")
                              nextOverride = getPriceNumber(item.cost_price || item.price);
                            if (st === "NORMAL") nextOverride = null;
                            
                            return {
                              ...prev,
                              tempSaleType: st,
                              tempOverridePrice: nextOverride,
                            };
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.priceTypeButtonText,
                            active && styles.priceTypeButtonTextActive,
                          ]}
                        >
                          {SALE_TYPE_LABEL[st]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                
                {["VIP", "CLEARANCE"].includes(priceEditModal.tempSaleType || "NORMAL") && (
                  <View style={styles.customPriceContainer}>
                    <Text style={styles.customPriceLabel}>Nhập giá mới (đ)</Text>
                    <TextInput
                      value={String(priceEditModal.tempOverridePrice ?? "")}
                      onChangeText={(txt) => {
                        const n = clampInt(txt, 0);
                        setPriceEditModal((prev) => ({
                          ...prev,
                          tempOverridePrice: n,
                        }));
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.placeholder}
                      style={styles.customPriceInput}
                    />
                  </View>
                )}
                
                <View style={styles.priceEditTotal}>
                  <Text style={styles.priceEditTotalLabel}>Thành tiền sau thay đổi</Text>
                  <Text style={styles.priceEditTotalValue}>
                    {formatPrice(computeTempUnitPrice() * (priceEditModal.item?.quantity || 1))}
                  </Text>
                </View>
                
                <View style={styles.modalActions}>
                  <Button
                    title="Hủy"
                    variant="outline"
                    onPress={() => setPriceEditModal({ visible: false })}
                    style={styles.modalActionButton}
                  />
                  
                  <Button
                    title="Áp dụng"
                    variant="primary"
                    onPress={applyPriceEdit}
                    style={styles.modalActionButton}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

/** =========================================================
 *  Styles
 *  ========================================================= */
const styles = StyleSheet.create({
  // Container Styles
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.muted,
    fontSize: TYPOGRAPHY.md,
    fontWeight: "500",
  },
  
  // Header Styles
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
    zIndex: 100,
    ...SHADOW,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === "ios" ? SPACING.xl : SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  storeInfoContainer: {
    flex: 1,
  },
  storeName: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: "700",
    color: COLORS.textStrong,
  },
  storeSubtitle: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
    marginTop: 2,
  },
  
  // Tabs Styles
  tabsScrollView: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  tabsContentContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  tabWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  tabButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  tabButtonActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "600",
    color: COLORS.text,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabCloseButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  addTabButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.chipActive,
    marginLeft: SPACING.xs,
  },
  
  // Search Styles
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.stroke,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...SHADOW,
  },
  searchContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.md,
    fontWeight: "500",
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  clearSearchButton: {
    padding: SPACING.xs,
  },
  searchActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.chipActive,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 90,
  },
  
  // Product Dropdown Styles
  productDropdown: {
    position: "absolute",
    top: 60,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    maxHeight: 300,
    zIndex: 1000,
    ...SHADOW_LG,
  },
  dropdownScrollView: {
    maxHeight: 300,
  },
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
  },
  productItemDisabled: {
    opacity: 0.5,
  },
  productItemImageContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
    marginRight: SPACING.sm,
  },
  productItemImage: {
    width: "100%",
    height: "100%",
  },
  productItemImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  productItemInfo: {
    flex: 1,
  },
  productItemName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  productItemSku: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
  },
  productItemRight: {
    alignItems: "flex-end",
  },
  productItemPrice: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 4,
  },
  stockBadge: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  stockBadgeOut: {
    backgroundColor: COLORS.dangerLight,
  },
  stockText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: "700",
    color: COLORS.success,
  },
  stockTextOut: {
    color: COLORS.danger,
  },
  
  // Keyboard Avoiding
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 180,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
  },
  
  // Quick Info Bar
  quickInfoBar: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  employeeSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    ...SHADOW,
  },
  employeeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.chipActive,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
    fontWeight: "600",
    marginBottom: 2,
  },
  employeeName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
  },
  customerInfo: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  customerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  customerDetails: {
    flex: 1,
  },
  customerLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
    fontWeight: "600",
    marginBottom: 2,
  },
  customerName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "700",
    color: COLORS.text,
  },
  changeCustomerButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.infoLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  changeCustomerText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: "700",
    color: COLORS.info,
  },
  
  // Loyalty Card
  loyaltyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
    gap: SPACING.sm,
  },
  loyaltyText: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: "#92400e",
  },
  loyaltyToggle: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  loyaltyToggleActive: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  },
  loyaltyToggleText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: "700",
    color: COLORS.text,
  },
  loyaltyToggleTextActive: {
    color: COLORS.success,
  },
  pointsInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  pointsInput: {
    width: 60,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  maxPointsText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: "700",
    color: COLORS.primary,
  },
  
  // Section Styles
  sectionContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    ...SHADOW,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: COLORS.textStrong,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
  },
  sectionContent: {
    marginTop: SPACING.sm,
  },
  
  // Badge Styles
  badge: {
    minWidth: 30,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "700",
  },
  
  // Empty Cart Styles
  emptyCart: {
    alignItems: "center",
    paddingVertical: SPACING.xxxl,
  },
  emptyCartText: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: "600",
    color: COLORS.muted,
    marginTop: SPACING.md,
  },
  emptyCartSubtext: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
    marginTop: SPACING.xs,
  },
  
  // Cart Item Styles
  cartItemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  cartItemSeparator: {
    height: SPACING.sm,
  },
  cartItemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  cartItemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    marginRight: SPACING.sm,
  },
  cartItemImage: {
    width: "100%",
    height: "100%",
  },
  cartItemImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  cartItemName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "700",
    color: COLORS.textStrong,
    marginBottom: SPACING.xs,
  },
  cartItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  cartItemSku: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
    backgroundColor: COLORS.chip,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  cartItemUnit: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
  },
  cartItemBatch: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textSecondary,
  },
  cartItemExpiry: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.danger,
    marginBottom: SPACING.xs,
  },
  taxBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    gap: 2,
  },
  taxText: {
    fontSize: TYPOGRAPHY.xs,
    color: "#92400e",
    fontWeight: "600",
  },
  priceEditButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.chip,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 2,
  },
  priceEditText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "700",
    color: COLORS.primary,
  },
  customPriceIndicator: {
    color: COLORS.warning,
  },
  cartItemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quantityControls: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  quickQuantityButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.chip,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  quickQuantityText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: "600",
    color: COLORS.muted,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  quantityButtonText: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: "600",
    color: COLORS.textStrong,
  },
  quantityValueContainer: {
    minWidth: 40,
    alignItems: "center",
  },
  quantityValue: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: COLORS.textStrong,
  },
  cartItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  cartItemSubtotal: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: COLORS.primary,
  },
  removeButton: {
    padding: SPACING.xs,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.sm,
  },
  
  // Price Breakdown Styles
  priceBreakdown: {
    gap: SPACING.sm,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
  },
  priceDivider: {
    marginVertical: SPACING.sm,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.stroke,
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: "700",
    color: COLORS.textStrong,
  },
  totalAmount: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: "700",
    color: COLORS.primary,
  },
  
  // VAT Toggle Styles
  vatToggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  vatLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    fontWeight: "500",
  },
  vatToggle: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.chip,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  vatToggleActive: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  },
  vatToggleText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: "700",
    color: COLORS.text,
  },
  vatToggleTextActive: {
    color: COLORS.success,
  },
  
  // VAT Info Styles
  vatInfoContainer: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  vatInput: {
    backgroundColor: COLORS.cardSecondary,
    borderColor: COLORS.stroke,
  },
  
  // Payment Method Styles
  paymentMethodLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    fontWeight: "500",
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  paymentMethodContainer: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  paymentMethodButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  paymentMethodButtonActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.primary,
  },
  paymentMethodText: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
  },
  paymentMethodTextActive: {
    color: COLORS.primary,
  },
  
  // Cash Payment Styles
  cashPaymentContainer: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  cashReceivedLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    fontWeight: "500",
  },
  cashAmountContainer: {
    alignItems: "flex-end",
  },
  cashAmountText: {
    fontSize: TYPOGRAPHY.xxxl,
    fontWeight: "700",
    color: COLORS.primary,
  },
  quickAmountsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  quickAmountButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  quickAmountText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "600",
    color: COLORS.success,
  },
  numpadContainer: {
    backgroundColor: COLORS.chipActive,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  numpadRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  numpadButton: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.stroke,
    ...SHADOW,
  },
  numpadButtonText: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: "700",
    color: COLORS.textStrong,
  },
  numpadActionButton: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.danger,
  },
  numpadActionText: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: COLORS.danger,
  },
  changeContainer: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  changeLabel: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
  },
  changeAmountText: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: "700",
  },
  confirmPaymentButton: {
    marginTop: SPACING.sm,
  },
  
  // Bottom Bar Styles
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.stroke,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === "ios" ? SPACING.xxl : SPACING.xl,
    flexDirection: "row",
    gap: SPACING.lg,
    ...SHADOW_LG,
  },
  bottomBarLeft: {
    flex: 1,
  },
  bottomBarLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
    fontWeight: "600",
    marginBottom: 2,
  },
  bottomBarTotal: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 2,
  },
  bottomBarSubtext: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
  },
  bottomBarRight: {
    flex: 1.5,
    gap: SPACING.sm,
  },
  paymentMethodChips: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  paymentMethodChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    alignItems: "center",
  },
  paymentMethodChipActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.primary,
  },
  paymentMethodChipText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "700",
    color: COLORS.text,
  },
  paymentMethodChipTextActive: {
    color: COLORS.primary,
  },
  actionButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  billButton: {
    flex: 1,
  },
  createOrderButton: {
    flex: 1.5,
  },
  continueQrButton: {
    marginTop: 0,
  },
  
  // Bottom Spacer
  bottomSpacer: {
    height: 120,
  },
  
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    ...SHADOW_LG,
  },
  customerModal: {
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: "700",
    color: COLORS.textStrong,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  modalScrollView: {
    maxHeight: 300,
    marginBottom: SPACING.lg,
  },
  modalCloseButton: {
    marginTop: SPACING.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  modalActionButton: {
    flex: 1,
  },
  modalDivider: {
    marginVertical: SPACING.lg,
  },
  
  // Employee Modal Styles
  employeeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
  },
  employeeItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.sm,
  },
  employeeItemInfo: {
    flex: 1,
  },
  employeeItemName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  employeeItemHint: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.muted,
  },
  employeeItemAction: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "700",
    color: COLORS.primary,
  },
  
  // Customer Modal Styles
  customerSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
  },
  customerResultsContainer: {
    flex: 1,
    minHeight: 100,
    marginBottom: SPACING.lg,
  },
  customerResultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
  },
  customerResultContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.sm,
  },
  customerResultInfo: {
    flex: 1,
  },
  customerResultName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  customerResultPhone: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
  },
  customerSelectedText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "700",
    color: COLORS.success,
  },
  customerSelectText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "700",
    color: COLORS.primary,
  },
  noResultsContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
  },
  noResultsText: {
    fontSize: TYPOGRAPHY.md,
    color: COLORS.muted,
    marginTop: SPACING.md,
  },
  createCustomerTitle: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: COLORS.textStrong,
    marginBottom: SPACING.md,
  },
  createCustomerForm: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  customerFormInput: {
    backgroundColor: COLORS.cardSecondary,
    borderColor: COLORS.stroke,
  },
  createCustomerButton: {
    marginTop: SPACING.md,
  },
  
  // QR Modal Styles
  qrCountdownContainer: {
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  qrCountdownText: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: "#92400e",
  },
  qrContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  noQrText: {
    fontSize: TYPOGRAPHY.md,
    color: COLORS.muted,
    fontStyle: "italic",
  },
  
  // Bill Modal Styles
  billInfoContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  billInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  billInfoLabel: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
  },
  billInfoValue: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "600",
    color: COLORS.text,
  },
  billTotalAmount: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: "700",
    color: COLORS.primary,
  },
  billProductsTitle: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: "700",
    color: COLORS.textStrong,
    marginBottom: SPACING.sm,
  },
  billProductsContainer: {
    maxHeight: 200,
    marginBottom: SPACING.lg,
  },
  billProductItem: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
  },
  billProductName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: "700",
    color: COLORS.textStrong,
    marginBottom: SPACING.xs,
  },
  billProductDetails: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
  },
  
  // Price Edit Modal Styles
  priceEditHint: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.muted,
    marginBottom: SPACING.lg,
  },
  priceTypeLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    fontWeight: "500",
    marginBottom: SPACING.sm,
  },
  priceTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  priceTypeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.chip,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  priceTypeButtonActive: {
    backgroundColor: COLORS.chipActive,
    borderColor: COLORS.primary,
  },
  priceTypeButtonText: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: "600",
    color: COLORS.text,
  },
  priceTypeButtonTextActive: {
    color: COLORS.primary,
  },
  customPriceContainer: {
    marginBottom: SPACING.lg,
  },
  customPriceLabel: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    fontWeight: "500",
    marginBottom: SPACING.xs,
  },
  customPriceInput: {
    backgroundColor: COLORS.cardSecondary,
    borderColor: COLORS.stroke,
  },
  priceEditTotal: {
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  priceEditTotalLabel: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.text,
    fontWeight: "500",
    marginBottom: SPACING.xs,
  },
  priceEditTotalValue: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: "700",
    color: COLORS.primary,
  },
  
  // Card Component
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    ...SHADOW,
  },
  
  // Icon Button Component
  iconButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  
  // Button Component Styles
  buttonBase: {
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginHorizontal: SPACING.xs,
  },
  buttonText: {
    fontWeight: "600",
  },
  
  // Input Component Styles
  inputContainer: {
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.text,
    fontWeight: "500",
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    paddingHorizontal: SPACING.md,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputLeftIcon: {
    marginRight: SPACING.sm,
  },
  inputRightIcon: {
    marginLeft: SPACING.sm,
  },
  inputField: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
  },
  inputErrorText: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
});

export default OrderPOSHomeScreen;