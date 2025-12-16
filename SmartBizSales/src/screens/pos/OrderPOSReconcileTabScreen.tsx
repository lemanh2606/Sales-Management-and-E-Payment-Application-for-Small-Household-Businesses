// src/screens/pos/OrderPOSReconcileTabScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import orderApi from "../../api/orderApi";

/** =========================
 * Types
 * ========================= */
interface ReconcileCheck {
  field: string;
  label: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

interface ReconcileResult {
  message: string;
  summary?: {
    totalChecks?: number;
    mismatched?: number;
    status?: string; // aligned | diverged | ...
    textPreview?: string;
  };
  checks: ReconcileCheck[];
}

type DocAsset = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

/** =========================
 * Const
 * ========================= */
const COLORS = {
  primary: "#10b981",
  primaryDark: "#0f766e",
  bg: "#f1f5f9",
  card: "#ffffff",
  text: "#0f172a",
  sub: "#64748b",
  border: "#e2e8f0",
  danger: "#ef4444",
  warn: "#f59e0b",
  ok: "#16a34a",
  info: "#2563eb",
};

/** =========================
 * Helpers
 * ========================= */
const safeParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
};

const formatValue = (field: string, value: string | number | null) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (field === "totalAmount") return value.toLocaleString("vi-VN") + "đ";
    return value.toLocaleString("vi-VN");
  }
  return value;
};

const statusMeta = (status?: string) => {
  if (status === "aligned")
    return {
      tone: "success" as const,
      label: "Khớp",
      color: COLORS.ok,
      icon: "checkmark-circle-outline" as const,
    };
  if (status === "diverged")
    return {
      tone: "warning" as const,
      label: "Lệch",
      color: COLORS.warn,
      icon: "warning-outline" as const,
    };
  return {
    tone: "info" as const,
    label: "Thông tin",
    color: COLORS.info,
    icon: "information-circle-outline" as const,
  };
};

/** =========================
 * UI atoms
 * ========================= */
const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

const Badge: React.FC<{
  text: string;
  tone?: "success" | "danger" | "warning" | "info";
}> = ({ text, tone = "info" }) => {
  const bg =
    tone === "success"
      ? "#dcfce7"
      : tone === "danger"
        ? "#fee2e2"
        : tone === "warning"
          ? "#ffedd5"
          : "#dbeafe";
  const fg =
    tone === "success"
      ? "#166534"
      : tone === "danger"
        ? "#b91c1c"
        : tone === "warning"
          ? "#9a3412"
          : "#1d4ed8";

  return (
    <View
      style={[styles.badge, { backgroundColor: bg, borderColor: fg + "33" }]}
    >
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
};

const InfoRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text
      style={[
        styles.infoValue,
        mono && {
          fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
        },
      ]}
    >
      {value}
    </Text>
  </View>
);

/** =========================
 * Screen
 * ========================= */
const OrderPOSReconcileTabScreen: React.FC = () => {
  const [loadingInit, setLoadingInit] = useState(true);

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("POS");

  const [picked, setPicked] = useState<DocAsset | null>(null);
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const csRaw = await AsyncStorage.getItem("currentStore");
        const cs = safeParse(csRaw);
        setStoreId(cs?._id || "");
        setStoreName(cs?.name || "POS");
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const summaryDescription = useMemo(() => {
    if (!result?.summary) return undefined;
    const total = result.summary.totalChecks ?? 0;
    const mismatched = result.summary.mismatched ?? 0;
    return `Đã kiểm tra ${total} tiêu chí, lệch ${mismatched}.`;
  }, [result]);

  const pickPdf = useCallback(async () => {
    if (!storeId) {
      Alert.alert(
        "Thiếu cửa hàng",
        "Vui lòng chọn cửa hàng trước khi đối soát."
      );
      return;
    }

    setError(null);
    setResult(null);

    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (res.canceled) return;

    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    const mimeType = asset.mimeType || "application/pdf";
    setPicked({
      uri: asset.uri,
      name: asset.name || "invoice.pdf",
      mimeType,
      size: asset.size,
    });
  }, [storeId]);

  const resetSession = () => {
    if (loading) return;
    setPicked(null);
    setResult(null);
    setError(null);
    setPreviewVisible(false);
  };

  const verifyInvoice = useCallback(async () => {
    if (!storeId) {
      Alert.alert(
        "Thiếu cửa hàng",
        "Vui lòng chọn cửa hàng trước khi đối soát."
      );
      return;
    }
    if (!picked) {
      Alert.alert("Chưa chọn file", "Vui lòng chọn file PDF hóa đơn.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Gọi qua orderApi (backend đang nhận field "invoice" trong FormData)
      const data = (await orderApi.verifyInvoiceAuto({
        storeId,
        file: {
          uri: picked.uri,
          name: picked.name,
          type: picked.mimeType || "application/pdf",
        },
      })) as ReconcileResult;

      setResult(data || null);
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể đối soát hóa đơn";
      setError(apiMessage);

      // Nếu backend trả checks/summary trong error response
      const summary = err?.response?.data?.summary;
      const checks = err?.response?.data?.checks;
      if (summary && Array.isArray(checks)) {
        setResult({ message: apiMessage, summary, checks });
      } else {
        setResult(null);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, picked]);

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = statusMeta(result?.summary?.status);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Đối soát hóa đơn POS</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {storeName}
          </Text>
        </View>

        <Pressable
          onPress={resetSession}
          disabled={loading}
          style={({ pressed }) => [
            styles.iconBtn,
            (pressed || loading) && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
        {/* Intro */}
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={22}
                color={COLORS.primaryDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tự động đối soát hóa đơn PDF</Text>
              <Text style={styles.cardSub}>
                Chọn file PDF để hệ thống nhận diện mã đơn và đối chiếu tổng
                tiền, khách hàng, phương thức thanh toán.
              </Text>
            </View>
          </View>

          <View style={styles.tipBox}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.tipText}>
              Nếu file không có mã hóa đơn hợp lệ, hệ thống sẽ trả cảnh báo để
              kiểm tra lại chứng từ.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Pressable
              onPress={pickPdf}
              disabled={loading}
              style={({ pressed }) => [
                styles.btn,
                styles.btnOutline,
                (pressed || loading) && { opacity: 0.92 },
                { flex: 1 },
              ]}
            >
              <Ionicons name="attach-outline" size={18} color={COLORS.text} />
              <Text style={styles.btnOutlineText}>Chọn PDF</Text>
            </Pressable>

            <Pressable
              onPress={verifyInvoice}
              disabled={loading || !picked}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                (pressed || loading || !picked) && { opacity: 0.7 },
                { flex: 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color="#fff"
                />
              )}
              <Text style={styles.btnPrimaryText}>
                {loading ? "Đang đối soát..." : "Đối soát"}
              </Text>
            </Pressable>
          </View>

          {/* Picked file */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.blockLabel}>File đã chọn</Text>
            <View style={styles.fileBox}>
              <View style={styles.fileIcon}>
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={20}
                  color="#ef4444"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {picked?.name || "Chưa chọn file"}
                </Text>
                <Text style={styles.fileMeta}>
                  {picked
                    ? `${formatBytes(picked.size)} • ${picked.mimeType || "application/pdf"}`
                    : "Hãy chọn file PDF để bắt đầu"}
                </Text>
              </View>

              {picked ? (
                <Pressable
                  disabled={loading}
                  onPress={() => setPicked(null)}
                  style={({ pressed }) => [
                    styles.fileRemove,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="close" size={16} color={COLORS.text} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Error */}
        {error ? (
          <Card style={{ borderColor: "#fecaca" }}>
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.danger}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </Card>
        ) : null}

        {/* Result */}
        {result ? (
          <>
            <Card>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons name={meta.icon} size={20} color={meta.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{result.message}</Text>
                  {summaryDescription ? (
                    <Text style={styles.resultSub}>{summaryDescription}</Text>
                  ) : null}
                </View>
                <Badge
                  text={meta.label}
                  tone={
                    meta.tone === "success"
                      ? "success"
                      : meta.tone === "warning"
                        ? "warning"
                        : "info"
                  }
                />
              </View>

              {result.summary?.textPreview ? (
                <Pressable
                  onPress={() => setPreviewVisible(true)}
                  style={({ pressed }) => [
                    styles.previewBtn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={COLORS.primaryDark}
                  />
                  <Text style={styles.previewBtnText}>Xem trích đoạn PDF</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.sub}
                  />
                </Pressable>
              ) : null}
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Chi tiết tiêu chí</Text>
              <Text style={styles.sectionSub}>
                So sánh dữ liệu hệ thống và dữ liệu trích từ PDF.
              </Text>

              {result.checks?.length ? (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {result.checks.map((c, idx) => (
                    <View
                      key={keyOf("check", c.field, idx)}
                      style={styles.checkRow}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View
                          style={[
                            styles.checkDot,
                            {
                              backgroundColor: c.match ? "#dcfce7" : "#fee2e2",
                            },
                          ]}
                        >
                          <Ionicons
                            name={c.match ? "checkmark" : "close"}
                            size={14}
                            color={c.match ? "#166534" : "#b91c1c"}
                          />
                        </View>

                        <Text style={styles.checkTitle} numberOfLines={2}>
                          {c.label}
                        </Text>

                        <Badge
                          text={c.match ? "Khớp" : "Lệch"}
                          tone={c.match ? "success" : "danger"}
                        />
                      </View>

                      <View style={{ marginTop: 10, gap: 8 }}>
                        <InfoRow
                          label="Hệ thống"
                          value={String(formatValue(c.field, c.expected))}
                        />
                        <InfoRow
                          label="PDF"
                          value={String(formatValue(c.field, c.actual))}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={COLORS.sub}
                  />
                  <Text style={styles.emptyBoxText}>
                    Không có tiêu chí được kiểm tra.
                  </Text>
                </View>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>

      {/* Preview modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPreviewVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trích đoạn PDF</Text>
              <Pressable
                onPress={() => setPreviewVisible(false)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.closeBtnText}>Đóng</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.previewText}>
                {result?.summary?.textPreview
                  ? result.summary.textPreview
                  : "—"}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default OrderPOSReconcileTabScreen;

/** =========================
 * Local key helper
 * ========================= */
function keyOf(prefix: string, idLike: any, index: number) {
  return `${prefix}:${String(idLike ?? "na")}:${index}`;
}

/** =========================
 * Styles
 * ========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  heroHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: { color: "#fff", fontWeight: "900", fontSize: 17 },
  heroSub: { marginTop: 2, color: "rgba(255,255,255,0.92)", fontWeight: "800" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  cardSub: {
    marginTop: 4,
    color: COLORS.sub,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },

  tipBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
  },
  tipText: {
    flex: 1,
    color: "#1d4ed8",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnOutlineText: { color: COLORS.text, fontWeight: "900" },

  blockLabel: { color: COLORS.sub, fontWeight: "900", fontSize: 12 },

  fileBox: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { color: COLORS.text, fontWeight: "900" },
  fileMeta: {
    marginTop: 3,
    color: COLORS.sub,
    fontWeight: "700",
    fontSize: 12,
  },
  fileRemove: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },

  errorText: { flex: 1, color: COLORS.danger, fontWeight: "900" },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontWeight: "900", fontSize: 12 },

  resultTitle: { color: COLORS.text, fontWeight: "900" },
  resultSub: {
    marginTop: 4,
    color: COLORS.sub,
    fontWeight: "700",
    fontSize: 12,
  },

  previewBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewBtnText: { flex: 1, color: COLORS.primaryDark, fontWeight: "900" },

  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  sectionSub: {
    marginTop: 4,
    color: COLORS.sub,
    fontWeight: "700",
    fontSize: 12,
  },

  checkRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
  },
  checkDot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  checkTitle: { flex: 1, color: COLORS.text, fontWeight: "900" },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: { color: COLORS.sub, fontWeight: "800", fontSize: 12 },
  infoValue: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  emptyBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
  },
  emptyBoxText: { color: COLORS.sub, fontWeight: "800" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    justifyContent: "center",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontWeight: "900", color: COLORS.text, fontSize: 16 },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  closeBtnText: { fontWeight: "900", color: COLORS.text },

  previewText: {
    marginTop: 10,
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: COLORS.sub, fontWeight: "700", marginTop: 8 },
});
