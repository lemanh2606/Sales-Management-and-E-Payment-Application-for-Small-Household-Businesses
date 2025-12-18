// src/screens/settings/DataExportScreen.tsx
// src/screens/settings/DataExportScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import DateTimePicker from "@react-native-community/datetimepicker";

import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useAuth } from "../../context/AuthContext";
import { exportApi } from "../../api/exportApi";

const ORDER_STATUS_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Đang chờ", value: "pending" },
  { label: "Đã thanh toán", value: "paid" },
  { label: "Đã hoàn", value: "refunded" },
  { label: "Hoàn một phần", value: "partially_refunded" },
] as const;

const PAYMENT_METHOD_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Tiền mặt", value: "cash" },
  { label: "Quét QR", value: "qr" },
] as const;

const filterBadges: Record<string, { color: string; label: string }> = {
  date: { color: "#3b82f6", label: "Khoảng thời gian" },
  status: { color: "#22c55e", label: "Trạng thái" },
  paymentMethod: { color: "#a855f7", label: "Hình thức thanh toán" },
};

const HIDDEN_EXPORT_KEYS = new Set([
  "purchaseOrders",
  "purchaseReturns",
  "stockChecks",
  "stockDisposals",
]);

const extractFilename = (
  contentDisposition: string | undefined,
  fallback: string
) => {
  if (!contentDisposition) return fallback;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(
    contentDisposition
  );
  if (match) return decodeURIComponent(match[1] || match[2]);
  return fallback;
};

type PickerItem = { label: string; value: string };

const SelectModal = ({
  visible,
  title,
  items,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selected: string;
  onClose: () => void;
  onPick: (v: string) => void;
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 360 }}>
            {items.map((it) => {
              const active = it.value === selected;
              return (
                <TouchableOpacity
                  key={it.value}
                  style={[styles.modalItem, active && styles.modalItemActive]}
                  onPress={() => {
                    onPick(it.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      active && styles.modalItemTextActive,
                    ]}
                  >
                    {it.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={18} color="#10b981" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

type DateTarget = "from" | "to";

const DataExportScreen: React.FC = () => {
  const { currentStore } = useAuth() as any;

  const [options, setOptions] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // filters
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");

  const [statusOpen, setStatusOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // DateTimePicker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<DateTarget>("from");
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const selectedOption = useMemo(
    () => options.find((opt) => opt.key === selectedKey) || null,
    [options, selectedKey]
  );

  useEffect(() => {
    if (!currentStore?._id) return;

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const { data } = await exportApi.getOptions({
          storeId: currentStore._id,
        });
        const fetched = data?.options || [];
        const visible = fetched.filter(
          (o: any) => !HIDDEN_EXPORT_KEYS.has(o.key)
        );

        setOptions(visible);
        setSelectedKey((prev) => {
          if (prev && visible.some((o: any) => o.key === prev)) return prev;
          return visible[0]?.key ?? null;
        });
      } catch (e: any) {
        Alert.alert(
          "Lỗi",
          e?.response?.data?.message ||
            e?.message ||
            "Không tải được danh sách dữ liệu"
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [currentStore?._id]);

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    setFromDate(null);
    setToDate(null);
    setStatus("all");
    setPaymentMethod("all");
  };

  const openDatePicker = (target: DateTarget) => {
    setDatePickerTarget(target);

    const current = target === "from" ? fromDate : toDate;
    setTempDate(current ?? new Date());

    setDatePickerVisible(true);
  };

  const closeDatePicker = () => setDatePickerVisible(false);

  const commitPickedDate = (d: Date) => {
    if (datePickerTarget === "from") {
      setFromDate(d);

      // nếu from > to => reset to để tránh range lỗi
      if (toDate && dayjs(d).isAfter(toDate, "day")) setToDate(null);
    } else {
      setToDate(d);

      // nếu to < from => reset from để tránh range lỗi
      if (fromDate && dayjs(d).isBefore(fromDate, "day")) setFromDate(null);
    }
  };

  const onChangeDate = (event: any, selected?: Date) => {
    // event.type: 'set' | 'dismissed' [web:1640][web:1641]
    if (Platform.OS === "android") {
      if (event?.type === "dismissed") {
        closeDatePicker();
        return;
      }
      if (event?.type === "set" && selected) {
        commitPickedDate(selected);
        closeDatePicker();
      }
      return;
    }

    // iOS: picker thường không tự đóng, nên chỉ update tempDate,
    // rồi bấm "Xong" để apply.
    if (selected) setTempDate(selected);
  };

  const formatDateLabel = (d: Date | null) =>
    d ? dayjs(d).format("DD/MM/YYYY") : "Chọn ngày";

  const handleDownload = async () => {
    try {
      if (!currentStore?._id) {
        Alert.alert(
          "Thiếu thông tin",
          "Vui lòng chọn cửa hàng trước khi xuất dữ liệu"
        );
        return;
      }
      if (!selectedKey) {
        Alert.alert("Thiếu thông tin", "Vui lòng chọn loại dữ liệu muốn xuất");
        return;
      }

      // Nếu đã chọn 1 ngày thì phải chọn đủ 2 ngày
      if ((fromDate && !toDate) || (!fromDate && toDate)) {
        Alert.alert(
          "Thiếu khoảng thời gian",
          "Vui lòng chọn đủ Từ ngày và Đến ngày"
        );
        return;
      }

      const params: Record<string, any> = { storeId: currentStore._id };

      if (fromDate && toDate) {
        params.from = dayjs(fromDate).format("YYYY-MM-DD");
        params.to = dayjs(toDate).format("YYYY-MM-DD");
      }
      if (status && status !== "all") params.status = status;
      if (paymentMethod && paymentMethod !== "all")
        params.paymentMethod = paymentMethod;

      setDownloading(true);

      const response = await exportApi.downloadResourceArrayBuffer(
        selectedKey,
        params
      );

      const contentType =
        (response.headers as any)?.["content-type"] ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const fallbackName = `${selectedKey}_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
      const filename = extractFilename(
        (response.headers as any)?.["content-disposition"],
        fallbackName
      );

      const bytes = new Uint8Array(response.data);

      const exportDir = new Directory(Paths.document, "exports");
      exportDir.create({ intermediates: true, idempotent: true });

      const file = new File(exportDir, filename);
      file.create({ intermediates: true, overwrite: true });
      file.write(bytes);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: `Xuất dữ liệu: ${filename}`,
          mimeType: contentType,
          UTI: "org.openxmlformats.spreadsheetml.sheet",
        });
      }

      Alert.alert(
        "Thành công",
        `Đã tạo file: ${filename}\nVị trí: ${file.uri}`
      );
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Xuất dữ liệu thất bại";
      Alert.alert("Lỗi", msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Xuất dữ liệu Excel</Text>
          <Text style={styles.subtitle}>
            Tải dữ liệu cửa hàng dưới dạng .xlsx để sao lưu hoặc xử lý thêm.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chọn loại dữ liệu</Text>

          {loadingOptions ? (
            <View style={styles.centerRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Đang tải danh sách...</Text>
            </View>
          ) : !options.length ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={28} color="#94a3b8" />
              <Text style={styles.muted}>
                Chưa có dữ liệu export cho cửa hàng này
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {options.map((opt: any) => {
                const active = opt.key === selectedKey;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.optionCard,
                      active && styles.optionCardActive,
                    ]}
                    onPress={() => handleSelect(opt.key)}
                    activeOpacity={0.9}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color={active ? "#16a34a" : "#334155"}
                      />
                      <Text
                        style={[
                          styles.optionTitle,
                          active && { color: "#16a34a" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>

                    {!!opt.description && (
                      <Text style={styles.optionDesc} numberOfLines={2}>
                        {opt.description}
                      </Text>
                    )}

                    <View style={styles.badgeRow}>
                      {(opt.filters || []).length ? (
                        (opt.filters || []).map((f: string) => (
                          <View
                            key={f}
                            style={[
                              styles.badge,
                              {
                                borderColor:
                                  filterBadges[f]?.color || "#cbd5e1",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                { color: filterBadges[f]?.color || "#334155" },
                              ]}
                            >
                              {filterBadges[f]?.label || f}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Không cần bộ lọc</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thiết lập bộ lọc</Text>

          {!currentStore?._id ? (
            <View style={styles.notice}>
              <Ionicons name="alert-circle-outline" size={18} color="#b45309" />
              <Text style={styles.noticeText}>
                Vui lòng chọn cửa hàng để xuất dữ liệu.
              </Text>
            </View>
          ) : !selectedOption ? (
            <View style={styles.noticeInfo}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#2563eb"
              />
              <Text style={styles.noticeInfoText}>
                Chọn loại dữ liệu ở bước trên để hiển thị bộ lọc.
              </Text>
            </View>
          ) : (
            <>
              {(selectedOption.filters || []).includes("date") && (
                <>
                  <Text style={styles.label}>Khoảng thời gian</Text>

                  <View style={styles.dateRow}>
                    <TouchableOpacity
                      style={styles.dateBox}
                      onPress={() => openDatePicker("from")}
                      activeOpacity={0.9}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#334155"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dateBoxLabel}>Từ ngày</Text>
                        <Text style={styles.dateBoxValue}>
                          {formatDateLabel(fromDate)}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#64748b"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dateBox}
                      onPress={() => openDatePicker("to")}
                      activeOpacity={0.9}
                      disabled={!fromDate} // gợi ý chọn from trước
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={!fromDate ? "#cbd5e1" : "#334155"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dateBoxLabel,
                            !fromDate && { color: "#94a3b8" },
                          ]}
                        >
                          Đến ngày
                        </Text>
                        <Text
                          style={[
                            styles.dateBoxValue,
                            !fromDate && { color: "#94a3b8" },
                          ]}
                        >
                          {fromDate
                            ? formatDateLabel(toDate)
                            : "Chọn Từ ngày trước"}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={!fromDate ? "#cbd5e1" : "#64748b"}
                      />
                    </TouchableOpacity>

                    {(fromDate || toDate) && (
                      <TouchableOpacity
                        style={styles.clearDateBtn}
                        onPress={() => {
                          setFromDate(null);
                          setToDate(null);
                        }}
                        activeOpacity={0.9}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#ef4444"
                        />
                        <Text style={styles.clearDateText}>Xóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {(selectedOption.filters || []).includes("status") && (
                <>
                  <Text style={styles.label}>Trạng thái</Text>
                  <TouchableOpacity
                    style={styles.select}
                    onPress={() => setStatusOpen(true)}
                  >
                    <Text style={styles.selectText}>
                      {ORDER_STATUS_OPTIONS.find((x) => x.value === status)
                        ?.label || "Chọn"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#334155" />
                  </TouchableOpacity>
                </>
              )}

              {(selectedOption.filters || []).includes("paymentMethod") && (
                <>
                  <Text style={styles.label}>Hình thức thanh toán</Text>
                  <TouchableOpacity
                    style={styles.select}
                    onPress={() => setPaymentOpen(true)}
                  >
                    <Text style={styles.selectText}>
                      {PAYMENT_METHOD_OPTIONS.find(
                        (x) => x.value === paymentMethod
                      )?.label || "Chọn"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#334155" />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.9}
              >
                {downloading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="download-outline" size={18} color="#fff" />
                )}
                <Text style={styles.primaryBtnText}>
                  {downloading ? "Đang tải..." : "Tải file Excel"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                Sau khi tải xong, bạn có thể chọn “Lưu vào
                Files/Downloads/Drive” trong màn hình chia sẻ.
              </Text>
            </>
          )}
        </View>

        <SelectModal
          visible={statusOpen}
          title="Chọn trạng thái"
          items={ORDER_STATUS_OPTIONS as unknown as PickerItem[]}
          selected={status}
          onClose={() => setStatusOpen(false)}
          onPick={setStatus}
        />

        <SelectModal
          visible={paymentOpen}
          title="Chọn hình thức thanh toán"
          items={PAYMENT_METHOD_OPTIONS as unknown as PickerItem[]}
          selected={paymentMethod}
          onClose={() => setPaymentOpen(false)}
          onPick={setPaymentMethod}
        />

        {/* DateTimePicker */}
        {datePickerVisible && (
          <>
            {Platform.OS === "android" ? (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="default"
                onChange={onChangeDate}
                maximumDate={new Date()}
                minimumDate={
                  datePickerTarget === "to" && fromDate ? fromDate : undefined
                }
                locale="vi-VN"
                style={{ backgroundColor: "#fff" }}
                textColor="#000000"
                themeVariant="light"
              />
            ) : (
              <Modal
                transparent
                animationType="fade"
                onRequestClose={closeDatePicker}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>
                        {datePickerTarget === "from"
                          ? "Chọn Từ ngày"
                          : "Chọn Đến ngày"}
                      </Text>
                      <TouchableOpacity
                        onPress={closeDatePicker}
                        style={styles.modalCloseBtn}
                      >
                        <Ionicons name="close" size={22} color="#0f172a" />
                      </TouchableOpacity>
                    </View>

                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="spinner"
                      onChange={onChangeDate}
                      maximumDate={new Date()}
                      minimumDate={
                        datePickerTarget === "to" && fromDate
                          ? fromDate
                          : undefined
                      }
                      style={{ alignSelf: "stretch", backgroundColor: "#fff" }}
                      locale="vi-VN"
                      textColor="#000000"
                      themeVariant="light"
                    />

                    <View style={styles.iosDateActions}>
                      <TouchableOpacity
                        style={[styles.secondaryBtn]}
                        onPress={closeDatePicker}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.secondaryBtnText}>Hủy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.primaryBtn, { marginTop: 0, flex: 1 }]}
                        onPress={() => {
                          commitPickedDate(tempDate);
                          closeDatePicker();
                        }}
                        activeOpacity={0.9}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.primaryBtnText}>Xong</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DataExportScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 16, gap: 14 },

  header: { paddingVertical: 6 },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  subtitle: { marginTop: 6, fontSize: 13, color: "#475569", fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
  },

  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
  },
  muted: { color: "#64748b", fontWeight: "700" },
  emptyBox: { alignItems: "center", gap: 10, paddingVertical: 22 },

  optionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#ffffff",
    gap: 8,
  },
  optionCardActive: { borderColor: "#22c55e", backgroundColor: "#f0fdf4" },
  optionTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  optionDesc: { fontSize: 12, color: "#64748b", fontWeight: "700" },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  badgeText: { fontSize: 12, fontWeight: "800", color: "#334155" },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  noticeText: { flex: 1, color: "#9a3412", fontWeight: "800" },

  noticeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  noticeInfoText: { flex: 1, color: "#1d4ed8", fontWeight: "800" },

  label: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "900",
    color: "#334155",
  },

  select: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectText: { fontWeight: "800", color: "#0f172a" },

  dateRow: { gap: 10 },
  dateBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateBoxLabel: { fontSize: 11, fontWeight: "900", color: "#64748b" },
  dateBoxValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },

  clearDateBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  clearDateText: { color: "#ef4444", fontWeight: "900" },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  hint: { marginTop: 10, fontSize: 12, color: "#64748b", fontWeight: "700" },

  secondaryBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "#0f172a", fontWeight: "900" },

  iosDateActions: { flexDirection: "row", gap: 10, marginTop: 12 },

  // modal (shared by selects + iOS date)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 15, fontWeight: "900", color: "#0f172a" },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalItemActive: { backgroundColor: "#f0fdf4" },
  modalItemText: { fontWeight: "800", color: "#0f172a" },
  modalItemTextActive: { color: "#16a34a" },
});
