// src/pages/order/OrderPOSHome.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Table,
  Input,
  Button,
  Modal,
  Tag,
  Popconfirm,
  Space,
  Form,
  InputNumber,
  Select,
  Divider,
  Typography,
  Badge,
  Tabs,
  Switch,
  QRCode,
  Statistic,
  Card,
  Row,
  Col,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  DollarOutlined,
  QrcodeOutlined,
  UserOutlined,
  GiftOutlined,
  UserAddOutlined,
  ShopOutlined,
  EditOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import ModalPrintBill from "./ModalPrintBill";
import ModalCustomerAdd from "./ModalCustomerAdd";
import { io, Socket } from "socket.io-client";
import Swal from "sweetalert2";

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { TabPane } = Tabs;
const { Countdown } = Statistic;
const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl}`;
const SOCKET_URL = `${apiUrl}`;

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: any;
  cost_price: any;
  stock_quantity: number;
  unit: string;
  image?: { url: string };
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
  loyaltyPoints: number;
}

interface Employee {
  _id: string;
  fullName: string;
  phone?: string;
  salary?: number | string;
  shift?: string;
  commission_rate?: number | string;
  hired_date?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  user_id: {
    _id: string;
    username: string;
    role?: string;
    email?: string;
    phone?: string;
    menu?: string[];
    // Có thể thêm các field khác nếu cần sau này
  } | null; // cho phép null nếu có nhân viên chưa link user (hiếm)
  store_id?: {
    _id: string;
    name?: string;
  };
}

type VirtualOwner = {
  _id: "virtual-owner";
  fullName: string;
  isOwner: true;
};

type RealEmployee = Employee & {
  isOwner?: false;
};

type Seller = RealEmployee | VirtualOwner;

type SaleType = "NORMAL" | "AT_COST" | "VIP" | "CLEARANCE" | "FREE";
interface CartItem {
  productId: string;
  name: string;
  image?: { url: string };
  sku: string;
  price: any; // giá gốc (Decimal128/from API)
  cost_price?: any; // giá vốn (Decimal128/from API)
  overridePrice?: number | null; // giá nhân viên nhập (VND)
  saleType?: SaleType; // VIP/AT_COST/FREE...
  unit: string;
  quantity: number;
  subtotal: string; // lưu chuỗi như hiện tại (format .toFixed(2))
}

interface OrderTab {
  key: string;
  cart: CartItem[];
  customer: Customer | null;
  employeeId: string | null;
  usedPoints: number; //điểm hiện có
  usedPointsEnabled: boolean; // bật/tắt áp dụng điểm
  isVAT: boolean;
  paymentMethod: "cash" | "qr";
  cashReceived: number;

  // Per-tab order data (not global anymore)
  pendingOrderId: string | null;
  orderCreatedPaymentMethod: "cash" | "qr" | null;
  orderCreatedAt: string;
  orderPrintCount: number;
  orderEarnedPoints: number;

  // Per-tab QR data
  qrImageUrl: string | null;
  qrPayload: string | null;
  qrExpiryTs: number | null;
  savedQrImageUrl: string | null;
  savedQrPayload: string | null;
  savedQrExpiryTs: number | null;
}

interface OrderResponse {
  message: string;
  order: {
    _id: string;
    storeId?: string;
    employeeId?: string;
    customer?: string | null;
    totalAmount?: any;
    qrExpiry?: string;
    paymentMethod: "cash" | "qr";
    status?: string;
    printDate?: string | null;
    printCount?: number;
    createdAt?: string;
    updatedAt?: string;
    items?: any[];
  };
  qrRef?: number;
  qrDataURL?: string;
  paymentLinkUrl?: string | null;
}

const OrderPOSHome: React.FC = () => {
  const [form] = Form.useForm();

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const [orders, setOrders] = useState<OrderTab[]>([
    {
      key: "1",
      cart: [],
      customer: null,
      employeeId: null,
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
    },
  ]);
  const [activeTab, setActiveTab] = useState("1");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loyaltySetting, setLoyaltySetting] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [newCustomerModal, setNewCustomerModal] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [billModalOpen, setBillModalOpen] = useState(false);

  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  // Thêm state để lưu employee hiện tại của user đang login
  const [currentUserEmployee, setCurrentUserEmployee] = useState<Seller | null>(
    null
  );

  // Helper - Lấy giá trị số từ price
  const getPriceNumber = (price: any): number => {
    if (!price) return 0;
    if (price.$numberDecimal) return parseFloat(price.$numberDecimal);
    if (typeof price === "string") return parseFloat(price) || 0;
    if (typeof price === "number") return price;
    return 0;
  };

  // Helper - Format giá tiền
  const formatPrice = (price: any): string => {
    const num = getPriceNumber(price);
    return num.toLocaleString("vi-VN") + "đ";
  };

  // Lấy đơn giá thực tế của item dựa trên saleType + overridePrice
  const getItemUnitPrice = (item: CartItem): number => {
    // 1. overridePrice ưu tiên
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
        // Nếu CLEARANCE chưa nhập giá thì fallback về base (hoặc cost) — tránh trả 0
        return cost || base;
      case "FREE":
        return 0;
      default:
        return base;
    }
  };

  // Hàm reset tab hiện tại sau in thành công
  const resetCurrentTab = () => {
    updateOrderTab((tab) => {
      tab.cart = [];
      tab.customer = null;
      tab.usedPoints = 0;
      tab.usedPointsEnabled = false;
      tab.isVAT = false;
      tab.paymentMethod = "cash";
      tab.cashReceived = 0;
      // Reset order data
      tab.pendingOrderId = null;
      tab.orderCreatedPaymentMethod = null;
      tab.orderCreatedAt = "";
      tab.orderPrintCount = 0;
      tab.orderEarnedPoints = 0;
      // Reset QR data
      tab.qrImageUrl = null;
      tab.qrPayload = null;
      tab.qrExpiryTs = null;
      tab.savedQrImageUrl = null;
      tab.savedQrPayload = null;
      tab.savedQrExpiryTs = null;
    });
    // Clear customer search input
    setPhoneInput(""); // 🟢 Clear search box
    setTempPhone(""); // Clear temp phone
    setFoundCustomers([]); // Clear customer dropdown
    setShowCustomerDropdown(false); // Close dropdown
  };

  // Socket - Kết nối socket để nhận các thông báo khác (low_stock, etc) - WEBHOOK PAYMENT KHÔNG DÙNG NỮA
  useEffect(() => {
    const s = io(SOCKET_URL, { auth: { token } });
    setSocket(s);
    // NOTE: payment_success listener REMOVED vì không dùng webhook, thanh toán QR bây giờ là thủ công
    // Khi user nhấn "In hoá đơn" ở QR Modal → API gọi printBill → tự động set paid
    return () => {
      s.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (storeId) {
      loadEmployees();
      loadLoyaltySetting();
    }
  }, [storeId]);

  // Khi load employees, tìm employee tương ứng với user đang login
  const loadEmployees = async () => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");

      if (!loggedInUser?.id) return;

      // Nếu là STAFF → chỉ lấy thông tin từ user, không cần load API employees
      if (loggedInUser.role === "STAFF") {
        // Tạo object employee từ thông tin user
        const staffEmployee: Seller = {
          _id: loggedInUser.id,
          fullName:
            loggedInUser.fullname || loggedInUser.username || "Nhân viên",
          user_id: {
            _id: loggedInUser.id,
            username: loggedInUser.username,
            role: loggedInUser.role,
            email: loggedInUser.email,
            phone: loggedInUser.phone,
            menu: loggedInUser.menu,
          },
        };

        setCurrentUserEmployee(staffEmployee);
        setEmployees([staffEmployee as Employee]); // Set danh sách chỉ có 1 nhân viên (chính mình)

        // Set mặc định employeeId = id của staff
        setOrders((prev) =>
          prev.map((tab) => ({
            ...tab,
            employeeId: loggedInUser.id,
          }))
        );

        return;
      }

      // Manager / Owner → load danh sách employees từ API
      const res = await axios.get(
        `${API_BASE}/stores/${storeId}/employees?deleted=false`,
        { headers }
      );

      const employeesList: Employee[] = res.data.employees || [];
      setEmployees(employeesList);

      // Manager / Owner → luôn là virtual owner
      if (loggedInUser.role === "MANAGER" || loggedInUser.role === "OWNER") {
        const virtualOwner: VirtualOwner = {
          _id: "virtual-owner",
          fullName:
            loggedInUser.fullname || loggedInUser.username || "Chủ cửa hàng",
          isOwner: true,
        };

        setCurrentUserEmployee(virtualOwner);

        // set mặc định employeeId = null
        setOrders((prev) =>
          prev.map((tab) => ({
            ...tab,
            employeeId: null,
          }))
        );
      }
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không tải được nhân viên",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    }
  };

  // Load cài đặt loyalty
  const loadLoyaltySetting = async () => {
    try {
      const res = await axios.get(`${API_BASE}/loyaltys/config/${storeId}`, {
        headers,
      });
      // Luôn lưu config, nhưng sẽ check isActive khi render
      if (res.data.isConfigured) {
        setLoyaltySetting(res.data.config);
      } else {
        setLoyaltySetting(null);
      }
    } catch (err) {
      console.error("Lỗi tải config tích điểm:", err);
      setLoyaltySetting(null);
    }
  };

  // Tìm kiếm sản phẩm với debounce
  const searchProductDebounced = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        setSearchedProducts([]);
        return;
      }
      try {
        const res = await axios.get(
          `${API_BASE}/products/search?query=${encodeURIComponent(
            query
          )}&storeId=${storeId}`,
          { headers }
        );
        setSearchedProducts(res.data.products || []);
      } catch (err) {
        Swal.fire({
          title: "❌ Lỗi!",
          text: "Không tìm thấy sản phẩm",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#ff4d4f",
          timer: 2000,
        });
      }
    }, 300),
    [storeId]
  );

  useEffect(() => {
    searchProductDebounced(searchProduct);
  }, [searchProduct]);

  // Thêm sản phẩm vào giỏ hàng
  const addToCart = (product: Product) => {
    const priceNum = getPriceNumber(product.price);
    updateOrderTab((tab) => {
      const existing = tab.cart.find((item) => item.productId === product._id);
      if (existing) {
        const newQty = existing.quantity + 1;
        tab.cart = tab.cart.map((item) =>
          item.productId === product._id
            ? {
                ...item,
                quantity: newQty,
                subtotal: (newQty * priceNum).toFixed(2),
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
            quantity: 1,
            overridePrice: undefined,
            saleType: "NORMAL",
            subtotal: priceNum.toFixed(2),
          },
        ];
      }
    });
    // Reset search sau khi thêm
    setSearchProduct("");
    setSearchedProducts([]);
  };

  // Cập nhật số lượng sản phẩm trong giỏ
  const updateQuantity = (id: string, qty: number) => {
    updateOrderTab((tab) => {
      const item = tab.cart.find((i) => i.productId === id);
      if (!item) return;
      if (qty <= 0) {
        tab.cart = tab.cart.filter((i) => i.productId !== id);
      } else {
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

  // Tìm kiếm khách hàng với debounce
  const searchCustomerDebounced = useCallback(
    debounce(async (phone: string, tabKey: string) => {
      setTempPhone(phone);
      if (phone.length < 3) return;
      try {
        const res = await axios.get(`${API_BASE}/customers/search`, {
          params: { query: phone, storeId },
          headers,
        });
        setFoundCustomers(res.data.customers || []); // chỉ lưu danh sách, không mở modal
      } catch (err) {
        setNewCustomerModal(true);
      }
    }, 500),
    [storeId]
  );

  // Cập nhật thông tin tab đơn hàng
  const updateOrderTab = (
    updater: (tab: OrderTab) => void,
    key = activeTab
  ) => {
    setOrders((prev) =>
      prev.map((tab) => {
        if (tab.key !== key) return tab;
        const updated = { ...tab };
        updater(updated);
        return updated;
      })
    );
  };

  // Thêm tab đơn hàng mới
  const addNewOrderTab = () => {
    const newKey = (orders.length + 1).toString();
    setOrders([
      ...orders,
      {
        key: newKey,
        cart: [],
        customer: null,
        employeeId: currentUserEmployee?.isOwner
          ? null
          : currentUserEmployee?._id || null,
        usedPoints: 0,
        usedPointsEnabled: false,
        isVAT: false,
        paymentMethod: "cash",
        cashReceived: 0,

        // Thêm các field mới theo interface OrderTab
        pendingOrderId: null,
        orderCreatedPaymentMethod: null,
        orderCreatedAt: "",
        orderPrintCount: 0,
        orderEarnedPoints: 0,

        // Thêm field QR
        qrImageUrl: null,
        qrPayload: null,
        qrExpiryTs: null,
        savedQrImageUrl: null,
        savedQrPayload: null,
        savedQrExpiryTs: null,
      },
    ]);
    setActiveTab(newKey);
  };

  // Xóa tab đơn hàng
  const removeOrderTab = (key: string) => {
    const newOrders = orders.filter((tab) => tab.key !== key);
    setOrders(newOrders);
    if (activeTab === key && newOrders.length > 0) {
      setActiveTab(newOrders[0].key);
    }
  };

  const currentTab = orders.find((tab) => tab.key === activeTab)!;
  const selectValue =
    currentTab.employeeId === null ? "virtual-owner" : currentTab.employeeId;

  // Tính toán các giá trị thanh toán
  const subtotal = useMemo(
    () =>
      currentTab.cart.reduce(
        (sum, item) => sum + getItemUnitPrice(item) * item.quantity,
        0
      ),
    [currentTab.cart]
  );
  const discount = useMemo(
    () =>
      currentTab.usedPointsEnabled
        ? currentTab.usedPoints * (loyaltySetting?.vndPerPoint || 0)
        : 0,
    [
      currentTab.usedPoints,
      currentTab.usedPointsEnabled,
      loyaltySetting?.vndPerPoint,
    ]
  );
  const beforeTax = Math.max(subtotal - discount, 0);
  const vatAmount = currentTab.isVAT ? beforeTax * 0.1 : 0;
  const totalAmount = beforeTax + vatAmount;
  const changeAmount = currentTab.cashReceived - totalAmount;

  // Tạo đơn hàng
  const createOrder = async () => {
    if (currentTab.cart.length === 0)
      return Swal.fire({
        icon: "warning",
        title: "Đơn hàng trống, hãy thêm sản phẩm vào ngay",
        confirmButtonText: "OK",
      });

    // if (!currentTab.employeeId)
    //   return Swal.fire({
    //     icon: "info",
    //     title: "Thông báo",
    //     text: "Đã tự động chọn bạn làm nhân viên bán hàng",
    //     confirmButtonText: "OK",
    //   });

    // === CHUYỂN VIRTUAL-OWNER VỀ NULL TRƯỚC KHI GỬI ===
    const sendEmployeeId =
      currentTab.employeeId === "virtual-owner" ? null : currentTab.employeeId;

    setLoading(true);
    try {
      const items = currentTab.cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        saleType: item.saleType ?? "NORMAL",
        ...(item.overridePrice !== null &&
          item.overridePrice !== undefined && {
            customPrice: item.overridePrice,
          }),
      }));

      // Build payload conditionally
      const payload: any = {
        storeId,
        employeeId: sendEmployeeId,
        items,
        paymentMethod: currentTab.paymentMethod,
        isVATInvoice: currentTab.isVAT,
      };

      // Nếu có customer được chọn thì gửi customerInfo, ko có thì thôi
      if (currentTab.customer) {
        payload.customerInfo = {
          phone: currentTab.customer.phone,
          name: currentTab.customer.name,
        };
      }

      // Chỉ gửi usedPoints khi user bật tính năng và có điểm > 0
      if (
        currentTab.usedPointsEnabled &&
        currentTab.usedPoints &&
        currentTab.usedPoints > 0
      ) {
        payload.usedPoints = currentTab.usedPoints;
      }

      const res = await axios.post<OrderResponse>(
        `${API_BASE}/orders`,
        payload,
        { headers }
      );
      const order = res.data.order;
      const orderId = order._id;

      // Set thông tin cho current tab (per-tab, not global)
      updateOrderTab((tab) => {
        tab.pendingOrderId = orderId;
        tab.orderCreatedAt = order.createdAt || "";
        tab.orderPrintCount =
          typeof order.printCount === "number" ? order.printCount : 0;
        tab.orderEarnedPoints = (order as any).earnedPoints ?? 0;
        tab.orderCreatedPaymentMethod = currentTab.paymentMethod;

        if (currentTab.paymentMethod === "qr" && res.data.qrDataURL) {
          tab.qrImageUrl = res.data.qrDataURL;
          tab.savedQrImageUrl = res.data.qrDataURL; // 🟢 Lưu giữ QR để restore lại
          tab.qrExpiryTs = res.data.order?.qrExpiry
            ? new Date(res.data.order.qrExpiry).getTime()
            : null;
          tab.savedQrExpiryTs = res.data.order?.qrExpiry
            ? new Date(res.data.order.qrExpiry).getTime()
            : null; // 🟢 Lưu giữ
        }
      });
    } catch (err: any) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: err.response?.data?.message || "Lỗi tạo đơn",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sửa hàm triggerPrint
  const triggerPrint = async (orderId: string) => {
    // ✅ NGĂN CHẶN GỌI TRÙNG
    if (isPrinting) {
      console.log("⚠️ Đang in, vui lòng đợi...");
      return;
    }

    setIsPrinting(true);

    try {
      await axios.post(
        `${API_BASE}/orders/${orderId}/print-bill`,
        {},
        { headers }
      );
      Swal.fire({
        icon: "success",
        title: "Thành công!",
        text: "In hóa đơn thành công!",
        showConfirmButton: false,
        timer: 1500,
      });
      setBillModalOpen(false);
      resetCurrentTab();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Có lỗi!",
        text: "In hóa đơn không thành công!",
        showConfirmButton: false,
        timer: 1500,
      });
    } finally {
      // ✅ RESET SAU 2 GIÂY ĐỂ TRÁNH SPAM
      setTimeout(() => {
        setIsPrinting(false);
      }, 2000);
    }
  };

  const currentEmployeeName =
    employees.find((e) => e._id === currentTab.employeeId)?.fullName || "N/A";
  const currentCustomerName = currentTab?.customer?.name || "Khách vãng lai";
  const currentCustomerPhone = currentTab?.customer?.phone || "Không có";

  //Phần logic tuỳ chỉnh giá
  const [priceEditModal, setPriceEditModal] = useState<{
    visible: boolean;
    item?: CartItem;
    tempSaleType?: SaleType;
    tempOverridePrice?: number | null;
  }>({ visible: false });

  const openPriceModal = (record: CartItem) => {
    // tìm object gốc trong currentTab.cart bằng productId
    const realItem =
      currentTab.cart.find((i) => i.productId === record.productId) || record;
    setPriceEditModal({
      visible: true,
      item: realItem,
      tempSaleType: realItem.saleType || "NORMAL",
      tempOverridePrice: realItem.overridePrice ?? null,
    });
  };

  const SALE_TYPE_LABEL: Record<SaleType, string> = {
    NORMAL: "Giá niêm yết",
    VIP: "Giá ưu đãi",
    AT_COST: "Giá vốn",
    CLEARANCE: "Xả kho",
    FREE: "Miễn phí",
  };
  //Hết phần logic tuỳ chỉnh giá

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f0f2f5",
        overflow: "auto",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "16px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flex: 1,
          }}
        >
          <ShopOutlined style={{ fontSize: 28, color: "#fff" }} />
          <div>
            <Title
              level={4}
              style={{ margin: 0, color: "#fff", fontSize: "20px" }}
            >
              {currentStore.name || "Cửa Hàng"}
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px" }}>
              Hệ thống bán hàng POS
            </Text>
          </div>
        </div>

        <Input
          size="large"
          placeholder="Tìm sản phẩm (SKU/Tên) hoặc quét mã vạch..."
          prefix={<SearchOutlined />}
          value={searchProduct}
          onChange={(e) => setSearchProduct(e.target.value)}
          style={{
            maxWidth: 500,
            flex: 2,
            borderRadius: "8px",
          }}
          autoFocus
        />

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={addNewOrderTab}
          size="large"
          style={{
            background: "#52c41a",
            borderColor: "#52c41a",
            borderRadius: "8px",
            fontWeight: 600,
          }}
        >
          Tạo đơn Mới
        </Button>
      </div>
      {/* Dropdown sản phẩm tìm kiếm */}
      {searchedProducts.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "50%",
            width: "600px",
            maxHeight: "480px",
            overflowY: "auto",
            background: "#fff",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            borderRadius: "10px",
            zIndex: 1000,
            padding: "8px",
            scrollbarWidth: "thin",
            transition: "transform 0.15s ease, opacity 0.15s ease",
            opacity: searchedProducts.length > 0 ? 1 : 0,
            transform: `translateX(-50%) ${
              searchedProducts.length > 0 ? "translateY(0)" : "translateY(-5px)"
            }`,
          }}
        >
          {searchedProducts.map((prod) => (
            <div
              key={prod._id}
              onClick={() => addToCart(prod)}
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                borderBottom: "1px solid #f0f0f0",
                borderRadius: "6px",
                transition: "all 0.2s ease",
                marginBottom: "4px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f5faff")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Text strong style={{ fontSize: "15px", color: "#000" }}>
                    {prod.name}
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      Mã SKU: {prod.sku}
                    </Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: "12px", marginLeft: 12 }}
                    >
                      Đơn vị: {prod.unit}
                    </Text>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <Text strong style={{ color: "#1890ff", fontSize: "17px" }}>
                    {formatPrice(prod.price)}
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    Tồn kho:{" "}
                    <Tag
                      color={prod.stock_quantity > 0 ? "green" : "red"}
                      style={{ fontWeight: 500, fontSize: "12px" }}
                    >
                      {prod.stock_quantity}
                    </Tag>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* BODY - 2 CỘT (GRID 24 CỘT) */}
      <Row gutter={[16, 16]} style={{ flex: 1, padding: 16 }}>
        {/* CỘT TRÁI - GIỎ HÀNG (CHIẾM 16/24) */}
        <Col
          xs={24}
          md={16}
          lg={17}
          xl={18}
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          {/* Row 1 - Card chính (chiếm hết chiều cao trừ footer) */}
          <Row style={{ flex: 1, overflow: "hidden" }}>
            <Col span={24}>
              <Card
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                styles={{
                  body: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    padding: 16,
                    overflow: "hidden",
                  },
                }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  type="editable-card"
                  onEdit={(targetKey, action) => {
                    if (action === "add") addNewOrderTab();
                    else if (action === "remove")
                      removeOrderTab(targetKey as string);
                  }}
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                  items={orders.map((tab) => ({
                    key: tab.key,
                    label: (
                      <span style={{ fontWeight: 600 }}>Đơn {tab.key}</span>
                    ),
                    closable: orders.length > 1,
                    children: (
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          height: "100%",
                        }}
                      >
                        <Table
                          dataSource={tab.cart.map((item, i) => ({
                            ...item,
                            stt: i + 1,
                          }))}
                          pagination={false}
                          size="middle"
                          scroll={{ y: "calc(100vh - 420px)" }}
                          style={{ flex: 1 }}
                          columns={[
                            {
                              title: "STT",
                              dataIndex: "stt",
                              width: 60,
                              align: "center",
                            },
                            {
                              title: "Tên sản phẩm",
                              dataIndex: "name",
                              ellipsis: true,
                              width: 250,
                              render: (_text, record: CartItem) => (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <img
                                    src={
                                      record.image?.url ||
                                      "/default-product.png"
                                    }
                                    alt={record.name}
                                    style={{
                                      width: 40,
                                      height: 40,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />

                                  <Text strong>{record.name}</Text>
                                </div>
                              ),
                            },
                            {
                              title: "SKU",
                              dataIndex: "sku",
                              width: 150,
                              render: (text) => <Text code>{text}</Text>,
                            },
                            {
                              title: "Số lượng",
                              width: 120,
                              align: "center",
                              render: (_, r) => (
                                <InputNumber
                                  min={1}
                                  value={r.quantity}
                                  onChange={(v) =>
                                    updateQuantity(r.productId, v || 1)
                                  }
                                  style={{ width: "60%" }}
                                />
                              ),
                            },
                            {
                              title: "Đơn giá",
                              width: 120,
                              align: "right",
                              render: (_, record) => {
                                const unitPrice = getItemUnitPrice(record);
                                const isCustom =
                                  record.saleType &&
                                  record.saleType !== "NORMAL";

                                return (
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontWeight: 500 }}>
                                      {formatPrice(unitPrice)}
                                      {isCustom && (
                                        <Tag
                                          color="blue"
                                          style={{
                                            marginLeft: 6,
                                            fontSize: 10,
                                            padding: "0 4px",
                                            height: 16,
                                            lineHeight: "16px",
                                          }}
                                        >
                                          {
                                            SALE_TYPE_LABEL[
                                              record.saleType || "NORMAL"
                                            ]
                                          }
                                        </Tag>
                                      )}
                                    </div>
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<EditOutlined />}
                                      style={{
                                        padding: 0,
                                        fontSize: 12,
                                        color: "#1890ff",
                                      }}
                                      onClick={() => openPriceModal(record)}
                                    >
                                      Tuỳ chỉnh
                                    </Button>
                                  </div>
                                );
                              },
                            },
                            {
                              title: "Đơn vị",
                              dataIndex: "unit",
                              width: 100,
                              align: "center",
                              render: (value: string) =>
                                value && String(value).trim() ? value : "---",
                            },
                            {
                              title: "Thành tiền",
                              dataIndex: "subtotal",
                              align: "right",
                              width: 150,
                              render: (_sub, record: CartItem) => {
                                const amount =
                                  getItemUnitPrice(record) * record.quantity;
                                return (
                                  <Text strong style={{ color: "#1890ff" }}>
                                    {formatPrice(amount)}
                                  </Text>
                                );
                              },
                            },
                            {
                              title: "Hành động",
                              width: 95,
                              align: "center",
                              render: (_, r) => (
                                <Button
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() =>
                                    updateOrderTab((t) => {
                                      t.cart = t.cart.filter(
                                        (i) => i.productId !== r.productId
                                      );
                                    })
                                  }
                                />
                              ),
                            },
                          ]}
                        />
                      </div>
                    ),
                  }))}
                />
              </Card>
            </Col>
          </Row>

          {/* Row 2 - Footer cố định bên dưới */}
          <Row style={{ flexShrink: 0 }}>
            <Col span={24}>
              <div
                style={{
                  background: "#fff",
                  padding: "12px 24px",
                  boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginTop: "5px",
                  borderRadius: "12px 12px 12px 12px",
                }}
              >
                <UserOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                <Text strong>Nhân viên bán hàng:</Text>
                <Select
                  placeholder="Nhân viên bán hàng"
                  value={selectValue}
                  onChange={(value) => {
                    updateOrderTab((tab) => {
                      tab.employeeId = value === "virtual-owner" ? null : value;
                    });
                  }}
                  style={{ width: "350px" }}
                  size="large"
                  allowClear={false} // không cho clear để luôn có người bán
                  // 🔥 Thêm dòng này để giới hạn chiều cao dropdown
                  listHeight={250} // khoảng 7-8 item hiển thị cùng lúc, rất vừa mắt
                  popupMatchSelectWidth={false} // tùy chọn: cho phép dropdown rộng hơn nếu cần
                >
                  {/* Ưu tiên hiển thị chủ cửa hàng ở trên cùng nếu là chủ */}
                  {currentUserEmployee?.isOwner && (
                    <Option value="virtual-owner" key="virtual-owner">
                      <Text strong style={{ color: "#1890ff" }}>
                        {currentUserEmployee.fullName} (Bạn - Chủ cửa hàng)
                      </Text>
                    </Option>
                  )}

                  {/* Danh sách nhân viên thật */}
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      {emp.fullName}
                      {currentUserEmployee?._id === emp._id && " (Bạn)"}
                    </Option>
                  ))}
                </Select>
                <div style={{ flex: 1 }} />
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  © 2025 SmartRetail POS System
                </Text>
              </div>
            </Col>
          </Row>
        </Col>

        {/* CỘT PHẢI - THANH TOÁN (CHIẾM 8/24) */}
        <Col xs={24} md={8} lg={7} xl={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
            styles={{
              body: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: 20,
              },
            }}
          >
            <Title level={5} style={{ marginBottom: 16, color: "#1890ff" }}>
              Thông tin thanh toán
            </Title>

            {/* Tìm khách hàng */}
            <div style={{ position: "relative" }}>
              <div style={{ position: "relative" }}>
                <Input
                  size="large"
                  placeholder="Nhập SĐT khách hàng..."
                  prefix={<UserOutlined />}
                  suffix={
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 1,
                          height: 20,
                          backgroundColor: "#d9d9d9",
                        }}
                      />
                      <PlusOutlined
                        onClick={() => setNewCustomerModal(true)}
                        style={{
                          fontSize: 18,
                          color: "#1890ff",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  }
                  value={phoneInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhoneInput(val);
                    if (!val.trim()) {
                      setFoundCustomers([]);
                      updateOrderTab((tab) => {
                        tab.customer = null;
                      }, activeTab);
                      return;
                    }
                    searchCustomerDebounced(val, activeTab);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowCustomerDropdown(false), 200)
                  }
                  style={{
                    marginBottom: 12,
                    borderRadius: 8,
                  }}
                />
              </div>
              {/* Dropdown danh sách khách */}
              {showCustomerDropdown && (foundCustomers.length > 0 || true) && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 1000,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {/* Nút thêm khách hàng */}
                  <div
                    onClick={() => {
                      setNewCustomerModal(true);
                      setShowCustomerDropdown(false);
                    }}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                      fontWeight: 500,
                      color: "#1890ff",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <UserAddOutlined /> + Thêm khách hàng mới
                  </div>

                  {/* Danh sách kết quả */}
                  {foundCustomers.length > 0 ? (
                    foundCustomers.map((c) => (
                      <div
                        key={c._id}
                        onClick={() => {
                          updateOrderTab((tab) => {
                            tab.customer = c;
                          }, activeTab);
                          setPhoneInput(c.phone);
                          setShowCustomerDropdown(false);
                        }}
                        style={{
                          padding: "10px 14px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f5faff")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#fff")
                        }
                      >
                        <Space direction="vertical" size={0}>
                          <Text strong>{c.name}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {c.phone}
                          </Text>
                        </Space>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: "10px 14px",
                        color: "#999",
                        fontStyle: "italic",
                      }}
                    >
                      Không tìm thấy khách hàng
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phần hiển thị đã chọn khách hàng nào */}
            {currentTab.customer && (
              <div
                style={{
                  background: "#f6ffed",
                  border: "1px solid #b7eb8f",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: 5,
                }}
              >
                <Space>
                  <UserOutlined style={{ color: "#52c41a" }} />
                  <Text strong>{currentTab.customer.name}</Text>
                  <Badge
                    count={`Đã có: ${currentTab.customer.loyaltyPoints} điểm`}
                    style={{ backgroundColor: "#faad14" }}
                  />
                </Space>
              </div>
            )}

            <Divider
              style={{ margin: "5px 0", borderTop: "1px solid #b8b6b6ff" }}
            />

            {/* Tổng tiền và các tùy chọn */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: "15px" }}>Tổng tiền hàng:</Text>
                  <Text type="secondary" style={{ fontSize: "13px" }}>
                    ({currentTab.cart.length} sản phẩm)
                  </Text>
                </div>
                <Text strong style={{ fontSize: "16px" }}>
                  {formatPrice(subtotal)}
                </Text>
              </div>

              {/* Áp dụng điểm */}
              <div
                style={{
                  background: "#fff7e6",
                  borderRadius: "8px",
                  padding: "12px",
                  border: "1px solid #ffd591",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Space>
                    <GiftOutlined style={{ color: "#faad14" }} />
                    <Text style={{ fontWeight: 500 }}>
                      Áp dụng điểm giảm giá:
                    </Text>
                    {/* Thêm icon info + tooltip khi bị disable */}
                    {!loyaltySetting?.isActive && (
                      <Tooltip title="Chương trình tích điểm đang bị tắt trong cài đặt cửa hàng">
                        <InfoCircleOutlined
                          style={{
                            color: "#faad14",
                            fontSize: 14,
                            cursor: "help",
                          }}
                        />
                      </Tooltip>
                    )}
                  </Space>

                  <Switch
                    checked={!!currentTab.usedPointsEnabled}
                    disabled={!loyaltySetting?.isActive}
                    onChange={(checked) => {
                      updateOrderTab((t) => {
                        t.usedPointsEnabled = checked;
                        // Nếu vừa bật mà chưa có điểm thì để 0 để user tự nhập
                        if (checked && t.usedPoints < 0) t.usedPoints = 0;
                      });
                    }}
                  />
                </div>

                {/* Thêm dòng text nhỏ bên dưới khi bị tắt – rất rõ ràng */}
                {!loyaltySetting?.isActive && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      <InfoCircleOutlined
                        style={{ marginRight: 4, color: "#faad14" }}
                      />
                      Chương trình tích điểm hiện đang tắt
                    </Text>
                  </div>
                )}

                {/* Ô nhập điểm */}
                {currentTab.usedPointsEnabled && (
                  <div style={{ marginTop: 12 }}>
                    <InputNumber
                      min={0}
                      max={currentTab.customer?.loyaltyPoints ?? 9999999}
                      value={currentTab.usedPoints}
                      onChange={(val) => {
                        const n = Math.max(0, Math.floor((val as number) || 0));
                        const maxAllowed =
                          currentTab.customer?.loyaltyPoints ?? n;
                        const clamped = Math.min(n, maxAllowed);
                        updateOrderTab((t) => {
                          t.usedPoints = clamped;
                        });
                      }}
                      size="large"
                      style={{ width: "100%" }}
                      placeholder="Nhập số điểm muốn sử dụng"
                      formatter={(v) =>
                        `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(v) =>
                        parseInt((v || "0").toString().replace(/(,*)/g, ""), 10)
                      }
                      addonAfter="điểm"
                    />

                    {/* Gợi ý nhỏ bên dưới input */}
                    {currentTab.customer && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {`Khách hiện có ${currentTab.customer.loyaltyPoints.toLocaleString()} điểm khả dụng`}
                      </Text>
                    )}
                  </div>
                )}
              </div>

              {discount > 0 && (
                <div
                  style={{
                    background: "#f6ffed",
                    border: "1px solid #b7eb8f",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#389e0d" }}>
                      Giảm giá từ điểm tích lũy:
                    </Text>
                    <Text strong style={{ color: "#389e0d", fontSize: 16 }}>
                      -{formatPrice(discount)}
                    </Text>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#52c41a",
                      textAlign: "right",
                    }}
                  >
                    Tỷ lệ quy đổi:{" "}
                    <Text strong>
                      {loyaltySetting?.vndPerPoint?.toLocaleString()}đ
                    </Text>{" "}
                    / điểm
                  </div>
                </div>
              )}

              {/* VAT */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text>VAT 10%:</Text>
                <Switch
                  checked={currentTab.isVAT}
                  onChange={(c) =>
                    updateOrderTab((t) => {
                      t.isVAT = c;
                    })
                  }
                />
              </div>

              {currentTab.isVAT && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#fa8c16",
                  }}
                >
                  <Text style={{ color: "#fa8c16" }}>+ VAT:</Text>
                  <Text strong style={{ color: "#fa8c16" }}>
                    {formatPrice(vatAmount)}
                  </Text>
                </div>
              )}

              <Divider
                style={{ margin: "5px 0", borderTop: "1px solid #b8b6b6ff" }}
              />

              {/* Khách phải trả */}
              <div
                style={{
                  background: "#e6f7ff",
                  borderRadius: "8px",
                  padding: "10px",
                  border: "2px solid #1890ff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text strong style={{ fontSize: "15px" }}>
                    Khách phải trả:
                  </Text>
                  <Text strong style={{ fontSize: "22px", color: "#1890ff" }}>
                    {formatPrice(totalAmount)}
                  </Text>
                </div>
              </div>

              <Divider
                style={{ margin: "1px 0", borderTop: "1px solid #b8b6b6ff" }}
              />

              {/* Phương thức thanh toán */}
              <div>
                <Text strong>Phương thức thanh toán: </Text>
              </div>
              <Space style={{ width: "100%", marginTop: -5 }}>
                <Button
                  icon={<DollarOutlined />}
                  onClick={() =>
                    updateOrderTab((t) => {
                      t.paymentMethod = "cash";
                    })
                  }
                  type={
                    currentTab.paymentMethod === "cash" ? "primary" : "default"
                  }
                  size="large"
                  style={{ flex: 1, borderRadius: "8px" }}
                >
                  Tiền mặt
                </Button>
                <Button
                  icon={<QrcodeOutlined />}
                  onClick={() =>
                    updateOrderTab((t) => {
                      t.paymentMethod = "qr";
                    })
                  }
                  type={
                    currentTab.paymentMethod === "qr" ? "primary" : "default"
                  }
                  size="large"
                  style={{ flex: 1, borderRadius: "8px" }}
                >
                  QR Code
                </Button>
              </Space>

              {/* Tiền khách đưa (nếu chọn tiền mặt) */}
              {currentTab.paymentMethod === "cash" && (
                <>
                  <div style={{ marginTop: 5 }}>
                    <Text style={{ display: "block", marginBottom: 8 }}>
                      Tiền khách đưa:
                    </Text>
                    <InputNumber
                      min={0}
                      value={currentTab.cashReceived}
                      onChange={(v) =>
                        updateOrderTab((t) => {
                          t.cashReceived = v || 0;
                        })
                      }
                      formatter={(v) =>
                        `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(v) =>
                        parseFloat(v?.replace(/\$\s?|(,*)/g, "") || "0")
                      }
                      size="large"
                      style={{ width: "100%" }}
                      addonAfter="đ"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      background: changeAmount >= 0 ? "#f6ffed" : "#fff1f0",
                      padding: "10px",
                      borderRadius: "8px",
                      border:
                        changeAmount >= 0
                          ? "1px solid #b7eb8f"
                          : "1px solid #ffa39e",
                    }}
                  >
                    <Text
                      strong
                      style={{
                        color: changeAmount >= 0 ? "#52c41a" : "#ff4d4f",
                      }}
                    >
                      Tiền thừa trả khách:
                    </Text>
                    <Text
                      strong
                      style={{
                        fontSize: "18px",
                        color: changeAmount >= 0 ? "#52c41a" : "#ff4d4f",
                      }}
                    >
                      {changeAmount >= 0 ? formatPrice(changeAmount) : "0đ"}
                    </Text>
                  </div>
                </>
              )}

              {/* Nút tạo đơn */}
              <Button
                type="primary"
                size="large"
                block
                loading={loading}
                onClick={createOrder}
                disabled={!!currentTab.pendingOrderId} // 🔴 Disable khi đã tạo đơn (per-tab)
                style={{
                  marginTop: 12,
                  height: "40px",
                  fontSize: "16px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  background: currentTab.pendingOrderId ? "#ccc" : "#1890ff",
                  border: "none",
                  cursor: currentTab.pendingOrderId ? "not-allowed" : "pointer",
                }}
              >
                {currentTab.paymentMethod === "qr"
                  ? "Tạo QR Thanh Toán"
                  : "Tạo Đơn Hàng"}
              </Button>

              {/* Tiếp tục thanh toán QR - Show khi đã tạo đơn QR */}
              {currentTab.pendingOrderId &&
                currentTab.paymentMethod === "qr" &&
                !currentTab.qrImageUrl && (
                  <Button
                    type="default"
                    size="large"
                    block
                    onClick={() => {
                      // 🟢 Restore từ saved QR data
                      if (currentTab.savedQrImageUrl) {
                        updateOrderTab((tab) => {
                          tab.qrImageUrl = tab.savedQrImageUrl;
                          tab.qrPayload = tab.savedQrPayload;
                          tab.qrExpiryTs = tab.savedQrExpiryTs;
                        });
                      } else {
                        Swal.fire({
                          icon: "warning",
                          title: "QR không hợp lệ",
                          text: "QR đã hết hạn hoặc không có dữ liệu, vui lòng tạo QR mới",
                          confirmButtonText: "Đã hiểu",
                        });
                      }
                    }}
                    style={{
                      marginTop: 8,
                      height: "45px",
                      fontSize: "15px",
                      fontWeight: 500,
                      borderRadius: "8px",
                      border: "1px solid #1890ff",
                      color: "#1890ff",
                    }}
                  >
                    📱 Tiếp tục thanh toán QR
                  </Button>
                )}

              {/* Xác nhận thanh toán tiền mặt */}
              {currentTab.pendingOrderId &&
                currentTab.paymentMethod === "cash" && (
                  <Popconfirm
                    title={`Xác nhận khách đã đưa ${formatPrice(totalAmount)}?`}
                    onConfirm={async () => {
                      try {
                        await axios.post(
                          `${API_BASE}/orders/${currentTab.pendingOrderId}/set-paid-cash`,
                          {},
                          { headers }
                        );
                        setBillModalOpen(true);
                      } catch (err: any) {
                        Swal.fire({
                          title: "❌ Lỗi!",
                          text: "Lỗi xác nhận thanh toán",
                          icon: "error",
                          confirmButtonText: "OK",
                          confirmButtonColor: "#ff4d4f",
                          timer: 2000,
                        });
                      }
                    }}
                  >
                    <Button
                      type="primary"
                      danger
                      size="large"
                      block
                      style={{
                        height: "50px",
                        fontSize: "16px",
                        fontWeight: 600,
                        borderRadius: "8px",
                      }}
                    >
                      Xác Nhận Thanh Toán Tiền Mặt
                    </Button>
                  </Popconfirm>
                )}
            </div>
          </Card>
        </Col>
      </Row>
      {/* Modal tạo khách hàng mới */}
      <ModalCustomerAdd
        open={newCustomerModal}
        onCancel={() => setNewCustomerModal(false)}
        loading={loading}
        onCreate={async (values) => {
          try {
            const res = await axios.post(`${API_BASE}/customers`, values, {
              headers,
            });
            updateOrderTab((tab) => {
              tab.customer = res.data.customer;
            });
            setPhoneInput(res.data.customer.phone);
            Swal.fire({
              title: "🎉 Thành công!",
              text: "Tạo khách hàng mới thành công",
              icon: "success",
              confirmButtonText: "OK",
              confirmButtonColor: "#52c41a",
            });

            setNewCustomerModal(false);
          } catch (err) {
            Swal.fire({
              title: "❌ Lỗi!",
              text: "Lỗi tạo khách hàng",
              icon: "error",
              confirmButtonText: "OK",
              confirmButtonColor: "#ff4d4f",
              timer: 2000,
            });
          }
        }}
      />
      <Modal
        open={!!(currentTab.qrImageUrl || currentTab.qrPayload)}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              updateOrderTab((tab) => {
                tab.qrImageUrl = null;
                tab.qrPayload = null;
                tab.qrExpiryTs = null;
              });
            }}
          >
            Huỷ
          </Button>,
          <Button
            key="print"
            loading={isPrinting} // ✅ HIỂN THỊ LOADING
            disabled={isPrinting} // ✅ DISABLE KHI ĐANG IN
            type="primary"
            danger
            onClick={() => {
              if (currentTab.pendingOrderId) {
                // 🔴 Call API set-paid-QR + in bill trong 1 request
                (async () => {
                  try {
                    await axios.post(
                      `${API_BASE}/orders/${currentTab.pendingOrderId}/print-bill`,
                      {},
                      { headers }
                    );
                    // Reset QR
                    updateOrderTab((tab) => {
                      tab.qrImageUrl = null;
                      tab.qrPayload = null;
                      tab.qrExpiryTs = null;
                    });
                    setBillModalOpen(true);
                  } catch (err: any) {
                    Swal.fire({
                      icon: "error",
                      title: "In hoá đơn thất bại",
                      text: err.response?.data?.message || "Lỗi khi in hoá đơn",
                      confirmButtonText: "OK",
                    });
                  }
                })();
              }
            }}
            style={{ background: "#ff7a45", borderColor: "#ff7a45" }}
          >
            {isPrinting ? "Đang in..." : "In Hóa Đơn & Xác Nhận Thanh Toán"}
          </Button>,
        ]}
        onCancel={() => {
          updateOrderTab((tab) => {
            tab.qrImageUrl = null;
            tab.qrPayload = null;
            tab.qrExpiryTs = null;
          });
        }}
        centered
        width={600}
      >
        <div style={{ textAlign: "center", padding: "25px" }}>
          <Title level={3} style={{ marginBottom: 20, color: "#1890ff" }}>
            <QrcodeOutlined /> Quét mã thanh toán
          </Title>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 10,
              padding: "10px",
            }}
          >
            {currentTab.qrImageUrl ? (
              <img
                src={currentTab.qrImageUrl}
                alt="QR code"
                style={{ width: 410, height: 410 }}
              />
            ) : currentTab.qrPayload ? (
              <QRCode value={currentTab.qrPayload} size={410} />
            ) : null}
          </div>
          {currentTab.qrExpiryTs && (
            <div
              style={{
                background: "#fff7e6",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ffd591",
              }}
            >
              <Text strong>Thời gian còn lại: </Text>
              <Countdown
                value={currentTab.qrExpiryTs}
                format="mm:ss"
                onFinish={() => {
                  Swal.fire({
                    title: "⚠️ Cảnh báo!",
                    text: "QR đã hết hạn",
                    icon: "warning",
                    confirmButtonText: "OK",
                    confirmButtonColor: "#faad14",
                    timer: 2000,
                  });

                  updateOrderTab((tab) => {
                    tab.qrImageUrl = null;
                    tab.qrPayload = null;
                    tab.qrExpiryTs = null;
                  });
                }}
                valueStyle={{ fontSize: "24px", color: "#faad14" }}
              />
            </div>
          )}
        </div>
      </Modal>
      {/* Modal in hóa đơn */}
      <ModalPrintBill
        open={billModalOpen}
        onCancel={() => {
          setBillModalOpen(false);
          resetCurrentTab(); // Reset tab (sẽ clear tất cả per-tab data)
        }}
        onPrint={() => {
          if (currentTab.pendingOrderId) {
            triggerPrint(currentTab.pendingOrderId);
          }
        }}
        orderId={currentTab.pendingOrderId || undefined}
        createdAt={currentTab.orderCreatedAt}
        printCount={currentTab.orderPrintCount}
        earnedPoints={currentTab.orderEarnedPoints}
        cart={currentTab.cart}
        totalAmount={totalAmount}
        storeName={currentStore.name || "Cửa hàng"}
        address={currentStore?.address || ""}
        employeeName={currentEmployeeName}
        customerName={currentCustomerName}
        customerPhone={currentCustomerPhone}
        paymentMethod={currentTab.paymentMethod}
      />

      <Modal
        title="Tuỳ chỉnh giá bán"
        open={priceEditModal.visible}
        onCancel={() => setPriceEditModal({ visible: false })}
        onOk={() => {
          if (!priceEditModal.item || !priceEditModal.tempSaleType) return;

          let finalPrice = 0;
          if (priceEditModal.tempSaleType === "FREE") {
            finalPrice = 0;
          } else if (priceEditModal.tempSaleType === "AT_COST") {
            finalPrice = getPriceNumber(
              priceEditModal.item.cost_price || priceEditModal.item.price
            );
          } else if (
            priceEditModal.tempOverridePrice !== null &&
            priceEditModal.tempOverridePrice !== undefined
          ) {
            finalPrice = priceEditModal.tempOverridePrice;
          } else {
            finalPrice = getPriceNumber(priceEditModal.item.price);
          }

          const newSubtotal = (
            finalPrice * priceEditModal.item.quantity
          ).toFixed(2);

          updateOrderTab((tab) => {
            tab.cart = tab.cart.map((i) =>
              i.productId === priceEditModal.item!.productId
                ? {
                    ...i,
                    saleType: priceEditModal.tempSaleType!,
                    overridePrice:
                      priceEditModal.tempSaleType === "NORMAL"
                        ? null
                        : finalPrice,
                    subtotal: newSubtotal,
                  }
                : i
            );
          });

          setPriceEditModal({ visible: false });
        }}
      >
        {priceEditModal.item && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space
              style={{ width: "100%", justifyContent: "space-between" }}
              align="center"
            >
              <Text strong>
                Sản phẩm: <Tag color="blue">{priceEditModal.item.name}</Tag>
              </Text>
              <Text style={{ color: "#1677ff" }}>
                Số lượng: {priceEditModal.item.quantity}{" "}
                {priceEditModal.item.unit}
              </Text>
            </Space>

            <Select
              style={{ width: "100%" }}
              value={priceEditModal.tempSaleType}
              onChange={(value) => {
                setPriceEditModal((prev) => ({
                  ...prev,
                  tempSaleType: value,
                  tempOverridePrice:
                    value === "FREE"
                      ? 0
                      : value === "AT_COST"
                      ? getPriceNumber(
                          prev.item!.cost_price || prev.item!.price
                        )
                      : value === "NORMAL"
                      ? null
                      : prev.tempOverridePrice,
                }));
              }}
            >
              <Option value="NORMAL">
                Giá niêm yết ({formatPrice(priceEditModal.item.price)})
              </Option>
              <Option value="VIP">Giá ưu đãi (nhập tay)</Option>
              <Option value="AT_COST">
                Giá vốn (
                {formatPrice(getPriceNumber(priceEditModal.item.cost_price))})
              </Option>
              <Option value="CLEARANCE">Xả kho (nhập tay)</Option>
              <Option value="FREE">Miễn phí (0đ)</Option>
            </Select>

            {["VIP", "CLEARANCE"].includes(
              priceEditModal.tempSaleType || "NORMAL"
            ) && (
              <InputNumber
                style={{ width: "100%" }}
                value={priceEditModal.tempOverridePrice ?? undefined}
                onChange={(v) => {
                  setPriceEditModal((prev) => ({
                    ...prev,
                    tempOverridePrice: v ?? 0,
                  }));
                }}
                min={0} // không cho nhập âm trực tiếp
                precision={0} // buộc là số nguyên, không cho thập phân
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, "") || 0)}
                addonAfter="đ"
                placeholder="Nhập giá mới"
              />
            )}

            <div
              style={{
                marginTop: 16,
                padding: "8px 12px",
                background: "#f5f5f5",
                borderRadius: 6,
              }}
            >
              <Text strong>Thành tiền sau thay đổi:</Text>
              <br />
              <Text type="success" style={{ fontSize: 18 }}>
                {(priceEditModal.tempOverridePrice !== null &&
                priceEditModal.tempOverridePrice !== undefined
                  ? priceEditModal.tempOverridePrice
                  : priceEditModal.tempSaleType === "FREE"
                  ? 0
                  : priceEditModal.tempSaleType === "AT_COST"
                  ? getPriceNumber(
                      priceEditModal.item.cost_price ||
                        priceEditModal.item.price
                    )
                  : getPriceNumber(priceEditModal.item.price)) *
                  priceEditModal.item.quantity}
                {" đ"}
              </Text>
            </div>
          </Space>
        )}
      </Modal>
      {/* ======================== Hết các Modal ======================== */}
    </div>
  );
};

// Hàm debounce để giảm số lần gọi API
function debounce<F extends (...args: any[]) => any>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default OrderPOSHome;
