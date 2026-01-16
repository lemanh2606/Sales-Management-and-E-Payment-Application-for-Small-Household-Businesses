// src/screens/settings/PaymentSettingsScreen.tsx
import React, { useState, useEffect, useCallback, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Modal,
  FlatList,
  RefreshControl,
  Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

// ========== TYPES ==========
interface Bank {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrTemplate?: string;
  logo?: string;
  isDefault: boolean;
  connectedAt?: string;
  updatedAt?: string;
}

interface VietQRBank {
  code: string;
  shortName: string;
  name: string;
  logo: string;
  bin?: string;
  swift_code?: string;
}

interface PayOSConfig {
  payos?: {
    isEnabled: boolean;
    clientId?: string;
    apiKey?: string;
    checksumKey?: string;
    webhookUrl?: string;
  };
  webhook?: {
    url?: string;
    events?: string[];
  };
}

interface BanksResponse {
  success: boolean;
  data: Bank[];
  message?: string;
}

interface VietQRBanksResponse {
  code: string;
  desc: string;
  data: VietQRBank[];
}

interface PayOSConfigResponse {
  success: boolean;
  data: PayOSConfig;
  message?: string;
}

interface PayOSConnectResponse {
  success: boolean;
  data: {
    webhookUrl: string;
    isEnabled: boolean;
  };
  message?: string;
}

interface QRGenerateResponse {
  success: boolean;
  data: {
    qrUrl: string;
    totalAmount: number;
    accountNumber: string;
    accountName: string;
    bankName: string;
  };
  message?: string;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
    status?: number;
  };
  message?: string;
}

type QRTemplate = "compact" | "compact2" | "qr_only" | "print";

// ========== MAIN COMPONENT ==========
const PaymentSettingsScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [vietQRBanks, setVietQRBanks] = useState<VietQRBank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<VietQRBank[]>([]);
  const [payosConfig, setPayosConfig] = useState<PayOSConfig | null>(null);

  // Search & Pagination
  const [searchText, setSearchText] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize: number = 8;

  // Modals
  const [bankModalVisible, setBankModalVisible] = useState<boolean>(false);
  const [qrModalVisible, setQrModalVisible] = useState<boolean>(false);
  const [payosModalVisible, setPayosModalVisible] = useState<boolean>(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);

  // Form states
  const [selectedBank, setSelectedBank] = useState<VietQRBank | null>(null);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankToDelete, setBankToDelete] = useState<Bank | null>(null);

  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [qrTemplate, setQrTemplate] = useState<QRTemplate>("compact2");

  // QR Form
  const [qrAmount, setQrAmount] = useState<string>("100000");
  const [qrDescription, setQrDescription] = useState<string>(
    "Thanh toan don hang"
  );
  const [qrUrl, setQrUrl] = useState<string>("");
  const [qrData, setQrData] = useState<{
    qrUrl: string;
    amount: number;
    accountNumber: string;
    accountName: string;
    bankName: string;
  } | null>(null);

  // PayOS Form
  const [clientId, setClientId] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [checksumKey, setChecksumKey] = useState<string>("");

  // Collapsible states
  const [isPayOSGuideExpanded, setIsPayOSGuideExpanded] =
    useState<boolean>(false);

  // ========== FETCH DATA ==========
  const fetchBanks = useCallback(async (): Promise<void> => {
    if (!storeId) return;

    try {
      setLoading(true);
      const response = await apiClient.get<BanksResponse>(
        `/stores-config-payment/${storeId}/banks`
      );
      if (response.data?.success) {
        setBanks(response.data.data || []);
      }
    } catch (err: any) {
      console.error(" Lỗi tải banks:", err);
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message ||
          "Không thể tải danh sách ngân hàng đã kết nối"
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const fetchVietQRBanks = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get<VietQRBanksResponse>(
        "https://api.vietqr.io/v2/banks"
      );
      if (response.data.code === "00") {
        setVietQRBanks(response.data.data || []);
        setFilteredBanks(response.data.data || []);
      }
    } catch (err: any) {
      console.error(" Lỗi tải VietQR banks:", err);
      Alert.alert("Lỗi", "Không thể tải danh sách ngân hàng VietQR");
    }
  }, []);

  const fetchPayOSConfig = useCallback(async (): Promise<void> => {
    if (!storeId) return;

    try {
      const response = await apiClient.get<PayOSConfigResponse>(
        `/stores-config-payment/${storeId}/config`
      );
      if (response.data?.success) {
        setPayosConfig(response.data.data);
      }
    } catch (err: any) {
      console.error(" Lỗi tải PayOS config:", err);
      // Silent fail - không hiển thị error cho config
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      fetchBanks();
      fetchVietQRBanks();
      fetchPayOSConfig();
    }
  }, [storeId, fetchBanks, fetchVietQRBanks, fetchPayOSConfig]);

  // ========== SEARCH ==========
  useEffect(() => {
    const filtered = vietQRBanks.filter(
      (bank: VietQRBank) =>
        bank.shortName.toLowerCase().includes(searchText.toLowerCase()) ||
        bank.name.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredBanks(filtered);
    setCurrentPage(1);
  }, [searchText, vietQRBanks]);

  // ========== PAGINATION ==========
  const paginatedBanks: VietQRBank[] = filteredBanks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages: number = Math.ceil(filteredBanks.length / pageSize);

  // ========== CHECK CONNECTED ==========
  const isConnected = (bankCode: string): Bank | null => {
    return banks.find((b: Bank) => b.bankCode === bankCode) || null;
  };

  // ========== HANDLE BANK LINK ==========
  const handleOpenBankModal = (bank: VietQRBank): void => {
    const connected: Bank | null = isConnected(bank.code);

    if (connected) {
      // Edit mode
      setEditingBank(connected);
      setAccountNumber(connected.accountNumber);
      setAccountName(connected.accountName);
      setQrTemplate((connected.qrTemplate as QRTemplate) || "compact2");
    } else {
      // Add mode
      setEditingBank(null);
      setAccountNumber("");
      setAccountName("");
      setQrTemplate("compact2");
    }

    setSelectedBank(bank);
    setBankModalVisible(true);
  };

  const handleSaveBank = async (): Promise<void> => {
    if (!selectedBank || !accountNumber || !accountName) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin");
      return;
    }

    // Validate account number
    if (!/^\d{6,24}$/.test(accountNumber)) {
      Alert.alert("Lỗi", "Số tài khoản phải là 6-24 chữ số");
      return;
    }

    setLoading(true);

    try {
      if (editingBank) {
        // Update
        await apiClient.put(`/stores-config-payment/${storeId}/banks`, {
          identifier: { accountNumber: editingBank.accountNumber },
          updates: {
            bankName: selectedBank.shortName,
            accountNumber,
            accountName: accountName.toUpperCase(),
            qrTemplate,
          },
        });
        Alert.alert("Thành công", "Cập nhật thông tin ngân hàng thành công!");
      } else {
        // Add
        await apiClient.post(`/stores-config-payment/${storeId}/banks`, {
          bankCode: selectedBank.code,
          bankName: selectedBank.shortName,
          accountNumber,
          accountName: accountName.toUpperCase(),
          qrTemplate,
          isDefault: false,
        });
        Alert.alert("Thành công", "Kết nối ngân hàng thành công!");
      }

      setBankModalVisible(false);
      resetBankForm();
      fetchBanks();
    } catch (err: any) {
      console.error(" Lỗi lưu bank:", err);
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "Không thể lưu ngân hàng"
      );
    } finally {
      setLoading(false);
    }
  };

  const resetBankForm = (): void => {
    setSelectedBank(null);
    setEditingBank(null);
    setAccountNumber("");
    setAccountName("");
    setQrTemplate("compact2");
  };

  // ========== HANDLE DELETE ==========
  const handleDeleteBank = async (): Promise<void> => {
    if (!bankToDelete) return;

    setLoading(true);

    try {
      await apiClient.delete(`/stores-config-payment/${storeId}/banks`, {
        data: {
          accountNumber: bankToDelete.accountNumber,
        },
      } as any);
      Alert.alert(
        "Thành công",
        `Đã ngắt kết nối ${bankToDelete.bankName} thành công!`
      );
      setDeleteModalVisible(false);
      setBankToDelete(null);
      fetchBanks();
    } catch (err: any) {
      console.error(" Lỗi xóa bank:", err);
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "Không thể ngắt kết nối"
      );
    } finally {
      setLoading(false);
    }
  };

  // ========== HANDLE SET DEFAULT ==========
  const handleSetDefault = async (bank: Bank): Promise<void> => {
    try {
      await apiClient.put(`/stores-config-payment/${storeId}/banks/default`, {
        accountNumber: bank.accountNumber,
      });
      Alert.alert("Thành công", "Đặt ngân hàng mặc định thành công!");
      fetchBanks();
    } catch (err: any) {
      console.error(" Lỗi set default:", err);
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "Không thể đặt mặc định"
      );
    }
  };

  // ========== GENERATE QR ==========
  const handleOpenQRModal = (bank?: Bank): void => {
    setEditingBank(bank || null);
    setQrAmount("100000");
    setQrDescription("Thanh toan don hang");
    setQrData(null);
    setQrModalVisible(true);
  };

  const handleGenerateQR = async (): Promise<void> => {
    if (!qrAmount) {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền");
      return;
    }

    const amount: number = parseInt(qrAmount.replace(/\./g, ""));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Lỗi", "Số tiền không hợp lệ");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        amount,
        description: qrDescription || "",
      };

      if (editingBank) {
        payload.bankCode = editingBank.bankCode;
        payload.accountNumber = editingBank.accountNumber;
      }

      const response = await apiClient.post<QRGenerateResponse>(
        `/stores-config-payment/${storeId}/generate-qr`,
        payload
      );

      if (response.data?.success) {
        const data = response.data.data;
        setQrData({
          qrUrl: data.qrUrl,
          amount: data.totalAmount || amount,
          accountNumber: data.accountNumber,
          accountName: data.accountName,
          bankName: data.bankName,
        });
        Alert.alert("Thành công", "Tạo mã QR thành công!");
      }
    } catch (err: any) {
      console.error(" Lỗi tạo QR:", err);
      Alert.alert("Lỗi", err?.response?.data?.message || "Không thể tạo mã QR");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQRUrl = (): void => {
    if (qrData?.qrUrl) {
      Clipboard.setString(qrData.qrUrl);
      Alert.alert("Thành công", "Đã sao chép URL mã QR!");
    }
  };

  // ========== ACTIVATE PAYOS ==========
  const handleActivatePayOS = async (): Promise<void> => {
    if (!clientId || !apiKey || !checksumKey) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ 3 key từ PayOS");
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post<PayOSConnectResponse>(
        `/stores-config-payment/${storeId}/payos/connect`,
        {
          clientId: clientId.trim(),
          apiKey: apiKey.trim(),
          checksumKey: checksumKey.trim(),
        }
      );

      if (response.data.success) {
        const webhookUrl = response.data.data.webhookUrl;

        // Copy to clipboard
        Clipboard.setString(webhookUrl);

        Alert.alert(
          "🎉 Kích hoạt thành công!",
          `Webhook URL đã được sao chép:\n\n${webhookUrl}\n\nVui lòng dán vào PayOS → Kênh thanh toán → Webhook URL`,
          [
            {
              text: "Đã hiểu",
              onPress: () => {
                setPayosModalVisible(false);
                resetPayOSForm();
                fetchPayOSConfig();
              },
            },
          ]
        );
      }
    } catch (err: any) {
      console.error(" Lỗi kích hoạt PayOS:", err);
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message ||
          "Kích hoạt thất bại. Vui lòng kiểm tra lại 3 key"
      );
    } finally {
      setLoading(false);
    }
  };

  const resetPayOSForm = (): void => {
    setClientId("");
    setApiKey("");
    setChecksumKey("");
  };

  // ========== DEACTIVATE PAYOS ==========
  const handleDeactivatePayOS = (): void => {
    Alert.alert(
      "Xác nhận tắt PayOS",
      "Đơn hàng sẽ không còn được tự động xác nhận. Bạn có chắc chắn?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Tắt PayOS",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.put(
                `/stores-config-payment/${storeId}/webhook`,
                {}
              );
              Alert.alert("Thành công", "Đã tắt PayOS tự động xác nhận");
              fetchPayOSConfig();
            } catch (err: any) {
              console.error(" Lỗi tắt PayOS:", err);
              Alert.alert(
                "Lỗi",
                err?.response?.data?.message || "Không thể tắt PayOS"
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ========== FORMAT NUMBER ==========
  const formatNumber = (value: string): string => {
    const number = value.replace(/[^0-9]/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatVND = (value: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // ========== RENDER BANK ITEM ==========
  const renderBankItem = ({ item }: { item: VietQRBank }): JSX.Element => {
    const connectedBank: Bank | null = isConnected(item.code);

    return (
      <TouchableOpacity
        style={[styles.bankCard, connectedBank && styles.bankCardConnected]}
        onPress={() => handleOpenBankModal(item)}
        activeOpacity={0.7}
      >
        {connectedBank && (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.connectedBadgeText}>Đã kết nối</Text>
          </View>
        )}

        <Image
          source={{ uri: item.logo }}
          style={styles.bankLogo}
          resizeMode="contain"
        />

        <Text style={styles.bankShortName} numberOfLines={1}>
          {item.shortName}
        </Text>
        <Text style={styles.bankFullName} numberOfLines={2}>
          {item.name}
        </Text>

        {connectedBank?.isDefault && (
          <View style={styles.defaultBadge}>
            <Ionicons name="star" size={12} color="#faad14" />
            <Text style={styles.defaultBadgeText}>Mặc định</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ========== RENDER ==========
  if (!storeId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.errorText}>Vui lòng chọn cửa hàng trước</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="card" size={32} color="#1890ff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Cấu hình thanh toán</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            fetchBanks();
            fetchPayOSConfig();
          }}
        >
          <Ionicons name="refresh" size={20} color="#1890ff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([fetchBanks(), fetchPayOSConfig()]);
              setRefreshing(false);
            }}
            colors={["#1890ff"]}
          />
        }
      >
        {/* PayOS Section */}
        <View style={styles.payosSection}>
          <View style={styles.payosSectionHeader}>
            <View style={styles.payosTitleRow}>
              <Ionicons name="shield-checkmark" size={20} color="#722ed1" />
              <Text style={styles.payosTitle}>PayOS Auto Confirm</Text>
            </View>
            {payosConfig?.payos?.isEnabled ? (
              <View
                style={[styles.statusBadge, { backgroundColor: "#f6ffed" }]}
              >
                <Text style={[styles.statusText, { color: "#52c41a" }]}>
                  Đã kích hoạt
                </Text>
              </View>
            ) : (
              <View
                style={[styles.statusBadge, { backgroundColor: "#fff1f0" }]}
              >
                <Text style={[styles.statusText, { color: "#ef4444" }]}>
                  Chưa kích hoạt
                </Text>
              </View>
            )}
          </View>

          {payosConfig?.payos?.isEnabled ? (
            <View style={styles.payosActive}>
              <Ionicons name="checkmark-circle" size={48} color="#52c41a" />
              <Text style={styles.payosActiveTitle}>PayOS đã kích hoạt!</Text>
              <Text style={styles.payosActiveDesc}>
                Đơn hàng sẽ tự động xác nhận khi khách chuyển khoản
              </Text>
              <TouchableOpacity
                style={styles.deactivateBtn}
                onPress={handleDeactivatePayOS}
              >
                <Text style={styles.deactivateBtnText}>Tắt PayOS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.payosInactive}>
              <TouchableOpacity
                style={styles.activateBtn}
                onPress={() => setPayosModalVisible(true)}
              >
                <LinearGradient
                  colors={["#722ed1", "#531dab"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activateBtnGradient}
                >
                  <Ionicons name="power" size={18} color="#fff" />
                  <Text style={styles.activateBtnText}>Kích hoạt PayOS</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.guideToggle}
                onPress={() => setIsPayOSGuideExpanded(!isPayOSGuideExpanded)}
              >
                <Text style={styles.guideToggleText}>
                  {isPayOSGuideExpanded ? "Thu gọn hướng dẫn" : "Xem hướng dẫn"}
                </Text>
                <Ionicons
                  name={isPayOSGuideExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#1890ff"
                />
              </TouchableOpacity>

              {isPayOSGuideExpanded && (
                <View style={styles.guideContent}>
                  <View style={styles.guideStep}>
                    <View style={styles.guideStepNumber}>
                      <Text style={styles.guideStepNumberText}>1</Text>
                    </View>
                    <Text style={styles.guideStepText}>
                      Đăng ký tài khoản tại https://my.payos.vn
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <View style={styles.guideStepNumber}>
                      <Text style={styles.guideStepNumberText}>2</Text>
                    </View>
                    <Text style={styles.guideStepText}>
                      Liên kết tài khoản ngân hàng và xác thực
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <View style={styles.guideStepNumber}>
                      <Text style={styles.guideStepNumberText}>3</Text>
                    </View>
                    <Text style={styles.guideStepText}>
                      Tạo kênh thanh toán và lấy 3 key: Client ID, API Key,
                      Checksum Key
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <View style={styles.guideStepNumber}>
                      <Text style={styles.guideStepNumberText}>4</Text>
                    </View>
                    <Text style={styles.guideStepText}>
                      Nhập 3 key vào form và kích hoạt
                    </Text>
                  </View>

                  <View style={styles.guideStep}>
                    <View style={styles.guideStepNumber}>
                      <Text style={styles.guideStepNumberText}>5</Text>
                    </View>
                    <Text style={styles.guideStepText}>
                      Sao chép Webhook URL và dán vào PayOS
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Banks Section */}
        <View style={styles.banksSection}>
          <View style={styles.banksSectionHeader}>
            <Text style={styles.banksSectionTitle}>Ngân hàng VietQR</Text>
            <View style={styles.banksCount}>
              <Text style={styles.banksCountText}>
                <Text style={{ color: "#52c41a", fontWeight: "700" }}>
                  {banks.length}
                </Text>
                /
                <Text style={{ color: "#ef4444", fontWeight: "700" }}>
                  {vietQRBanks.length}
                </Text>
              </Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Tìm kiếm ngân hàng (MB, Vietcombank, BIDV...)..."
              placeholderTextColor="#9ca3af"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Banks Grid */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>
                Đang tải danh sách ngân hàng...
              </Text>
            </View>
          ) : paginatedBanks.length > 0 ? (
            <>
              <FlatList
                data={paginatedBanks}
                renderItem={renderBankItem}
                keyExtractor={(item: VietQRBank) => item.code}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.bankGrid}
                contentContainerStyle={styles.bankList}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[
                      styles.paginationBtn,
                      currentPage === 1 && styles.paginationBtnDisabled,
                    ]}
                    onPress={() =>
                      setCurrentPage((prev: number) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={currentPage === 1 ? "#d1d5db" : "#1890ff"}
                    />
                  </TouchableOpacity>

                  <Text style={styles.paginationText}>
                    Trang {currentPage} / {totalPages}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.paginationBtn,
                      currentPage === totalPages &&
                        styles.paginationBtnDisabled,
                    ]}
                    onPress={() =>
                      setCurrentPage((prev: number) =>
                        Math.min(totalPages, prev + 1)
                      )
                    }
                    disabled={currentPage === totalPages}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={currentPage === totalPages ? "#d1d5db" : "#1890ff"}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {searchText
                  ? `Không tìm thấy ngân hàng "${searchText}"`
                  : "Không có ngân hàng nào"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bank Modal */}
      <Modal
        visible={bankModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setBankModalVisible(false);
          resetBankForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBank ? "Chỉnh sửa" : "Liên kết"}{" "}
                {selectedBank?.shortName}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setBankModalVisible(false);
                  resetBankForm();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Số tài khoản *</Text>
              <TextInput
                style={styles.formInput}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Nhập số tài khoản (6-24 chữ số)"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                maxLength={24}
              />

              <Text style={styles.formLabel}>Tên chủ tài khoản *</Text>
              <TextInput
                style={styles.formInput}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="NGUYEN VAN A"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
              />

              <Text style={styles.formLabel}>Mẫu QR Code</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={qrTemplate}
                  onValueChange={(value: QRTemplate) => setQrTemplate(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Compact" value="compact" />
                  <Picker.Item label="Compact 2 (Mặc định)" value="compact2" />
                  <Picker.Item label="QR Only" value="qr_only" />
                  <Picker.Item label="Print" value="print" />
                </Picker>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={handleSaveBank}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnText}>
                      {editingBank ? "Cập nhật" : "Liên kết"}
                    </Text>
                  )}
                </TouchableOpacity>

                {editingBank && (
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnSecondary]}
                      onPress={() => handleOpenQRModal(editingBank)}
                    >
                      <Ionicons name="qr-code" size={16} color="#1890ff" />
                      <Text style={styles.modalBtnTextSecondary}>Tạo QR</Text>
                    </TouchableOpacity>

                    {!editingBank.isDefault && (
                      <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnSecondary]}
                        onPress={() => {
                          handleSetDefault(editingBank);
                          setBankModalVisible(false);
                          resetBankForm();
                        }}
                      >
                        <Ionicons name="star" size={16} color="#faad14" />
                        <Text style={styles.modalBtnTextSecondary}>
                          Đặt mặc định
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnDanger]}
                      onPress={() => {
                        setBankToDelete(editingBank);
                        setBankModalVisible(false);
                        setDeleteModalVisible(true);
                      }}
                    >
                      <Ionicons name="trash" size={16} color="#fff" />
                      <Text style={styles.modalBtnTextDanger}>
                        Ngắt kết nối
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setQrModalVisible(false);
          setQrData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo mã QR thanh toán</Text>
              <TouchableOpacity
                onPress={() => {
                  setQrModalVisible(false);
                  setQrData(null);
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {!qrData ? (
                <>
                  <Text style={styles.formLabel}>Số tiền (VND) *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formatNumber(qrAmount)}
                    onChangeText={(text: string) =>
                      setQrAmount(text.replace(/\./g, ""))
                    }
                    placeholder="100,000"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />

                  <Text style={styles.formLabel}>Nội dung chuyển khoản</Text>
                  <TextInput
                    style={[styles.formInput, { height: 80 }]}
                    value={qrDescription}
                    onChangeText={setQrDescription}
                    placeholder="Thanh toan don hang"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                  />

                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      styles.modalBtnPrimary,
                      { marginTop: 24 },
                    ]}
                    onPress={handleGenerateQR}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="qr-code" size={18} color="#fff" />
                        <Text style={styles.modalBtnText}>Tạo mã QR</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.qrResultContainer}>
                  <View style={styles.qrImageContainer}>
                    <Image
                      source={{ uri: qrData.qrUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.qrInfoCard}>
                    <View style={styles.qrInfoRow}>
                      <Text style={styles.qrInfoLabel}>Số tiền:</Text>
                      <Text style={styles.qrInfoValue}>
                        {formatVND(qrData.amount)}
                      </Text>
                    </View>
                    <View style={styles.qrInfoRow}>
                      <Text style={styles.qrInfoLabel}>Ngân hàng:</Text>
                      <Text style={styles.qrInfoValue}>{qrData.bankName}</Text>
                    </View>
                    <View style={styles.qrInfoRow}>
                      <Text style={styles.qrInfoLabel}>Số TK:</Text>
                      <Text style={styles.qrInfoValue}>
                        {qrData.accountNumber}
                      </Text>
                    </View>
                    <View style={styles.qrInfoRow}>
                      <Text style={styles.qrInfoLabel}>Chủ TK:</Text>
                      <Text style={styles.qrInfoValue}>
                        {qrData.accountName}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnSecondary]}
                    onPress={handleCopyQRUrl}
                  >
                    <Ionicons name="copy" size={16} color="#1890ff" />
                    <Text style={styles.modalBtnTextSecondary}>
                      Sao chép URL
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary]}
                    onPress={() => setQrData(null)}
                  >
                    <Ionicons name="reload" size={16} color="#fff" />
                    <Text style={styles.modalBtnText}>Tạo mã QR mới</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PayOS Modal */}
      <Modal
        visible={payosModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPayosModalVisible(false);
          resetPayOSForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kích hoạt PayOS</Text>
              <TouchableOpacity
                onPress={() => {
                  setPayosModalVisible(false);
                  resetPayOSForm();
                }}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.payosAlert}>
                <Ionicons name="information-circle" size={20} color="#1890ff" />
                <Text style={styles.payosAlertText}>
                  Nhập 3 key từ PayOS để kích hoạt tự động xác nhận thanh toán
                </Text>
              </View>

              <Text style={styles.formLabel}>Client ID *</Text>
              <TextInput
                style={styles.formInput}
                value={clientId}
                onChangeText={setClientId}
                placeholder="Nhập Client ID từ PayOS"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.formLabel}>API Key *</Text>
              <TextInput
                style={styles.formInput}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Nhập API Key từ PayOS"
                secureTextEntry
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.formLabel}>Checksum Key *</Text>
              <TextInput
                style={styles.formInput}
                value={checksumKey}
                onChangeText={setChecksumKey}
                placeholder="Nhập Checksum Key từ PayOS"
                secureTextEntry
                placeholderTextColor="#9ca3af"
              />

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { marginTop: 24 },
                ]}
                onPress={handleActivatePayOS}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="power" size={18} color="#fff" />
                    <Text style={styles.modalBtnText}>Kích hoạt PayOS</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "40%" }]}>
            <Text style={styles.deleteTitle}>Xác nhận ngắt kết nối</Text>
            <Text style={styles.deleteText}>
              Bạn có chắc muốn ngắt kết nối với{" "}
              <Text style={{ fontWeight: "700", color: "#111827" }}>
                {bankToDelete?.bankName}
              </Text>
              ?{"\n\n"}
              <Text style={{ color: "#ef4444" }}>
                Khách hàng sẽ không thể thanh toán qua QR của ngân hàng này nữa.
              </Text>
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary, { flex: 1 }]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setBankToDelete(null);
                }}
              >
                <Text style={styles.modalBtnTextSecondary}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger, { flex: 1 }]}
                onPress={handleDeleteBank}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnTextDanger}>Ngắt kết nối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PaymentSettingsScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: { fontSize: 14, color: "#6b7280", textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 14,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 13, color: "#6b7280" },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  payosSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  payosSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  payosTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  payosTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  payosActive: {
    alignItems: "center",
    paddingVertical: 24,
  },
  payosActiveTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#52c41a",
    marginTop: 12,
    marginBottom: 8,
  },
  payosActiveDesc: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  deactivateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  deactivateBtnText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  payosInactive: { gap: 12 },
  activateBtn: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#722ed1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  activateBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  activateBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  guideToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  guideToggleText: { fontSize: 14, fontWeight: "600", color: "#1890ff" },
  guideContent: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  guideStep: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  guideStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1890ff",
    alignItems: "center",
    justifyContent: "center",
  },
  guideStepNumberText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  guideStepText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  banksSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  banksSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  banksSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  banksCount: {
    backgroundColor: "#e6f4ff",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  banksCountText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  bankList: {
    paddingBottom: 16,
  },
  bankGrid: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  bankCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    alignItems: "center",
    position: "relative",
  },
  bankCardConnected: {
    borderColor: "#52c41a",
    borderWidth: 2,
  },
  connectedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#52c41a",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    zIndex: 1,
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  bankLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  bankShortName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  bankFullName: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    height: 32,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#faad14",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },
  paginationBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  paginationBtnDisabled: {
    backgroundColor: "#f3f4f6",
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
  },
  bottomSpacer: { height: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  modalBody: {
    padding: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  formInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: { height: 50 },
  modalActions: {
    marginTop: 24,
    gap: 12,
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalBtnPrimary: {
    backgroundColor: "#1890ff",
  },
  modalBtnSecondary: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#1890ff",
    flex: 1,
  },
  modalBtnDanger: {
    backgroundColor: "#ef4444",
    flex: 1,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  modalBtnTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1890ff",
  },
  modalBtnTextDanger: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  payosAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#e6f4ff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  payosAlertText: {
    flex: 1,
    fontSize: 14,
    color: "#1890ff",
    lineHeight: 20,
  },
  qrResultContainer: {
    gap: 16,
  },
  qrImageContainer: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  qrImage: {
    width: 280,
    height: 280,
  },
  qrInfoCard: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  qrInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qrInfoLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  qrInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
    padding: 20,
    paddingBottom: 0,
  },
  deleteText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteActions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
});
