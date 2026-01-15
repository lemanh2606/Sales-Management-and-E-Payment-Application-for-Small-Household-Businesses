// src/pages/settings/PaymentGatewaySettings.tsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Modal,
  Form,
  Input,
  Steps,
  Space,
  Empty,
  Typography,
  InputNumber,
  Tag,
  Alert,
  Divider,
  message,
  Spin,
  Image,
  Select,
  Pagination,
  Checkbox,
} from "antd";
import {
  BankOutlined,
  UserAddOutlined,
  CreditCardOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CaretDownOutlined,
  QrcodeOutlined,
  SafetyOutlined,
  StarOutlined,
  CopyOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import axios from "axios";
import Layout from "../../components/Layout";
import debounce from "../../utils/debounce";
import Swal from "sweetalert2";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// ===== INTERFACES =====
interface BankEntry {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrTemplate?: string;
  logo?: string;
  isDefault?: boolean;
  connectedAt?: string;
  updatedAt?: string;
}
const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl}/stores-config-payment`;

// ===== COMPONENT =====
const PaymentGatewaySettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<BankEntry[]>([]);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [selectedBankTemplate, setSelectedBankTemplate] = useState<any>(null);
  const [vietQrBanks, setVietQrBanks] = useState<any[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [editingBank, setEditingBank] = useState<BankEntry | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<BankEntry | null>(null);
  const [searchText, setSearchText] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 8 });
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [disablePayOSModal, setDisablePayOSModal] = useState(false);
  const [qrData, setQrData] = useState<{
    qrUrl: string;
    amount: number;
  } | null>(null);
  const [form] = Form.useForm();
  const [qrForm] = Form.useForm();
  const [expanded, setExpanded] = useState(false);

  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!storeId) {
      Swal.fire({
        icon: "warning",
        title: "Chưa chọn cửa hàng",
        text: "Vui lòng chọn cửa hàng trước khi cấu hình thanh toán.",
      });
      return;
    }
    fetchBanks();
    // eslint-disable-next-line
  }, [storeId]);

  //Fetch danh sách ngân hàng VietQR
  useEffect(() => {
    const fetchVietQrBanks = async () => {
      try {
        setBanksLoading(true);
        const res = await axios.get("https://api.vietqr.io/v2/banks");
        if (res.data.code === "00") {
          setVietQrBanks(res.data.data);
        }
      } catch (err) {
        console.error("Lỗi load danh sách ngân hàng VietQR:", err);
        message.error("Không tải được danh sách ngân hàng VietQR");
      } finally {
        setBanksLoading(false);
      }
    };
    fetchVietQrBanks();
  }, []);

  // Fetch webhook config
  async function fetchPaymentConfig() {
    if (!storeId) return;
    try {
      const res = await axios.get(`${API_BASE}/${storeId}/config`, { headers });
      if (res.data?.success) {
        const config = res.data.data;
        setWebhookConfig(config); // giờ có cả payos + webhook
        // Nếu muốn giữ form cũ thì vẫn set webhookForm nếu cần
      }
    } catch (err: any) {
      console.error("Lỗi load config:", err);
    }
  }

  // Load webhook & banks together
  useEffect(() => {
    if (storeId) {
      fetchBanks();
      fetchPaymentConfig();
    }
  }, [storeId]);

  // Fetch banks
  async function fetchBanks() {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/${storeId}/banks`, { headers });

      if (res.data?.success) {
        setBanks(res.data.data || []);
      }
    } catch (err: any) {
      console.error("fetchBanks error:", err);

      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err?.response?.data?.message || "Lỗi tải danh sách ngân hàng",
        showCancelButton: true,
        cancelButtonText: "Đóng",
        showConfirmButton: false,
      });
    } finally {
      setLoading(false);
    }
  }

  // Check if bank template is connected
  const isBankConnected = (bankCode: string): BankEntry | null => {
    return banks.find((b) => b.bankCode === bankCode) || null;
  };

  // Open add modal
  const handleOpenLinkModal = (bank: any) => {
    const connected = banks.find((b) => b.bankCode === bank.code);

    if (connected) {
      // Edit mode
      setEditingBank(connected);
      form.setFieldsValue({
        bankCode: connected.bankCode,
        bankName: connected.bankName || bank.shortName,
        accountNumber: connected.accountNumber,
        accountName: connected.accountName,
        qrTemplate: connected.qrTemplate || "compact2",
        isDefault: connected.isDefault,
      });
    } else {
      // Add mode
      setEditingBank(null);
      form.setFieldsValue({
        bankCode: bank.code,
        bankName: bank.shortName,
        qrTemplate: "compact2",
      });
    }
    setSelectedBankTemplate(bank);
    setLinkModalVisible(true);
  };

  // Handle submit (add or update)
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      if (editingBank) {
        // Update
        const identifier = { accountNumber: editingBank.accountNumber };
        const updates = {
          bankName: values.bankName,
          accountName: values.accountName,
          accountNumber: values.accountNumber,
          qrTemplate: values.qrTemplate,
          isDefault: values.isDefault ?? editingBank.isDefault,
        };
        await axios.put(`${API_BASE}/${storeId}/banks`, { identifier, updates }, { headers });
        Swal.fire({
          icon: "success",
          title: "Thành công",
          text: `Cập nhật thông tin ngân hàng thành công!`,
          timer: 1500,
          showConfirmButton: true,
        });
      } else {
        // Add
        const payload = {
          bankCode: values.bankCode,
          bankName: values.bankName,
          accountNumber: values.accountNumber,
          accountName: values.accountName,
          qrTemplate: values.qrTemplate || "compact2",
          isDefault: values.isDefault || false,
        };
        await axios.post(`${API_BASE}/${storeId}/banks`, payload, { headers });
        Swal.fire({
          icon: "success",
          title: "Thành công",
          text: `Kết nối ngân hàng thành công!`,
          timer: 1500,
          showConfirmButton: true,
        });
      }

      setLinkModalVisible(false);
      form.resetFields();
      fetchBanks();
    } catch (err: any) {
      console.error("handleSubmit error:", err);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err?.response?.data?.message || "Lỗi khi lưu ngân hàng",
        showCancelButton: true,
        cancelButtonText: "Đóng",
        showConfirmButton: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = (bank: BankEntry) => {
    setBankToDelete(bank);
    setDeleteModalVisible(true);
  };
  // Submit xoá
  const confirmDeleteBank = async () => {
    if (!bankToDelete) return;
    try {
      setLoading(true);
      const identifier = { accountNumber: bankToDelete.accountNumber };
      await axios.delete(`${API_BASE}/${storeId}/banks`, {
        data: identifier,
        headers,
      });
      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: `Đã ngắt kết nối ${bankToDelete.bankName} thành công!`,
        timer: 1500,
        showConfirmButton: true,
      });
      setDeleteModalVisible(false);
      setBankToDelete(null);
      fetchBanks();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err?.response?.data?.message || "Lỗi khi ngắt kết nối",
        showCancelButton: true,
        cancelButtonText: "Đóng",
        showConfirmButton: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle set default
  const handleSetDefault = async (bank: BankEntry) => {
    try {
      const identifier = { accountNumber: bank.accountNumber };
      await axios.put(`${API_BASE}/${storeId}/banks/default`, identifier, {
        headers,
      });
      message.success("Đã đặt ngân hàng mặc định!");
      fetchBanks();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err?.response?.data?.message || "Lỗi khi đặt mặc định",
        showCancelButton: true,
        cancelButtonText: "Đóng",
        showConfirmButton: false,
      });
    }
  };

  // Handle generate QR
  const handleGenerateQR = (bank?: BankEntry) => {
    // Set default form values
    qrForm.setFieldsValue({
      amount: 100000,
      description: "Thanh toan don hang 123",
    });
    // Lưu bank được chọn (nếu có)
    setEditingBank(bank || null);
    setQrModalVisible(true);
  };

  // Submit tạo QR
  const submitGenerateQR = async () => {
    try {
      setQrData(null); // reset trước khi tạo lại
      const values = await qrForm.validateFields();
      const payload: any = {
        amount: Number(values.amount),
        description: values.description || "",
      };

      if (editingBank) {
        payload.bankCode = editingBank.bankCode;
        payload.accountNumber = editingBank.accountNumber;
      }

      const res = await axios.post(`${API_BASE}/${storeId}/generate-qr`, payload, { headers });

      if (res.data?.success) {
        const rawUrl = res.data.data.qrUrl;
        const qrUrl = rawUrl.includes("?") ? `${rawUrl}&t=${Date.now()}` : `${rawUrl}?t=${Date.now()}`; //chống cache
        setQrData({
          qrUrl,
          //qrUrl: res.data.data.qrUrl,
          amount: res.data.data.totalAmount || payload.amount,
        });
        message.success("Tạo QR thành công!");
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err?.response?.data?.message || "Lỗi tạo QR",
        showCancelButton: true,
        cancelButtonText: "Đóng",
        showConfirmButton: false,
      });
    }
  };

  // === TÍNH TOÁN DATA SAU KHI SEARCH + PAGINATION ===
  const filteredBanks = vietQrBanks.filter((bank) => {
    // Check search text
    const matchesSearch =
      bank.shortName.toLowerCase().includes(searchText.toLowerCase()) || bank.name.toLowerCase().includes(searchText.toLowerCase());

    // Check connected filter
    if (showConnectedOnly) {
      return matchesSearch && isBankConnected(bank.code);
    }

    return matchesSearch;
  });

  const paginatedBanks = filteredBanks.slice((pagination.current - 1) * pagination.pageSize, pagination.current * pagination.pageSize);

  // DEBOUNCED SEARCH - MƯỢT NHƯ BƠ, KHÔNG GIẬT Lag
  const debouncedSearch = debounce((value: string) => {
    setSearchLoading(true);
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
    // Giả lập loading 100ms để đẹp mắt
    setTimeout(() => setSearchLoading(false), 100);
  }, 300);

  return (
    <Layout>
      <div style={{ minHeight: "100vh" }}>
        {/* HEADER */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            border: "1px solid #8c8c8c",
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Space align="start">
                <QrcodeOutlined style={{ fontSize: 32, color: "#1890ff" }} />
                <div>
                  <Title level={3} style={{ margin: 0 }}>
                    Cấu hình cổng thanh toán QRCode - VietQR PRO
                  </Title>
                  <Text type="secondary">Liên kết tài khoản ngân hàng của bạn để nhận thanh toán qua mã QR từ khách hàng</Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={async () => {
                  await fetchBanks();
                  if (!loading) {
                    Swal.fire({
                      icon: "success",
                      title: "Thành công",
                      text: "Đã tải danh sách ngân hàng",
                      timer: 1200,
                      timerProgressBar: true,
                      showConfirmButton: false,
                    });
                  }
                }}
                loading={loading}
              >
                Làm mới dữ liệu
              </Button>
            </Col>
          </Row>
        </Card>

        {/* DANH SÁCH NGÂN HÀNG – 65 NGÂN HÀNG + SEARCH + PAGINATION */}
        <Card
          title={
            <Space>
              <BankOutlined />
              <span>Các ngân hàng hỗ trợ tạo mã QR bằng ứng dụng VietQR</span>
              <Tag
                color="blue"
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: "15px",
                }}
              >
                Đã kết nối <span style={{ color: "#52c41a", fontWeight: 700 }}>{banks.length}</span> /{" "}
                <span style={{ color: "#d4380d", fontWeight: 700 }}>{vietQrBanks.length}</span> ngân hàng
              </Tag>
            </Space>
          }
          style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}
        >
          {/* SEARCH BOX + FILTER - REAL-TIME, GÕ LÀ RA LUÔN */}
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col flex="auto">
              <Input.Search
                placeholder="Tìm kiếm ngân hàng (MB, Vietcombank, BIDV, Ngân hàng TMCP Quân đội, .....)"
                allowClear
                size="large"
                loading={searchLoading}
                onChange={(e) => {
                  const value = e.target.value;
                  debouncedSearch(value);
                }}
              />
            </Col>

            {/* ======================================= */}
            <Col>{/* Cột rỗng */}</Col>
            {/* ======================================= */}

            <Col>
              <Checkbox
                checked={showConnectedOnly}
                onChange={(e) => {
                  setShowConnectedOnly(e.target.checked);
                  setPagination({ ...pagination, current: 1 }); // Reset page
                }}
                style={{ lineHeight: "40px", fontWeight: 500 }}
              >
                <FilterOutlined style={{ marginRight: 6 }} />
                Ngân hàng đã kết nối
              </Checkbox>
            </Col>
          </Row>

          {banksLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <Spin size="large" tip="Đang tải danh sách 65 ngân hàng từ VietQR..." />
            </div>
          ) : (
            <>
              {/* GRID 8 NGÂN HÀNG / TRANG */}
              <Row gutter={[16, 16]}>
                {paginatedBanks.length > 0 ? (
                  paginatedBanks.map((bank: any) => {
                    const connectedBank = banks.find((b) => b.bankCode === bank.code);
                    const isConnected = !!connectedBank;

                    return (
                      <Col xs={24} sm={12} lg={6} key={bank.code}>
                        <Card
                          hoverable
                          style={{
                            borderRadius: 12,
                            border: isConnected ? `2px solid #52c41a` : "1px solid #d9d9d9",
                            position: "relative",
                            overflow: "hidden",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          {/* Badge đã kết nối */}
                          {isConnected && (
                            <div
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                zIndex: 1,
                              }}
                            >
                              <Tag
                                icon={<CheckCircleOutlined />}
                                color="success"
                                style={{
                                  padding: "0 12px",
                                  fontSize: "14px",
                                  lineHeight: "18px",
                                  height: "22px",
                                  display: "inline-flex",
                                }}
                              >
                                Đã kết nối
                              </Tag>
                            </div>
                          )}

                          {/* Logo + Tên */}
                          <div
                            style={{
                              textAlign: "center",
                              flex: 1,
                              padding: "16px 0",
                            }}
                          >
                            <div
                              style={{
                                width: 70,
                                height: 70,
                                margin: "0 auto 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#fff",
                                borderRadius: "50%",
                                overflow: "hidden",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              }}
                            >
                              <Image
                                src={bank.logo}
                                alt={bank.shortName}
                                preview={false}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                }}
                                fallback="/bank_images/default.png"
                              />
                            </div>

                            <Title level={5} style={{ margin: "8px 0 4px", fontSize: 18 }}>
                              {bank.shortName}
                            </Title>
                            <Text style={{ fontSize: "14px", color: "#1006a7ff" }}>{bank.name}</Text>

                            {isConnected && connectedBank?.isDefault && (
                              <Tag
                                icon={<StarOutlined />}
                                color="gold"
                                style={{
                                  marginTop: "10px",
                                  padding: "0 6px",
                                  fontSize: "12px",
                                  lineHeight: "20px",
                                  height: "20px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                Đã đặt làm ngân hàng mặc định
                              </Tag>
                            )}
                          </div>

                          {/* Nút hành động */}
                          <div style={{ padding: "0 12px 12px" }}>
                            {isConnected ? (
                              <Space direction="vertical" style={{ width: "100%" }}>
                                <Button type="default" icon={<QrcodeOutlined />} block size="small" onClick={() => handleGenerateQR(connectedBank)}>
                                  Tạo QRCode
                                </Button>
                                <Space
                                  style={{
                                    width: "100%",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <Button size="small" onClick={() => handleOpenLinkModal(bank)}>
                                    Sửa
                                  </Button>
                                  {!connectedBank?.isDefault && (
                                    <Button size="small" onClick={() => handleSetDefault(connectedBank!)}>
                                      Đặt mặc định
                                    </Button>
                                  )}
                                  <Button
                                    danger
                                    size="small"
                                    onClick={() => handleDisconnect(connectedBank!)}
                                    style={{
                                      backgroundColor: "transparent",
                                      borderColor: "#ff4d4f",
                                      color: "#ff4d4f",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#f14e4bff";
                                      e.currentTarget.style.color = "#fff";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                      e.currentTarget.style.color = "#ff4d4f";
                                    }}
                                  >
                                    Huỷ kết nối
                                  </Button>
                                </Space>
                              </Space>
                            ) : (
                              <Button type="primary" block size="large" icon={<LinkOutlined />} onClick={() => handleOpenLinkModal(bank)}>
                                Liên kết ngay
                              </Button>
                            )}
                          </div>
                        </Card>
                      </Col>
                    );
                  })
                ) : (
                  // KHI KHÔNG CÓ KẾT QUẢ
                  <Col span={24}>
                    <div style={{ textAlign: "center", padding: "60px 0" }}>
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span style={{ fontSize: 16, color: "#8c8c8c" }}>
                            Không tìm thấy ngân hàng nào phù hợp với kết quả tìm kiếm "<b>{searchText}</b>"
                          </span>
                        }
                      ></Empty>
                    </div>
                  </Col>
                )}
              </Row>

              {/* PAGINATION - phân trang */}
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Pagination
                  current={pagination.current}
                  pageSize={pagination.pageSize}
                  total={filteredBanks.length}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(total, range) => (
                    <div style={{ fontSize: 13 }}>
                      Đang xem{" "}
                      <span style={{ color: "#1890ff", fontWeight: 600 }}>
                        {range[0]} – {range[1]}
                      </span>{" "}
                      trong tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> ngân hàng
                    </div>
                  )}
                  onChange={(page, pageSize) => setPagination({ current: page, pageSize: pageSize || 8 })}
                />
              </div>
            </>
          )}
        </Card>

        {/* ==================== PAYOS AUTO CONNECT ====================== */}
        <Card
          style={{
            marginTop: 24,
            borderRadius: 12,
            border: "1px solid #8c8c8c",
          }}
          title={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              <Space>
                <SafetyOutlined style={{ color: "#722ed1", fontSize: 18 }} />
                <Text strong style={{ fontSize: 16 }}>
                  Liên kết chức năng Tự Động Xác Nhận Thanh Toán Của PayOS
                </Text>
              </Space>

              <Space>
                <Text type="secondary" style={{ fontWeight: 500 }}>
                  Trạng thái:
                </Text>
                {webhookConfig?.payos?.isEnabled ? (
                  <Tag icon={<CheckCircleOutlined />} color="success" style={{ padding: "4px 10px", fontSize: 14 }}>
                    Đã kích hoạt
                  </Tag>
                ) : (
                  <Tag color="error" style={{ padding: "4px 10px", fontSize: 14 }}>
                    Chưa kích hoạt
                  </Tag>
                )}
              </Space>
            </div>
          }
        >
          {webhookConfig?.payos?.isEnabled ? (
            // ĐÃ KÍCH HOẠT → HIỆN THÔNG TIN + NÚT TẮT
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <CheckCircleOutlined style={{ fontSize: 64, color: "#52c41a" }} />
              <Title level={4} style={{ margin: "16px 0 8px", color: "#52c41a" }}>
                PayOS đã được kích hoạt thành công!
              </Title>
              <Text type="secondary">Từ giờ trở đi, đơn hàng của bạn sẽ tự động được xác nhận bởi PAYOS khi khách chuyển khoản qua QRCode</Text>
              <div style={{ marginTop: 24 }}>
                <Button danger onClick={() => setDisablePayOSModal(true)}>
                  Tắt tính năng tự động xác nhận thanh toán
                </Button>
              </div>
            </div>
          ) : (
            // CHƯA KÍCH HOẠT → FORM NHẬP 3 KEY SIÊU ĐƠN GIẢN
            <Form
              layout="vertical"
              onFinish={async (values) => {
                try {
                  setSavingWebhook(true);
                  const res = await axios.post(
                    `${API_BASE}/${storeId}/payos/connect`,
                    {
                      clientId: values.clientId.trim(),
                      apiKey: values.apiKey.trim(),
                      checksumKey: values.checksumKey.trim(),
                    },
                    { headers }
                  );

                  if (res.data.success) {
                    message.success("Kích hoạt thành công! Sao chép Webhook URL này dán vào PayOS:");

                    Swal.fire({
                      title: "Sao chép Webhook URL ngay!",
                      text: res.data.data.webhookUrl,
                      input: "text",
                      inputValue: res.data.data.webhookUrl,
                      showCancelButton: true,
                      confirmButtonText: "Đã Sao chép & dán vào PayOS",
                      preConfirm: () => {
                        navigator.clipboard.writeText(res.data.data.webhookUrl);
                      },
                    });

                    fetchPaymentConfig(); // Reload config
                  }
                } catch (err: any) {
                  message.error(err?.response?.data?.message || "Kích hoạt thất bại, kiểm tra lại 3 key");
                } finally {
                  setSavingWebhook(false);
                }
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="clientId" label="Client ID (do PayOS cấp)" rules={[{ required: true, message: "Client ID là bắt buộc!" }]}>
                    <Input placeholder="Ví dụ: 8a9f3b..." prefix={<CreditCardOutlined />} size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="apiKey" label="API Key (do PayOS cấp)" rules={[{ required: true, message: "API Key là bắt buộc!" }]}>
                    <Input.Password placeholder="Ví dụ: 3f8a9b1c..." size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="checksumKey"
                    label="Checksum Key (do PayOS cấp)"
                    rules={[{ required: true, message: "Checksum Key là bắt buộc!" }]}
                  >
                    <Input.Password placeholder="Ví dụ: a1b2c3d4..." arial-label="checksum key" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ textAlign: "right" }}>
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} loading={savingWebhook} htmlType="submit">
                  Kích hoạt PayOS
                </Button>
              </div>
            </Form>
          )}
        </Card>

        {/* HƯỚNG DẪN */}
        <Card
          title={
            <Row justify="space-between" align="middle">
              <Col>
                <SafetyOutlined style={{ marginRight: 8 }} />
                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                  Hướng dẫn liên kết với tài khoản PayOS để sử dụng tính năng tự động xác nhận thanh toán
                </span>
              </Col>
              <Col>
                <Button
                  type="default" // dùng default để customize màu
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  icon={
                    <CaretDownOutlined
                      style={{
                        transition: "transform 0.3s",
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  }
                  style={{
                    borderRadius: 8,
                    fontWeight: 500,
                    padding: "4px 12px",
                    transition: "all 0.3s",
                    backgroundColor: expanded ? "#1890ff" : "#fff",
                    color: expanded ? "#fff" : "#1890ff",
                    border: "1px solid #1890ff",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = expanded ? "#40a9ff" : "#e6f7ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = expanded ? "#1890ff" : "#fff";
                  }}
                >
                  {expanded ? "Thu gọn thông tin" : "Xem thêm thông tin"}
                </Button>
              </Col>
            </Row>
          }
          style={{
            marginTop: 24,
            borderRadius: 12,
            border: "1px solid #8c8c8c",
          }}
        >
          {expanded && (
            <Steps
              direction="vertical"
              current={-1}
              style={{ marginTop: 16 }}
              items={[
                {
                  title: <span style={{ fontWeight: "bold", color: "#1d39c4" }}>Bước 1: Đăng ký & xác thực tài khoản PayOS</span>,
                  icon: <UserAddOutlined style={{ color: "#1890ff" }} />,
                  description: (
                    <div style={{ lineHeight: "1.7" }}>
                      <div>
                        • Truy cập{" "}
                        <a
                          href="https://my.payos.vn/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#1d39c4",
                            textDecoration: "underline",
                          }}
                        >
                          https://my.payos.vn/login
                        </a>{" "}
                        để đăng ký tài khoản mới
                      </div>
                      <div>
                        • Sau khi đăng ký → xác thực email → chọn <b style={{ color: "#d4380d" }}>Tổ chức</b> (cá nhân/doanh nghiệp)
                      </div>
                      <div>
                        • Hoàn tất <i style={{ color: "#d46b08", fontWeight: 600 }}>Xác thực tổ chức</i> (CMND/CCCD, thông tin công ty…)
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "13px",
                          color: "#595959",
                        }}
                      >
                        📚 Chi tiết bạn đọc tại đây:{" "}
                        <a
                          href="https://payos.vn/docs/huong-dan-su-dung/tao-tai-khoan-payos"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#1677ff" }}
                        >
                          Tạo tài khoản
                        </a>{" "}
                        |{" "}
                        <a
                          href="https://payos.vn/docs/huong-dan-su-dung/xac-thuc-to-chuc"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#1677ff" }}
                        >
                          Xác thực tổ chức
                        </a>
                      </div>
                    </div>
                  ),
                },
                {
                  title: <span style={{ fontWeight: "bold", color: "#1d39c4" }}>Bước 2: Liên kết tài khoản ngân hàng nhận tiền</span>,
                  icon: <BankOutlined style={{ color: "#52c41a" }} />,
                  description: (
                    <div style={{ lineHeight: "1.7" }}>
                      <div>
                        • Vào menu bên trái → <b style={{ color: "#08979c" }}>Mục "Ngân hàng"</b>
                      </div>
                      <div>
                        • Nhấn <b>Thêm tài khoản ngân hàng</b> → điền thông tin → xác thực (PayOS sẽ chuyển 1 đồng để Xác thực bạn)
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          color: "#595959",
                          fontSize: "13px",
                        }}
                      >
                        ⚡ Lưu ý: Phải dùng tài khoản chính chủ trùng tên với tổ chức đã xác thực
                      </div>
                    </div>
                  ),
                },
                {
                  title: <span style={{ fontWeight: "bold", color: "#1d39c4" }}>Bước 3: Tạo kênh thanh toán → Lấy 3 khóa quan trọng sau</span>,
                  icon: <CreditCardOutlined style={{ color: "#722ed1" }} />,
                  description: (
                    <div style={{ lineHeight: "1.7" }}>
                      <div>
                        • Menu bên trái → <b style={{ color: "#d4380d" }}>Kênh thanh toán</b> → <b>Tạo kênh thanh toán</b>
                      </div>
                      <div>• Chọn tài khoản ngân hàng vừa liên kết → Xác thực các yêu cầu → Lưu lại → PayOS sẽ cấp ngay:</div>
                      <div style={{ marginLeft: 20, marginTop: 8 }}>
                        <b style={{ color: "#08979c" }}>✅ Client ID</b>
                        <br />
                        <b style={{ color: "#08979c" }}>✅ API Key</b>
                        <br />
                        <b style={{ color: "#08979c" }}>✅ Checksum Key</b>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "13px",
                          color: "#595959",
                        }}
                      >
                        📚 Hướng dẫn chi tiết + hình ảnh:{" "}
                        <a
                          href="https://payos.vn/docs/huong-dan-su-dung/kenh-thu/tao-kenh-thanh-toan"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#1677ff" }}
                        >
                          Tạo kênh thanh toán PayOS
                        </a>
                      </div>
                    </div>
                  ),
                },
                {
                  title: <span style={{ fontWeight: "bold", color: "#1d39c4" }}>Bước 4: Nhập 3 key vào hệ thống và bấm “Kích hoạt PayOS”</span>,
                  icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
                  description: (
                    <div style={{ lineHeight: "1.7" }}>
                      <div>
                        • Dán lần lượt <b>Client ID</b>, <b>API Key</b>, <b>Checksum Key</b> vào 3 ô ở trên
                      </div>
                      <div>
                        • Bấm nút <b style={{ color: "#389e0d" }}>Kích hoạt PayOS</b>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          color: "#389e0d",
                          fontWeight: 600,
                        }}
                      >
                        Hệ thống sẽ tự động tạo link webhook và hiện thông báo cho bạn Sao chép!
                      </div>
                    </div>
                  ),
                },
                {
                  title: (
                    <span style={{ fontWeight: "bold", color: "#52c41a" }}>
                      Bước 5: Sao chép link Webhook từ thông báo → Dán vào PayOS (chỉ làm 1 lần)
                    </span>
                  ),
                  icon: <LinkOutlined style={{ color: "#52c41a" }} />,
                  description: (
                    <div style={{ lineHeight: "1.7" }}>
                      <div>• Sau khi bấm “Kích hoạt PayOS” → sẽ hiện 1 cửa sổ chứa link dài (bắt đầu bằng https://...)</div>
                      <div>• Sao chép toàn bộ link đó</div>
                      <div>
                        • Vào PayOS → Kênh thanh toán → Chọn kênh mà bạn đã tạo → Dán vào ô <b>Webhook URL</b> ở trường nhập cuối → Lưu lại
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          padding: "12px",
                          background: "#f6ffed",
                          border: "1px solid #b7eb8f",
                          borderRadius: 8,
                        }}
                      >
                        <b>HOÀN TẤT!</b> Từ giờ khách chuyển khoản qua mã QR của bạn → hệ thống sẽ tự động xác nhận rằng đơn hàng đã được thanh toán
                        thành công chỉ trong vòng 10-15 giây.
                        <br />
                        bạn không cần phải check App ngân hàng trên điện thoại thủ công nữa!
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>

        {/* MODAL: LIÊN KẾT/CHỈNH SỬA NGÂN HÀNG */}
        <Modal
          title={
            <Space>
              <BankOutlined style={{ color: selectedBankTemplate?.color }} />
              <span>
                {editingBank
                  ? `Chỉnh sửa thông tin ngân hàng ${selectedBankTemplate?.shortName || "ngân hàng"}`
                  : `Liên kết với ngân hàng ${selectedBankTemplate?.shortName || "ngân hàng"}`}
              </span>
            </Space>
          }
          open={linkModalVisible}
          onCancel={() => {
            setLinkModalVisible(false);
            form.resetFields();
            setEditingBank(null);
          }}
          footer={null}
          width={600}
        >
          <Alert
            message={editingBank ? "Cập nhật thông tin tài khoản" : "Nhập thông tin tài khoản ngân hàng"}
            description={
              editingBank
                ? "Cập nhật số tài khoản, tên chủ tài khoản hoặc template QR."
                : "Nhập đầy đủ thông tin tài khoản để tạo mã VietQR cho khách hàng."
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="bankCode" label="Mã ngân hàng" hidden>
              <Input disabled />
            </Form.Item>

            <Form.Item name="bankName" label="Tên ngân hàng" rules={[{ required: true, message: "Nhập tên ngân hàng!" }]}>
              <Input placeholder="VD: MB Bank" prefix={<BankOutlined />} />
            </Form.Item>

            <Form.Item
              name="accountNumber"
              label="Số tài khoản"
              rules={[
                { required: true, message: "Nhập số tài khoản!" },
                {
                  pattern: /^\d{6,24}$/,
                  message: "Số TK phải là 6-24 chữ số!",
                },
              ]}
            >
              <Input placeholder="VD: 3863666898666" />
            </Form.Item>

            <Form.Item name="accountName" label="Tên chủ tài khoản" rules={[{ required: true, message: "Nhập tên chủ tài khoản!" }]}>
              <Input placeholder="VD: NGUYEN DUC HUY" />
            </Form.Item>

            <Form.Item name="qrTemplate" label="QR Template">
              <Select>
                <Option value="compact">Compact</Option>
                <Option value="compact2">Compact 2 (Mặc định)</Option>
                <Option value="qr_only">QR Only</Option>
                <Option value="print">Print</Option>
              </Select>
            </Form.Item>

            <Divider />

            <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
              <Space>
                <Button
                  onClick={() => {
                    setLinkModalVisible(false);
                    form.resetFields();
                    setEditingBank(null);
                  }}
                >
                  Hủy
                </Button>
                <Button type="primary" htmlType="submit" icon={<LinkOutlined />} loading={loading}>
                  {editingBank ? "Cập nhật" : "Liên kết"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* MODAL: TẠO & XEM QR */}
        <Modal
          title="Tạo VietQR"
          open={qrModalVisible}
          onCancel={() => {
            setQrModalVisible(false);
            setQrData(null);
            qrForm.resetFields();
          }}
          width={500}
          footer={[
            <Button key="cancel" onClick={() => setQrModalVisible(false)}>
              Hủy
            </Button>,
            <Button key="ok" type="primary" onClick={submitGenerateQR}>
              {qrData ? "Tạo lại QR" : "Tạo QR"}
            </Button>,
          ]}
        >
          <Form form={qrForm} layout="vertical">
            {/* INPUTS */}
            <Form.Item name="amount" label="Số tiền (VND)" rules={[{ required: true, message: "Nhập số tiền!" }]}>
              <InputNumber
                placeholder="100000"
                style={{ width: "100%" }}
                formatter={(value) => (value ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "")}
                parser={(value) => value?.replace(/\$\s?|(,*)/g, "") || ""}
              />
            </Form.Item>

            <Form.Item name="description" label="Nội dung">
              <Input placeholder="Thanh toan don hang 123" />
            </Form.Item>

            {/* QR PREVIEW */}
            {qrData && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <Divider />

                {/* Ảnh QR */}
                <Image src={qrData.qrUrl} alt="VietQR" style={{ maxWidth: "100%", borderRadius: 8 }} />

                <Divider />

                {/* THÔNG TIN SỐ TIỀN */}
                <Text strong style={{ fontSize: 16 }}>
                  Số tiền: <Text type="danger">{qrData.amount?.toLocaleString()}₫</Text>
                </Text>

                <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
                  {/* Nút mở QR tab mới */}
                  <Button type="primary" block icon={<QrcodeOutlined />} onClick={() => window.open(qrData.qrUrl, "_blank")}>
                    Mở ảnh QR trong tab mới
                  </Button>

                  {/* Nút Sao chép URL */}
                  <Button
                    block
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard?.writeText(qrData.qrUrl);
                      message.success("Đã Sao chép URL QR!");
                    }}
                  >
                    Sao chép URL
                  </Button>
                </Space>
              </div>
            )}
          </Form>
        </Modal>

        {/* MODAL XOÁ NGÂN HÀNG */}
        <Modal
          title="Xác nhận ngắt kết nối"
          open={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            setBankToDelete(null);
          }}
          footer={null}
          centered
        >
          <div style={{ padding: "8px 0" }}>
            <Text>
              Bạn có chắc muốn <b>ngắt kết nối</b> với ngân hàng <span style={{ color: "#d4380d", fontWeight: 600 }}>{bankToDelete?.bankName}</span>{" "}
              không?
            </Text>
            <br />
            <Text type="secondary">Khách hàng sẽ không thể thanh toán qua QR của ngân hàng này nữa.</Text>
          </div>
          <Divider />
          <div style={{ textAlign: "right" }}>
            <Space>
              <Button
                onClick={() => {
                  setDeleteModalVisible(false);
                  setBankToDelete(null);
                }}
              >
                Hủy
              </Button>
              <Button danger type="primary" loading={loading} onClick={confirmDeleteBank}>
                Ngắt kết nối
              </Button>
            </Space>
          </div>
        </Modal>

        {/* ========== Modal hỏi tắt kích hoạt PayOS xác nhận tự động  ===========*/}
        <Modal title="Tắt PayOS?" open={disablePayOSModal} centered onCancel={() => setDisablePayOSModal(false)} footer={null}>
          <p>Đơn hàng sẽ không tự động xác nhận nữa. Bạn có chắc không?</p>
          <Divider />
          <div style={{ textAlign: "right" }}>
            <Space>
              <Button onClick={() => setDisablePayOSModal(false)}>Hủy</Button>
              <Button
                type="primary"
                danger
                onClick={async () => {
                  await axios.put(`${API_BASE}/${storeId}/webhook`, {}, { headers }); // body có thể rỗng
                  Swal.fire({
                    icon: "success",
                    title: "Đã tắt PayOS",
                    text: "Tính năng tự động xác nhận thanh toán đã được tắt.",
                    timer: 1200,
                    timerProgressBar: true,
                    showConfirmButton: true,
                  });

                  setDisablePayOSModal(false);
                  fetchPaymentConfig();
                }}
              >
                Tắt PayOS
              </Button>
            </Space>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default PaymentGatewaySettingsPage;
