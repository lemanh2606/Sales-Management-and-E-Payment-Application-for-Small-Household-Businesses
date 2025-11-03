import React, { useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { TextInput, Button, Card, Title } from "react-native-paper";
import { useAuth } from "../../context/AuthContext";
import {
  updateProfile,
  sendPasswordOTP,
  changePassword,
} from "../../api/userApi";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { showMessage } from "react-native-flash-message";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [profile, setProfile] = useState({
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
    fullname: user?.fullname || "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const flash = (message: string, type: "success" | "danger") =>
    showMessage({
      message,
      type,
      icon: type,
      duration: 2500,
      floating: true,
    });

  const handleSaveInfo = async () => {
    if (savingInfo) return;
    setSavingInfo(true);
    try {
      const res = await updateProfile(profile as any);
      if (res?.user) {
        setProfile({
          ...profile,
          username: res.user.username,
          fullname: res.user.fullname ?? "",
          email: res.user.email ?? "",
          phone: res.user.phone ?? "",
        });
        setUser(res.user);
      }
      flash("Cập nhật thông tin thành công!", "success");
    } catch (err: any) {
      flash(
        err?.response?.data?.message || err.message || "Lỗi server",
        "danger"
      );
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSendOTP = async () => {
    try {
      await sendPasswordOTP({ email: profile.email ?? "" });
      setOtpSent(true);
      flash("OTP đã được gửi vào email!", "success");
    } catch (err: any) {
      flash(err?.response?.data?.message || err.message, "danger");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword)
      return flash("Mật khẩu mới không khớp", "danger");
    if (newPassword.length < 6)
      return flash("Mật khẩu phải ít nhất 6 ký tự", "danger");

    setSavingPass(true);
    try {
      await changePassword({
        otp: otpCode,
        password: newPassword,
        confirmPassword,
      });
      flash("Đổi mật khẩu thành công!", "success");
      setOtpSent(false);
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      flash(err?.response?.data?.message || err.message, "danger");
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Tên đăng nhập"
              value={profile.username}
              disabled
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Họ và tên"
              value={profile.fullname}
              onChangeText={(text) =>
                setProfile({ ...profile, fullname: text })
              }
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Email"
              value={profile.email}
              onChangeText={(text) => setProfile({ ...profile, email: text })}
              style={styles.input}
              mode="outlined"
              keyboardType="email-address"
            />
            <TextInput
              label="Số điện thoại"
              value={profile.phone}
              onChangeText={(text) => setProfile({ ...profile, phone: text })}
              style={styles.input}
              mode="outlined"
              keyboardType="phone-pad"
            />
            <Button
              mode="contained"
              onPress={handleSaveInfo}
              loading={savingInfo}
              style={styles.button}
              icon="content-save"
              buttonColor="#43a047"
              textColor="#fff"
            >
              Lưu Thông Tin
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>
              <Icon name="lock-reset" size={28} color="#2e7d32" /> Đổi Mật Khẩu
            </Title>
            <Button
              mode="outlined"
              onPress={handleSendOTP}
              disabled={otpSent}
              style={styles.button}
              icon="email-outline"
              buttonColor="#a5d6a7"
              textColor="#2e7d32"
            >
              {otpSent ? "OTP đã gửi" : "Gửi OTP"}
            </Button>
            {otpSent && (
              <>
                <TextInput
                  label="Mã OTP"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  style={styles.input}
                  mode="outlined"
                />
                <TextInput
                  label="Mật khẩu mới"
                  value={newPassword}
                  secureTextEntry
                  onChangeText={setNewPassword}
                  style={styles.input}
                  mode="outlined"
                />
                <TextInput
                  label="Xác nhận mật khẩu mới"
                  value={confirmPassword}
                  secureTextEntry
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                  mode="outlined"
                />
                <Button
                  mode="contained"
                  onPress={handleChangePassword}
                  loading={savingPass}
                  style={styles.button}
                  icon="lock-reset"
                  buttonColor="#43a047"
                  textColor="#fff"
                >
                  Đổi Mật Khẩu
                </Button>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 4,
    paddingVertical: 8,
  },
  input: { marginBottom: 12, backgroundColor: "#fff" },
  button: { marginTop: 8, borderRadius: 12 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    color: "#2e7d32",
  },
});
