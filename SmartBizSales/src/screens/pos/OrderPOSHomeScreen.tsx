// src/screens/pos/OrderPOSHomeScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";

/** =========================================================
 *  Design tokens (LIGHT / WHITE)
 *  ========================================================= */
const COLORS = {
  bg: "#f5f7fb",
  surface: "#ffffff",
  card: "#ffffff",
  card2: "#f8fafc",
  stroke: "#e2e8f0",

  text: "#0f172a",
  textStrong: "#0b1220",
  muted: "#64748b",
  placeholder: "#94a3b8",

  primary: "#2563eb",
  primary2: "#1d4ed8",
  good: "#16a34a",
  warn: "#f59e0b",
  danger: "#ef4444",

  chip: "#f1f5f9",
  chipActive: "#dbeafe",

  white: "#ffffff",
};

const RADIUS = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

const SPACING = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
};

const SHADOW = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 2 },
});

/** =========================================================
 *  Small UI primitives
 *  ========================================================= */
const Divider: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[{ height: 1, backgroundColor: COLORS.stroke }, style]} />
);

const Section: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}> = React.memo(({ title, subtitle, right, children }) => {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
        {right}
      </View>

      <View style={{ marginTop: SPACING.md }}>{children}</View>
    </View>
  );
});

const Pill: React.FC<{
  label: string;
  active?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}> = ({ label, active, onPress, right }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
      hitSlop={8}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
      {right}
    </Pressable>
  );
};

const IconTextButton: React.FC<{
  text: string;
  type?: "primary" | "outline" | "danger" | "ghost";
  onPress?: () => void;
  disabled?: boolean;
  right?: React.ReactNode;
  style?: any;
}> = ({ text, type = "primary", onPress, disabled, right, style }) => {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btnBase,
        type === "primary" && styles.btnPrimary,
        type === "outline" && styles.btnOutline,
        type === "danger" && styles.btnDanger,
        type === "ghost" && styles.btnGhost,
        disabled && { opacity: 0.55 },
        pressed && !disabled && { transform: [{ scale: 0.99 }], opacity: 0.96 },
        style,
      ]}
      hitSlop={8}
    >
      <Text
        style={[
          styles.btnTextBase,
          type === "primary" && styles.btnTextPrimary,
          type === "outline" && styles.btnTextOutline,
          type === "danger" && styles.btnTextDanger,
          type === "ghost" && styles.btnTextOutline,
        ]}
      >
        {text}
      </Text>
      {right}
    </Pressable>
  );
};

const Badge: React.FC<{ value: number | string }> = ({ value }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{value}</Text>
  </View>
);

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
};

type Employee = {
  _id: string;
  fullName: string;
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
  subtotal: string; // giữ giống web: string .toFixed(2)
  tax_rate?: number;
  stock_quantity?: number; // Store original stock for validation
};

type OrderTab = {
  key: string;

  cart: CartItem[];
  customer: Customer | null;
  employeeId: string | null; // null = owner/không gán
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

  qrImageUrl: string | null;
  qrPayload: string | null;
  qrExpiryTs: number | null;

  savedQrImageUrl: string | null;
  savedQrPayload: string | null;
  savedQrExpiryTs: number | null;
};

type OrderResponse = {
  message: string;
  order: {
    _id: string;
    qrExpiry?: string;
    paymentMethod: PaymentMethod;
    createdAt?: string;
    printCount?: number;
  };
  qrDataURL?: string;
  paymentLinkUrl?: string | null;
};

type LoyaltyConfig = {
  isActive?: boolean;
  vndPerPoint?: number;
};

const SALE_TYPE_LABEL: Record<SaleType, string> = {
  NORMAL: "Giá niêm yết",
  VIP: "Giá ưu đãi",
  AT_COST: "Giá vốn",
  CLEARANCE: "Xả kho",
  FREE: "Miễn phí",
};

/** =========================================================
 *  Helpers
 *  ========================================================= */
function debounce<F extends (...args: any[]) => any>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const safeParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
      return base; // VIP nhập tay qua overridePrice nếu muốn
    case "AT_COST":
      return cost || base;
    case "CLEARANCE":
      return cost || base; // Xả kho nhập tay qua overridePrice nếu muốn
    case "FREE":
      return 0;
    default:
      return base;
  }
};

const makeEmptyTab = (
  key: string,
  defaultEmployeeId: string | null
): OrderTab => ({
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

  qrImageUrl: null,
  qrPayload: null,
  qrExpiryTs: null,

  savedQrImageUrl: null,
  savedQrPayload: null,
  savedQrExpiryTs: null,
});

const clampInt = (raw: string, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.floor(parseInt(raw || "0", 10) || 0);
  return Math.max(min, Math.min(max, n));
};

/** =========================================================
 *  Screen
 *  ========================================================= */
const OrderPOSHomeScreen: React.FC = () => {
  // ===== init =====
  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("Cửa hàng");

  const [token, setToken] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [token]);

  // refs để tránh stale closure trong debounce
  const storeIdRef = useRef<string | null>(null);
  useEffect(() => {
    storeIdRef.current = storeId;
  }, [storeId]);

  const authHeadersRef = useRef<any>(undefined);
  useEffect(() => {
    authHeadersRef.current = authHeaders;
  }, [authHeaders]);

  // ===== data =====
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = useState<Seller | null>(
    null
  );
  const [loyaltySetting, setLoyaltySetting] = useState<LoyaltyConfig | null>(
    null
  );
  const [isStoreEmpty, setIsStoreEmpty] = useState(false);
  const [hasCheckedEmpty, setHasCheckedEmpty] = useState(false);

  // ===== tabs =====
  const [orders, setOrders] = useState<OrderTab[]>([makeEmptyTab("1", null)]);
  const [activeTab, setActiveTab] = useState("1");

  const currentTab = useMemo(
    () => orders.find((t) => t.key === activeTab)!,
    [orders, activeTab]
  );

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
    setTempPhone("");
    setFoundCustomers([]);
    setShowCustomerDropdown(false);

    setSearchProduct("");
    setSearchedProducts([]);
    setShowProductDropdown(false);

    // 🗑️ Clear saved cart from AsyncStorage after successful order
    (async () => {
      try {
        const uId = loggedInUser?.id || loggedInUser?._id || "anonymous";
        const cartKey = `pos_cart_${storeId}_${uId}`;
        await AsyncStorage.removeItem(cartKey);
        console.log("🗑️ Đã xóa giỏ hàng đã lưu sau khi hoàn thành đơn");
      } catch (err) {
        console.error("Lỗi xóa cart:", err);
      }
    })();
  }, [updateOrderTab, currentUserEmployee, storeId, loggedInUser]);

  const addNewOrderTab = () => {
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
  };

  const removeOrderTab = (key: string) => {
    if (orders.length <= 1) return;

    setOrders((prev) => {
      const next = prev.filter((t) => t.key !== key);
      const nextActive = activeTab === key ? next[0]?.key : activeTab;
      if (nextActive) setActiveTab(nextActive);
      return next;
    });
  };

  // ===== init load AsyncStorage =====
  useEffect(() => {
    (async () => {
      try {
        const [csRaw, tkn, usrRaw] = await Promise.all([
          AsyncStorage.getItem("currentStore"),
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("user"),
        ]);

        const cs = safeParse(csRaw);
        const usr = safeParse(usrRaw);

        if (!cs?._id) {
          Alert.alert(
            "Thiếu cửa hàng",
            "Không tìm thấy currentStore trong bộ nhớ."
          );
          setLoadingInit(false);
          return;
        }

        setStoreId(cs._id);
        setStoreName(cs?.name || "Cửa hàng");
        setToken(tkn);
        setLoggedInUser(usr);
      } catch {
        Alert.alert("Lỗi", "Không đọc được dữ liệu khởi tạo.");
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  // ===== load employees + loyalty =====
  const loadEmployees = useCallback(async () => {
    if (!storeId) return;

    try {
      const user = loggedInUser;
      if (!user?.id && !user?._id) return;

      const userId = user?.id || user?._id;
      const role = user?.role;

      // STAFF: dùng user như employee
      if (role === "STAFF") {
        const staffEmployee: Seller = {
          _id: userId,
          fullName:
            user?.fullname || user?.fullName || user?.username || "Nhân viên",
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
        setOrders((prev) => prev.map((t) => ({ ...t, employeeId: userId })));
        return;
      }

      // MANAGER/OWNER: load list
      const res: any = await apiClient.get(`/stores/${storeId}/employees`, {
        params: { deleted: "false" },
        headers: authHeaders,
      });

      const employeesList: Employee[] =
        res?.data?.employees || res?.data?.data?.employees || [];
      setEmployees(Array.isArray(employeesList) ? employeesList : []);

      if (role === "MANAGER" || role === "OWNER") {
        const virtualOwner: VirtualOwner = {
          _id: "virtual-owner",
          fullName:
            user?.fullname ||
            user?.fullName ||
            user?.username ||
            "Chủ cửa hàng",
          isOwner: true,
        };

        setCurrentUserEmployee(virtualOwner);
        setOrders((prev) => prev.map((t) => ({ ...t, employeeId: null })));
      }
    } catch {
      Alert.alert("Lỗi", "Không tải được nhân viên.");
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
    } catch {
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
        showEmptyStoreAlert();
      }
    } catch (err) {
      console.error("Lỗi kiểm tra danh mục sản phẩm:", err);
    }
  }, [storeId, authHeaders]);

  const showEmptyStoreAlert = () => {
    const isOwner =
      loggedInUser?.role === "OWNER" || loggedInUser?.role === "MANAGER";

    Alert.alert(
      "Kho hàng trống!",
      isOwner
        ? "Cửa hàng của bạn chưa có sản phẩm nào. Vui lòng nhập hàng hóa vào hệ thống để bắt đầu bán hàng."
        : "Cửa hàng chưa có sản phẩm nào. Vui lòng báo chủ cửa hàng nhập hàng hóa vào kho.",
      [{ text: "Tôi đã hiểu" }]
    );
  };

  useEffect(() => {
    if (!storeId) return;
    loadEmployees();
    loadLoyaltySetting();
    checkStoreProducts();
  }, [storeId, loadEmployees, loadLoyaltySetting, checkStoreProducts]);

  // ===== CART PERSISTENCE - AsyncStorage =====
  // Include userId in key to separate carts for different users on same device
  const currentUserId = loggedInUser?.id || loggedInUser?._id || "anonymous";
  const CART_STORAGE_KEY = `pos_cart_${storeId}_${currentUserId}`;

  // Load cart from AsyncStorage on mount (when storeId and userId are available)
  useEffect(() => {
    if (!storeId || !currentUserId) return;

    (async () => {
      try {
        const savedData = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (
            parsed.orders &&
            Array.isArray(parsed.orders) &&
            parsed.orders.length > 0
          ) {
            setOrders(parsed.orders);
            if (parsed.activeTab) setActiveTab(parsed.activeTab);
            console.log(` Đã khôi phục giỏ hàng POS cho user ${currentUserId}`);
          }
        }
      } catch (err) {
        console.error("Lỗi đọc cart từ AsyncStorage:", err);
      }
    })();
  }, [storeId, currentUserId]);

  // Save cart to AsyncStorage whenever orders change
  useEffect(() => {
    if (!storeId || !currentUserId) return;

    // Don't save if all carts are empty (initial state)
    const hasItems = orders.some(
      (tab) => tab.cart.length > 0 || tab.customer || tab.pendingOrderId
    );
    if (hasItems) {
      (async () => {
        try {
          const dataToSave = {
            orders,
            activeTab,
            userId: currentUserId, // Store userId to verify ownership
            savedAt: new Date().toISOString(),
          };
          await AsyncStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(dataToSave)
          );
        } catch (err) {
          console.error("Lỗi lưu cart vào AsyncStorage:", err);
        }
      })();
    }
  }, [orders, activeTab, storeId, currentUserId]);

  // Function to clear saved cart after successful order
  const clearSavedCart = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
      console.log("🗑️ Đã xóa giỏ hàng đã lưu");
    } catch (err) {
      console.error("Lỗi xóa cart:", err);
    }
  }, [CART_STORAGE_KEY]);

  // ===== product search =====
  const [searchProduct, setSearchProduct] = useState("");
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(
    null
  );

  // ===== Voice Recognition (Expo Go Safe Mode) =====
  // Since native speech recognition requires dev build, we use a simpler approach
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  const startVoiceSearch = () => {
    // IOS: Use native Alert.prompt interactively (closest to voice input)
    if (Platform.OS === "ios") {
      Alert.prompt(
        "🎤 Tìm kiếm bằng giọng nói",
        "Sử dụng biểu tượng Microphone trên bàn phím của bạn để nói.",
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Tìm kiếm",
            onPress: (text: string | undefined) => {
              if (text && text.trim()) {
                setSearchProduct(text.trim());
                setShowProductDropdown(true);
              }
            },
          },
        ],
        "plain-text",
        searchProduct // Pre-fill with current search
      );
    }
    // ANDROID: Guide user to use Google Keyboard Voice
    else {
      Alert.alert(
        "🎤 Tìm kiếm bằng giọng nói",
        "Trên Android, hãy nhấn vào ô tìm kiếm và sử dụng biểu tượng Micro 🎤 trên bàn phím để nhập liệu bằng giọng nói.",
        [
          {
            text: "Mở bàn phím",
            onPress: () => {
              // Focus search input to open keyboard
              // We need a ref to the TextInput, but for now just showing info is good
            },
          },
        ]
      );
    }
  };

  const stopVoiceSearch = () => {
    setIsListening(false);
  };

  const suggestedProducts = useMemo(() => {
    const q = searchProduct.trim();
    // Filter out products with stock_quantity <= 0
    const inStockProducts = searchedProducts.filter(
      (p) => p.stock_quantity > 0
    );

    if (!q) return inStockProducts.slice(0, 30); // Hiển thị nhiều hơn

    return [...inStockProducts]
      .map((p) => ({
        p,
        score: Math.max(matchScore(p.name, q), matchScore(p.sku, q)),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
      .slice(0, 30); // Hiển thị nhiều hơn
  }, [searchProduct, searchedProducts]);

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
          const products = Array.isArray(list) ? list : [];
          setSearchedProducts(products);

          if (products.length === 0 && hasCheckedEmpty && isStoreEmpty) {
            showEmptyStoreAlert();
          }
        } catch (e: any) {
          setSearchedProducts([]);
          setProductSearchError(
            e?.response?.data?.message || "Không tìm được sản phẩm"
          );
        } finally {
          setProductSearchLoading(false);
        }
      }, 220),
    []
  );

  useEffect(() => {
    searchProductDebounced(searchProduct);
  }, [searchProduct, searchProductDebounced]);

  // chặn blur khi đang bấm vào dropdown
  const selectingCustomerRef = useRef(false);
  const selectingProductRef = useRef(false);

  // Tính toán tồn kho khả dụng (trừ đi các lô đã hết hạn)
  const getAvailableStock = (product: Product) => {
    if (!product.batches || product.batches.length === 0)
      return product.stock_quantity;

    // Tổng số lượng trong các lô chưa hết hạn
    const available = product.batches.reduce((sum: number, b: ProductBatch) => {
      const isExpired = !!(
        b.expiry_date && new Date(b.expiry_date) < new Date()
      );
      return isExpired ? sum : sum + (b.quantity || 0);
    }, 0);

    return available;
  };

  const addToCart = useCallback(
    (product: Product) => {
      const availableStock = getAvailableStock(product);

      // Check if product is out of stock or expired
      if (availableStock <= 0) {
        const hasExpired =
          product.batches &&
          product.batches.some(
            (b) => b.expiry_date && new Date(b.expiry_date) < new Date()
          );
        Alert.alert(
          hasExpired ? "Hàng hết hạn" : "Hết hàng",
          hasExpired
            ? `Sản phẩm "${product.name}" hiện chỉ còn các lô đã hết hạn sử dụng, không thể bán.`
            : `Sản phẩm "${product.name}" đã hết hàng trong kho.`
        );
        return;
      }

      const priceNum = getPriceNumber(product.price);

      updateOrderTab((tab) => {
        const existing = tab.cart.find(
          (item) => item.productId === product._id
        );

        if (existing) {
          const newQty = existing.quantity + 1;

          // Check if new quantity exceeds available stock
          if (newQty > availableStock) {
            Alert.alert(
              "Vượt tồn kho khả dụng",
              `Sản phẩm "${product.name}" chỉ còn ${availableStock} có thể bán (không tính hàng hết hạn). Bạn đã có ${existing.quantity} trong giỏ.`
            );
            return;
          }

          tab.cart = tab.cart.map((item) =>
            item.productId === product._id
              ? {
                  ...item,
                  quantity: newQty,
                  subtotal: (newQty * getItemUnitPrice(item)).toFixed(2),
                }
              : item
          );
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
              stock_quantity: availableStock, // Store available stock
            },
          ];
        }
      });

      // reset search UI
      setSearchProduct("");
      setSearchedProducts([]);
      setShowProductDropdown(false);
      Keyboard.dismiss();
    },
    [updateOrderTab]
  );

  const updateQuantity = (id: string, qty: number) => {
    updateOrderTab((tab) => {
      const item = tab.cart.find((i) => i.productId === id);
      if (!item) return;

      if (qty <= 0) {
        tab.cart = tab.cart.filter((i) => i.productId !== id);
      } else {
        // Get max stock from cart item (stored when added) or from search results
        const maxStock =
          item.stock_quantity ??
          searchedProducts.find((p) => p._id === id)?.stock_quantity ??
          9999;

        if (qty > maxStock) {
          Alert.alert(
            "Vượt tồn kho",
            `Sản phẩm "${item.name}" chỉ còn ${maxStock} đơn vị trong kho.`
          );
          // Cap the quantity to max stock
          const cappedQty = maxStock;
          tab.cart = tab.cart.map((i) =>
            i.productId === id
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
          i.productId === id
            ? {
                ...i,
                quantity: qty,
                subtotal: (getItemUnitPrice(i) * qty).toFixed(2),
              }
            : i
        );
      }
    });
  };

  const removeItem = (productId: string) => {
    updateOrderTab((tab) => {
      tab.cart = tab.cart.filter((i) => i.productId !== productId);
    });
  };

  // ===== customer search + add =====
  const [phoneInput, setPhoneInput] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const searchCustomerDebounced = useMemo(
    () =>
      debounce(async (phone: string) => {
        const sid = storeIdRef.current;
        const headers = authHeadersRef.current;

        const p = phone.trim();
        setTempPhone(p);

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
          setNewCustomerModalOpen(true);
        }
      }, 300),
    []
  );

  const onChangePhoneInput = (val: string) => {
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
  };

  const selectCustomer = (c: Customer) => {
    updateOrderTab((t) => {
      t.customer = c;
      t.usedPoints = 0;
      t.usedPointsEnabled = false;
    });

    setPhoneInput(c.phone);
    setFoundCustomers([]);
    setShowCustomerDropdown(false);
  };

  const createCustomer = async () => {
    if (!storeId) return;

    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();

    if (!name || !phone) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên và số điện thoại.");
      return;
    }

    try {
      const res: any = await apiClient.post(
        `/customers`,
        { storeId, name, phone },
        { headers: authHeaders }
      );

      const created: Customer =
        res?.data?.customer || res?.data?.data?.customer || res?.data;
      if (!created?._id) throw new Error("create customer failed");

      selectCustomer(created);
      setNewCustomerModalOpen(false);
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Không tạo được khách hàng."
      );
    }
  };

  // ===== totals/payment =====
  const subtotal = useMemo(
    () =>
      currentTab.cart.reduce(
        (sum, item) => sum + getItemUnitPrice(item) * item.quantity,
        0
      ),
    [currentTab.cart]
  );

  const discount = useMemo(() => {
    const vndPerPoint = loyaltySetting?.vndPerPoint || 0;
    return currentTab.usedPointsEnabled
      ? (currentTab.usedPoints || 0) * vndPerPoint
      : 0;
  }, [
    currentTab.usedPointsEnabled,
    currentTab.usedPoints,
    loyaltySetting?.vndPerPoint,
  ]);

  const beforeTax = Math.max(subtotal - discount, 0);

  // Tính VAT dựa trên từng sản phẩm tự động
  const vatAmount = useMemo(() => {
    return currentTab.cart.reduce((sum, item) => {
      const itemPrice = getItemUnitPrice(item);
      const itemTaxRate =
        item.tax_rate !== undefined && item.tax_rate !== null
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

  // ===== create order =====
  const createOrder = async () => {
    if (!storeId) return;

    if (currentTab.cart.length === 0) {
      Alert.alert("Đơn trống", "Hãy thêm sản phẩm vào giỏ.");
      return;
    }

    const sendEmployeeId =
      currentTab.employeeId === "virtual-owner" ? null : currentTab.employeeId;

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
        orderId: currentTab.pendingOrderId || undefined, // Gửi ID nếu đang có đơn pending
      };

      if (currentTab.customer) {
        payload.customerInfo = {
          phone: currentTab.customer.phone,
          name: currentTab.customer.name,
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
        tab.orderPrintCount =
          typeof order?.printCount === "number" ? order.printCount : 0;
        tab.orderEarnedPoints = (order as any)?.earnedPoints ?? 0;
        tab.orderCreatedPaymentMethod = currentTab.paymentMethod;

        if (currentTab.paymentMethod === "qr" && res?.data?.qrDataURL) {
          tab.qrImageUrl = res.data.qrDataURL;
          tab.savedQrImageUrl = res.data.qrDataURL;
          tab.qrPayload = order?.paymentRef; // Save code for polling

          tab.qrExpiryTs = order?.qrExpiry
            ? new Date(order.qrExpiry).getTime()
            : null;
          tab.savedQrExpiryTs = order?.qrExpiry
            ? new Date(order.qrExpiry).getTime()
            : null;
        }
      });

      if (currentTab.paymentMethod === "cash") {
        Alert.alert("Thành công", "Đã tạo đơn hàng (tiền mặt).");
      } else {
        setQrModalOpen(true);
      }
    } catch (err: any) {
      Alert.alert(
        "Lỗi tạo đơn",
        err?.response?.data?.message || err?.message || "Không thể tạo đơn."
      );
    } finally {
      setLoading(false);
    }
  };

  // ===== confirm paid cash =====
  const confirmPaidCash = async () => {
    if (!currentTab.pendingOrderId) {
      Alert.alert("Thiếu đơn", "Chưa có orderId.");
      return;
    }

    try {
      await apiClient.post(
        `/orders/${currentTab.pendingOrderId}/set-paid-cash`,
        {},
        { headers: authHeaders }
      );
      setBillModalOpen(true);
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Lỗi xác nhận thanh toán tiền mặt."
      );
    }
  };

  // ===== print bill (server side) =====
  const triggerPrintServer = async (orderId: string) => {
    try {
      await apiClient.post(
        `/orders/${orderId}/print-bill`,
        {},
        { headers: authHeaders }
      );
      Alert.alert("Thành công", "Đã gửi lệnh in hoá đơn.");

      // reset sau khi in xong (giống logic web)
      setBillModalOpen(false);
      setQrModalOpen(false);
      resetCurrentTab();
    } catch (err: any) {
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "In hoá đơn không thành công!"
      );
    }
  };

  // ===== Export PDF to file =====
  const buildInvoiceHtml = useCallback(() => {
    const rows = currentTab.cart
      .map((i, idx) => {
        const unit = getItemUnitPrice(i);
        const amount = unit * i.quantity;

        return `
          <tr>
            <td style="padding:6px 0; border-bottom: 1px solid #eee;">
              ${idx + 1}. ${i.name}<br/>
              <span style="color:#666;font-size:11px;">
                SKU: ${i.sku} • ${i.unit || ""}
              </span>
            </td>
            <td style="padding:6px 0; border-bottom: 1px solid #eee; text-align:right;">${
              i.quantity
            }</td>
            <td style="padding:6px 0; border-bottom: 1px solid #eee; text-align:right;">${formatPrice(
              unit
            )}</td>
            <td style="padding:6px 0; border-bottom: 1px solid #eee; text-align:right; font-weight:700;">${formatPrice(
              amount
            )}</td>
          </tr>
        `;
      })
      .join("");

    const orderId = currentTab.pendingOrderId || "";
    const customerLine = currentTab.customer
      ? `${currentTab.customer.name} (${currentTab.customer.phone})`
      : "Khách vãng lai";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; padding: 14px; }
    .muted { color:#666; }
    h2 { margin: 0 0 6px 0; }
    .box { border: 1px solid #eaeaea; border-radius: 10px; padding: 10px; }
    table { width:100%; border-collapse: collapse; margin-top: 10px; }
    th { text-align:left; font-size: 11px; color:#666; padding-bottom: 6px; border-bottom:1px solid #eee; }
    .right { text-align:right; }
    .total { font-size: 16px; font-weight: 800; color: #1d4ed8; }
  </style>
</head>
<body>
  <h2>${storeName}</h2>
  <div class="muted">POS • Hoá đơn</div>
  <div style="height:10px"></div>

  <div class="box">
    <div><b>Mã đơn:</b> ${orderId}</div>
    <div><b>Khách:</b> ${customerLine}</div>
    <div><b>Thanh toán:</b> ${currentTab.paymentMethod === "cash" ? "Tiền mặt" : "QR"}</div>
    <div><b>VAT:</b> ${currentTab.isVAT ? "Có" : "Không"}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Sản phẩm</th>
        <th class="right">SL</th>
        <th class="right">Đơn giá</th>
        <th class="right">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div style="height:8px"></div>
  <div class="right muted">Tạm tính: ${formatPrice(subtotal)}</div>
  <div class="right muted">Giảm (điểm): -${formatPrice(discount)}</div>
  <div class="right muted">VAT: ${formatPrice(vatAmount)}</div>
  <div class="right total">Tổng: ${formatPrice(totalAmount)}</div>
</body>
</html>`;
  }, [
    currentTab.cart,
    currentTab.pendingOrderId,
    currentTab.customer,
    currentTab.paymentMethod,
    currentTab.isVAT,
    storeName,
    subtotal,
    discount,
    vatAmount,
    totalAmount,
  ]);

  const exportBillPdfToDevice = useCallback(async () => {
    const html = buildInvoiceHtml();
    const fileName = `hoa-don-${currentTab.pendingOrderId || "tmp"}.pdf`;

    // 1) Try Expo (expo-print + expo-sharing)
    try {
      const Print = require("expo-print");
      const Sharing = require("expo-sharing");

      if (Print?.printToFileAsync) {
        const { uri } = await Print.printToFileAsync({ html });
        if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: fileName,
          });
          return;
        }

        await Share.share({
          url: uri,
          message: "Hoá đơn PDF",
          title: fileName,
        });
        return;
      }
    } catch {
      // ignore
    }

    // 2) Try react-native-html-to-pdf
    try {
      const RNHTMLtoPDF = require("react-native-html-to-pdf");
      if (RNHTMLtoPDF?.convert) {
        const results = await RNHTMLtoPDF.convert({
          html,
          fileName: `hoa-don-${currentTab.pendingOrderId || "tmp"}`,
          base64: false,
        });
        const filePath = results?.filePath;
        if (filePath) {
          await Share.share({
            url: filePath,
            message: "Hoá đơn PDF",
            title: fileName,
          });
          return;
        }
      }
    } catch {
      // ignore
    }

    Alert.alert(
      "Chưa hỗ trợ xuất PDF",
      "Thiếu thư viện tạo PDF. Nếu dùng Expo: cài expo-print + expo-sharing. Nếu RN CLI: cài react-native-html-to-pdf."
    );
  }, [buildInvoiceHtml, currentTab.pendingOrderId]);

  // ===== UI: employee modal =====
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);

  const employeeLabel = useMemo(() => {
    if (currentUserEmployee?.isOwner && currentTab.employeeId === null) {
      return `${currentUserEmployee.fullName} (Chủ cửa hàng)`;
    }
    const e = employees.find((x) => x._id === currentTab.employeeId);
    return e?.fullName || "Chưa chọn";
  }, [currentUserEmployee, currentTab.employeeId, employees]);

  // ===== UI: QR modal =====
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // countdown QR
  const [qrRemainingSec, setQrRemainingSec] = useState<number | null>(null);
  useEffect(() => {
    if (!qrModalOpen) return;

    // --- 1. Countdown Logic ---
    let countdownId: any = null;
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
          Alert.alert("Hết hạn", "QR đã hết hạn. Vui lòng tạo QR mới.");
        }
      };

      tick();
      countdownId = setInterval(tick, 1000);
    } else {
      setQrRemainingSec(null);
    }

    // --- 2. Polling Logic for PayOS ---
    let pollId: any = null;
    const orderCode = currentTab.qrPayload;

    if (orderCode) {
      const checkPayment = async () => {
        try {
          const res: any = await apiClient.get(
            `/orders/pos/payment-status/${orderCode}?storeId=${storeId}`,
            {
              headers: authHeaders,
            }
          );
          // PayOS status: PENDING | PAID | CANCELLED
          if (
            res.data.success &&
            String(res.data.status).toUpperCase() === "PAID"
          ) {
            console.log("PayOS CONFIRMED PAID:", orderCode);
            // Dừng polling ngay
            if (pollId) clearInterval(pollId);
            closeQrModal(); // Close QR

            // Xác nhận đơn hàng thành công
            await confirmPaidCash();
            Alert.alert(
              "Thanh toán thành công!",
              "PayOS đã xác nhận thanh toán."
            );
          }
        } catch (e) {
          // ignore polling error
        }
      };

      // Check ngay lập tức 1 phát
      // checkPayment();
      // Sau đó loop 3s
      pollId = setInterval(checkPayment, 3000);
    }

    return () => {
      if (countdownId) clearInterval(countdownId);
      if (pollId) clearInterval(pollId);
    };
  }, [
    qrModalOpen,
    currentTab.qrExpiryTs,
    currentTab.qrPayload,
    updateOrderTab,
  ]);

  const closeQrModal = () => {
    setQrModalOpen(false);
    updateOrderTab((tab) => {
      tab.qrImageUrl = null;
      tab.qrPayload = null;
      tab.qrExpiryTs = null;
    });
  };

  // ===== UI: bill modal =====
  const [billModalOpen, setBillModalOpen] = useState(false);

  // ===== UI: price edit modal =====
  const [priceEditModal, setPriceEditModal] = useState<{
    visible: boolean;
    item?: CartItem;
    tempSaleType?: SaleType;
    tempOverridePrice?: number | null;
  }>({ visible: false });

  const openPriceModal = (record: CartItem) => {
    const realItem =
      currentTab.cart.find((i) => i.productId === record.productId) || record;
    setPriceEditModal({
      visible: true,
      item: realItem,
      tempSaleType: realItem.saleType || "NORMAL",
      tempOverridePrice: realItem.overridePrice ?? null,
    });
  };

  const computeTempUnitPrice = () => {
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
  };

  const applyPriceEdit = () => {
    if (!priceEditModal.item || !priceEditModal.tempSaleType) return;

    const item = priceEditModal.item;
    const st = priceEditModal.tempSaleType;
    let override: number | null = priceEditModal.tempOverridePrice ?? null;

    if (st === "NORMAL") override = null;
    if (st === "FREE") override = 0;
    if (st === "AT_COST")
      override = getPriceNumber(item.cost_price || item.price);

    const finalUnit =
      st === "NORMAL"
        ? getPriceNumber(item.price)
        : (override ?? getPriceNumber(item.price));
    const newSubtotal = (finalUnit * item.quantity).toFixed(2);

    updateOrderTab((tab) => {
      tab.cart = tab.cart.map((i) =>
        i.productId === item.productId
          ? {
              ...i,
              saleType: st,
              overridePrice: override,
              subtotal: newSubtotal,
            }
          : i
      );
    });

    setPriceEditModal({ visible: false });
  };

  // ===== points block =====
  const PointsBlock = useMemo(() => {
    const canUse = !!loyaltySetting && !!currentTab.customer;
    const maxPoints = currentTab.customer?.loyaltyPoints || 0;
    const vndPerPoint = loyaltySetting?.vndPerPoint || 0;

    if (!loyaltySetting) return null;

    return (
      <View style={{ marginTop: SPACING.md }}>
        <View style={styles.rowBetween}>
          <Text style={styles.mutedInline}>Dùng điểm</Text>

          <Pressable
            disabled={!canUse}
            onPress={() =>
              updateOrderTab((t) => {
                t.usedPointsEnabled = !t.usedPointsEnabled;
                if (!t.usedPointsEnabled) t.usedPoints = 0;
              })
            }
            style={[
              styles.toggle,
              currentTab.usedPointsEnabled && canUse && styles.toggleOn,
              !canUse && { opacity: 0.5 },
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                currentTab.usedPointsEnabled && canUse && styles.toggleTextOn,
              ]}
            >
              {currentTab.usedPointsEnabled ? "BẬT" : "TẮT"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Khách hiện có: {maxPoints.toLocaleString("vi-VN")} điểm • Quy đổi:{" "}
          {vndPerPoint.toLocaleString("vi-VN")}đ/điểm
        </Text>

        {currentTab.usedPointsEnabled ? (
          <View style={{ marginTop: SPACING.sm }}>
            <Text style={styles.mutedInline}>Số điểm muốn dùng</Text>
            <TextInput
              value={String(currentTab.usedPoints || 0)}
              onChangeText={(txt) => {
                const n = clampInt(txt, 0, maxPoints);
                updateOrderTab((t) => {
                  t.usedPoints = n;
                });
              }}
              keyboardType="numeric"
              style={styles.input}
              editable={canUse}
              placeholder="0"
              placeholderTextColor={COLORS.placeholder}
            />
            <Text style={styles.hint}>
              Giảm: {formatPrice((currentTab.usedPoints || 0) * vndPerPoint)}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    loyaltySetting,
    currentTab.customer,
    currentTab.usedPointsEnabled,
    currentTab.usedPoints,
    updateOrderTab,
  ]);

  const CartRow = useCallback(
    ({ item }: { item: CartItem }) => {
      const unitPrice = getItemUnitPrice(item);
      const amount = unitPrice * item.quantity;

      const isCustom =
        (item.saleType && item.saleType !== "NORMAL") ||
        item.overridePrice !== null;

      return (
        <View style={styles.cartCard}>
          <View style={styles.cartMainRow}>
            {item.image?.url ? (
              <Image
                source={{ uri: item.image.url }}
                style={styles.cartThumb}
              />
            ) : (
              <View style={[styles.cartThumb, styles.cartThumbPlaceholder]}>
                <Ionicons name="cube-outline" size={20} color={COLORS.muted} />
              </View>
            )}

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cartName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cartSub}>
                {item.sku} • {item.unit}
              </Text>
              {item.tax_rate !== undefined && item.tax_rate !== 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 2,
                  }}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={12}
                    color={COLORS.warn}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      color: COLORS.warn,
                      marginLeft: 4,
                      fontWeight: "700",
                    }}
                  >
                    Thuế:{" "}
                    {item.tax_rate === -1 ? "Ko thuế" : `${item.tax_rate}%`}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.priceTag}
                onPress={() => openPriceModal(item)}
              >
                <Text style={styles.priceTagText}>
                  {formatPrice(unitPrice)}
                  {isCustom && <Text style={{ color: COLORS.warn }}> *</Text>}
                </Text>
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={COLORS.muted}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.cartQtyBox}>
              <TouchableOpacity
                onPress={() =>
                  updateQuantity(item.productId, item.quantity - 1)
                }
                style={styles.qtyBtn}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>

              <Text style={styles.qtyValue}>{item.quantity}</Text>

              <TouchableOpacity
                onPress={() =>
                  updateQuantity(item.productId, item.quantity + 1)
                }
                style={styles.qtyBtn}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cartBottomRow}>
            <View style={styles.quickQtyRow}>
              {[5, 10, 20].map((q) => (
                <TouchableOpacity
                  key={q}
                  onPress={() => updateQuantity(item.productId, q)}
                  style={styles.quickQtyBtn}
                >
                  <Text style={styles.quickQtyText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.rowRight}>
              <Text style={styles.cartSubtotal}>{formatPrice(amount)}</Text>
              <TouchableOpacity
                onPress={() => removeItem(item.productId)}
                hitSlop={8}
                style={styles.cartRemoveBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={COLORS.danger}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [openPriceModal, removeItem, updateQuantity]
  );

  // ===== UI: Buttons State =====
  const canOpenBill = useMemo(() => {
    return !!currentTab.pendingOrderId;
  }, [currentTab.pendingOrderId]);

  const canContinueQr = useMemo(() => {
    return (
      !!currentTab.pendingOrderId &&
      !!currentTab.savedQrImageUrl &&
      currentTab.paymentMethod === "qr"
    );
  }, [
    currentTab.pendingOrderId,
    currentTab.savedQrImageUrl,
    currentTab.paymentMethod,
  ]);

  const primaryActionText = useMemo(() => {
    if (currentTab.pendingOrderId) {
      if (currentTab.paymentMethod === "qr") return "Cập nhật QR";
      return "Cập nhật Đơn";
    }
    if (currentTab.paymentMethod === "qr") return "Tạo QR";
    return "Tạo Đơn Hàng";
  }, [currentTab.paymentMethod, currentTab.pendingOrderId]);

  const canCreateOrder = useMemo(() => {
    // Luôn cho phép tạo/cập nhật nếu có hàng và chọn employee (nếu cần)
    if (currentTab.cart.length === 0) return false;
    // Cho phép update kể cả khi đã có pendingOrderId
    return true;
  }, [currentTab.cart, currentTab.pendingOrderId]);

  // ===== render loading =====
  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.mutedText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {storeName}
              </Text>
              <Text style={styles.headerSub}>POS • Bán hàng</Text>
            </View>

            <IconTextButton
              type="ghost"
              text="Reset"
              onPress={() => {
                Alert.alert(
                  "Reset đơn",
                  "Bạn có chắc muốn reset đơn hiện tại?",
                  [
                    { text: "Huỷ", style: "cancel" },
                    {
                      text: "Reset",
                      style: "destructive",
                      onPress: resetCurrentTab,
                    },
                  ]
                );
              }}
              style={{ paddingVertical: 10, paddingHorizontal: 12 }}
            />
          </View>

          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: SPACING.sm }}
          >
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              {orders.map((t) => {
                const active = t.key === activeTab;
                return (
                  <View
                    key={t.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Pill
                      label={`Đơn ${t.key}`}
                      active={active}
                      onPress={() => setActiveTab(t.key)}
                    />
                    {orders.length > 1 ? (
                      <Pressable
                        onPress={() => removeOrderTab(t.key)}
                        style={({ pressed }) => [
                          styles.iconClose,
                          pressed && { opacity: 0.8 },
                        ]}
                        hitSlop={8}
                      >
                        <Text style={styles.iconCloseText}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}

              <IconTextButton
                type="outline"
                text="+ Đơn mới"
                onPress={addNewOrderTab}
                style={{ paddingHorizontal: 14 }}
              />
            </View>
          </ScrollView>

          {/* Search product - Enhanced UI */}
          <View style={styles.searchSection}>
            <View style={styles.searchBoxEnhanced}>
              <Ionicons name="search" size={20} color={COLORS.muted} />
              <TextInput
                value={searchProduct}
                onChangeText={(t) => {
                  setSearchProduct(t);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => {
                  setTimeout(() => {
                    if (!selectingProductRef.current)
                      setShowProductDropdown(false);
                  }, 180);
                }}
                placeholder="Tìm sản phẩm..."
                placeholderTextColor={COLORS.placeholder}
                style={styles.searchInputEnhanced}
                returnKeyType="search"
              />

              {/* Voice Search Button - Real Speech Recognition */}
              <TouchableOpacity
                onPress={() => {
                  if (isListening) {
                    stopVoiceSearch();
                  } else {
                    startVoiceSearch();
                  }
                }}
                style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
              >
                <Ionicons
                  name={isListening ? "mic" : "mic-outline"}
                  size={20}
                  color={isListening ? "#fff" : COLORS.primary}
                />
              </TouchableOpacity>

              {/* Show listening indicator */}
              {isListening && (
                <View style={styles.listeningBadge}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.listeningText}>
                    {voiceTranscript || "Đang nghe..."}
                  </Text>
                </View>
              )}

              {/* Barcode Scanner */}
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "📷 Quét mã vạch",
                    "Chức năng quét mã đang được tích hợp."
                  )
                }
                style={styles.scanBtn}
              >
                <Ionicons
                  name="barcode-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>

              {/* Clear Button */}
              {!!searchProduct && (
                <Pressable
                  onPress={() => {
                    setSearchProduct("");
                    setSearchedProducts([]);
                    setShowProductDropdown(false);
                  }}
                  hitSlop={10}
                  style={styles.clearBtn}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.muted}
                  />
                </Pressable>
              )}
            </View>

            {/* Product Dropdown - Enhanced */}
            {showProductDropdown && (
              <View style={styles.productDropdown}>
                {productSearchLoading ? (
                  <View style={styles.dropdownCenter}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                    <Text style={styles.dropdownHint}>Đang tìm kiếm...</Text>
                  </View>
                ) : productSearchError ? (
                  <View style={styles.dropdownCenter}>
                    <Ionicons
                      name="alert-circle"
                      size={24}
                      color={COLORS.danger}
                    />
                    <Text
                      style={[styles.dropdownHint, { color: COLORS.danger }]}
                    >
                      {productSearchError}
                    </Text>
                  </View>
                ) : suggestedProducts.length === 0 ? (
                  <View style={styles.dropdownCenter}>
                    <Ionicons
                      name="cube-outline"
                      size={32}
                      color={COLORS.muted}
                    />
                    <Text style={styles.dropdownHint}>
                      {searchProduct
                        ? "Không tìm thấy sản phẩm"
                        : "Nhập tên để tìm kiếm"}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 300 }}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                  >
                    {suggestedProducts.map((p) => {
                      const avail = getAvailableStock(p);
                      const isOut = avail <= 0;
                      const hasBatches = p.batches && p.batches.length > 0;

                      return (
                        <Pressable
                          key={p._id}
                          onPressIn={() => (selectingProductRef.current = true)}
                          onPressOut={() =>
                            (selectingProductRef.current = false)
                          }
                          onPress={() => !isOut && addToCart(p)}
                          style={({ pressed }) => [
                            styles.productCard,
                            pressed && !isOut && styles.productCardPressed,
                            isOut && { opacity: 0.6 },
                          ]}
                        >
                          <View style={{ width: "100%" }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              {/* Product Image */}
                              {p.image?.url ? (
                                <Image
                                  source={{ uri: p.image.url }}
                                  style={styles.productThumb}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.productThumb,
                                    styles.productThumbEmpty,
                                  ]}
                                >
                                  <Ionicons
                                    name="cube"
                                    size={20}
                                    color={COLORS.muted}
                                  />
                                </View>
                              )}

                              {/* Product Info */}
                              <View style={styles.productInfo}>
                                <Text
                                  style={[
                                    styles.productName,
                                    isOut && { color: COLORS.muted },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {p.name}
                                </Text>
                                <View style={styles.productMeta}>
                                  <Text style={styles.productSku}>{p.sku}</Text>
                                  <View
                                    style={[
                                      styles.stockBadge,
                                      isOut && { backgroundColor: "#fee2e2" },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.stockText,
                                        isOut && { color: COLORS.danger },
                                      ]}
                                    >
                                      {isOut
                                        ? "Hết hàng có thể bán"
                                        : `Tồn: ${avail}`}
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              {/* Price & Add Button */}
                              <View style={styles.productRight}>
                                <Text
                                  style={[
                                    styles.productPrice,
                                    isOut && { color: COLORS.muted },
                                  ]}
                                >
                                  {formatPrice(p.price)}
                                </Text>
                                {!isOut && (
                                  <View style={styles.addBtnMini}>
                                    <Ionicons
                                      name="add"
                                      size={16}
                                      color={COLORS.white}
                                    />
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Đã ẩn chi tiết lô hàng để tối ưu giao diện theo yêu cầu */}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Body */}
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Info Bar - Employee & Customer inline */}
          <View style={styles.quickInfoBar}>
            <Pressable
              style={styles.quickInfoItem}
              onPress={() => setEmployeeModalOpen(true)}
            >
              <Text style={styles.quickInfoLabel}>NV bán</Text>
              <Text style={styles.quickInfoValue} numberOfLines={1}>
                {employeeLabel}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.muted} />
            </Pressable>

            <View style={styles.quickInfoDivider} />

            <Pressable
              style={[styles.quickInfoItem, { flex: 1.2 }]}
              onPress={() => {
                setNewCustomerName("");
                setNewCustomerPhone(phoneInput || tempPhone || "");
                setNewCustomerModalOpen(true);
              }}
            >
              <Text style={styles.quickInfoLabel}>Khách hàng</Text>
              <Text style={styles.quickInfoValue} numberOfLines={1}>
                {currentTab.customer ? currentTab.customer.name : "Vãng lai"}
              </Text>
              <Ionicons
                name="person-add-outline"
                size={16}
                color={COLORS.primary}
              />
            </Pressable>
          </View>

          {/* Customer Search - Compact */}
          <View style={styles.customerSearchBox}>
            <Ionicons name="search" size={18} color={COLORS.muted} />
            <TextInput
              value={phoneInput}
              onChangeText={onChangePhoneInput}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => {
                setTimeout(() => {
                  if (!selectingCustomerRef.current)
                    setShowCustomerDropdown(false);
                }, 180);
              }}
              placeholder="Tìm khách theo SĐT..."
              placeholderTextColor={COLORS.placeholder}
              style={styles.customerSearchInput}
              keyboardType="phone-pad"
            />
            {currentTab.customer && (
              <View style={styles.customerBadge}>
                <Text style={styles.customerBadgeText}>
                  {currentTab.customer.loyaltyPoints?.toLocaleString("vi-VN") ||
                    0}{" "}
                  điểm
                </Text>
              </View>
            )}
          </View>

          {showCustomerDropdown && foundCustomers.length > 0 && (
            <View style={[styles.dropdown, { marginTop: -8, marginBottom: 8 }]}>
              <ScrollView
                style={{ maxHeight: 180 }}
                keyboardShouldPersistTaps="always"
              >
                {foundCustomers.map((c) => (
                  <Pressable
                    key={c._id}
                    onPressIn={() => (selectingCustomerRef.current = true)}
                    onPressOut={() => (selectingCustomerRef.current = false)}
                    onPress={() => selectCustomer(c)}
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      pressed && { backgroundColor: "#eff6ff" },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownTitle}>{c.name}</Text>
                      <Text style={styles.hint}>
                        {c.phone} •{" "}
                        {(c.loyaltyPoints || 0).toLocaleString("vi-VN")} đểm
                      </Text>
                    </View>
                    <Text style={styles.addHint}>Chọn</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Loyalty Points - Compact */}
          {loyaltySetting?.isActive && currentTab.customer && (
            <View style={styles.pointsCompactBox}>
              <Ionicons name="gift" size={18} color={COLORS.warn} />
              <Text style={styles.pointsCompactText}>
                Có{" "}
                {currentTab.customer.loyaltyPoints?.toLocaleString("vi-VN") ||
                  0}{" "}
                điểm
              </Text>
              <Pressable
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
                style={[
                  styles.pointsToggle,
                  currentTab.usedPointsEnabled && styles.pointsToggleOn,
                ]}
              >
                <Text
                  style={[
                    styles.pointsToggleText,
                    currentTab.usedPointsEnabled && styles.pointsToggleTextOn,
                  ]}
                >
                  {currentTab.usedPointsEnabled ? "BẬT" : "TẮT"}
                </Text>
              </Pressable>
              {currentTab.usedPointsEnabled && (
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
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
                  <Pressable
                    onPress={() =>
                      updateOrderTab(
                        (t) => (t.usedPoints = t.customer?.loyaltyPoints || 0)
                      )
                    }
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: COLORS.primary,
                        fontWeight: "bold",
                      }}
                    >
                      MAX
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Cart */}
          <Section
            title="Giỏ hàng"
            subtitle="Sản phẩm đã chọn"
            right={<Badge value={currentTab.cart.length} />}
          >
            {currentTab.cart.length === 0 ? (
              <Text style={styles.mutedText}>Chưa có sản phẩm.</Text>
            ) : (
              <FlatList
                data={currentTab.cart}
                keyExtractor={(i) => i.productId}
                scrollEnabled={false}
                renderItem={CartRow as any}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              />
            )}
          </Section>

          {/* Payment */}
          <Section
            title="Thanh toán"
            subtitle="Tổng kết đơn hàng & phương thức"
          >
            <View style={styles.rowBetween}>
              <Text style={styles.mutedInline}>Tạm tính</Text>
              <Text style={styles.valueText}>{formatPrice(subtotal)}</Text>
            </View>

            {vatAmount > 0 && (
              <View style={[styles.rowBetween, { marginTop: 10 }]}>
                <Text style={[styles.mutedInline, { color: COLORS.warn }]}>
                  Thuế GTGT (Tự động)
                </Text>
                <Text style={[styles.valueText, { color: COLORS.warn }]}>
                  +{formatPrice(vatAmount)}
                </Text>
              </View>
            )}

            {/* LƯU Ý: Đã có phần render discount ở trên hoặc gom vào đây */}
            {discount > 0 && (
              <View style={[styles.rowBetween, { marginTop: 10 }]}>
                <Text style={[styles.mutedInline, { color: COLORS.good }]}>
                  Giảm giá điểm
                </Text>
                <Text style={[styles.valueText, { color: COLORS.good }]}>
                  -{formatPrice(discount)}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.rowBetween,
                {
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: COLORS.stroke,
                },
              ]}
            >
              <Text
                style={[
                  styles.mutedInline,
                  {
                    fontWeight: "bold",
                    color: COLORS.textStrong,
                    fontSize: 16,
                  },
                ]}
              >
                THANH TOÁN
              </Text>
              <Text
                style={[
                  styles.valueText,
                  { color: COLORS.primary, fontSize: 22, fontWeight: "900" },
                ]}
              >
                {formatPrice(totalAmount)}
              </Text>
            </View>

            <View style={[styles.rowBetween, { marginTop: 12 }]}>
              <Text style={styles.mutedInline}>Cung cấp hoá đơn VAT</Text>
              <Pressable
                onPress={() => updateOrderTab((t) => (t.isVAT = !t.isVAT))}
                style={[styles.toggle, currentTab.isVAT && styles.toggleOn]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    currentTab.isVAT && styles.toggleTextOn,
                  ]}
                >
                  {currentTab.isVAT ? "MỞ" : "TẮT"}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.mutedInline, { marginTop: 14 }]}>
              Phương thức
            </Text>

            <View style={styles.pmRow}>
              <Pressable
                onPress={() =>
                  updateOrderTab((t) => (t.paymentMethod = "cash"))
                }
                style={[
                  styles.pmBtn,
                  currentTab.paymentMethod === "cash" && styles.pmBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.pmBtnText,
                    currentTab.paymentMethod === "cash" &&
                      styles.pmBtnTextActive,
                  ]}
                >
                  Tiền mặt
                </Text>
              </Pressable>

              <Pressable
                onPress={() => updateOrderTab((t) => (t.paymentMethod = "qr"))}
                style={[
                  styles.pmBtn,
                  currentTab.paymentMethod === "qr" && styles.pmBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.pmBtnText,
                    currentTab.paymentMethod === "qr" && styles.pmBtnTextActive,
                  ]}
                >
                  QR
                </Text>
              </Pressable>
            </View>

            {currentTab.paymentMethod === "cash" ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.mutedInline}>Tiền khách đưa</Text>
                <TextInput
                  value={String(currentTab.cashReceived || 0)}
                  onChangeText={(txt) => {
                    const n = clampInt(txt, 0);
                    updateOrderTab((t) => (t.cashReceived = n));
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.input}
                />

                <View
                  style={[
                    styles.changeBox,
                    {
                      borderColor: changeAmount >= 0 ? "#bbf7d0" : "#fecaca",
                      backgroundColor:
                        changeAmount >= 0 ? "#f0fdf4" : "#fff1f2",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.totalLabel,
                      {
                        color: changeAmount >= 0 ? COLORS.good : COLORS.danger,
                      },
                    ]}
                  >
                    Tiền thừa
                  </Text>
                  <Text
                    style={[
                      styles.totalValue,
                      {
                        color: changeAmount >= 0 ? COLORS.good : COLORS.danger,
                      },
                    ]}
                  >
                    {changeAmount >= 0
                      ? formatPrice(changeAmount)
                      : `-${formatPrice(Math.abs(changeAmount))}`}
                  </Text>
                </View>

                {currentTab.pendingOrderId ? (
                  <IconTextButton
                    type="danger"
                    text="Xác nhận đã thu tiền"
                    onPress={() => {
                      Alert.alert(
                        "Xác nhận",
                        `Khách đã đưa đủ ${formatPrice(totalAmount)}?`,
                        [
                          { text: "Huỷ", style: "cancel" },
                          {
                            text: "Xác nhận",
                            style: "destructive",
                            onPress: confirmPaidCash,
                          },
                        ]
                      );
                    }}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </View>
            ) : null}
          </Section>

          {/* spacer for bottom bar */}
          <View style={{ height: 108 }} />
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomBarLabel}>Khách phải trả</Text>
            <Text style={styles.bottomBarTotal}>
              {formatPrice(totalAmount)}
            </Text>
            {currentTab.pendingOrderId ? (
              <Text style={styles.bottomBarHint}>
                Mã đơn: {currentTab.pendingOrderId}
              </Text>
            ) : (
              <Text style={styles.bottomBarHint}>Chưa tạo đơn</Text>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() =>
                  updateOrderTab((t) => (t.paymentMethod = "cash"))
                }
                style={[
                  styles.bottomChip,
                  currentTab.paymentMethod === "cash" &&
                    styles.bottomChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.bottomChipText,
                    currentTab.paymentMethod === "cash" &&
                      styles.bottomChipTextActive,
                  ]}
                >
                  Cash
                </Text>
              </Pressable>

              <Pressable
                onPress={() => updateOrderTab((t) => (t.paymentMethod = "qr"))}
                style={[
                  styles.bottomChip,
                  currentTab.paymentMethod === "qr" && styles.bottomChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.bottomChipText,
                    currentTab.paymentMethod === "qr" &&
                      styles.bottomChipTextActive,
                  ]}
                >
                  QR
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <IconTextButton
                type="outline"
                text="Hoá đơn"
                disabled={!canOpenBill}
                onPress={() => setBillModalOpen(true)}
                style={{ flex: 1, height: 44 }}
              />

              <IconTextButton
                type="primary"
                text={loading ? "Đang xử lý..." : primaryActionText}
                disabled={!canCreateOrder}
                onPress={createOrder}
                style={{ flex: 1.2, height: 44 }}
              />
            </View>

            {canContinueQr && !currentTab.qrImageUrl ? (
              <IconTextButton
                type="outline"
                text="Tiếp tục QR"
                onPress={() => {
                  if (currentTab.savedQrImageUrl) {
                    updateOrderTab((t) => {
                      t.qrImageUrl = t.savedQrImageUrl;
                      t.qrPayload = t.savedQrPayload;
                      t.qrExpiryTs = t.savedQrExpiryTs;
                    });
                    setQrModalOpen(true);
                  } else {
                    Alert.alert(
                      "Thông báo",
                      "Không có QR đã lưu, vui lòng tạo QR mới."
                    );
                  }
                }}
                style={{ height: 44 }}
              />
            ) : null}
          </View>
        </View>

        {/* Employee picker modal */}
        <Modal
          visible={employeeModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setEmployeeModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Chọn nhân viên bán</Text>
              <Text style={styles.modalSubtitle}>
                Chọn người thực hiện đơn hàng
              </Text>

              <ScrollView
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="always"
              >
                {currentUserEmployee?.isOwner ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      pressed && { backgroundColor: "#eff6ff" },
                    ]}
                    onPress={() => {
                      updateOrderTab((t) => (t.employeeId = null));
                      setEmployeeModalOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownTitle}>
                        {currentUserEmployee.fullName} (Chủ cửa hàng)
                      </Text>
                      <Text style={styles.hint}>Gửi employeeId = null</Text>
                    </View>
                    <Text style={styles.addHint}>Chọn</Text>
                  </Pressable>
                ) : null}

                {employees.map((e) => (
                  <Pressable
                    key={e._id}
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      pressed && { backgroundColor: "#eff6ff" },
                    ]}
                    onPress={() => {
                      updateOrderTab((t) => (t.employeeId = e._id));
                      setEmployeeModalOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownTitle}>
                        {e.fullName}
                        {currentUserEmployee?._id === e._id ? " (Bạn)" : ""}
                      </Text>
                      <Text style={styles.hint}>ID: {e._id}</Text>
                    </View>
                    <Text style={styles.addHint}>Chọn</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <IconTextButton
                type="outline"
                text="Đóng"
                onPress={() => setEmployeeModalOpen(false)}
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        </Modal>

        {/* New customer modal */}
        <Modal
          visible={newCustomerModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setNewCustomerModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Thêm khách hàng</Text>

              <Text style={[styles.mutedInline, { marginTop: 10 }]}>
                Tên khách
              </Text>
              <TextInput
                value={newCustomerName}
                onChangeText={setNewCustomerName}
                placeholder="Nhập tên..."
                placeholderTextColor={COLORS.placeholder}
                style={styles.input}
              />

              <Text style={[styles.mutedInline, { marginTop: 10 }]}>
                Số điện thoại
              </Text>
              <TextInput
                value={newCustomerPhone}
                onChangeText={setNewCustomerPhone}
                placeholder="Nhập SĐT..."
                placeholderTextColor={COLORS.placeholder}
                style={styles.input}
                keyboardType="phone-pad"
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <IconTextButton
                  type="outline"
                  text="Huỷ"
                  onPress={() => setNewCustomerModalOpen(false)}
                  style={{ flex: 1 }}
                />
                <IconTextButton
                  type="primary"
                  text="Tạo"
                  onPress={createCustomer}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* QR modal */}
        <Modal
          visible={qrModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeQrModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>QR thanh toán</Text>
              <Text style={styles.modalSubtitle}>
                Khách quét mã để thanh toán
              </Text>

              {qrRemainingSec !== null ? (
                <View style={[styles.infoStrip, { marginTop: 10 }]}>
                  <Text style={styles.infoStripText}>
                    Còn lại:{" "}
                    {Math.floor(qrRemainingSec / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(qrRemainingSec % 60).toString().padStart(2, "0")}
                  </Text>
                </View>
              ) : null}

              <View style={styles.qrBox}>
                {currentTab.qrImageUrl ? (
                  <Image
                    source={{ uri: currentTab.qrImageUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.hint}>
                    Không có QR (có thể đã bị tắt / hết hạn).
                  </Text>
                )}
              </View>

              <View style={styles.modalRow}>
                <IconTextButton
                  type="outline"
                  text="Đóng"
                  onPress={closeQrModal}
                  style={{ flex: 1 }}
                />
                <IconTextButton
                  type="danger"
                  text="In hoá đơn"
                  onPress={async () => {
                    if (!currentTab.pendingOrderId) {
                      Alert.alert("Thiếu đơn hàng", "Chưa có orderId.");
                      return;
                    }
                    await triggerPrintServer(currentTab.pendingOrderId);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Bill modal */}
        <Modal
          visible={billModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setBillModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Hoá đơn</Text>
              <Text style={styles.modalSubtitle}>
                {currentTab.pendingOrderId
                  ? `Mã đơn: ${currentTab.pendingOrderId}`
                  : "Chưa có đơn"}
              </Text>

              <View style={{ marginTop: 10, gap: 10 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedInline}>Khách</Text>
                  <Text style={styles.valueText}>
                    {currentTab.customer?.name || "Khách vãng lai"}
                  </Text>
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.mutedInline}>SĐT</Text>
                  <Text style={styles.valueText}>
                    {currentTab.customer?.phone || "---"}
                  </Text>
                </View>

                <Divider />

                <View style={styles.rowBetween}>
                  <Text style={styles.mutedInline}>Tổng thanh toán</Text>
                  <Text style={styles.totalValue}>
                    {formatPrice(totalAmount)}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionTitleMini}>Danh sách sản phẩm</Text>

                <ScrollView
                  style={{ maxHeight: 220, marginTop: 8 }}
                  keyboardShouldPersistTaps="always"
                >
                  {currentTab.cart.map((i) => (
                    <View
                      key={i.productId}
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: COLORS.stroke,
                      }}
                    >
                      <Text
                        style={{ fontWeight: "900", color: COLORS.textStrong }}
                      >
                        {i.name}
                      </Text>
                      <Text style={styles.hint}>
                        {i.quantity} × {formatPrice(getItemUnitPrice(i))} ={" "}
                        {formatPrice(getItemUnitPrice(i) * i.quantity)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <IconTextButton
                  type="outline"
                  text="Đóng"
                  onPress={() => setBillModalOpen(false)}
                  style={{ flex: 1 }}
                />
                <IconTextButton
                  type="outline"
                  text="Xuất PDF"
                  disabled={!currentTab.cart.length}
                  onPress={exportBillPdfToDevice}
                  style={{ flex: 1 }}
                />
                <IconTextButton
                  type="primary"
                  text="In"
                  disabled={!currentTab.pendingOrderId}
                  onPress={async () => {
                    if (!currentTab.pendingOrderId) return;
                    await triggerPrintServer(currentTab.pendingOrderId);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Price edit modal */}
        <Modal
          visible={priceEditModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setPriceEditModal({ visible: false })}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tuỳ chỉnh giá</Text>

              {priceEditModal.item ? (
                <>
                  <Text style={styles.modalSubtitle}>
                    {priceEditModal.item.name}
                  </Text>
                  <Text style={styles.hint}>
                    Số lượng: {priceEditModal.item.quantity}
                  </Text>

                  <Text style={[styles.mutedInline, { marginTop: 12 }]}>
                    Loại giá
                  </Text>

                  <View style={styles.optionRow}>
                    {(
                      [
                        "NORMAL",
                        "VIP",
                        "AT_COST",
                        "CLEARANCE",
                        "FREE",
                      ] as SaleType[]
                    ).map((st) => {
                      const active =
                        (priceEditModal.tempSaleType || "NORMAL") === st;

                      return (
                        <Pressable
                          key={st}
                          onPress={() => {
                            setPriceEditModal((prev) => {
                              const item = prev.item!;
                              let nextOverride = prev.tempOverridePrice ?? null;

                              if (st === "FREE") nextOverride = 0;
                              if (st === "AT_COST")
                                nextOverride = getPriceNumber(
                                  item.cost_price || item.price
                                );
                              if (st === "NORMAL") nextOverride = null;

                              return {
                                ...prev,
                                tempSaleType: st,
                                tempOverridePrice: nextOverride,
                              };
                            });
                          }}
                          style={[
                            styles.optionChip,
                            active && styles.optionChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && styles.optionChipTextActive,
                            ]}
                          >
                            {SALE_TYPE_LABEL[st]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {["VIP", "CLEARANCE"].includes(
                    priceEditModal.tempSaleType || "NORMAL"
                  ) ? (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.mutedInline}>Nhập giá mới (đ)</Text>
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
                        style={styles.input}
                      />
                    </View>
                  ) : null}

                  <View style={[styles.totalBox, { marginTop: 12 }]}>
                    <Text style={styles.totalLabel}>
                      Thành tiền sau thay đổi
                    </Text>
                    <Text style={styles.totalValue}>
                      {formatPrice(
                        computeTempUnitPrice() *
                          (priceEditModal.item?.quantity || 1)
                      )}
                    </Text>
                  </View>

                  <View
                    style={{ flexDirection: "row", gap: 10, marginTop: 12 }}
                  >
                    <IconTextButton
                      type="outline"
                      text="Huỷ"
                      onPress={() => setPriceEditModal({ visible: false })}
                      style={{ flex: 1 }}
                    />
                    <IconTextButton
                      type="primary"
                      text="Áp dụng"
                      onPress={applyPriceEdit}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.hint}>Không có dữ liệu sản phẩm.</Text>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OrderPOSHomeScreen;

/** =========================================================
 *  Styles (LIGHT)
 *  ========================================================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  mutedText: { color: COLORS.muted, marginTop: 10, fontWeight: "800" },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
    ...SHADOW,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { color: COLORS.textStrong, fontSize: 18, fontWeight: "900" },
  headerSub: { color: COLORS.muted, marginTop: 4, fontWeight: "800" },

  container: { padding: SPACING.lg, paddingBottom: 18, gap: SPACING.md },

  // Pills (tabs)
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillActive: { backgroundColor: COLORS.chipActive, borderColor: "#93c5fd" },
  pillText: { color: COLORS.text, fontWeight: "900" },
  pillTextActive: { color: COLORS.primary2, fontWeight: "900" },

  iconClose: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCloseText: {
    color: "#b91c1c",
    fontWeight: "900",
    marginTop: -2,
    fontSize: 16,
  },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: COLORS.stroke,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: "900",
    width: 18,
    textAlign: "center",
  },
  searchInput: {
    flex: 1,
    fontWeight: "900",
    color: COLORS.textStrong,
    fontSize: 15,
    paddingVertical: 0,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  qtyBtnText: { fontSize: 20, fontWeight: "600", color: COLORS.textStrong },
  scannerBtn: {
    padding: 8,
    backgroundColor: COLORS.chip,
    borderRadius: 10,
    marginLeft: 10,
  },
  cartCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    ...SHADOW,
  },
  cartMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cartThumb: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card2,
  },
  cartThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  cartName: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.textStrong,
  },
  cartSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  priceTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: COLORS.chip,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceTagText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  cartQtyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    padding: 4,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.textStrong,
    minWidth: 30,
    textAlign: "center",
  },
  cartBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  quickQtyRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickQtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  quickQtyText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cartSubtotal: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.primary,
  },
  cartRemoveBtn: {
    padding: 8,
    backgroundColor: "#fff1f2",
    borderRadius: 8,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  searchClearText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginTop: -2,
  },

  // Dropdown
  dropdown: {
    marginTop: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    ...SHADOW,
  },
  dropdownLoadingRow: {
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  dropdownTitle: { fontWeight: "900", color: COLORS.textStrong },
  hint: { marginTop: 4, color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  addHint: { fontWeight: "900", color: COLORS.primary },

  // Section
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    padding: SPACING.lg,
    ...SHADOW,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: COLORS.textStrong },
  sectionTitleMini: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.textStrong,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  valueText: { fontWeight: "900", color: COLORS.textStrong },

  input: {
    backgroundColor: "#f8fafc",
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    fontWeight: "900",
    color: COLORS.textStrong,
    marginTop: 6,
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mutedInline: { color: COLORS.muted, fontWeight: "900" },

  toggle: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  toggleOn: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
  toggleText: { fontWeight: "900", color: COLORS.text, fontSize: 12 },
  toggleTextOn: { color: "#166534" },

  badge: {
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontWeight: "900", color: "#1d4ed8" },

  removeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  removeBtnText: { color: "#b91c1c", fontWeight: "900", fontSize: 12 },

  totalBox: {
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  totalLabel: { fontWeight: "900", color: COLORS.textStrong, fontSize: 13 },
  totalValue: {
    fontWeight: "900",
    color: "#1d4ed8",
    fontSize: 18,
    marginTop: 2,
  },

  changeBox: {
    borderRadius: RADIUS.xl,
    padding: 14,
    borderWidth: 1,
    marginTop: 10,
  },

  pmRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  pmBtn: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  pmBtnActive: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  pmBtnText: { fontWeight: "900", color: COLORS.text },
  pmBtnTextActive: { color: "#1d4ed8" },

  // Buttons
  btnBase: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.20)",
  },
  btnOutline: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  btnDanger: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  btnGhost: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnTextBase: { fontWeight: "900" },
  btnTextPrimary: { color: COLORS.white },
  btnTextOutline: { color: COLORS.textStrong },
  btnTextDanger: { color: "#b91c1c" },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 18 : 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.stroke,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    ...SHADOW,
  },
  bottomBarLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },
  bottomBarTotal: {
    color: "#1d4ed8",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 2,
  },
  bottomBarHint: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
  },

  bottomChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: COLORS.stroke,
    minWidth: 72,
    alignItems: "center",
  },
  bottomChipActive: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  bottomChipText: { fontWeight: "900", color: COLORS.text },
  bottomChipTextActive: { color: "#1d4ed8" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    ...SHADOW,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: COLORS.textStrong },
  modalSubtitle: { marginTop: 6, color: COLORS.muted, fontWeight: "800" },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 12 },

  qrBox: {
    marginTop: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    backgroundColor: "#f8fafc",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: { width: 280, height: 280 },

  infoStrip: {
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
  },
  infoStripText: { fontWeight: "900", color: "#92400e" },

  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  optionChipActive: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  optionChipText: { fontWeight: "900", color: COLORS.text, fontSize: 12 },
  optionChipTextActive: { color: "#1d4ed8" },

  // Quick Info Bar - Compact employee & customer display
  quickInfoBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    padding: 10,
    gap: 8,
    ...SHADOW,
  },
  quickInfoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
    borderRadius: RADIUS.sm,
  },
  quickInfoLabel: { fontSize: 11, fontWeight: "700", color: COLORS.muted },
  quickInfoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textStrong,
  },
  quickInfoDivider: {
    width: 1,
    backgroundColor: COLORS.stroke,
    marginVertical: 4,
  },

  // Customer Search - Compact
  customerSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customerSearchInput: {
    flex: 1,
    fontWeight: "700",
    color: COLORS.textStrong,
    fontSize: 14,
    paddingVertical: 0,
  },
  customerBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  customerBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400e" },

  // Points Compact
  pointsCompactBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pointsCompactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e",
  },
  pointsToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  pointsToggleOn: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  pointsToggleText: { fontSize: 11, fontWeight: "800", color: COLORS.muted },
  pointsToggleTextOn: { color: "#16a34a" },
  pointsInput: {
    width: 70,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textStrong,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    textAlign: "center",
  },

  // ===== Enhanced Product Search Styles =====
  searchSection: {
    marginTop: SPACING.md,
  },
  searchBoxEnhanced: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...SHADOW,
  },
  searchInputEnhanced: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textStrong,
    paddingVertical: 6,
  },
  voiceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  listeningBadge: {
    position: "absolute",
    top: 55,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  listeningText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  scanBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    padding: 4,
  },

  // Product Dropdown
  productDropdown: {
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
    overflow: "hidden",
    ...SHADOW,
  },
  dropdownCenter: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  dropdownHint: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
    textAlign: "center",
  },

  // Product Card in Dropdown
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.stroke,
  },
  productCardPressed: {
    backgroundColor: "#f0f9ff",
  },
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card2,
  },
  productThumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textStrong,
  },
  productMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  productSku: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.muted,
  },
  stockBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16a34a",
  },
  productRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  addBtnMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
