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
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { useAuth } from "../../context/AuthContext";
import { sendPasswordOTP, changePassword } from "../../api/userApi";
import { UserPublic } from "@/type/user";

// ================== CONFIG ==================
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.example.com";
const UPDATE_PROFILE_URL = `${API_BASE_URL}/users/profile`;
const IMAGE_FIELD_NAME = "image";

// ================== TYPES ==================
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

type UpdateProfileResponse = {
  user: any;
  message?: string;
};

// ================== HELPERS ==================
const getAuthToken = async (): Promise<string | null> => {
  const t1 = await AsyncStorage.getItem("token");
  if (t1) return t1;
  const t2 = await AsyncStorage.getItem("accessToken");
  if (t2) return t2;
  return null;
};

const buildUserPublic = (raw: any): UserPublic => {
  return {
    id: raw._id || raw.id,
    username: raw.username,
    fullname: raw.fullname,
    email: raw.email,
    phone: raw.phone,
    role: raw.role,
    isVerified: raw.isVerified,
    isDeleted: raw.isDeleted,
    image: raw.image,
    menu: raw.menu || [],
  };
};

const safeReadJson = async (res: Response): Promise<any | null> => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const updateProfileRequest = async (params: {
  fullname: string;
  email: string;
  phone: string;
  imageUri?: string | null;
  removeImage?: boolean;
}): Promise<UpdateProfileResponse> => {
  const token = await getAuthToken();

  if (params.removeImage) {
    const res = await fetch(UPDATE_PROFILE_URL, {
      method: "PATCH",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullname: params.fullname,
        email: params.email,
        phone: params.phone,
        removeImage: true,
      }),
    });

    const data = await safeReadJson(res);
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data as UpdateProfileResponse;
  }

  if (params.imageUri) {
    const formData = new FormData();
    formData.append("fullname", params.fullname);
    formData.append("email", params.email);
    formData.append("phone", params.phone);

    const file = new File(params.imageUri);
    formData.append(IMAGE_FIELD_NAME, file as any);

    const res = await fetch(UPDATE_PROFILE_URL, {
      method: "PATCH",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData as any,
    });

    const data = await safeReadJson(res);
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data as UpdateProfileResponse;
  }

  const res = await fetch(UPDATE_PROFILE_URL, {
    method: "PATCH",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullname: params.fullname,
      email: params.email,
      phone: params.phone,
    }),
  });

  const data = await safeReadJson(res);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data as UpdateProfileResponse;
};

// ================== MAIN COMPONENT ==================
const ProfileScreen: React.FC = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [profileData, setProfileData] = useState<ProfileFormData>({
    fullname: "",
    email: "",
    phone: "",
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [compressing, setCompressing] = useState<boolean>(false);

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
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };

  const getFileSizeMB = async (uri: string): Promise<number> => {
    const f = new File(uri);
    const info = await f.info();
    const sizeBytes = typeof info?.size === "number" ? info.size : f.size;

    if (!info?.exists || !sizeBytes || sizeBytes <= 0) {
      throw new Error("Không thể xác định kích thước ảnh");
    }
    return sizeBytes / (1024 * 1024);
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      console.log("🔄 Compressing image...");
      setCompressing(true);

      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );

      if (!manipResult.uri) throw new Error("Không thể xử lý ảnh");

      const sizeInMB = await getFileSizeMB(manipResult.uri);
      console.log(`✅ Compressed image size: ${sizeInMB.toFixed(2)}MB`);
      if (sizeInMB > 5) {
        throw new Error("Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác");
      }

      return manipResult.uri;
    } catch (error: any) {
      console.error("❌ Image compression error:", error);
      throw error;
    } finally {
      setCompressing(false);
    }
  };

  // ========== IMAGE PICKER (NEW API) ==========
  const handlePickImage = async () => {
    // Request permission first (recommended by new docs)
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Quyền truy cập",
        "Cần quyền truy cập thư viện ảnh để chọn ảnh đại diện"
      );
      return;
    }

    // Launch picker with NEW API syntax
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], // ✅ NEW: array syntax instead of MediaTypeOptions.Images
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      allowsMultipleSelection: false, // explicitly set to false
    });

    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const compressedUri = await compressImage(result.assets[0].uri);

        setSelectedImage(compressedUri);
        setImagePreview(compressedUri);

        Alert.alert(
          "Thành công",
          "Ảnh đã được chọn và nén. Nhấn 'Lưu thông tin' để cập nhật."
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

            const response = await updateProfileRequest({
              fullname: profileData.fullname,
              email: profileData.email,
              phone: profileData.phone,
              removeImage: true,
            });

            const updatedUser = buildUserPublic(response.user);
            setUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

            setImagePreview(null);
            setSelectedImage(null);

            Alert.alert("Thành công", "Đã xóa ảnh đại diện");
          } catch (error: any) {
            console.error("❌ Remove image error:", error);
            Alert.alert("Lỗi", error?.message || "Không thể xóa ảnh đại diện");
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!profileData.fullname.trim()) {
      Alert.alert("Lỗi", "Họ và tên không được để trống");
      return;
    }

    setSaving(true);
    try {
      console.log("📝 Updating profile...");

      const response = await updateProfileRequest({
        fullname: profileData.fullname,
        email: profileData.email,
        phone: profileData.phone,
        imageUri: selectedImage || null,
      });

      const updatedUser = buildUserPublic(response.user);
      setUser(updatedUser);
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

      setSelectedImage(null);
      setImagePreview(updatedUser.image || null);

      Alert.alert("Thành công", "Cập nhật thông tin thành công");
    } catch (error: any) {
      console.error("❌ Save profile error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật thông tin");
    } finally {
      setSaving(false);
    }
  };

  const handleSendOTP = async () => {
    if (timer > 0) return;

    if (!profileData.email) {
      Alert.alert("Lỗi", "Vui lòng cập nhật email trước khi đổi mật khẩu");
      return;
    }

    setSendingOTP(true);
    try {
      console.log("📧 Sending OTP to:", profileData.email);
      await sendPasswordOTP({ email: profileData.email });

      setOtpSent(true);
      setTimer(300);
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

      await changePassword({
        password: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
        otp: passwordData.otp,
      });

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
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={["#6366f1", "#8b5cf6", "#d946ef"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>
                <View style={styles.headerSubRow}>
                  <Ionicons
                    name="person-circle-outline"
                    size={14}
                    color="rgba(255,255,255,0.92)"
                  />
                  <Text style={styles.headerSubtitle}>
                    Quản lý thông tin của bạn
                  </Text>
                </View>
              </View>
            </View>

            {/* Avatar in header */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {imagePreview ? (
                  <Image source={{ uri: imagePreview }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={56} color="#e0e7ff" />
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
                {compressing
                  ? "Đang nén ảnh..."
                  : "Nhấn để thay đổi ảnh (tối đa 5MB)"}
              </Text>

              {imagePreview && !compressing && (
                <TouchableOpacity
                  onPress={handleRemoveImage}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  <Text style={styles.removeBtnText}>Xóa ảnh</Text>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>

          {/* Profile Form Card */}
          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="person-outline" size={20} color="#6366f1" />
              </View>
              <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
            </View>

            <Text style={styles.label}>Tên đăng nhập</Text>
            <View style={[styles.input, styles.inputDisabled]}>
              <Ionicons name="at-outline" size={18} color="#94a3b8" />
              <Text style={styles.inputTextDisabled}>{user?.username}</Text>
            </View>

            <Text style={styles.label}>
              Họ và tên <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.input}>
              <Ionicons name="person-outline" size={18} color="#64748b" />
              <TextInput
                style={styles.inputText}
                value={profileData.fullname}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, fullname: text })
                }
                placeholder="Nhập họ và tên"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.input}>
              <Ionicons name="mail-outline" size={18} color="#64748b" />
              <TextInput
                style={styles.inputText}
                value={profileData.email}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, email: text })
                }
                placeholder="Nhập email"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Số điện thoại</Text>
            <View style={styles.input}>
              <Ionicons name="call-outline" size={18} color="#64748b" />
              <TextInput
                style={styles.inputText}
                value={profileData.phone}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, phone: text })
                }
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>

            {/* Status Pills */}
            <View style={styles.statusGrid}>
              <View style={styles.statusPill}>
                <View
                  style={[styles.statusDot, { backgroundColor: "#3b82f6" }]}
                />
                <Text style={styles.statusText}>
                  {user?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
                </Text>
              </View>

              <View style={styles.statusPill}>
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

              <View style={styles.statusPill}>
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

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || compressing) && { opacity: 0.55 },
              ]}
              onPress={handleSaveProfile}
              disabled={saving || compressing}
            >
              <LinearGradient
                colors={["#10b981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnGradient}
              >
                {saving ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.saveBtnText}>Đang lưu...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Lưu thông tin</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Password Card */}
          <View style={styles.formCard}>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: "#fef2f2" }]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#ef4444"
                />
              </View>
              <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>
            </View>

            {!showPasswordForm ? (
              <TouchableOpacity
                style={styles.showPasswordBtn}
                onPress={() => setShowPasswordForm(true)}
              >
                <Ionicons name="key-outline" size={18} color="#6366f1" />
                <Text style={styles.showPasswordBtnText}>Đổi mật khẩu</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.otpBtn,
                    (timer > 0 || sendingOTP) && { opacity: 0.55 },
                  ]}
                  onPress={handleSendOTP}
                  disabled={timer > 0 || sendingOTP}
                >
                  {sendingOTP ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={18} color="#fff" />
                      <Text style={styles.otpBtnText}>
                        {timer > 0
                          ? `Gửi lại sau (${formatTime(timer)})`
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
                        size={18}
                        color="#64748b"
                      />
                      <TextInput
                        style={styles.inputText}
                        value={passwordData.otp}
                        onChangeText={(text) =>
                          setPasswordData({ ...passwordData, otp: text })
                        }
                        placeholder="Nhập mã OTP"
                        placeholderTextColor="#94a3b8"
                        maxLength={6}
                        keyboardType="number-pad"
                      />
                    </View>

                    <Text style={styles.label}>Mật khẩu mới</Text>
                    <View style={styles.input}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color="#64748b"
                      />
                      <TextInput
                        style={styles.inputText}
                        value={passwordData.newPassword}
                        onChangeText={(text) =>
                          setPasswordData({
                            ...passwordData,
                            newPassword: text,
                          })
                        }
                        placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry
                      />
                    </View>

                    <Text style={styles.label}>Xác nhận mật khẩu</Text>
                    <View style={styles.input}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color="#64748b"
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
                        placeholderTextColor="#94a3b8"
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
                          changingPassword && { opacity: 0.55 },
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
                              size={18}
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

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
    backgroundColor: "#10b981",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
  },

  avatarSection: { alignItems: "center", paddingVertical: 8 },
  avatarWrapper: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.16)",
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 8,
    fontWeight: "700",
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  removeBtnText: { fontSize: 12, color: "#ef4444", fontWeight: "900" },

  formCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#0f172a" },

  label: { fontSize: 13, fontWeight: "900", color: "#334155", marginBottom: 8 },
  required: { color: "#ef4444" },

  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inputDisabled: { backgroundColor: "#f1f5f9" },
  inputText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  inputTextDisabled: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "700",
  },

  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "900", color: "#334155" },

  saveBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  showPasswordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#6366f1",
    backgroundColor: "#eff6ff",
  },
  showPasswordBtnText: { fontSize: 14, fontWeight: "900", color: "#6366f1" },

  otpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  otpBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  passwordActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "900", color: "#64748b" },
  changePasswordBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 14,
  },
  changePasswordBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
