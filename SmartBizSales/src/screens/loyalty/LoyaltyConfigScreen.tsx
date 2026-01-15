// src/screens/loyalty/LoyaltyConfigScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

// ========== TYPES ==========
interface LoyaltyConfig {
  pointsPerVND: number;
  vndPerPoint: number;
  minOrderValue: number;
  isActive: boolean;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface LoyaltyConfigResponse {
  config: LoyaltyConfig;
  message?: string;
}

// ========== DEFAULT CONFIG ==========
const DEFAULT_CONFIG: LoyaltyConfig = {
  pointsPerVND: 1 / 20000, // 20.000 VNĐ = 1 điểm
  vndPerPoint: 100, // 1 điểm = 100 VNĐ
  minOrderValue: 0,
  isActive: false,
};

// ========== MAIN COMPONENT ==========
const LoyaltyConfigScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [config, setConfig] = useState<LoyaltyConfig>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [pointsPerVND, setPointsPerVND] = useState<string>("");
  const [vndPerPoint, setVndPerPoint] = useState<string>("");
  const [minOrderValue, setMinOrderValue] = useState<string>("");

  useEffect(() => {
    if (!storeId) {
      setError("Chưa chọn cửa hàng");
      setLoading(false);
      return;
    }
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // ========== FETCH CONFIG ==========
  const fetchConfig = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<LoyaltyConfigResponse>(
        `/loyaltys/config/${storeId}`
      );
      const apiConfig: LoyaltyConfig = response.data.config || DEFAULT_CONFIG;

      setConfig(apiConfig);
      setIsActive(apiConfig.isActive);

      // Set form values
      setPointsPerVND(apiConfig.pointsPerVND.toString());
      setVndPerPoint(apiConfig.vndPerPoint.toString());
      setMinOrderValue(apiConfig.minOrderValue.toString());

      console.log("✅ Lấy config tích điểm thành công:", apiConfig);
    } catch (err) {
      const axiosError = err as any;
      console.error(" Lỗi lấy config:", axiosError);

      if (axiosError.response?.status === 404) {
        // 404: Chưa setup
        Alert.alert(
          "Hệ thống tích điểm",
          "Chưa cấu hình hệ thống tích điểm cho cửa hàng. Hãy thiết lập để bắt đầu tích điểm cho khách hàng!",
          [{ text: "OK" }]
        );
        setConfig(DEFAULT_CONFIG);
        setIsActive(false);
        setPointsPerVND(DEFAULT_CONFIG.pointsPerVND.toString());
        setVndPerPoint(DEFAULT_CONFIG.vndPerPoint.toString());
        setMinOrderValue(DEFAULT_CONFIG.minOrderValue.toString());
      } else {
        const errorMessage =
          axiosError.response?.data?.message ||
          axiosError.response?.data?.error ||
          "Lỗi lấy cấu hình";
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // ========== TOGGLE ACTIVE ==========
  const handleToggle = async (value: boolean): Promise<void> => {
    setIsActive(value);
    setSaving(true);

    try {
      const response = await apiClient.post<LoyaltyConfigResponse>(
        `/loyaltys/config/${storeId}`,
        {
          isActive: value,
        }
      );

      console.log(
        "✅ Toggle isActive thành công:",
        response.data.config.isActive
      );

      if (response.data.config) {
        setConfig(response.data.config);
      }

      Alert.alert(
        "Cập nhật trạng thái",
        value
          ? "Hệ thống tích điểm đã được bật!"
          : "Hệ thống tích điểm đã được tắt!",
        [{ text: "OK" }]
      );
    } catch (err) {
      const axiosError = err as any;
      console.error(" Lỗi toggle:", axiosError);
      setIsActive(!value); // Revert

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Không thể cập nhật trạng thái tích điểm";

      Alert.alert("Lỗi cập nhật", errorMessage, [{ text: "OK" }]);
    } finally {
      setSaving(false);
    }
  };

  // ========== SAVE CONFIG ==========
  const handleSave = async (): Promise<void> => {
    if (!isActive) {
      Alert.alert("Thông báo", "Hệ thống tích điểm đang tắt, không cần lưu");
      return;
    }

    // Validate
    const pointsValue: number = parseFloat(pointsPerVND);
    const vndValue: number = parseFloat(vndPerPoint);
    const minValue: number = parseFloat(minOrderValue);

    if (isNaN(pointsValue) || pointsValue <= 0) {
      Alert.alert("Lỗi", "Tỉ lệ tích điểm phải lớn hơn 0");
      return;
    }

    if (isNaN(vndValue) || vndValue < 0) {
      Alert.alert("Lỗi", "Giá trị 1 điểm phải lớn hơn hoặc bằng 0");
      return;
    }

    if (isNaN(minValue) || minValue < 0) {
      Alert.alert("Lỗi", "Đơn hàng tối thiểu phải lớn hơn hoặc bằng 0");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Partial<LoyaltyConfig> = {
        pointsPerVND: pointsValue,
        vndPerPoint: vndValue,
        minOrderValue: minValue,
        isActive: true,
      };

      const response = await apiClient.post<LoyaltyConfigResponse>(
        `/loyaltys/config/${storeId}`,
        payload
      );

      console.log("✅ Lưu config thành công:", response.data.config);

      Alert.alert("Thành công", "Cấu hình đã được lưu thành công!", [
        { text: "OK" },
      ]);

      if (response.data.config) {
        setConfig(response.data.config);
      } else {
        await fetchConfig();
      }
    } catch (err) {
      const axiosError = err as any;
      console.error(" Lỗi lưu config:", axiosError);

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Lỗi lưu cấu hình";

      setError(errorMessage);
      Alert.alert("Lỗi lưu cấu hình", errorMessage, [{ text: "OK" }]);
    } finally {
      setSaving(false);
    }
  };

  // ========== FORMAT NUMBER ==========
  const formatNumber = (value: string): string => {
    const number: string = value.replace(/[^0-9]/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumber = (value: string): string => {
    return value.replace(/\./g, "");
  };

  // ========== RENDER ==========
  if (!storeId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.errorText}>
          Vui lòng chọn cửa hàng trước khi cấu hình
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="gift" size={32} color="#10b981" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Cấu hình tích điểm</Text>
            <Text style={styles.headerSubtitle}>
              Thiết lập hệ thống tích điểm cho khách hàng
            </Text>
          </View>
        </View>

        {/* Toggle Card */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleTitle}>Bật/Tắt Hệ Thống Tích Điểm</Text>
            <Text style={styles.toggleSubtitle}>
              Khi <Text style={styles.activeText}>bật</Text>, khách hàng sẽ tự
              động tích điểm theo đơn hàng
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={handleToggle}
            trackColor={{ false: "#d1d5db", true: "#6ee7b7" }}
            thumbColor={isActive ? "#10b981" : "#f3f4f6"}
            disabled={saving}
          />
        </View>

        {/* Error Alert */}
        {error && (
          <View style={styles.errorAlert}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorAlertText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Form - Only show when active */}
        {isActive ? (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Ionicons name="settings-outline" size={22} color="#3b82f6" />
              <Text style={styles.formTitle}>Cài đặt chi tiết</Text>
            </View>

            {/* Points Per VND */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tỉ lệ tích điểm <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.hint}>VD: 0.00005 = 20.000 VNĐ = 1 điểm</Text>
              <TextInput
                style={styles.input}
                value={pointsPerVND}
                onChangeText={setPointsPerVND}
                placeholder="0.00005"
                keyboardType="decimal-pad"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.description}>
                💡 Số tiền này tương ứng 1 điểm. VD: nhập 0.00005 thì đơn
                200.000 được 10 điểm
              </Text>
            </View>

            {/* VND Per Point */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Giá trị 1 điểm <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.hint}>VD: 100 VNĐ</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={formatNumber(vndPerPoint)}
                  onChangeText={(text: string) =>
                    setVndPerPoint(parseNumber(text))
                  }
                  placeholder="100"
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.suffix}>VNĐ</Text>
              </View>
              <Text style={styles.description}>
                💡 Mỗi điểm khách dùng sẽ giảm số tiền tương ứng
              </Text>
            </View>

            {/* Min Order Value */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Đơn hàng tối thiểu <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.hint}>VD: 50.000 VNĐ</Text>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={formatNumber(minOrderValue)}
                  onChangeText={(text: string) =>
                    setMinOrderValue(parseNumber(text))
                  }
                  placeholder="50000"
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.suffix}>VNĐ</Text>
              </View>
              <Text style={styles.description}>
                💡 Đơn hàng dưới mức này sẽ không được tích điểm
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#10b981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.saveBtnText}>Lưu cấu hình</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          // Info Alert when disabled
          <View style={styles.infoAlert}>
            <Ionicons name="information-circle" size={24} color="#3b82f6" />
            <View style={styles.infoAlertTextContainer}>
              <Text style={styles.infoAlertTitle}>
                Hệ thống tích điểm đang tắt
              </Text>
              <Text style={styles.infoAlertText}>
                Bật công tắc ở trên để kích hoạt. Khi tắt, khách hàng sẽ không
                được cộng điểm.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoyaltyConfigScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
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
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 16,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  activeText: {
    fontWeight: "700",
    color: "#10b981",
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    color: "#991b1b",
    fontWeight: "600",
  },
  infoAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#eff6ff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoAlertTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoAlertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e40af",
    marginBottom: 4,
  },
  infoAlertText: {
    fontSize: 13,
    color: "#1e40af",
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
  },
  required: {
    color: "#ef4444",
  },
  hint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  inputFlex: {
    flex: 1,
  },
  inputWithSuffix: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  suffix: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginLeft: 8,
  },
  description: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    lineHeight: 16,
  },
  saveBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomSpacer: {
    height: 40,
  },
});
