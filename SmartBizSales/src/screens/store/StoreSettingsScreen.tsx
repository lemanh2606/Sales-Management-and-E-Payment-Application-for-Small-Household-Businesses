// src/screens/store/StoreSettingsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Switch,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient"; // 🚀 IMPORT APICLIENT
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerResult } from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";

// ========== TYPES ==========
interface OpeningHours {
  open: string;
  close: string;
  is24h: boolean;
}

interface Location {
  lat: number | null;
  lng: number | null;
}

interface StoreForm {
  _id?: string;
  name: string;
  address: string;
  phone: string;
  description: string;
  imageUrl: string;
  tags: string[];
  location: Location;
  openingHours: OpeningHours;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StoreResponse {
  message?: string;
  store: StoreForm;
}

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: "default" | "phone-pad" | "numeric" | "email-address";
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
}

// ========== SUB-COMPONENTS ==========
const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = "default",
  required = false,
  multiline = false,
  maxLength,
}) => {
  return (
    <View style={styles.inputContainer}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {maxLength && (
          <Text style={styles.charCount}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
      <View
        style={[styles.inputWrapper, multiline && styles.inputWrapperMultiline]}
      >
        <Ionicons
          name={icon}
          size={20}
          color="#6b7280"
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? "top" : "center"}
          maxLength={maxLength}
        />
      </View>
    </View>
  );
};

const SectionHeader: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  iconColor?: string;
}> = ({ icon, title, subtitle, iconColor = "#10b981" }) => (
  <View style={styles.sectionHeader}>
    <View
      style={[styles.sectionIconCircle, { backgroundColor: `${iconColor}15` }]}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
    <View style={styles.sectionTitleContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  </View>
);

const ToggleSection: React.FC<{
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}> = ({ label, value, onValueChange, icon, iconColor }) => (
  <View style={styles.toggleContainer}>
    <View style={styles.toggleLeft}>
      <View
        style={[styles.toggleIconCircle, { backgroundColor: `${iconColor}15` }]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#e5e7eb", true: "#10b981" }}
      thumbColor={value ? "#fff" : "#f3f4f6"}
      ios_backgroundColor="#e5e7eb"
    />
  </View>
);

// ========== MAIN COMPONENT ==========
const StoreSettingsScreen: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string>("basic");
  const fadeAnim = useState(new Animated.Value(0))[0];

  const [store, setStore] = useState<StoreForm>({
    name: "",
    address: "",
    phone: "",
    description: "",
    imageUrl: "",
    tags: [],
    location: { lat: null, lng: null },
    openingHours: { open: "08:00", close: "22:00", is24h: false },
    isActive: true,
  });

  useEffect(() => {
    fetchStore();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchStore = async (): Promise<void> => {
    try {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const currentStore = storeStr ? JSON.parse(storeStr) : null;
      const storeId = currentStore?._id;

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy cửa hàng");
        setLoading(false);
        return;
      }

      // 🚀 SỬ DỤNG APICLIENT
      const res = await apiClient.get<StoreResponse>(`/stores/${storeId}`);

      const data = res.data?.store || res.data;
      setStore({
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : [],
        openingHours: {
          open: data.openingHours?.open || "08:00",
          close: data.openingHours?.close || "22:00",
          is24h: data.openingHours?.is24h || false,
        },
        location: {
          lat: data.location?.lat || null,
          lng: data.location?.lng || null,
        },
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
    } catch (error) {
      console.error(" Fetch store error:", error);
      Alert.alert("Lỗi", "Không thể tải thông tin cửa hàng");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = (): void => {
    setRefreshing(true);
    fetchStore();
  };

  const handlePickImage = async (): Promise<void> => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh");
      return;
    }

    const result: ImagePickerResult = await ImagePicker.launchImageLibraryAsync(
      {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      }
    );

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setStore({ ...store, imageUrl: base64Image });
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!store.name.trim()) {
      Alert.alert("Lỗi", "Tên cửa hàng không được để trống");
      return;
    }

    if (store.phone && !/^[0-9+\-\s()]{10,15}$/.test(store.phone)) {
      Alert.alert("Lỗi", "Số điện thoại không hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const currentStore = storeStr ? JSON.parse(storeStr) : null;
      const storeId = currentStore?._id;

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy ID cửa hàng");
        return;
      }

      const payload: Partial<StoreForm> = {
        name: store.name,
        address: store.address,
        phone: store.phone,
        description: store.description,
        imageUrl: store.imageUrl,
        tags: store.tags,
        location: store.location,
        openingHours: store.openingHours,
        isActive: store.isActive,
      };

      // 🚀 SỬ DỤNG APICLIENT
      await apiClient.put(`/stores/${storeId}`, payload);

      // Update localStorage
      const updatedStore = { ...currentStore, ...payload };
      await AsyncStorage.setItem("currentStore", JSON.stringify(updatedStore));

      Alert.alert("Thành công", "Cập nhật thông tin cửa hàng thành công", [
        {
          text: "OK",
          onPress: () => fetchStore(),
        },
      ]);
    } catch (error) {
      console.error(" Save store error:", error);
      Alert.alert("Lỗi", "Không thể lưu thông tin cửa hàng");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMap = (): void => {
    if (store.location.lat && store.location.lng) {
      const url = `https://www.google.com/maps?q=${store.location.lat},${store.location.lng}`;
      Linking.openURL(url);
    } else {
      Alert.alert("Thông báo", "Chưa có tọa độ địa lý");
    }
  };

  const handleOpenHoursToggle = (is24h: boolean): void => {
    setStore({
      ...store,
      openingHours: {
        ...store.openingHours,
        is24h,
        open: is24h ? "00:00" : store.openingHours.open,
        close: is24h ? "23:59" : store.openingHours.close,
      },
    });
  };

  const NavigationTabs = () => (
    <View style={styles.navContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.navTabs}>
          {[
            { id: "basic", label: "Thông tin cơ bản", icon: "business" },
            { id: "hours", label: "Giờ hoạt động", icon: "time" },
            { id: "location", label: "Vị trí", icon: "map" },
            { id: "settings", label: "Cài đặt", icon: "settings" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.navTab,
                activeSection === tab.id && styles.navTabActive,
              ]}
              onPress={() => setActiveSection(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeSection === tab.id ? "#10b981" : "#6b7280"}
              />
              <Text
                style={[
                  styles.navTabText,
                  activeSection === tab.id && styles.navTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderBasicInfo = () => (
    <View style={styles.formSection}>
      <SectionHeader
        icon="business-outline"
        title="Thông tin cơ bản"
        subtitle="Thông tin hiển thị công khai của cửa hàng"
      />

      <InputField
        label="Tên cửa hàng"
        value={store.name}
        onChangeText={(text) => setStore({ ...store, name: text })}
        placeholder="Nhập tên cửa hàng"
        icon="storefront-outline"
        required
        maxLength={50}
      />

      <InputField
        label="Số điện thoại"
        value={store.phone}
        onChangeText={(text) => setStore({ ...store, phone: text })}
        placeholder="Nhập số điện thoại"
        icon="call-outline"
        keyboardType="phone-pad"
        maxLength={15}
      />

      <InputField
        label="Địa chỉ"
        value={store.address}
        onChangeText={(text) => setStore({ ...store, address: text })}
        placeholder="Nhập địa chỉ cửa hàng"
        icon="location-outline"
        maxLength={100}
      />

      <InputField
        label="Mô tả cửa hàng"
        value={store.description}
        onChangeText={(text) => setStore({ ...store, description: text })}
        placeholder="Mô tả về cửa hàng của bạn..."
        icon="document-text-outline"
        multiline
        maxLength={500}
      />
    </View>
  );

  const renderOpeningHours = () => (
    <View style={styles.formSection}>
      <SectionHeader
        icon="time-outline"
        title="Giờ hoạt động"
        subtitle="Thiết lập thời gian mở cửa của cửa hàng"
        iconColor="#f59e0b"
      />

      <ToggleSection
        label="Mở cửa 24/7"
        value={store.openingHours.is24h}
        onValueChange={handleOpenHoursToggle}
        icon="time"
        iconColor="#f59e0b"
      />

      {!store.openingHours.is24h && (
        <View style={styles.timeRow}>
          <View style={styles.timeInputContainer}>
            <Text style={styles.label}>Giờ mở cửa</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="sunny-outline"
                size={20}
                color="#f59e0b"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={store.openingHours.open}
                onChangeText={(text) =>
                  setStore({
                    ...store,
                    openingHours: { ...store.openingHours, open: text },
                  })
                }
                placeholder="08:00"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.timeInputContainer}>
            <Text style={styles.label}>Giờ đóng cửa</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="moon-outline"
                size={20}
                color="#6366f1"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={store.openingHours.close}
                onChangeText={(text) =>
                  setStore({
                    ...store,
                    openingHours: { ...store.openingHours, close: text },
                  })
                }
                placeholder="22:00"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          Thời gian mở cửa sẽ được hiển thị cho khách hàng khi tìm kiếm cửa hàng
        </Text>
      </View>
    </View>
  );

  const renderLocation = () => (
    <View style={styles.formSection}>
      <SectionHeader
        icon="map-outline"
        title="Vị trí cửa hàng"
        subtitle="Tọa độ địa lý để hiển thị trên bản đồ"
        iconColor="#3b82f6"
      />

      <View style={styles.timeRow}>
        <View style={styles.timeInputContainer}>
          <Text style={styles.label}>Vĩ độ (Latitude)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="location-outline"
              size={20}
              color="#3b82f6"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={store.location.lat?.toString() || ""}
              onChangeText={(text) =>
                setStore({
                  ...store,
                  location: {
                    ...store.location,
                    lat: parseFloat(text) || null,
                  },
                })
              }
              placeholder="21.0120439"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.timeInputContainer}>
          <Text style={styles.label}>Kinh độ (Longitude)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="location-outline"
              size={20}
              color="#3b82f6"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={store.location.lng?.toString() || ""}
              onChangeText={(text) =>
                setStore({
                  ...store,
                  location: {
                    ...store.location,
                    lng: parseFloat(text) || null,
                  },
                })
              }
              placeholder="105.5252407"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {store.location.lat && store.location.lng ? (
        <TouchableOpacity
          style={styles.mapButton}
          onPress={handleOpenMap}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#3b82f6", "#2563eb"]}
            style={styles.mapButtonGradient}
          >
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.mapButtonText}>Xem trên Google Maps</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.infoCard}>
          <Ionicons name="help-circle" size={20} color="#6b7280" />
          <Text style={styles.infoText}>
            Nhập tọa độ địa lý để khách hàng có thể tìm đường đến cửa hàng của
            bạn
          </Text>
        </View>
      )}
    </View>
  );

  const renderSettings = () => (
    <View style={styles.formSection}>
      <SectionHeader
        icon="settings-outline"
        title="Cài đặt cửa hàng"
        subtitle="Quản lý trạng thái hoạt động"
        iconColor="#8b5cf6"
      />

      <ToggleSection
        label="Cửa hàng đang hoạt động"
        value={store.isActive}
        onValueChange={(value) => setStore({ ...store, isActive: value })}
        icon="power"
        iconColor={store.isActive ? "#10b981" : "#ef4444"}
      />

      <View
        style={[
          styles.settingNote,
          store.isActive
            ? styles.settingNoteActive
            : styles.settingNoteInactive,
        ]}
      >
        <Ionicons
          name={store.isActive ? "checkmark-circle" : "close-circle"}
          size={20}
          color={store.isActive ? "#10b981" : "#ef4444"}
        />
        <Text style={styles.settingNoteText}>
          {store.isActive
            ? "✅ Cửa hàng đang hiển thị và khách hàng có thể đặt hàng"
            : "⚠️ Cửa hàng tạm thời ẩn, khách hàng không thể đặt hàng"}
        </Text>
      </View>

      {store.createdAt && (
        <View style={styles.metadataCard}>
          <View style={styles.metadataRow}>
            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            <Text style={styles.metadataLabel}>Ngày tạo:</Text>
            <Text style={styles.metadataValue}>
              {new Date(store.createdAt).toLocaleDateString("vi-VN")}
            </Text>
          </View>
          {store.updatedAt && (
            <View style={styles.metadataRow}>
              <Ionicons name="time-outline" size={16} color="#6b7280" />
              <Text style={styles.metadataLabel}>Cập nhật lần cuối:</Text>
              <Text style={styles.metadataValue}>
                {new Date(store.updatedAt).toLocaleDateString("vi-VN")}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <LinearGradient
          colors={["#10b981", "#059669"]}
          style={styles.loadingCircle}
        >
          <ActivityIndicator size="large" color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>Đang tải thông tin cửa hàng...</Text>
        <Text style={styles.loadingSubtext}>Vui lòng chờ trong giây lát</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10b981"]}
            tintColor="#10b981"
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header Section */}
          <LinearGradient colors={["#10b981", "#059669"]} style={styles.header}>
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                <View style={styles.avatarWrapper}>
                  {store.imageUrl ? (
                    <Image
                      source={{ uri: store.imageUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="storefront" size={48} color="#10b981" />
                    </View>
                  )}
                  <LinearGradient
                    colors={["#3b82f6", "#2563eb"]}
                    style={styles.cameraBtn}
                  >
                    <Ionicons name="camera" size={18} color="#fff" />
                  </LinearGradient>
                </View>
              </TouchableOpacity>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>
                  {store.name || "Cửa hàng của bạn"}
                </Text>
                <View style={styles.statusBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: store.isActive ? "#10b981" : "#ef4444",
                      },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {store.isActive ? "Đang hoạt động" : "Tạm đóng cửa"}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Navigation Tabs */}
          <NavigationTabs />

          {/* Content Sections */}
          {activeSection === "basic" && renderBasicInfo()}
          {activeSection === "hours" && renderOpeningHours()}
          {activeSection === "location" && renderLocation()}
          {activeSection === "settings" && renderSettings()}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={saving ? ["#9ca3af", "#6b7280"] : ["#10b981", "#059669"]}
              style={styles.saveBtnGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default StoreSettingsScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
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
    fontSize: 16,
    color: "#1f2937",
    fontWeight: "700",
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  navContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  navTabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  navTabActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  navTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginLeft: 6,
  },
  navTabTextActive: {
    color: "#10b981",
  },
  formSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  sectionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  required: {
    color: "#ef4444",
  },
  charCount: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputWrapperMultiline: {
    alignItems: "flex-start",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
    padding: 0,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeInputContainer: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginBottom: 16,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  mapButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mapButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  settingNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 10,
    borderWidth: 1,
  },
  settingNoteActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#d1fae5",
  },
  settingNoteInactive: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  settingNoteText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    lineHeight: 18,
  },
  metadataCard: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metadataLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  metadataValue: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "600",
  },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
