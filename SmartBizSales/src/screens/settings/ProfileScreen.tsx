// src/pages/user/ProfileScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

import { useAuth } from "../../context/AuthContext";
import {
  updateProfile,
  sendPasswordOTP,
  changePassword,
} from "../../api/userApi";
import { UserPublic } from "@/type/user";

/**
 * ================== Types ==================
 */
type ProfileFormData = {
  fullname: string;
  email: string;
  phone: string;
};

type PasswordFormData = {
  otp: string;
  newPassword: string;
  confirmPassword: string;
};

// File kiểu React Native để gửi multipart lên backend
type RNImageFile = {
  uri: string;
  name: string;
  type: string; // mime, ví dụ image/jpeg
  sizeBytes: number;
};

const buildUserPublic = (raw: any): UserPublic => ({
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
});

const formatTime = (sec: number): string => {
  if (!sec || sec <= 0) return "00:00";
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
};

const normalizeError = (err: any, defaultMsg: string) => {
  const msgFromBackend = err?.response?.data?.message;
  const status = err?.response?.status;
  if (status === 503)
    return msgFromBackend || "Máy chủ đang bận. Vui lòng thử lại sau.";
  if (status === 413)
    return msgFromBackend || "File quá lớn. Vui lòng chọn ảnh nhỏ hơn.";
  return msgFromBackend || err?.message || defaultMsg;
};

const bytesToKB = (b: number) => `${Math.round(b / 1024)} KB`;
const bytesToMB = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`;

const guessMime = (maybeMime?: string | null) =>
  maybeMime ? maybeMime : "image/jpeg";
const guessName = (maybeName?: string | null) =>
  maybeName && maybeName.trim() ? maybeName : `avatar-${Date.now()}.jpg`;

const ProfileScreen: React.FC = () => {
  const { user, setUser } = useAuth();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [compressing, setCompressing] = useState(false);

  // Error states
  const [infoError, setInfoError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);

  // Image states
  const [imagePreview, setImagePreview] = useState<string | null>(null); // local uri hoặc url từ backend
  const [pickedImage, setPickedImage] = useState<RNImageFile | null>(null); // ảnh local (đã nén) để gửi backend

  // Preview modal
  const [previewVisible, setPreviewVisible] = useState(false);

  const [profileData, setProfileData] = useState<ProfileFormData>({
    fullname: "",
    email: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });

  const otpExpireMinutes = useMemo(
    () => Number(process.env.EXPO_PUBLIC_OTP_EXPIRE_MINUTES || 5),
    []
  );
  const otpTimerRef = useRef<NodeJS.Timeout | null>(null);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "—";
    if (user.role === "MANAGER") return "Quản lý";
    return String(user.role);
  }, [user?.role]);

  // Load user
  useEffect(() => {
    if (user) {
      setProfileData({
        fullname: user.fullname || "",
        email: user.email || "",
        phone: user.phone || "",
      });

      setImagePreview(user.image || null);
      setPickedImage(null);
    }
    setLoading(false);
  }, [user]);

  // Timer countdown
  useEffect(() => {
    if (timer <= 0) {
      otpTimerRef.current && clearInterval(otpTimerRef.current);
      otpTimerRef.current = null;
      return;
    }

    otpTimerRef.current && clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(
      () => setTimer((t) => Math.max(0, t - 1)),
      1000
    );

    return () => {
      otpTimerRef.current && clearInterval(otpTimerRef.current);
      otpTimerRef.current = null;
    };
  }, [timer]);

  /**
   * ================== Image helpers ==================
   * API mới expo-image-manipulator:
   * manipulate(uri) -> resize/rotate/... -> renderAsync() -> saveAsync()
   */
  const compressImage = async (uri: string): Promise<string> => {
    setCompressing(true);
    try {
      // resize để giảm dung lượng, và save về JPEG để tránh HEIC/AVIF
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 900, height: 900 } }],
        { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!result?.uri) throw new Error("Không thể xử lý ảnh");
      return result.uri;
    } finally {
      setCompressing(false);
    }
  };

  const getFileMeta = async (
    uri: string,
    fallbackName?: string | null,
    fallbackMime?: string | null,
    fallbackSize?: number | null
  ): Promise<RNImageFile> => {
    // Ưu tiên size từ ImagePicker nếu có (asset.fileSize),
    // còn không thì lấy từ FileSystem.getInfoAsync.
    let sizeBytes = typeof fallbackSize === "number" ? fallbackSize : 0;

    if (!sizeBytes) {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists)
        throw new Error("File ảnh không tồn tại hoặc không đọc được.");
      sizeBytes = typeof info.size === "number" ? info.size : 0;
    }

    const name = guessName(fallbackName);
    const type = guessMime(fallbackMime);

    return { uri, name, type, sizeBytes };
  };

  /**
   * ================== Handlers ==================
   */
  const handlePickImage = async () => {
    try {
      setInfoError(null);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Quyền truy cập",
          "Cần quyền truy cập thư viện ảnh để chọn ảnh đại diện."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      // 1) Nén/convert
      const compressedUri = await compressImage(asset.uri);

      // 2) Meta
      const meta = await getFileMeta(
        compressedUri,
        asset.fileName ?? null,
        asset.mimeType ?? "image/jpeg",
        asset.fileSize ?? null
      );

      // 3) Chặn ảnh > 5MB
      if (meta.sizeBytes > 5 * 1024 * 1024) {
        throw new Error(
          `Ảnh quá lớn (${bytesToMB(meta.sizeBytes)}). Vui lòng chọn ảnh khác (<= 5MB).`
        );
      }

      // 4) Preview local trước
      setPickedImage(meta);
      setImagePreview(meta.uri);

      Alert.alert(
        "Đã chọn ảnh",
        "Nhấn “Lưu thông tin” để cập nhật lên hệ thống."
      );
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể chọn/xử lý ảnh");
    }
  };

  const handleRemoveImage = async () => {
    Alert.alert("Xóa ảnh đại diện", "Bạn có chắc muốn xóa ảnh đại diện?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          setSavingInfo(true);
          setInfoError(null);
          try {
            const payload = {
              fullname: profileData.fullname,
              email: profileData.email,
              phone: profileData.phone,
            };

            const res: any = await updateProfile(payload as any, {
              removeImage: true,
            });

            const updatedUser = buildUserPublic(res.user);
            setUser(updatedUser);
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

            setImagePreview(null);
            setPickedImage(null);

            Alert.alert("Thành công", "Đã xóa ảnh đại diện!");
          } catch (err: any) {
            const msg = normalizeError(
              err,
              "Không thể xóa ảnh đại diện, vui lòng thử lại."
            );
            setInfoError(msg);
            Alert.alert("Lỗi", msg);
          } finally {
            setSavingInfo(false);
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    setSavingInfo(true);
    setInfoError(null);

    try {
      if (!profileData.fullname.trim()) {
        Alert.alert("Lỗi", "Họ và tên không được để trống");
        return;
      }

      // Chỉ gửi field thay đổi
      const payload: any = {};
      if ((profileData.fullname || "") !== (user?.fullname || ""))
        payload.fullname = profileData.fullname;
      if ((profileData.email || "") !== (user?.email || ""))
        payload.email = profileData.email;
      if ((profileData.phone || "") !== (user?.phone || ""))
        payload.phone = profileData.phone;

      const hasAvatar = !!pickedImage;

      if (!hasAvatar && Object.keys(payload).length === 0) {
        Alert.alert("Thông báo", "Không có thông tin nào thay đổi");
        return;
      }

      // Nếu có ảnh: gửi multipart lên backend (field avatar)
      const options = hasAvatar
        ? {
            imageFile: {
              uri: pickedImage!.uri,
              name: pickedImage!.name,
              type: pickedImage!.type,
            },
          }
        : {};

      const res: any = await updateProfile(payload, options as any);
      const updatedUser = buildUserPublic(res.user);

      setUser(updatedUser);
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));

      // reset pick sau khi lưu
      setPickedImage(null);

      // UI ưu tiên ảnh backend trả về
      setImagePreview(updatedUser.image || null);

      Alert.alert("Thành công", "Cập nhật thông tin thành công");
    } catch (err: any) {
      const msg = normalizeError(err, "Lỗi cập nhật thông tin cá nhân.");
      setInfoError(msg);
      Alert.alert("Lỗi cập nhật", msg);
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSendOTP = async () => {
    if (timer > 0) return;

    setSendingOTP(true);
    setPassError(null);

    try {
      const email = profileData.email?.trim();
      if (!email)
        throw new Error(
          "Cần email để gửi OTP, vui lòng cập nhật thông tin trước."
        );

      const res = await sendPasswordOTP({ email });
      setOtpSent(true);
      setTimer(60 * otpExpireMinutes);

      Alert.alert(
        "Thành công",
        res.message || "Mã OTP đã được gửi đến email của bạn"
      );
    } catch (err: any) {
      const msg = normalizeError(
        err,
        "Không thể gửi OTP, vui lòng thử lại sau."
      );
      setOtpSent(false);
      setPassError(msg);
      Alert.alert("OTP chưa được gửi", msg);
    } finally {
      setSendingOTP(false);
    }
  };

  const handleChangePassword = async () => {
    setChangingPass(true);
    setPassError(null);

    try {
      if (!passwordData.otp.trim()) throw new Error("Vui lòng nhập mã OTP");
      if (passwordData.newPassword.length < 6)
        throw new Error("Mật khẩu mới phải ít nhất 6 ký tự");
      if (passwordData.newPassword !== passwordData.confirmPassword)
        throw new Error("Mật khẩu xác nhận không khớp");

      await changePassword({
        password: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
        otp: passwordData.otp,
      } as any);

      setPasswordData({ otp: "", newPassword: "", confirmPassword: "" });
      setOtpSent(false);
      setTimer(0);

      Alert.alert("Thành công", "Đổi mật khẩu thành công");
    } catch (err: any) {
      const msg = normalizeError(err, "Lỗi đổi mật khẩu, vui lòng thử lại.");
      setPassError(msg);
      Alert.alert("Lỗi đổi mật khẩu", msg);
    } finally {
      setChangingPass(false);
    }
  };

  /**
   * ================== Render guards ==================
   */
  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>
            Chưa đăng nhập. Vui lòng đăng nhập để xem hồ sơ.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const busy = savingInfo || compressing;

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
          <LinearGradient
            colors={["#6366f1", "#8b5cf6", "#d946ef"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerTopRow}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>
                <Text style={styles.headerSubtitle}>
                  Quản lý thông tin của bạn
                </Text>
              </View>

              <View style={styles.headerBadges}>
                <View style={styles.badge}>
                  <Ionicons
                    name="briefcase-outline"
                    size={14}
                    color="#111827"
                  />
                  <Text style={styles.badgeText}>{roleLabel}</Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    user.isVerified ? styles.badgeOk : styles.badgeWarn,
                  ]}
                >
                  <Ionicons
                    name={
                      user.isVerified
                        ? "checkmark-circle-outline"
                        : "alert-circle-outline"
                    }
                    size={14}
                    color={user.isVerified ? "#065f46" : "#9a3412"}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      { color: user.isVerified ? "#065f46" : "#9a3412" },
                    ]}
                  >
                    {user.isVerified ? "Đã xác thực" : "Chưa xác thực"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.avatarSection}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => imagePreview && setPreviewVisible(true)}
                disabled={!imagePreview}
                style={styles.avatarWrapper}
              >
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
                  disabled={busy}
                  activeOpacity={0.9}
                >
                  {compressing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>

              <Text style={styles.avatarHint}>
                {compressing
                  ? "Đang tối ưu ảnh..."
                  : pickedImage
                    ? `Ảnh mới: ${pickedImage.name} • ${bytesToKB(pickedImage.sizeBytes)} (nhấn Lưu để cập nhật)`
                    : "Nhấn camera để chọn ảnh (tối đa 5MB)"}
              </Text>

              <View style={styles.avatarActionsRow}>
                {!!imagePreview && (
                  <TouchableOpacity
                    onPress={() => setPreviewVisible(true)}
                    style={styles.secondaryPill}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="eye-outline" size={14} color="#111827" />
                    <Text style={styles.secondaryPillText}>Xem</Text>
                  </TouchableOpacity>
                )}

                {!!imagePreview && (
                  <TouchableOpacity
                    onPress={handleRemoveImage}
                    style={[styles.dangerPill, busy && { opacity: 0.6 }]}
                    disabled={busy}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    <Text style={styles.dangerPillText}>Xóa ảnh</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>

          {!!infoError && (
            <View style={styles.alertError}>
              <Ionicons name="warning-outline" size={18} color="#b91c1c" />
              <Text style={styles.alertErrorText}>{infoError}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin cá nhân</Text>

            <Text style={styles.label}>Tên đăng nhập</Text>
            <View style={[styles.input, styles.inputDisabled]}>
              <Ionicons name="at-outline" size={18} color="#94a3b8" />
              <Text style={styles.inputTextDisabled}>{user.username}</Text>
            </View>

            <Text style={styles.label}>Họ và tên</Text>
            <View style={styles.input}>
              <Ionicons name="person-outline" size={18} color="#64748b" />
              <TextInput
                style={styles.inputText}
                value={profileData.fullname}
                onChangeText={(t) =>
                  setProfileData((p) => ({ ...p, fullname: t }))
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
                onChangeText={(t) =>
                  setProfileData((p) => ({ ...p, email: t }))
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
                onChangeText={(t) =>
                  setProfileData((p) => ({ ...p, phone: t }))
                }
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={busy}
              activeOpacity={0.9}
            >
              {savingInfo ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="save-outline" size={18} color="#fff" />
              )}
              <Text style={styles.primaryBtnText}>
                {savingInfo ? "Đang lưu..." : "Lưu thông tin"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đổi mật khẩu</Text>

            {!!passError && (
              <View
                style={[
                  styles.alertError,
                  { marginHorizontal: 0, marginTop: 0, marginBottom: 12 },
                ]}
              >
                <Ionicons name="warning-outline" size={18} color="#b91c1c" />
                <Text style={styles.alertErrorText}>{passError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.otpBtn,
                (timer > 0 || sendingOTP || changingPass) && { opacity: 0.6 },
              ]}
              onPress={handleSendOTP}
              disabled={timer > 0 || sendingOTP || changingPass}
              activeOpacity={0.9}
            >
              {sendingOTP ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="mail-outline" size={18} color="#fff" />
              )}
              <Text style={styles.otpBtnText}>
                {sendingOTP
                  ? "Đang gửi..."
                  : timer > 0
                    ? `Chờ gửi lại (${formatTime(timer)})`
                    : otpSent
                      ? "Gửi OTP mới"
                      : "Gửi OTP đến Email"}
              </Text>
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
                    onChangeText={(t) =>
                      setPasswordData((p) => ({ ...p, otp: t }))
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
                    onChangeText={(t) =>
                      setPasswordData((p) => ({ ...p, newPassword: t }))
                    }
                    placeholder="Mật khẩu mới (>= 6 ký tự)"
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
                    onChangeText={(t) =>
                      setPasswordData((p) => ({ ...p, confirmPassword: t }))
                    }
                    placeholder="Xác nhận mật khẩu"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.dangerBtn, changingPass && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={changingPass}
                  activeOpacity={0.9}
                >
                  {changingPass ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#fff"
                    />
                  )}
                  <Text style={styles.dangerBtnText}>
                    {changingPass ? "Đang đổi..." : "Đổi mật khẩu"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

        {/* Preview modal */}
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setPreviewVisible(false)}
              activeOpacity={0.9}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.previewBox}>
              {imagePreview ? (
                <Image
                  source={{ uri: imagePreview }}
                  style={styles.previewImg}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.previewEmpty}>
                  <Ionicons name="image-outline" size={42} color="#cbd5e1" />
                  <Text style={styles.previewEmptyText}>
                    Chưa có ảnh đại diện
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },
  errorText: {
    marginTop: 10,
    textAlign: "center",
    color: "#991b1b",
    fontWeight: "700",
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: "#10b981",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
  },

  headerBadges: { alignItems: "flex-end", gap: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  badgeOk: { backgroundColor: "rgba(236,253,245,0.95)" },
  badgeWarn: { backgroundColor: "rgba(255,247,237,0.95)" },
  badgeText: { fontSize: 12, fontWeight: "900", color: "#111827" },

  avatarSection: { alignItems: "center", paddingTop: 14 },
  avatarWrapper: { position: "relative" },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },

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
  },

  avatarHint: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "800",
    textAlign: "center",
  },

  avatarActionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  secondaryPillText: { fontSize: 12, color: "#111827", fontWeight: "900" },
  dangerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  dangerPillText: { fontSize: 12, color: "#ef4444", fontWeight: "900" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
  },

  label: { fontSize: 13, fontWeight: "900", color: "#334155", marginBottom: 8 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 10,
  },
  inputDisabled: { backgroundColor: "#f1f5f9" },
  inputText: { flex: 1, fontSize: 14, color: "#0f172a", fontWeight: "700" },
  inputTextDisabled: {
    flex: 1,
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "700",
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  otpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  otpBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  dangerBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  alertError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  alertErrorText: { flex: 1, color: "#991b1b", fontWeight: "800" },

  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  previewClose: {
    position: "absolute",
    top: 56,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBox: {
    width: "100%",
    height: "75%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  previewImg: { width: "100%", height: "100%" },
  previewEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewEmptyText: { marginTop: 10, color: "#cbd5e1", fontWeight: "800" },
});
