// src/screens/settings/ProfileScreen.tsx
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
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "../../context/AuthContext";
import {
  updateProfile,
  sendPasswordOTP,
  changePassword,
} from "../../api/userApi";

// ========== TYPES ==========
interface UserProfile {
  _id: string;
  username: string;
  fullname?: string;
  email?: string;
  phone?: string;
  role: string;
  isVerified: boolean;
  isDeleted: boolean;
  image?: string;
}

interface ProfileFormData {
  fullname: string;
  email: string;
  phone: string;
}

interface PasswordFormData {
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

// ========== MAIN COMPONENT ==========
const ProfileScreen: React.FC = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Profile form
  const [profileData, setProfileData] = useState<ProfileFormData>({
    fullname: "",
    email: "",
    phone: "",
  });

  // Avatar
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState<boolean>(false);
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [sendingOTP, setSendingOTP] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    loadUserData();
  }, [user]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const loadUserData = () => {
    if (user) {
      setProfileData({
        fullname: user.fullname || "",
        email: user.email || "",
        phone: user.phone || "",
      });
      setImagePreview(user.image || null);
      setLoading(false);
    }
  };

  const formatTime = (sec: number): string => {
    if (!sec || sec <= 0) return "00:00";
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(
      sec % 60
    ).padStart(2, "0")}`;
  };

  // ========== IMAGE COMPRESSION ==========
  const compressImage = async (uri: string): Promise<string> => {
    try {
      console.log("🔄 Compressing image...");
      setCompressing(true);

      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Resize to 800px width
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!manipResult.base64) {
        throw new Error("Failed to convert image to base64");
      }

      const base64Image = `data:image/jpeg;base64,${manipResult.base64}`;

      // Calculate size
      const sizeInMB = (base64Image.length * 0.75) / (1024 * 1024);
      console.log(`✅ Compressed image size: ${sizeInMB.toFixed(2)}MB`);

      if (sizeInMB > 5) {
        throw new Error("Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác");
      }

      return base64Image;
    } catch (error: any) {
      console.error("❌ Image compression error:", error);
      throw error;
    } finally {
      setCompressing(false);
    }
  };

  // ========== IMAGE HANDLING ==========
  const handlePickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        // ✅ Compress image
        const compressedBase64 = await compressImage(result.assets[0].uri);

        setSelectedImage(compressedBase64);
        setImagePreview(compressedBase64);

        Alert.alert(
          "Thành công",
          "Ảnh đã được chọn và nén. Nhấn Lưu để cập nhật."
        );
      } catch (error: any) {
        console.error("❌ Image processing error:", error);
        Alert.alert("Lỗi", error.message || "Không thể xử lý ảnh");
      }
    }
  };

  const handleRemoveImage = async () => {
    Alert.alert("Xóa ảnh đại diện", "Bạn có chắc muốn xóa ảnh đại diện?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            console.log("🗑️ Removing image...");

            // ✅ Call API with removeImage option
            const response = await updateProfile(profileData, {
              removeImage: true,
            });

            console.log("✅ Image removed:", response);

            const updatedUser = response.user;
            setUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

            setImagePreview(null);
            setSelectedImage(null);

            Alert.alert("Thành công", "Đã xóa ảnh đại diện");
          } catch (error: any) {
            console.error("❌ Remove image error:", error);
            Alert.alert(
              "Lỗi",
              error?.response?.data?.message || "Không thể xóa ảnh đại diện"
            );
          }
        },
      },
    ]);
  };

  // ========== SAVE PROFILE ==========
  const handleSaveProfile = async () => {
    if (!profileData.fullname.trim()) {
      Alert.alert("Lỗi", "Họ và tên không được để trống");
      return;
    }

    setSaving(true);
    try {
      console.log("📝 Updating profile...", {
        hasSelectedImage: !!selectedImage,
        fullname: profileData.fullname,
        email: profileData.email,
        phone: profileData.phone,
      });

      // ✅ Call API with imageBase64 option if image is selected
      const response = await updateProfile(
        {
          fullname: profileData.fullname,
          email: profileData.email,
          phone: profileData.phone,
        },
        selectedImage ? { imageBase64: selectedImage } : {}
      );

      console.log("✅ Profile updated:", response);

      const updatedUser = response.user;
      setUser(updatedUser);
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

      setSelectedImage(null);
      Alert.alert("Thành công", "Cập nhật thông tin thành công");
    } catch (error: any) {
      console.error("❌ Save profile error:", error);
      console.error("Error details:", {
        message: error?.message,
        response: error?.response?.data,
      });

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.message ||
          "Không thể cập nhật thông tin"
      );
    } finally {
      setSaving(false);
    }
  };

  // ========== PASSWORD CHANGE ==========
  const handleSendOTP = async () => {
    if (timer > 0) return;

    if (!profileData.email) {
      Alert.alert("Lỗi", "Vui lòng cập nhật email trước khi đổi mật khẩu");
      return;
    }

    setSendingOTP(true);
    try {
      console.log("📧 Sending OTP to:", profileData.email);

      // ✅ Call API
      const res = await sendPasswordOTP({ email: profileData.email });

      console.log("✅ OTP sent:", res);

      setOtpSent(true);
      setTimer(300); // 5 minutes
      Alert.alert("Thành công", "Mã OTP đã được gửi đến email của bạn");
    } catch (error: any) {
      console.error("❌ Send OTP error:", error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message || error?.message || "Không thể gửi OTP"
      );
    } finally {
      setSendingOTP(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.otp.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã OTP");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải ít nhất 6 ký tự");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp");
      return;
    }

    setChangingPassword(true);
    try {
      console.log("🔐 Changing password...");

      // ✅ Call API
      await changePassword({
        password: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
        otp: passwordData.otp,
      });

      console.log("✅ Password changed successfully");

      setPasswordData({ otp: "", newPassword: "", confirmPassword: "" });
      setOtpSent(false);
      setShowPasswordForm(false);
      setTimer(0);

      Alert.alert("Thành công", "Đổi mật khẩu thành công");
    } catch (error: any) {
      console.error("❌ Change password error:", error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.message ||
          "Không thể đổi mật khẩu"
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>
          <Text style={styles.headerSubtitle}>Quản lý thông tin của bạn</Text>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {imagePreview ? (
              <Image source={{ uri: imagePreview }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={56} color="#d1d5db" />
              </View>
            )}
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={handlePickImage}
              disabled={compressing}
            >
              {compressing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.avatarHint}>
            {compressing ? "Đang nén ảnh..." : "Nhấn để thay đổi ảnh"}
          </Text>
          {imagePreview && !compressing && (
            <TouchableOpacity
              onPress={handleRemoveImage}
              style={styles.removeBtn}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={styles.removeBtnText}>Xóa ảnh</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Form */}
        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={22} color="#10b981" />
            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
          </View>

          <Text style={styles.label}>Tên đăng nhập</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Ionicons name="at-outline" size={20} color="#9ca3af" />
            <Text style={styles.inputTextDisabled}>{user?.username}</Text>
          </View>

          <Text style={styles.label}>
            Họ và tên <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.input}>
            <Ionicons name="person-outline" size={20} color="#6b7280" />
            <TextInput
              style={styles.inputText}
              value={profileData.fullname}
              onChangeText={(text) =>
                setProfileData({ ...profileData, fullname: text })
              }
              placeholder="Nhập họ và tên"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={styles.input}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
            <TextInput
              style={styles.inputText}
              value={profileData.email}
              onChangeText={(text) =>
                setProfileData({ ...profileData, email: text })
              }
              placeholder="Nhập email"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Số điện thoại</Text>
          <View style={styles.input}>
            <Ionicons name="call-outline" size={20} color="#6b7280" />
            <TextInput
              style={styles.inputText}
              value={profileData.phone}
              onChangeText={(text) =>
                setProfileData({ ...profileData, phone: text })
              }
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          {/* Status Badges */}
          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Vai trò</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[styles.statusDot, { backgroundColor: "#3b82f6" }]}
                />
                <Text style={styles.statusText}>
                  {user?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
                </Text>
              </View>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Email</Text>
              <View
                style={[
                  styles.statusBadge,
                  user?.isVerified
                    ? styles.statusSuccess
                    : styles.statusWarning,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: user?.isVerified ? "#10b981" : "#f59e0b",
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {user?.isVerified ? "Đã xác thực" : "Chưa xác thực"}
                </Text>
              </View>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Tài khoản</Text>
              <View
                style={[
                  styles.statusBadge,
                  user?.isDeleted ? styles.statusDanger : styles.statusSuccess,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: user?.isDeleted ? "#ef4444" : "#10b981",
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {user?.isDeleted ? "Đã khóa" : "Hoạt động"}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              (saving || compressing) && styles.saveBtnDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={saving || compressing}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.saveBtnText}>Đang lưu...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>Lưu thông tin</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Password Section */}
        <View style={styles.formCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={22} color="#ef4444" />
            <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>
          </View>

          {!showPasswordForm ? (
            <TouchableOpacity
              style={styles.showPasswordBtn}
              onPress={() => setShowPasswordForm(true)}
            >
              <Ionicons name="key-outline" size={20} color="#10b981" />
              <Text style={styles.showPasswordBtnText}>Đổi mật khẩu</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.otpBtn,
                  (timer > 0 || sendingOTP) && styles.otpBtnDisabled,
                ]}
                onPress={handleSendOTP}
                disabled={timer > 0 || sendingOTP}
              >
                {sendingOTP ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={20} color="#fff" />
                    <Text style={styles.otpBtnText}>
                      {timer > 0
                        ? `Chờ gửi lại (${formatTime(timer)})`
                        : "Gửi OTP đến Email"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {otpSent && (
                <>
                  <Text style={styles.label}>Mã OTP</Text>
                  <View style={styles.input}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#6b7280"
                    />
                    <TextInput
                      style={styles.inputText}
                      value={passwordData.otp}
                      onChangeText={(text) =>
                        setPasswordData({ ...passwordData, otp: text })
                      }
                      placeholder="Nhập mã OTP"
                      placeholderTextColor="#9ca3af"
                      maxLength={6}
                      keyboardType="number-pad"
                    />
                  </View>

                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <View style={styles.input}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#6b7280"
                    />
                    <TextInput
                      style={styles.inputText}
                      value={passwordData.newPassword}
                      onChangeText={(text) =>
                        setPasswordData({ ...passwordData, newPassword: text })
                      }
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry
                    />
                  </View>

                  <Text style={styles.label}>Xác nhận mật khẩu</Text>
                  <View style={styles.input}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#6b7280"
                    />
                    <TextInput
                      style={styles.inputText}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: text,
                        })
                      }
                      placeholder="Xác nhận mật khẩu mới"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.passwordActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        setShowPasswordForm(false);
                        setOtpSent(false);
                        setTimer(0);
                        setPasswordData({
                          otp: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                      }}
                    >
                      <Text style={styles.cancelBtnText}>Hủy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.changePasswordBtn,
                        changingPassword && styles.changePasswordBtnDisabled,
                      ]}
                      onPress={handleChangePassword}
                      disabled={changingPassword}
                    >
                      {changingPassword ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#fff"
                          />
                          <Text style={styles.changePasswordBtnText}>
                            Đổi mật khẩu
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ProfileScreen;

// ========== STYLES (giữ nguyên như cũ) ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b" },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 14, color: "#6b7280" },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#fff",
  },
  avatarWrapper: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#e5e7eb",
  },
  avatarPlaceholder: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  avatarHint: { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
  },
  removeBtnText: { fontSize: 13, color: "#ef4444", fontWeight: "600" },
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  required: { color: "#ef4444" },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inputDisabled: { backgroundColor: "#f3f4f6" },
  inputText: { flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" },
  inputTextDisabled: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#9ca3af",
  },
  statusGrid: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statusCard: { flex: 1 },
  statusLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  statusSuccess: { backgroundColor: "#ecfdf5" },
  statusWarning: { backgroundColor: "#fef3c7" },
  statusDanger: { backgroundColor: "#fef2f2" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "700", color: "#374151", flex: 1 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnDisabled: { backgroundColor: "#9ca3af" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  showPasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#10b981",
    borderStyle: "dashed",
  },
  showPasswordBtnText: { fontSize: 15, fontWeight: "700", color: "#10b981" },
  otpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  otpBtnDisabled: { backgroundColor: "#9ca3af" },
  otpBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  passwordActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#6b7280" },
  changePasswordBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
  },
  changePasswordBtnDisabled: { backgroundColor: "#9ca3af" },
  changePasswordBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
