// src/screens/reports/TaxDeclarationScreen.tsx
import React, { useState, useEffect, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

dayjs.extend(quarterOfYear);
dayjs.locale("vi");

// ========== TYPES ==========
interface TaxDeclaration {
  _id: string;
  periodKey: string;
  periodType: string;
  version: number;
  declaredRevenue: number | { $numberDecimal: string };
  taxRates: {
    gtgt: number;
    tncn: number;
  };
  taxAmounts: {
    gtgt: number | { $numberDecimal: string };
    tncn: number | { $numberDecimal: string };
    total: number | { $numberDecimal: string };
  };
  status: "saved" | "submitted";
  createdAt: string;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface PreviewResponse {
  systemRevenue: number;
}

interface DeclarationsResponse {
  data: TaxDeclaration[];
}

type PeriodType = "" | "month" | "quarter" | "year" | "custom";

// ========== MAIN COMPONENT ==========
const TaxDeclarationScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [systemRevenue, setSystemRevenue] = useState<number | null>(null);

  // ✅ Collapsible states
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);
  const [isFormExpanded, setIsFormExpanded] = useState<boolean>(false);

  // Filters
  const [periodType, setPeriodType] = useState<PeriodType>("");
  const [periodKey, setPeriodKey] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number>(
    dayjs().month() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    dayjs().quarter()
  );

  // Custom range
  const [customMonthFrom, setCustomMonthFrom] = useState<number>(
    dayjs().month() + 1
  );
  const [customYearFrom, setCustomYearFrom] = useState<number>(dayjs().year());
  const [customMonthTo, setCustomMonthTo] = useState<number>(
    dayjs().month() + 1
  );
  const [customYearTo, setCustomYearTo] = useState<number>(dayjs().year());

  // Form values
  const [declaredRevenue, setDeclaredRevenue] = useState<string>("");
  const [gtgtRate, setGtgtRate] = useState<string>("1.0");
  const [tncnRate, setTncnRate] = useState<string>("0.5");
  const [calculatedTax, setCalculatedTax] = useState<{
    gtgt: number;
    tncn: number;
    total: number;
  } | null>(null);

  // Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ========== FORMAT VND ==========
  const formatVND = (
    value: number | { $numberDecimal: string } | undefined | null
  ): string => {
    if (!value) return "₫0";
    const num =
      typeof value === "object" ? parseFloat(value.$numberDecimal) : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // ========== FORMAT NUMBER ==========
  const formatNumber = (value: string): string => {
    const number = value.replace(/[^0-9]/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // ========== CALCULATE TAX ==========
  const calculateTax = (revenue: number, gtgt: number, tncn: number) => {
    const gtgtAmount = (revenue * gtgt) / 100;
    const tncnAmount = (revenue * tncn) / 100;
    const total = gtgtAmount + tncnAmount;
    return { gtgt: gtgtAmount, tncn: tncnAmount, total };
  };

  // ========== UPDATE PERIOD KEY ==========
  useEffect(() => {
    if (!periodType || periodType === "custom") {
      setPeriodKey("");
      return;
    }

    let key = "";
    if (periodType === "month") {
      key = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    } else if (periodType === "quarter") {
      key = `${selectedYear}-Q${selectedQuarter}`;
    } else if (periodType === "year") {
      key = selectedYear.toString();
    }
    setPeriodKey(key);
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  // ========== FETCH DECLARATIONS ==========
  const fetchDeclarations = async (
    isRefresh: boolean = false
  ): Promise<void> => {
    if (!storeId) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await apiClient.get<DeclarationsResponse>(
        `/taxs?shopId=${storeId}`
      );
      setDeclarations(response.data.data || []);
      console.log("✅ Lấy danh sách tờ khai thành công");
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy danh sách:", axiosError);
      Alert.alert("Lỗi", "Không thể tải danh sách tờ khai");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeclarations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // ========== CAN PREVIEW CHECK ==========
  const canPreview = (): boolean => {
    if (!periodType || loading) return false;

    if (periodType === "custom") {
      return !!(
        customMonthFrom &&
        customYearFrom &&
        customMonthTo &&
        customYearTo
      );
    }

    return !!periodKey;
  };

  // ========== FETCH PREVIEW ==========
  const fetchPreview = async (): Promise<void> => {
    if (!storeId || !periodType) {
      Alert.alert("Cảnh báo", "Vui lòng chọn kỳ báo cáo");
      return;
    }

    if (!canPreview()) {
      Alert.alert("Cảnh báo", "Vui lòng chọn thời gian cụ thể");
      return;
    }

    setLoading(true);

    try {
      let params = `shopId=${storeId}&periodType=${periodType}`;

      if (periodType === "custom") {
        params += `&monthFrom=${customYearFrom}-${String(
          customMonthFrom
        ).padStart(
          2,
          "0"
        )}&monthTo=${customYearTo}-${String(customMonthTo).padStart(2, "0")}`;
      } else {
        params += `&periodKey=${periodKey}`;
      }

      console.log("📡 Fetching preview with params:", params);

      const response = await apiClient.get<PreviewResponse>(
        `/taxs/preview?${params}`
      );

      setSystemRevenue(response.data.systemRevenue);
      setDeclaredRevenue(response.data.systemRevenue.toString());

      // ✅ Auto expand form, collapse filter
      setIsFormExpanded(true);
      setIsFilterExpanded(false);

      console.log("✅ Lấy preview thành công:", response.data.systemRevenue);
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy preview:", axiosError.response?.data);

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Không thể lấy doanh thu hệ thống";

      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ========== SAVE DECLARATION ==========
  const saveDeclaration = async (): Promise<void> => {
    if (!systemRevenue) {
      Alert.alert("Cảnh báo", "Vui lòng xem trước doanh thu trước");
      return;
    }

    const revenue = parseFloat(declaredRevenue.replace(/\./g, ""));
    const gtgt = parseFloat(gtgtRate);
    const tncn = parseFloat(tncnRate);

    if (isNaN(revenue) || isNaN(gtgt) || isNaN(tncn)) {
      Alert.alert("Lỗi", "Vui lòng nhập đúng định dạng số");
      return;
    }

    setLoading(true);

    try {
      const taxAmounts = calculateTax(revenue, gtgt, tncn);

      const payload: any = {
        periodType,
        periodKey:
          periodType === "custom"
            ? `${customYearFrom}-${String(customMonthFrom).padStart(
                2,
                "0"
              )} đến ${customYearTo}-${String(customMonthTo).padStart(2, "0")}`
            : periodKey,
        declaredRevenue: revenue,
        taxRates: { gtgt, tncn },
        taxAmounts,
      };

      if (periodType === "custom") {
        payload.monthFrom = `${customYearFrom}-${String(customMonthFrom).padStart(2, "0")}`;
        payload.monthTo = `${customYearTo}-${String(customMonthTo).padStart(2, "0")}`;
      }

      await apiClient.post(`/taxs?shopId=${storeId}`, payload);

      Alert.alert("Thành công", "Tạo tờ khai thành công!");

      // Reset form
      setDeclaredRevenue("");
      setGtgtRate("1.0");
      setTncnRate("0.5");
      setCalculatedTax(null);
      setSystemRevenue(null);
      setIsFormExpanded(false);

      fetchDeclarations();
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lưu tờ khai:", axiosError);
      Alert.alert("Lỗi", "Không thể lưu tờ khai");
    } finally {
      setLoading(false);
    }
  };

  // ========== DELETE DECLARATION ==========
  const deleteDeclaration = async (): Promise<void> => {
    if (!deletingId) return;

    setLoading(true);

    try {
      await apiClient.delete(`/taxs/${deletingId}?shopId=${storeId}`);
      Alert.alert("Thành công", "Xóa tờ khai thành công!");
      setDeleteModalVisible(false);
      setDeletingId(null);
      fetchDeclarations();
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi xóa:", axiosError);
      Alert.alert("Lỗi", "Không thể xóa tờ khai");
    } finally {
      setLoading(false);
    }
  };

  // ========== CALCULATE TAX PREVIEW ==========
  const handleCalculateTax = (): void => {
    const revenue = parseFloat(declaredRevenue.replace(/\./g, ""));
    const gtgt = parseFloat(gtgtRate);
    const tncn = parseFloat(tncnRate);

    if (isNaN(revenue) || isNaN(gtgt) || isNaN(tncn)) {
      Alert.alert("Lỗi", "Vui lòng nhập đúng định dạng số");
      return;
    }

    const result = calculateTax(revenue, gtgt, tncn);
    setCalculatedTax(result);
    Alert.alert("Thành công", "Đã tính toán xong!");
  };

  // ========== EXPORT CSV (NEW API) ==========
  const exportToCSV = async (): Promise<void> => {
    if (!declarations.length) {
      Alert.alert("Thông báo", "Chưa có dữ liệu để xuất");
      return;
    }

    try {
      // Build CSV content with BOM for proper UTF-8 encoding
      const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
      let csv =
        BOM +
        "Kỳ,Loại kỳ,Phiên bản,Doanh thu khai,Thuế GTGT,Thuế TNCN,Tổng thuế,Trạng thái,Ngày lập\n";

      declarations.forEach((item) => {
        const revenue =
          typeof item.declaredRevenue === "object"
            ? parseFloat(item.declaredRevenue.$numberDecimal)
            : item.declaredRevenue;

        const gtgt =
          typeof item.taxAmounts.gtgt === "object"
            ? parseFloat(item.taxAmounts.gtgt.$numberDecimal)
            : item.taxAmounts.gtgt;

        const tncn =
          typeof item.taxAmounts.tncn === "object"
            ? parseFloat(item.taxAmounts.tncn.$numberDecimal)
            : item.taxAmounts.tncn;

        const total =
          typeof item.taxAmounts.total === "object"
            ? parseFloat(item.taxAmounts.total.$numberDecimal)
            : item.taxAmounts.total;

        const row = [
          item.periodKey,
          item.periodType,
          item.version,
          revenue,
          gtgt,
          tncn,
          total,
          item.status === "submitted" ? "Đã nộp" : "Đã lưu",
          dayjs(item.createdAt).format("DD/MM/YYYY"),
        ].join(",");

        csv += row + "\n";
      });

      // Create file using new API
      const file = new File(
        Paths.cache,
        `kekhai-thue-${dayjs().format("YYYYMMDD-HHmmss")}.csv`
      );

      // ✅ Fix: Dùng write() trực tiếp với string, không cần encoding parameter
      file.write(csv);

      console.log("✅ File created at:", file.uri);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Xuất file Excel kê khai thuế",
          UTI: "public.comma-separated-values-text",
        });
        Alert.alert("Thành công", "Xuất file Excel thành công!");
      } else {
        Alert.alert("Lỗi", "Không thể chia sẻ file trên thiết bị này");
      }
    } catch (err) {
      console.error("❌ Lỗi xuất CSV:", err);
      Alert.alert("Lỗi", `Không thể xuất file CSV: ${err}`);
    }
  };

  // ========== GENERATE YEARS ==========
  const generateYears = (): number[] => {
    const currentYear = dayjs().year();
    const years: number[] = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years;
  };

  // ========== GET PERIOD DISPLAY TEXT ==========
  const getPeriodDisplayText = (): string => {
    if (!periodType) return "Chưa chọn kỳ";

    if (periodType === "month") {
      return `Tháng ${selectedMonth}/${selectedYear}`;
    } else if (periodType === "quarter") {
      return `Quý ${selectedQuarter}/${selectedYear}`;
    } else if (periodType === "year") {
      return `Năm ${selectedYear}`;
    } else if (periodType === "custom") {
      return `${customMonthFrom}/${customYearFrom} - ${customMonthTo}/${customYearTo}`;
    }
    return "";
  };

  // ========== RENDER DECLARATION ITEM ==========
  const renderDeclarationItem = ({
    item,
    index,
  }: {
    item: TaxDeclaration;
    index: number;
  }): JSX.Element => {
    const revenue =
      typeof item.declaredRevenue === "object"
        ? parseFloat(item.declaredRevenue.$numberDecimal)
        : item.declaredRevenue;

    const total =
      typeof item.taxAmounts.total === "object"
        ? parseFloat(item.taxAmounts.total.$numberDecimal)
        : item.taxAmounts.total;

    return (
      <View style={styles.declarationCard}>
        {/* Header */}
        <View style={styles.declarationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.declarationPeriod}>{item.periodKey}</Text>
            <Text style={styles.declarationVersion}>
              Phiên bản {item.version}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === "submitted" ? "#e6f4ff" : "#f6ffed",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: item.status === "submitted" ? "#1890ff" : "#52c41a" },
              ]}
            >
              {item.status === "submitted" ? "Đã nộp" : "Đã lưu"}
            </Text>
          </View>
        </View>

        {/* Revenue */}
        <View style={styles.declarationRow}>
          <Text style={styles.declarationLabel}>Doanh thu khai:</Text>
          <Text style={styles.declarationValue}>{formatVND(revenue)}</Text>
        </View>

        {/* Tax Details */}
        <View style={styles.taxDetailsGrid}>
          <View style={styles.taxDetailItem}>
            <Text style={styles.taxDetailLabel}>GTGT</Text>
            <Text style={styles.taxDetailValue}>{item.taxRates.gtgt}%</Text>
          </View>
          <View style={styles.taxDetailItem}>
            <Text style={styles.taxDetailLabel}>TNCN</Text>
            <Text style={styles.taxDetailValue}>{item.taxRates.tncn}%</Text>
          </View>
          <View style={styles.taxDetailItem}>
            <Text style={styles.taxDetailLabel}>Tổng thuế</Text>
            <Text style={[styles.taxDetailValue, { color: "#ef4444" }]}>
              {formatVND(total)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.declarationActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setDeletingId(item._id);
              setDeleteModalVisible(true);
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text style={styles.declarationDate}>
          {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
        </Text>
      </View>
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
          <Ionicons name="document-text" size={32} color="#722ed1" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Kê khai thuế</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
          <Ionicons name="download-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDeclarations(true)}
            colors={["#722ed1"]}
          />
        }
      >
        {/* ✅ Collapsible Filter Section */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setIsFilterExpanded(!isFilterExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.filterToggleLeft}>
              <Ionicons name="funnel" size={20} color="#722ed1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.filterToggleText}>
                  {isFilterExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
                </Text>
                {!isFilterExpanded && periodType && (
                  <Text style={styles.filterTogglePeriod}>
                    {getPeriodDisplayText()}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons
              name={isFilterExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#722ed1"
            />
          </TouchableOpacity>

          {isFilterExpanded && (
            <View style={styles.filterContent}>
              {/* Period Type */}
              <Text style={styles.filterLabel}>Kỳ kê khai</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={periodType}
                  onValueChange={(value: PeriodType) => {
                    setPeriodType(value);
                    setSystemRevenue(null);
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Chọn loại" value="" />
                  <Picker.Item label="Theo tháng" value="month" />
                  <Picker.Item label="Theo quý" value="quarter" />
                  <Picker.Item label="Theo năm" value="year" />
                  <Picker.Item label="Tùy chọn" value="custom" />
                </Picker>
              </View>

              {/* Period Selection - Non-Custom */}
              {periodType && periodType !== "custom" && (
                <>
                  <Text style={styles.filterLabel}>Năm</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedYear}
                      onValueChange={(value: number) => setSelectedYear(value)}
                      style={styles.picker}
                    >
                      {generateYears().map((year) => (
                        <Picker.Item
                          key={year}
                          label={year.toString()}
                          value={year}
                        />
                      ))}
                    </Picker>
                  </View>

                  {periodType === "month" && (
                    <>
                      <Text style={styles.filterLabel}>Tháng</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={selectedMonth}
                          onValueChange={(value: number) =>
                            setSelectedMonth(value)
                          }
                          style={styles.picker}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (month) => (
                              <Picker.Item
                                key={month}
                                label={`Tháng ${month}`}
                                value={month}
                              />
                            )
                          )}
                        </Picker>
                      </View>
                    </>
                  )}

                  {periodType === "quarter" && (
                    <>
                      <Text style={styles.filterLabel}>Quý</Text>
                      <View style={styles.pickerContainer}>
                        <Picker
                          selectedValue={selectedQuarter}
                          onValueChange={(value: number) =>
                            setSelectedQuarter(value)
                          }
                          style={styles.picker}
                        >
                          <Picker.Item label="Quý 1" value={1} />
                          <Picker.Item label="Quý 2" value={2} />
                          <Picker.Item label="Quý 3" value={3} />
                          <Picker.Item label="Quý 4" value={4} />
                        </Picker>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Custom Range */}
              {periodType === "custom" && (
                <>
                  <Text style={styles.filterLabel}>Từ tháng</Text>
                  <View style={styles.customRangeRow}>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                      <Picker
                        selectedValue={customMonthFrom}
                        onValueChange={(value: number) =>
                          setCustomMonthFrom(value)
                        }
                        style={styles.picker}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (month) => (
                            <Picker.Item
                              key={month}
                              label={`Tháng ${month}`}
                              value={month}
                            />
                          )
                        )}
                      </Picker>
                    </View>
                    <View
                      style={[
                        styles.pickerContainer,
                        { flex: 1, marginLeft: 8 },
                      ]}
                    >
                      <Picker
                        selectedValue={customYearFrom}
                        onValueChange={(value: number) =>
                          setCustomYearFrom(value)
                        }
                        style={styles.picker}
                      >
                        {generateYears().map((year) => (
                          <Picker.Item
                            key={year}
                            label={year.toString()}
                            value={year}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  <Text style={styles.filterLabel}>Đến tháng</Text>
                  <View style={styles.customRangeRow}>
                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                      <Picker
                        selectedValue={customMonthTo}
                        onValueChange={(value: number) =>
                          setCustomMonthTo(value)
                        }
                        style={styles.picker}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (month) => (
                            <Picker.Item
                              key={month}
                              label={`Tháng ${month}`}
                              value={month}
                            />
                          )
                        )}
                      </Picker>
                    </View>
                    <View
                      style={[
                        styles.pickerContainer,
                        { flex: 1, marginLeft: 8 },
                      ]}
                    >
                      <Picker
                        selectedValue={customYearTo}
                        onValueChange={(value: number) =>
                          setCustomYearTo(value)
                        }
                        style={styles.picker}
                      >
                        {generateYears().map((year) => (
                          <Picker.Item
                            key={year}
                            label={year.toString()}
                            value={year}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  !canPreview() && styles.actionBtnDisabled,
                ]}
                onPress={fetchPreview}
                disabled={!canPreview()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#722ed1", "#531dab"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionBtnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="eye" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>
                        Xem trước doanh thu
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ✅ Collapsible Form Section */}
        {systemRevenue !== null && (
          <View style={styles.formSection}>
            <TouchableOpacity
              style={styles.formToggle}
              onPress={() => setIsFormExpanded(!isFormExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.formToggleLeft}>
                <Ionicons name="document-attach" size={20} color="#722ed1" />
                <Text style={styles.formToggleText}>
                  {isFormExpanded
                    ? "Thu gọn form kê khai"
                    : "Mở rộng form kê khai"}
                </Text>
              </View>
              <Ionicons
                name={isFormExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#722ed1"
              />
            </TouchableOpacity>

            {isFormExpanded && (
              <View style={styles.formContent}>
                {/* System Revenue Display */}
                <View style={styles.systemRevenueCard}>
                  <Text style={styles.systemRevenueLabel}>
                    Doanh thu hệ thống (tham khảo)
                  </Text>
                  <Text style={styles.systemRevenueValue}>
                    {formatVND(systemRevenue)}
                  </Text>
                  <TouchableOpacity
                    style={styles.useSystemBtn}
                    onPress={() => setDeclaredRevenue(systemRevenue.toString())}
                  >
                    <Ionicons name="sync" size={16} color="#722ed1" />
                    <Text style={styles.useSystemBtnText}>
                      Dùng doanh thu hệ thống
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Declared Revenue */}
                <Text style={styles.formLabel}>Doanh thu khai báo (VND)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formatNumber(declaredRevenue)}
                  onChangeText={(text) =>
                    setDeclaredRevenue(text.replace(/\./g, ""))
                  }
                  placeholder="Nhập doanh thu"
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />

                {/* Tax Rates */}
                <View style={styles.taxRatesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Thuế GTGT (%)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={gtgtRate}
                      onChangeText={setGtgtRate}
                      placeholder="1.0"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.formLabel}>Thuế TNCN (%)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={tncnRate}
                      onChangeText={setTncnRate}
                      placeholder="0.5"
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                {/* Calculated Tax Display */}
                {calculatedTax && (
                  <View style={styles.calculatedTaxCard}>
                    <Text style={styles.calculatedTaxTitle}>Dự tính thuế</Text>
                    <View style={styles.calculatedTaxRow}>
                      <Text style={styles.calculatedTaxLabel}>Thuế GTGT:</Text>
                      <Text style={styles.calculatedTaxValue}>
                        {formatVND(calculatedTax.gtgt)}
                      </Text>
                    </View>
                    <View style={styles.calculatedTaxRow}>
                      <Text style={styles.calculatedTaxLabel}>Thuế TNCN:</Text>
                      <Text style={styles.calculatedTaxValue}>
                        {formatVND(calculatedTax.tncn)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.calculatedTaxRow,
                        {
                          borderTopWidth: 1,
                          borderTopColor: "#e5e7eb",
                          paddingTop: 12,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calculatedTaxLabel,
                          { fontWeight: "700" },
                        ]}
                      >
                        Tổng thuế:
                      </Text>
                      <Text
                        style={[
                          styles.calculatedTaxValue,
                          { color: "#ef4444", fontWeight: "700", fontSize: 18 },
                        ]}
                      >
                        {formatVND(calculatedTax.total)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.calculateBtn}
                    onPress={handleCalculateTax}
                  >
                    <Ionicons name="calculator" size={18} color="#fff" />
                    <Text style={styles.calculateBtnText}>Tính toán</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
                    onPress={saveDeclaration}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={["#52c41a", "#389e0d"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveBtnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#fff"
                          />
                          <Text style={styles.saveBtnText}>Lưu tờ khai</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Declarations List */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Lịch sử kê khai</Text>
            <Text style={styles.listHeaderCount}>
              {declarations.length} tờ khai
            </Text>
          </View>

          {declarations.length > 0 ? (
            <FlatList
              data={declarations}
              renderItem={renderDeclarationItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.declarationList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>
                Chưa có tờ khai nào. Tạo tờ khai để xem!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Xác nhận xóa</Text>
            <Text style={styles.modalText}>
              Bạn có chắc muốn xóa tờ khai này không?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={deleteDeclaration}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalDeleteText}>Xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TaxDeclarationScreen;

// ========== STYLES (giữ nguyên như bản trước) ==========
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
    backgroundColor: "#f9f0ff",
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
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#722ed1",
    alignItems: "center",
    justifyContent: "center",
  },
  filterSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  filterToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  filterToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  filterToggleText: { fontSize: 16, fontWeight: "700", color: "#722ed1" },
  filterTogglePeriod: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: { height: 50 },
  customRangeRow: { flexDirection: "row" },
  actionBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
    shadowColor: "#722ed1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  formSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  formToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  formToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  formToggleText: { fontSize: 16, fontWeight: "700", color: "#722ed1" },
  formContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  systemRevenueCard: {
    backgroundColor: "#f0f5ff",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  systemRevenueLabel: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  systemRevenueValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1890ff",
    marginBottom: 12,
  },
  useSystemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderRadius: 8,
  },
  useSystemBtnText: { fontSize: 14, fontWeight: "600", color: "#722ed1" },
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
  taxRatesRow: { flexDirection: "row" },
  calculatedTaxCard: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  calculatedTaxTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  calculatedTaxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  calculatedTaxLabel: { fontSize: 14, color: "#6b7280" },
  calculatedTaxValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  formActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  calculateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#faad14",
    paddingVertical: 14,
    borderRadius: 12,
  },
  calculateBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  saveBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  listSection: { marginHorizontal: 16, marginTop: 16 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listHeaderTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  listHeaderCount: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  declarationList: { gap: 12 },
  declarationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  declarationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  declarationPeriod: { fontSize: 16, fontWeight: "700", color: "#111827" },
  declarationVersion: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: "700" },
  declarationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  declarationLabel: { fontSize: 14, color: "#6b7280" },
  declarationValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
  taxDetailsGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  taxDetailItem: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  taxDetailLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  taxDetailValue: { fontSize: 14, fontWeight: "700", color: "#111827" },
  declarationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  declarationDate: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 12,
    textAlign: "right",
  },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
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
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, fontWeight: "700", color: "#6b7280" },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalDeleteText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
