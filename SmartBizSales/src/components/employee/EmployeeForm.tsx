import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

type Mode = "create" | "edit";

export interface EmployeeUser {
  _id?: string;
  username?: string;
  email?: string;
  phone?: string;
  menu?: string[];
}

export interface EmployeeRecord {
  _id?: string;
  fullName?: string;
  shift?: string;
  salary?: number;
  commission_rate?: number;
  user_id?: EmployeeUser | string;
}

type ShiftType = "Sáng" | "Chiều" | "Tối" | "Fulltime";

export type EmployeeFormValues = {
  fullName: string;
  username?: string;
  password?: string;
  email?: string;
  phone?: string;
  shift: ShiftType;
  salary: number;
  commission_rate?: number;
};

type Props = {
  mode: Mode;
  initialValues?: EmployeeRecord | null;
  loading?: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel?: () => void;
};

const SHIFT_OPTIONS: ShiftType[] = ["Sáng", "Chiều", "Tối", "Fulltime"];

const toNumber = (v: any) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[^\d.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const normalizePhone = (v: string) => v.replace(/\D/g, "").slice(0, 11);

const isEmail = (v: string) => {
  const s = v.trim();
  if (!s) return true; // email optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

type ErrorMap = Partial<Record<keyof EmployeeFormValues, string>>;

const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  editable?: boolean;
  error?: string;
}> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  editable = true,
  error,
}) => {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        editable={editable}
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          !!error && styles.inputError,
        ]}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default function EmployeeForm({
  mode,
  initialValues,
  loading = false,
  onSubmit,
  onCancel,
}: Props) {
  const initial = useMemo(() => {
    const user =
      initialValues?.user_id && typeof initialValues.user_id === "object"
        ? (initialValues.user_id as EmployeeUser)
        : ({} as EmployeeUser);

    return {
      fullName: initialValues?.fullName ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      salary: initialValues?.salary ?? 0,
      commission_rate: initialValues?.commission_rate ?? 0,
      shift: (initialValues?.shift as ShiftType) ?? "Sáng",
      password: "",
    };
  }, [initialValues]);

  const [fullName, setFullName] = useState(initial.fullName);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState(initial.password);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [shift, setShift] = useState<ShiftType>(initial.shift);
  const [salaryText, setSalaryText] = useState(String(initial.salary ?? 0));
  const [commissionText, setCommissionText] = useState(
    String(initial.commission_rate ?? 0)
  );
  const [errors, setErrors] = useState<ErrorMap>({});

  useEffect(() => {
    setFullName(initial.fullName);
    setUsername(initial.username);
    setPassword("");
    setEmail(initial.email);
    setPhone(initial.phone);
    setShift(initial.shift);
    setSalaryText(String(initial.salary ?? 0));
    setCommissionText(String(initial.commission_rate ?? 0));
    setErrors({});
  }, [initial]);

  const validate = (): ErrorMap => {
    const next: ErrorMap = {};
    if (!fullName.trim()) next.fullName = "Nhập tên nhân viên";

    if (mode === "create") {
      if (!username.trim()) next.username = "Nhập username";
      if (!password.trim()) next.password = "Nhập mật khẩu";
      // nếu muốn: password >= 6 ký tự
      if (password.trim() && password.trim().length < 6)
        next.password = "Mật khẩu tối thiểu 6 ký tự";
    }

    if (!shift) next.shift = "Chọn ca làm việc";

    const salaryNumber = toNumber(salaryText);
    if (!salaryNumber || salaryNumber <= 0)
      next.salary = "Nhập lương cơ bản hợp lệ";

    if (email.trim() && !isEmail(email)) next.email = "Email không hợp lệ";

    return next;
  };

  const handlePressSubmit = () => {
    if (loading) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload: EmployeeFormValues = {
      fullName: fullName.trim(),
      shift,
      salary: toNumber(salaryText),
      commission_rate: toNumber(commissionText),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    };

    if (mode === "create") {
      payload.username = username.trim();
      payload.password = password;
    }

    onSubmit(payload);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="Tên nhân viên"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Nhập tên nhân viên"
          error={errors.fullName}
        />

        {mode === "create" ? (
          <>
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Nhập username"
              error={errors.username}
            />
            <Field
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              placeholder="Nhập mật khẩu"
              secureTextEntry
              error={errors.password}
            />
          </>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="example@email.com"
          keyboardType="email-address"
          error={errors.email}
        />

        <Field
          label="Số điện thoại"
          value={phone}
          onChangeText={(t) => setPhone(normalizePhone(t))}
          placeholder="Nhập số điện thoại"
          keyboardType="phone-pad"
          error={errors.phone}
        />

        <Text style={styles.label}>Ca làm việc</Text>
        <View style={[styles.shiftRow, !!errors.shift && styles.shiftRowError]}>
          {SHIFT_OPTIONS.map((opt) => {
            const active = shift === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setShift(opt)}
                activeOpacity={0.85}
                style={[styles.shiftPill, active && styles.shiftPillActive]}
                disabled={loading}
              >
                <Text
                  style={[styles.shiftText, active && styles.shiftTextActive]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!!errors.shift && <Text style={styles.errorText}>{errors.shift}</Text>}

        <Field
          label="Lương cơ bản"
          value={salaryText}
          onChangeText={setSalaryText}
          placeholder="Nhập lương cơ bản"
          keyboardType="number-pad"
          error={errors.salary}
        />

        <Field
          label="Hoa hồng (%)"
          value={commissionText}
          onChangeText={setCommissionText}
          placeholder="0"
          keyboardType="numeric"
          error={errors.commission_rate}
        />

        <View style={styles.footerRow}>
          {onCancel ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnGhostText}>Hủy</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnPrimary,
              loading && styles.btnDisabled,
            ]}
            onPress={handlePressSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {mode === "edit" ? "Cập nhật" : "Tạo"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    color: "#111827",
    fontSize: 14,
  },
  inputDisabled: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  inputError: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "700",
  },
  shiftRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
  },
  shiftRowError: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  shiftPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  shiftPillActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  shiftText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6b7280",
  },
  shiftTextActive: {
    color: "#2563eb",
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: "#2563eb",
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  btnGhost: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  btnGhostText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "900",
  },
});
