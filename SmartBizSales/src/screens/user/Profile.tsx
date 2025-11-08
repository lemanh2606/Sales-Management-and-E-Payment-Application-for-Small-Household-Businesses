import React, { useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  TextInput,
  Button,
  Card,
  Title,
  Text,
  Avatar,
} from "react-native-paper";
import { useAuth } from "../../context/AuthContext";
import {
  updateProfile,
  sendPasswordOTP,
  changePassword,
} from "../../api/userApi";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { showMessage } from "react-native-flash-message";
import * as ImagePicker from "expo-image-picker";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profile, setProfile] = useState({
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
    fullname: user?.fullname || "",
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const flash = (message: string, type: "success" | "danger" | "warning") =>
    showMessage({
      message,
      type,
      icon: type,
      duration: 2500,
      floating: true,
    });

  // Image Picker Handler
  const handleImagePick = async (source: "library" | "camera") => {
    try {
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          flash("Cần quyền truy cập camera để chụp ảnh", "warning");
          return;
        }
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          flash("Cần quyền truy cập thư viện ảnh", "warning");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        flash("Ảnh đã được chọn thành công", "success");
      }
    } catch (error) {
      console.error("Image pick error:", error);
      flash("Lỗi khi chọn ảnh", "danger");
    }
  };

  const removeSelectedImage = () => {
    Alert.alert("Xóa ảnh", "Bạn có chắc muốn xóa ảnh đã chọn?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => setSelectedImage(null),
      },
    ]);
  };

  const handleSaveInfo = async () => {
    if (savingInfo) return;

    // Validation
    if (!profile.fullname.trim()) {
      flash("Vui lòng nhập họ và tên", "warning");
      return;
    }

    if (!profile.email.trim()) {
      flash("Vui lòng nhập email", "warning");
      return;
    }

    setSavingInfo(true);
    try {
      // Gửi cả thông tin và ảnh (nếu có)
      const res = await updateProfile(
        profile,
        selectedImage ? { imageUri: selectedImage } : undefined
      );

      if (res?.user) {
        setProfile({
          username: res.user.username || "",
          fullname: res.user.fullname || "",
          email: res.user.email || "",
          phone: res.user.phone || "",
        });
        setUser(res.user);
        setSelectedImage(null);
        flash("✅ Thông tin đã được cập nhật thành công", "success");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err.message || "Lỗi server";
      flash(`❌ ${errorMessage}`, "danger");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSendOTP = async () => {
    if (!profile.email) {
      flash("Vui lòng nhập email trước", "warning");
      return;
    }

    try {
      await sendPasswordOTP({ email: profile.email });
      setOtpSent(true);
      flash("📧 Mã OTP đã được gửi đến email của bạn", "success");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message;
      flash(`❌ ${errorMessage}`, "danger");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword)
      return flash("Mật khẩu xác nhận không khớp", "danger");
    if (newPassword.length < 6)
      return flash("Mật khẩu phải ít nhất 6 ký tự", "warning");

    setSavingPass(true);
    try {
      await changePassword({
        otp: otpCode,
        password: newPassword,
        confirmPassword,
      });
      flash("✅ Mật khẩu đã được thay đổi thành công", "success");
      setOtpSent(false);
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message;
      flash(`❌ ${errorMessage}`, "danger");
    } finally {
      setSavingPass(false);
    }
  };

  const updateProfileField = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const displayImage = selectedImage || user?.image;
  const hasChanges =
    selectedImage !== null ||
    profile.fullname !== user?.fullname ||
    profile.email !== user?.email ||
    profile.phone !== user?.phone;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hồ Sơ Cá Nhân</Text>
          <Text style={styles.headerSubtitle}>
            Quản lý thông tin và ảnh đại diện
          </Text>
        </View>

        {/* Avatar Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarWrapper}>
                  {displayImage ? (
                    <Image
                      source={{ uri: displayImage }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Avatar.Icon
                      size={100}
                      icon="account"
                      style={styles.avatarPlaceholder}
                    />
                  )}

                  {selectedImage && (
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={removeSelectedImage}
                    >
                      <Icon name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.avatarText}>
                  {selectedImage ? "Ảnh mới đã chọn" : "Ảnh đại diện"}
                </Text>
              </View>

              <View style={styles.imageActions}>
                <Button
                  mode="outlined"
                  onPress={() => handleImagePick("library")}
                  style={styles.imageBtn}
                  contentStyle={styles.btnContent}
                  icon="image-multiple"
                  buttonColor="transparent"
                  textColor="#6366f1"
                >
                  Thư viện
                </Button>

                <Button
                  mode="outlined"
                  onPress={() => handleImagePick("camera")}
                  style={styles.imageBtn}
                  contentStyle={styles.btnContent}
                  icon="camera"
                  buttonColor="transparent"
                  textColor="#6366f1"
                >
                  Chụp ảnh
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Profile Information Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Icon name="account-details" size={24} color="#4f46e5" />
              <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                label="Tên đăng nhập"
                value={profile.username}
                disabled
                style={styles.input}
                mode="outlined"
                left={<TextInput.Icon icon="account" color="#6b7280" />}
                outlineColor="#e5e7eb"
                activeOutlineColor="#4f46e5"
              />

              <TextInput
                label="Họ và tên *"
                value={profile.fullname}
                onChangeText={(text) => updateProfileField("fullname", text)}
                style={styles.input}
                mode="outlined"
                left={
                  <TextInput.Icon icon="card-account-details" color="#6b7280" />
                }
                outlineColor="#e5e7eb"
                activeOutlineColor="#4f46e5"
              />

              <TextInput
                label="Email *"
                value={profile.email}
                onChangeText={(text) => updateProfileField("email", text)}
                style={styles.input}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                left={<TextInput.Icon icon="email" color="#6b7280" />}
                outlineColor="#e5e7eb"
                activeOutlineColor="#4f46e5"
              />

              <TextInput
                label="Số điện thoại"
                value={profile.phone}
                onChangeText={(text) => updateProfileField("phone", text)}
                style={styles.input}
                mode="outlined"
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone" color="#6b7280" />}
                outlineColor="#e5e7eb"
                activeOutlineColor="#4f46e5"
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSaveInfo}
              loading={savingInfo}
              disabled={!hasChanges}
              style={styles.primaryButton}
              contentStyle={styles.btnContent}
              icon={savingInfo ? undefined : "check"}
              buttonColor="#4f46e5"
            >
              {savingInfo ? "Đang lưu..." : "Cập nhật thông tin"}
            </Button>
          </Card.Content>
        </Card>

        {/* Password Change Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Icon name="lock-reset" size={24} color="#dc2626" />
              <Text style={styles.cardTitle}>Bảo mật tài khoản</Text>
            </View>

            {!otpSent ? (
              <Button
                mode="outlined"
                onPress={handleSendOTP}
                disabled={!profile.email}
                style={styles.secondaryButton}
                contentStyle={styles.btnContent}
                icon="shield-key"
                buttonColor="transparent"
                textColor="#dc2626"
              >
                Gửi mã xác thực
              </Button>
            ) : (
              <View style={styles.passwordForm}>
                <Text style={styles.otpNote}>
                  📧 Mã OTP đã được gửi đến {profile.email}
                </Text>

                <TextInput
                  label="Mã OTP *"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="number-pad"
                  left={<TextInput.Icon icon="shield-key" color="#6b7280" />}
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#dc2626"
                />

                <TextInput
                  label="Mật khẩu mới *"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={styles.input}
                  mode="outlined"
                  secureTextEntry
                  left={<TextInput.Icon icon="lock" color="#6b7280" />}
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#dc2626"
                />

                <TextInput
                  label="Xác nhận mật khẩu *"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                  mode="outlined"
                  secureTextEntry
                  left={<TextInput.Icon icon="lock-check" color="#6b7280" />}
                  outlineColor="#e5e7eb"
                  activeOutlineColor="#dc2626"
                />

                <View style={styles.passwordActions}>
                  <Button
                    mode="outlined"
                    onPress={() => setOtpSent(false)}
                    style={styles.cancelButton}
                    contentStyle={styles.btnContent}
                    icon="close"
                    buttonColor="transparent"
                    textColor="#6b7280"
                  >
                    Hủy
                  </Button>

                  <Button
                    mode="contained"
                    onPress={handleChangePassword}
                    loading={savingPass}
                    style={styles.dangerButton}
                    contentStyle={styles.btnContent}
                    icon={savingPass ? undefined : "lock-reset"}
                    buttonColor="#dc2626"
                  >
                    {savingPass ? "Đang xử lý..." : "Đổi mật khẩu"}
                  </Button>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Account Info Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Tài khoản • {user?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
          </Text>
          <Text style={styles.footerSubtext}>
            Đăng nhập lần cuối:{" "}
            {user?.last_login
              ? new Date(user.last_login).toLocaleDateString("vi-VN")
              : "Chưa có thông tin"}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 8,
  },
  avatarSection: {
    alignItems: "center",
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#4f46e5",
  },
  avatarPlaceholder: {
    backgroundColor: "#e5e7eb",
    borderWidth: 3,
    borderColor: "#d1d5db",
  },
  removeImageBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#dc2626",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  imageActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  imageBtn: {
    flex: 1,
    borderRadius: 12,
    borderColor: "#6366f1",
    borderWidth: 1.5,
  },
  form: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  primaryButton: {
    borderRadius: 12,
    elevation: 2,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#dc2626",
  },
  dangerButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderColor: "#d1d5db",
    marginRight: 12,
  },
  btnContent: {
    paddingVertical: 8,
  },
  passwordForm: {
    gap: 16,
  },
  otpNote: {
    fontSize: 14,
    color: "#059669",
    textAlign: "center",
    backgroundColor: "#d1fae5",
    padding: 12,
    borderRadius: 8,
    fontWeight: "500",
  },
  passwordActions: {
    flexDirection: "row",
    gap: 12,
  },
  footer: {
    alignItems: "center",
    marginTop: 8,
    padding: 16,
  },
  footerText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: "#9ca3af",
  },
});
