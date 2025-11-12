// src/pages/order/OrderPOSHome.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Table,
  Input,
  Button,
  Modal,
  message,
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
} from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  PrinterOutlined,
  DollarOutlined,
  QrcodeOutlined,
  UserOutlined,
  GiftOutlined,
  FileTextOutlined,
  UserAddOutlined,
  ShopOutlined,
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

const API_BASE = "http://localhost:9999/api";
const SOCKET_URL = "http://localhost:9999";

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: any;
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
  user_id: { username: string };
}

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: any;
  unit: string;
  quantity: number;
  subtotal: string;
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
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);

  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrExpiryTs, setQrExpiryTs] = useState<number | null>(null);

  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [orderCreatedAt, setOrderCreatedAt] = useState<string>(""); // ngày tạo order
  const [orderPrintCount, setOrderPrintCount] = useState<number>(0); // số lần in
  const [orderEarnedPoints, setOrderEarnedPoints] = useState<number>(0); // điểm tích

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

  // Socket - Kết nối socket để nhận thông báo thanh toán
  useEffect(() => {
    const s = io(SOCKET_URL, { auth: { token } });
    setSocket(s);
    s.on("payment_success", (data) => {
      message.success("Thanh toán QR thành công!");
      setPendingOrderId(data.ref || data.orderId);
      setBillModalOpen(true);
    });
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

  // Load danh sách nhân viên
  const loadEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/stores/${storeId}/employees?deleted=false`, { headers });
      setEmployees(res.data.employees || []);
    } catch (err) {
      message.error("Không tải được nhân viên");
    }
  };

  // Load cài đặt loyalty
  const loadLoyaltySetting = async () => {
    try {
      const res = await axios.get(`${API_BASE}/loyaltys/config/${storeId}`, { headers });
      if (res.data.isConfigured && res.data.config.isActive) {
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
          `${API_BASE}/products/search?query=${encodeURIComponent(query)}&storeId=${storeId}`,
          { headers }
        );
        setSearchedProducts(res.data.products || []);
      } catch (err) {
        message.error("Không tìm thấy sản phẩm");
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
            ? { ...item, quantity: newQty, subtotal: (newQty * priceNum).toFixed(2) }
            : item
        );
      } else {
        tab.cart = [
          ...tab.cart,
          {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            unit: product.unit,
            quantity: 1,
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
      const priceNum = getPriceNumber(item.price);
      if (qty <= 0) {
        tab.cart = tab.cart.filter((i) => i.productId !== id);
      } else {
        tab.cart = tab.cart.map((i) =>
          i.productId === id ? { ...i, quantity: qty, subtotal: (qty * priceNum).toFixed(2) } : i
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
  const updateOrderTab = (updater: (tab: OrderTab) => void, key = activeTab) => {
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
        employeeId: null,
        usedPoints: 0,
        usedPointsEnabled: false,
        isVAT: false,
        paymentMethod: "cash",
        cashReceived: 0,
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

  // Tính toán các giá trị thanh toán
  const subtotal = useMemo(
    () => currentTab.cart.reduce((sum, item) => sum + getPriceNumber(item.price) * item.quantity, 0),
    [currentTab.cart]
  );
  const discount = useMemo(
    () => (currentTab.usedPointsEnabled ? currentTab.usedPoints * (loyaltySetting?.vndPerPoint || 0) : 0),
    [currentTab.usedPoints, currentTab.usedPointsEnabled, loyaltySetting?.vndPerPoint]
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

    if (!currentTab.employeeId)
      return Swal.fire({
        icon: "warning",
        title: "Vui lòng chọn nhân viên",
        confirmButtonText: "OK",
      });

    setLoading(true);
    try {
      const items = currentTab.cart.map((item) => ({ productId: item.productId, quantity: item.quantity }));

      // Build payload conditionally
      const payload: any = {
        storeId,
        employeeId: currentTab.employeeId,
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
      if (currentTab.usedPointsEnabled && currentTab.usedPoints && currentTab.usedPoints > 0) {
        payload.usedPoints = currentTab.usedPoints;
      }

      const res = await axios.post<OrderResponse>(`${API_BASE}/orders`, payload, { headers });
      const order = res.data.order;
      const orderId = order._id;

      // set thông tin cho modal in hóa đơn (an toàn với undefined/null)
      setPendingOrderId(orderId);
      setOrderCreatedAt(order.createdAt || "");
      setOrderPrintCount(typeof order.printCount === "number" ? order.printCount : 0);
      setOrderEarnedPoints((order as any).earnedPoints ?? 0);

      if (currentTab.paymentMethod === "qr" && res.data.qrDataURL) {
        setQrImageUrl(res.data.qrDataURL);
        setQrExpiryTs(res.data.order?.qrExpiry ? new Date(res.data.order.qrExpiry).getTime() : null);
        setPendingOrderId(orderId);
        message.success("QR đã tạo, chờ thanh toán...");
      } else {
        setPendingOrderId(orderId);
        message.success("Đơn hàng đã tạo! Vui lòng xác nhận thanh toán tiền mặt.");
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || "Lỗi tạo đơn");
    } finally {
      setLoading(false);
    }
  };

  // In hóa đơn
  const triggerPrint = async (orderId: string) => {
    try {
      await axios.post(`${API_BASE}/orders/${orderId}/print-bill`, {}, { headers });
      setBillModalOpen(true);
    } catch (err: any) {
      message.error("Lỗi in hóa đơn");
    }
  };

  const currentEmployeeName = employees.find((e) => e._id === currentTab.employeeId)?.fullName || "N/A";
  const currentCustomerName = currentTab?.customer?.name || "Khách vãng lai";
  const currentCustomerPhone = currentTab?.customer?.phone || "Không có";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f2f5", overflow: "hidden" }}
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
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
          <ShopOutlined style={{ fontSize: 28, color: "#fff" }} />
          <div>
            <Title level={4} style={{ margin: 0, color: "#fff", fontSize: "20px" }}>
              {currentStore.name || "Cửa Hàng"}
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px" }}>Hệ thống bán hàng POS</Text>
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
            transform: `translateX(-50%) ${searchedProducts.length > 0 ? "translateY(0)" : "translateY(-5px)"}`,
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
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5faff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Text strong style={{ fontSize: "15px", color: "#000" }}>
                    {prod.name}
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      Mã SKU: {prod.sku}
                    </Text>
                    <Text type="secondary" style={{ fontSize: "12px", marginLeft: 12 }}>
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
        <Col xs={24} md={16} lg={17} xl={18} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
                    else if (action === "remove") removeOrderTab(targetKey as string);
                  }}
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                  items={orders.map((tab) => ({
                    key: tab.key,
                    label: <span style={{ fontWeight: 600 }}>Đơn {tab.key}</span>,
                    closable: orders.length > 1,
                    children: (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                        <Table
                          dataSource={tab.cart.map((item, i) => ({ ...item, stt: i + 1 }))}
                          pagination={false}
                          size="middle"
                          scroll={{ y: "calc(100vh - 420px)" }}
                          style={{ flex: 1 }}
                          columns={[
                            { title: "STT", dataIndex: "stt", width: 60, align: "center" },
                            { title: "SKU", dataIndex: "sku", width: 150, render: (text) => <Text code>{text}</Text> },
                            {
                              title: "Tên sản phẩm",
                              dataIndex: "name",
                              ellipsis: true,
                              width: 300,
                              render: (text) => <Text strong>{text}</Text>,
                            },
                            { title: "Đơn vị", dataIndex: "unit", width: 100, align: "center" },
                            {
                              title: "Số lượng",
                              width: 120,
                              align: "center",
                              render: (_, r) => (
                                <InputNumber
                                  min={1}
                                  value={r.quantity}
                                  onChange={(v) => updateQuantity(r.productId, v || 1)}
                                  style={{ width: "100%" }}
                                />
                              ),
                            },
                            {
                              title: "Đơn giá",
                              dataIndex: "price",
                              align: "right",
                              width: 140,
                              render: (price) => <Text>{formatPrice(price)}</Text>,
                            },
                            {
                              title: "Thành tiền",
                              dataIndex: "subtotal",
                              align: "right",
                              width: 160,
                              render: (price) => (
                                <Text strong style={{ color: "#1890ff" }}>
                                  {formatPrice(price)}
                                </Text>
                              ),
                            },
                            {
                              title: "Hành động",
                              width: 120,
                              align: "center",
                              render: (_, r) => (
                                <Button
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() =>
                                    updateOrderTab((t) => {
                                      t.cart = t.cart.filter((i) => i.productId !== r.productId);
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
                  placeholder="Chọn nhân viên"
                  value={currentTab.employeeId}
                  onChange={(v) =>
                    updateOrderTab((t) => {
                      t.employeeId = v;
                    })
                  }
                  style={{ width: 300 }}
                  size="large"
                >
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      {emp.fullName} ({emp.user_id?.username})
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
              body: { flex: 1, display: "flex", flexDirection: "column", padding: 20 },
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
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
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f5faff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
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
                    <div style={{ padding: "10px 14px", color: "#999", fontStyle: "italic" }}>
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
                  marginBottom: 16,
                }}
              >
                <Space>
                  <UserOutlined style={{ color: "#52c41a" }} />
                  <Text strong>{currentTab.customer.name}</Text>
                  <Badge count={`${currentTab.customer.loyaltyPoints} điểm`} style={{ backgroundColor: "#faad14" }} />
                </Space>
              </div>
            )}

            <Divider style={{ margin: "12px 0" }} />

            {/* Tổng tiền và các tùy chọn */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Space>
                    <GiftOutlined style={{ color: "#faad14" }} />
                    <Text style={{ fontWeight: 500 }}>Áp dụng điểm giảm giá:</Text>
                  </Space>

                  <Switch
                    checked={!!currentTab.usedPointsEnabled}
                    onChange={(checked) => {
                      updateOrderTab((t) => {
                        t.usedPointsEnabled = checked;
                        // Nếu vừa bật mà chưa có điểm thì để 0 để user tự nhập
                        if (checked && t.usedPoints < 0) t.usedPoints = 0;
                      });
                    }}
                  />
                </div>

                {/* Ô nhập điểm */}
                {currentTab.usedPointsEnabled && (
                  <div style={{ marginTop: 12 }}>
                    <InputNumber
                      min={0}
                      max={currentTab.customer?.loyaltyPoints ?? 9999999}
                      value={currentTab.usedPoints}
                      onChange={(val) => {
                        const n = Math.max(0, Math.floor((val as number) || 0));
                        const maxAllowed = currentTab.customer?.loyaltyPoints ?? n;
                        const clamped = Math.min(n, maxAllowed);
                        updateOrderTab((t) => {
                          t.usedPoints = clamped;
                        });
                      }}
                      size="large"
                      style={{ width: "100%" }}
                      placeholder="Nhập số điểm muốn sử dụng"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      parser={(v) => parseInt((v || "0").toString().replace(/(,*)/g, ""), 10)}
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: "#389e0d" }}>Giảm giá từ điểm tích lũy:</Text>
                    <Text strong style={{ color: "#389e0d", fontSize: 16 }}>
                      -{formatPrice(discount)}
                    </Text>
                  </div>
                  <div style={{ fontSize: 13, color: "#52c41a", textAlign: "right" }}>
                    Tỷ lệ quy đổi: <Text strong>{loyaltySetting?.vndPerPoint?.toLocaleString()}đ</Text> / điểm
                  </div>
                </div>
              )}

              {/* VAT */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", color: "#fa8c16" }}>
                  <Text style={{ color: "#fa8c16" }}>+ VAT:</Text>
                  <Text strong style={{ color: "#fa8c16" }}>
                    {formatPrice(vatAmount)}
                  </Text>
                </div>
              )}

              <Divider style={{ margin: "8px 0" }} />

              {/* Khách phải trả */}
              <div
                style={{
                  background: "#e6f7ff",
                  borderRadius: "8px",
                  padding: "16px",
                  border: "2px solid #1890ff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text strong style={{ fontSize: "16px" }}>
                    Khách phải trả:
                  </Text>
                  <Text strong style={{ fontSize: "24px", color: "#1890ff" }}>
                    {formatPrice(totalAmount)}
                  </Text>
                </div>
              </div>

              {/* Phương thức thanh toán */}
              <Space style={{ width: "100%", marginTop: 8 }}>
                <Button
                  icon={<DollarOutlined />}
                  onClick={() =>
                    updateOrderTab((t) => {
                      t.paymentMethod = "cash";
                    })
                  }
                  type={currentTab.paymentMethod === "cash" ? "primary" : "default"}
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
                  type={currentTab.paymentMethod === "qr" ? "primary" : "default"}
                  size="large"
                  style={{ flex: 1, borderRadius: "8px" }}
                >
                  QR Code
                </Button>
              </Space>

              {/* Tiền khách đưa (nếu chọn tiền mặt) */}
              {currentTab.paymentMethod === "cash" && (
                <>
                  <div style={{ marginTop: 8 }}>
                    <Text style={{ display: "block", marginBottom: 8 }}>Tiền khách đưa:</Text>
                    <InputNumber
                      min={0}
                      value={currentTab.cashReceived}
                      onChange={(v) =>
                        updateOrderTab((t) => {
                          t.cashReceived = v || 0;
                        })
                      }
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      parser={(v) => parseFloat(v?.replace(/\$\s?|(,*)/g, "") || "0")}
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
                      padding: "12px",
                      borderRadius: "8px",
                      border: changeAmount >= 0 ? "1px solid #b7eb8f" : "1px solid #ffa39e",
                    }}
                  >
                    <Text strong style={{ color: changeAmount >= 0 ? "#52c41a" : "#ff4d4f" }}>
                      Tiền thừa:
                    </Text>
                    <Text strong style={{ fontSize: "18px", color: changeAmount >= 0 ? "#52c41a" : "#ff4d4f" }}>
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
                style={{
                  marginTop: 12,
                  height: "50px",
                  fontSize: "16px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                }}
              >
                {currentTab.paymentMethod === "qr" ? "Tạo QR Thanh Toán" : "Tạo Đơn Hàng"}
              </Button>

              {/* Xác nhận thanh toán tiền mặt */}
              {pendingOrderId && currentTab.paymentMethod === "cash" && (
                <Popconfirm
                  title={`Xác nhận khách đã đưa ${formatPrice(totalAmount)}?`}
                  onConfirm={async () => {
                    try {
                      await axios.post(`${API_BASE}/orders/${pendingOrderId}/set-paid-cash`, {}, { headers });
                      setBillModalOpen(true);
                      message.success("Đã xác nhận thanh toán! Vui lòng in hóa đơn.");
                    } catch (err: any) {
                      message.error("Lỗi xác nhận thanh toán");
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
            const res = await axios.post(`${API_BASE}/customers`, values, { headers });
            updateOrderTab((tab) => {
              tab.customer = res.data.customer;
            });
            setPhoneInput(res.data.customer.phone);
            message.success("Tạo khách hàng mới thành công");
            setNewCustomerModal(false);
          } catch (err) {
            message.error("Lỗi tạo khách hàng");
          }
        }}
      />

      {/* Modal QR Code */}
      <Modal
        open={!!(qrImageUrl || qrPayload)}
        footer={null}
        onCancel={() => {
          setQrImageUrl(null);
          setQrPayload(null);
          setQrExpiryTs(null);
        }}
        centered
        width={400}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Title level={3} style={{ marginBottom: 20, color: "#1890ff" }}>
            <QrcodeOutlined /> Quét mã thanh toán
          </Title>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
              padding: "20px",
              background: "#f5f5f5",
              borderRadius: "12px",
            }}
          >
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="QR code" style={{ width: 256, height: 256 }} />
            ) : qrPayload ? (
              <QRCode value={qrPayload} size={256} />
            ) : null}
          </div>
          {qrExpiryTs && (
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
                value={qrExpiryTs}
                format="mm:ss"
                onFinish={() => {
                  message.warning("QR hết hạn");
                  setQrImageUrl(null);
                  setQrPayload(null);
                  setQrExpiryTs(null);
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
        onCancel={() => setBillModalOpen(false)}
        onPrint={() => {
          if (pendingOrderId) {
            triggerPrint(pendingOrderId);
          }
        }}
        orderId={pendingOrderId || undefined}
        createdAt={orderCreatedAt}
        printCount={orderPrintCount}
        earnedPoints={orderEarnedPoints}
        cart={currentTab.cart}
        totalAmount={totalAmount}
        storeName={currentStore.name || "Cửa hàng"}
        address={currentStore?.address || ""}
        employeeName={currentEmployeeName}
        customerName={currentCustomerName}
        customerPhone={currentCustomerPhone}
        paymentMethod={currentTab.paymentMethod}
      />
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
