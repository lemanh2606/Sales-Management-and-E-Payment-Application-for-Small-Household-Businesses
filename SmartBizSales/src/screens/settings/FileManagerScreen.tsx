// src/screens/settings/FileManagerScreen.tsx
import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
  Modal,
  Image,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { File, Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

dayjs.extend(relativeTime);
dayjs.locale("vi");

// ========== TYPES ==========
interface FileItem {
  _id: string;
  name: string;
  originalName: string;
  url: string;
  size: number;
  type: string;
  extension: string;
  category: "image" | "video" | "document" | "other";
  uploadedBy: {
    _id: string;
    username: string;
    fullname?: string;
  };
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

interface FilesResponse {
  success?: boolean;
  data?: FileItem[];
}

interface UploadResponse {
  success?: boolean;
  file?: FileItem;
  message?: string;
}

type FilterCategory = "all" | "image" | "video" | "document" | "other";
type FilterExtension = "all" | string;

// ========== CONSTANTS ==========
const FILE_CATEGORIES: Record<string, { label: string; color: string }> = {
  image: { label: "Ảnh", color: "#1890ff" },
  video: { label: "Video", color: "#722ed1" },
  document: { label: "Tài liệu", color: "#52c41a" },
  other: { label: "Khác", color: "#faad14" },
};

const FILE_EXTENSIONS: Record<string, { icon: string; color: string }> = {
  jpg: { icon: "image", color: "#1890ff" },
  jpeg: { icon: "image", color: "#1890ff" },
  png: { icon: "image", color: "#52c41a" },
  gif: { icon: "image", color: "#722ed1" },
  pdf: { icon: "document-text", color: "#ef4444" },
  doc: { icon: "document", color: "#1890ff" },
  docx: { icon: "document", color: "#1890ff" },
  xls: { icon: "stats-chart", color: "#52c41a" },
  xlsx: { icon: "stats-chart", color: "#52c41a" },
  mp4: { icon: "videocam", color: "#722ed1" },
  mp3: { icon: "musical-notes", color: "#faad14" },
  zip: { icon: "archive", color: "#8c8c8c" },
  txt: { icon: "document-text", color: "#6b7280" },
};

// ========== SMALL HELPERS ==========
type SelectOption<T extends string> = { label: string; value: T };

const formatDateLabel = (d?: Date | null) =>
  d ? dayjs(d).format("DD/MM/YYYY") : "";

const clampDateRange = (from: Date | null, to: Date | null) => {
  if (from && to && dayjs(from).isAfter(to, "day")) return { from, to: from };
  return { from, to };
};

const isSameOrAfterDay = (iso: string, d: Date) =>
  dayjs(iso).startOf("day").valueOf() >= dayjs(d).startOf("day").valueOf();

const isSameOrBeforeDay = (iso: string, d: Date) =>
  dayjs(iso).startOf("day").valueOf() <= dayjs(d).startOf("day").valueOf();

// ========== UI: FILTER CHIP ==========
const FilterChip = memo(
  ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <View style={styles.filterChip}>
      <Text style={styles.filterChipText} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={16} color="#1890ff" />
      </TouchableOpacity>
    </View>
  )
);
FilterChip.displayName = "FilterChip";

// ========== UI: SEARCHABLE SELECT ==========
const SelectField = <T extends string>({
  label,
  value,
  placeholder,
  options,
  onChange,
  leftIcon = "options-outline",
}: {
  label: string;
  value: T;
  placeholder?: string;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) => {
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");

  const currentLabel = options.find((o) => o.value === value)?.label || "";
  const filtered = (() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  })();

  return (
    <>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.selectField}
        onPress={() => setVisible(true)}
        activeOpacity={0.85}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flex: 1,
          }}
        >
          <Ionicons name={leftIcon} size={18} color="#9ca3af" />
          <Text
            style={[
              styles.selectValue,
              !currentLabel && styles.selectPlaceholder,
            ]}
          >
            {currentLabel || placeholder || "Chọn..."}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.selectOverlay}>
          <View style={styles.selectModal}>
            <View style={styles.selectHeader}>
              <Text style={styles.selectTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectSearchRow}>
              <Ionicons name="search-outline" size={18} color="#9ca3af" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Tìm nhanh..."
                placeholderTextColor="#9ca3af"
                style={styles.selectSearchInput}
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ("")}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(it) => it.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.selectItem,
                      active && styles.selectItemActive,
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setVisible(false);
                      setQ("");
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.selectItemText,
                        active && styles.selectItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Ionicons
                      name={active ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={active ? "#1890ff" : "#d1d5db"}
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ paddingVertical: 22, alignItems: "center" }}>
                  <Ionicons name="search-outline" size={28} color="#d1d5db" />
                  <Text
                    style={{
                      marginTop: 8,
                      color: "#6b7280",
                      fontWeight: "800",
                    }}
                  >
                    Không tìm thấy dữ liệu
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// ========== MAIN COMPONENT ==========
const FileManagerScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);

  // Filters (applied)
  const [searchText, setSearchText] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [extensionFilter, setExtensionFilter] =
    useState<FilterExtension>("all");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Filter sheet (draft)
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
  const [draftSearchText, setDraftSearchText] = useState<string>("");
  const [draftCategoryFilter, setDraftCategoryFilter] =
    useState<FilterCategory>("all");
  const [draftExtensionFilter, setDraftExtensionFilter] =
    useState<FilterExtension>("all");
  const [draftFromDate, setDraftFromDate] = useState<Date | null>(null);
  const [draftToDate, setDraftToDate] = useState<Date | null>(null);

  // Date picker
  const [datePickerTarget, setDatePickerTarget] = useState<
    "from" | "to" | null
  >(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  // Modals
  const [previewModalVisible, setPreviewModalVisible] =
    useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState<boolean>(false);

  // ========== FETCH FILES ==========
  const fetchFiles = useCallback(
    async (isRefresh: boolean = false): Promise<void> => {
      if (!storeId) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await apiClient.get<FilesResponse>(
          `/files/store/${storeId}`
        );

        let filesList: FileItem[] = [];
        if (response.data?.data) filesList = response.data.data;
        else if (Array.isArray(response.data)) filesList = response.data as any;

        setFiles(filesList);
      } catch (err: any) {
        console.error(" Lỗi tải files:", err);
        Alert.alert(
          "Lỗi",
          err?.response?.data?.message || "Không thể tải files"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    if (storeId) fetchFiles(false);
  }, [storeId, fetchFiles]);

  // ========== OPTIONS (dynamic) ==========
  const extensionOptions = useMemo((): SelectOption<string>[] => {
    const exts = Array.from(
      new Set(
        files
          .map((f) => (f.extension || "").toLowerCase().trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      { label: "Tất cả đuôi file", value: "all" },
      ...exts.map((e) => ({ label: e.toUpperCase(), value: e })),
    ];
  }, [files]);

  const categoryOptions: SelectOption<FilterCategory>[] = useMemo(
    () => [
      { label: "Tất cả loại", value: "all" },
      { label: "Hình ảnh", value: "image" },
      { label: "Tài liệu", value: "document" },
      { label: "Video", value: "video" },
      { label: "Khác", value: "other" },
    ],
    []
  );

  // ========== FILTERED FILES ==========
  const filteredFiles = useMemo(() => {
    let result = [...files];

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(search) ||
          f.originalName.toLowerCase().includes(search)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((f) => f.category === categoryFilter);
    }

    if (extensionFilter !== "all") {
      result = result.filter(
        (f) =>
          (f.extension || "").toLowerCase() ===
          String(extensionFilter).toLowerCase()
      );
    }

    if (fromDate)
      result = result.filter((f) => isSameOrAfterDay(f.createdAt, fromDate));
    if (toDate)
      result = result.filter((f) => isSameOrBeforeDay(f.createdAt, toDate));

    return result;
  }, [files, searchText, categoryFilter, extensionFilter, fromDate, toDate]);

  // ========== FORMAT BYTES ==========
  const formatBytes = (bytes: number): string => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // ========== SLUGIFY FILENAME ==========
  const slugifyFileName = (fileName: string): string => {
    const lastDot = fileName.lastIndexOf(".");
    const name = fileName.substring(0, lastDot);
    const ext = fileName.substring(lastDot);

    const slug = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .replace(/-+/g, "-")
      .toLowerCase();

    return slug + ext;
  };

  // ========== PICK IMAGE ==========
  const pickImage = async (): Promise<void> => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Lỗi", "Cần quyền truy cập thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      await uploadFiles(result.assets.map((asset) => asset.uri));
    }
  };

  // ========== PICK DOCUMENT ==========
  const pickDocument = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: "*/*",
      });

      if (result.canceled) return;

      const uris = result.assets?.map((asset) => asset.uri) || [];
      if (uris.length > 0) await uploadFiles(uris);
    } catch (err: any) {
      console.error(" Lỗi pick document:", err);
      Alert.alert("Lỗi", "Không thể chọn file");
    }
  };

  // ========== UPLOAD FILES ==========
  const uploadFiles = async (uris: string[]): Promise<void> => {
    if (!storeId) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
      return;
    }

    setUploading(true);
    setUploadModalVisible(false);

    let successCount = 0;
    let errorCount = 0;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Lỗi", "Vui lòng đăng nhập lại");
        setUploading(false);
        return;
      }

      const baseURL = apiClient.defaults.baseURL || "http://localhost:9999/api";

      for (const uri of uris) {
        try {
          const sourceFile = new File(uri);

          if (!sourceFile.exists) {
            console.warn(`⚠️ File không tồn tại: ${uri}`);
            errorCount++;
            continue;
          }

          const fileName = Paths.basename(uri);
          slugifyFileName(fileName); // keep for future server naming if needed

          const formData = new FormData();
          formData.append("file", sourceFile as any);
          formData.append("storeId", storeId);

          const response = await fetch(
            `${baseURL}/files/upload?storeId=${storeId}`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            }
          );

          const responseText = await response.text();
          let result: UploadResponse;
          try {
            result = JSON.parse(responseText);
          } catch {
            errorCount++;
            continue;
          }

          if (result.success && result.file) {
            setFiles((prev) => [result.file!, ...prev]);
            successCount++;
          } else if (result.file) {
            setFiles((prev) => [result.file!, ...prev]);
            successCount++;
          } else {
            errorCount++;
          }
        } catch (fileError: any) {
          console.error(
            ` Lỗi upload file ${Paths.basename(uri)}:`,
            fileError
          );
          errorCount++;
        }
      }

      if (successCount > 0) {
        Alert.alert(
          "Thành công",
          `Đã upload ${successCount}/${uris.length} file`
        );
        await fetchFiles(false);
      }

      if (errorCount > 0) {
        Alert.alert(
          "Cảnh báo",
          `${errorCount}/${uris.length} file upload thất bại`
        );
      }
    } catch (err: any) {
      console.error(" Lỗi upload general:", err);
      Alert.alert("Lỗi", err?.message || "Không thể upload file");
    } finally {
      setUploading(false);
    }
  };

  // ========== DELETE FILE ==========
  const deleteFile = async (fileId: string): Promise<void> => {
    Alert.alert("Xác nhận xóa", "Bạn có chắc muốn xóa file này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await apiClient.delete(`/files/${fileId}?storeId=${storeId}`);
            Alert.alert("Thành công", "Đã xóa file");
            setFiles((prev) => prev.filter((f) => f._id !== fileId));
          } catch (err: any) {
            console.error(" Lỗi xóa:", err);
            Alert.alert("Lỗi", "Không thể xóa file");
          }
        },
      },
    ]);
  };

  // ========== BULK DELETE ==========
  const bulkDelete = async (): Promise<void> => {
    if (selectedIds.length === 0) return;

    Alert.alert("Xác nhận xóa", `Xóa ${selectedIds.length} file đã chọn?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            await Promise.all(
              selectedIds.map((id) =>
                apiClient.delete(`/files/${id}?storeId=${storeId}`)
              )
            );
            Alert.alert("Thành công", `Đã xóa ${selectedIds.length} file`);
            setSelectedIds([]);
            setIsSelectionMode(false);
            fetchFiles(false);
          } catch (err: any) {
            console.error(" Lỗi xóa hàng loạt:", err);
            Alert.alert("Lỗi", "Không thể xóa files");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // ========== DOWNLOAD FILE (FIX) ==========
  const downloadFile = async (fileItem: FileItem): Promise<void> => {
    try {
      // Tạo folder gốc downloads (nếu đã có thì bỏ qua lỗi)
      const root = new Directory(Paths.cache, "downloads");
      try {
        root.create();
      } catch (e) {
        // ignore "already exists"
      }

      // Tạo subfolder unique để tránh trùng file name từ server headers
      const safeStamp = dayjs().format("YYYYMMDD_HHmmss");
      const uniqueDir = new Directory(root, safeStamp);
      try {
        uniqueDir.create();
      } catch (e) {
        // ignore
      }

      // Download vào folder unique
      const downloadedFile = await File.downloadFileAsync(
        fileItem.url,
        uniqueDir
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadedFile.uri, {
          mimeType: fileItem.type,
          dialogTitle: `Lưu ${fileItem.name}`,
        });
      } else {
        Alert.alert("Thành công", `File đã lưu tại: ${downloadedFile.uri}`);
      }
    } catch (err: any) {
      console.error(" Lỗi download:", err);
      Alert.alert("Lỗi", "Không thể tải file");
    }
  };

  // ========== OPEN FILE ==========
  const openFile = (file: FileItem): void => {
    if (file.category === "image") {
      setSelectedFile(file);
      setPreviewModalVisible(true);
    } else {
      Linking.openURL(file.url);
    }
  };

  // ========== SELECTION ==========
  const toggleSelection = (id: string): void => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const selectAll = (): void => setSelectedIds(filteredFiles.map((f) => f._id));
  const deselectAll = (): void => setSelectedIds([]);

  // ========== FILTER UX HELPERS ==========
  const hasActiveFilters = (): boolean =>
    searchText.trim() !== "" ||
    categoryFilter !== "all" ||
    extensionFilter !== "all" ||
    !!fromDate ||
    !!toDate;

  const activeFilterCount = (): number => {
    let c = 0;
    if (searchText.trim()) c += 1;
    if (categoryFilter !== "all") c += 1;
    if (extensionFilter !== "all") c += 1;
    if (fromDate || toDate) c += 1;
    return c;
  };

  const buildChips = (): Array<{ key: string; label: string }> => {
    const chips: Array<{ key: string; label: string }> = [];
    if (searchText.trim())
      chips.push({ key: "search", label: `Từ khóa: "${searchText.trim()}"` });

    if (categoryFilter !== "all") {
      chips.push({
        key: "category",
        label: `Loại: ${FILE_CATEGORIES[categoryFilter]?.label || categoryFilter}`,
      });
    }

    if (extensionFilter !== "all") {
      chips.push({
        key: "ext",
        label: `Đuôi: ${String(extensionFilter).toUpperCase()}`,
      });
    }

    if (fromDate || toDate) {
      const f = fromDate ? formatDateLabel(fromDate) : "—";
      const t = toDate ? formatDateLabel(toDate) : "—";
      chips.push({ key: "date", label: `Ngày: ${f} → ${t}` });
    }

    return chips;
  };

  const removeChip = (key: string) => {
    if (key === "search") setSearchText("");
    if (key === "category") setCategoryFilter("all");
    if (key === "ext") setExtensionFilter("all");
    if (key === "date") {
      setFromDate(null);
      setToDate(null);
    }
  };

  const clearFilters = (): void => {
    setSearchText("");
    setCategoryFilter("all");
    setExtensionFilter("all");
    setFromDate(null);
    setToDate(null);
  };

  const openFilterSheet = () => {
    setDraftSearchText(searchText);
    setDraftCategoryFilter(categoryFilter);
    setDraftExtensionFilter(extensionFilter);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setFilterModalVisible(true);
  };

  const resetDraft = () => {
    setDraftSearchText("");
    setDraftCategoryFilter("all");
    setDraftExtensionFilter("all");
    setDraftFromDate(null);
    setDraftToDate(null);
  };

  const applyDraft = () => {
    const fixed = clampDateRange(draftFromDate, draftToDate);

    setSearchText(draftSearchText);
    setCategoryFilter(draftCategoryFilter);
    setExtensionFilter(draftExtensionFilter);
    setFromDate(fixed.from);
    setToDate(fixed.to);
    setFilterModalVisible(false);
  };

  const onChangeDate = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      // Android: dismiss => đóng, không set
      if (Platform.OS !== "ios" && event.type === "dismissed") {
        setDatePickerTarget(null);
        return;
      }
      if (!selected) return;

      if (datePickerTarget === "from") {
        const fixed = clampDateRange(selected, draftToDate);
        setDraftFromDate(fixed.from);
        setDraftToDate(fixed.to);
      } else if (datePickerTarget === "to") {
        const fixed = clampDateRange(draftFromDate, selected);
        setDraftFromDate(fixed.from);
        setDraftToDate(fixed.to);
      }

      setDatePickerTarget(null);
    },
    [datePickerTarget, draftFromDate, draftToDate]
  );

  // ========== GET FILE ICON ==========
  const getFileIcon = (extension: string): { icon: string; color: string } => {
    return (
      FILE_EXTENSIONS[extension.toLowerCase()] || {
        icon: "document",
        color: "#8c8c8c",
      }
    );
  };

  // ========== RENDER FILE ITEM ==========
  const renderFileItem = ({ item }: { item: FileItem }) => {
    const fileIcon = getFileIcon(item.extension);

    return (
      <TouchableOpacity
        style={[
          styles.fileCard,
          selectedIds.includes(item._id) && styles.fileCardSelected,
        ]}
        onPress={() => {
          if (isSelectionMode) toggleSelection(item._id);
          else openFile(item);
        }}
        onLongPress={() => {
          setIsSelectionMode(true);
          toggleSelection(item._id);
        }}
        activeOpacity={0.7}
      >
        {isSelectionMode && (
          <View style={styles.checkbox}>
            {selectedIds.includes(item._id) ? (
              <Ionicons name="checkbox" size={24} color="#1890ff" />
            ) : (
              <Ionicons name="square-outline" size={24} color="#d1d5db" />
            )}
          </View>
        )}

        <View style={styles.filePreview}>
          {item.category === "image" ? (
            <Image source={{ uri: item.url }} style={styles.fileImage} />
          ) : (
            <View
              style={[
                styles.fileIconContainer,
                { backgroundColor: `${fileIcon.color}20` },
              ]}
            >
              <Ionicons
                name={fileIcon.icon as any}
                size={32}
                color={fileIcon.color}
              />
            </View>
          )}

          <View style={styles.extensionBadge}>
            <Text style={styles.extensionBadgeText}>
              {item.extension.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={2}>
            {item.originalName || item.name}
          </Text>

          <View style={styles.fileMetaRow}>
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor: `${FILE_CATEGORIES[item.category]?.color}20`,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryBadgeText,
                  { color: FILE_CATEGORIES[item.category]?.color },
                ]}
              >
                {FILE_CATEGORIES[item.category]?.label}
              </Text>
            </View>
            <Text style={styles.fileSize}>{formatBytes(item.size)}</Text>
          </View>

          <Text style={styles.fileDate}>
            {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
          </Text>
          <Text style={styles.fileUploader} numberOfLines={1}>
            {item.uploadedBy?.username || "Unknown"}
          </Text>
        </View>

        {!isSelectionMode && (
          <View style={styles.fileActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => downloadFile(item)}
            >
              <Ionicons name="download" size={18} color="#1890ff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => deleteFile(item._id)}
            >
              <Ionicons name="trash" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ========== RENDER ==========
  if (!storeId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.errorText}>Vui lòng chọn cửa hàng trước</Text>
      </View>
    );
  }

  const chips = buildChips();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="folder" size={32} color="#1890ff" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Quản lý file</Text>
            <Text style={styles.headerSubtitle}>{storeName}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={openFilterSheet}
            activeOpacity={0.85}
          >
            <Ionicons name="funnel-outline" size={20} color="#1890ff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchFiles(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={20} color="#1890ff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selection Mode Bar */}
      {isSelectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            style={styles.selectionBtn}
            onPress={() => {
              setIsSelectionMode(false);
              deselectAll();
            }}
          >
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>

          <Text style={styles.selectionText}>
            Đã chọn {selectedIds.length} file
          </Text>

          <View style={styles.selectionActions}>
            {selectedIds.length === 0 ? (
              <TouchableOpacity style={styles.selectionBtn} onPress={selectAll}>
                <Text style={styles.selectionBtnText}>Chọn tất cả</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectionBtn}
                  onPress={deselectAll}
                >
                  <Text style={styles.selectionBtnText}>Bỏ chọn</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectionBtn, styles.deleteBtn]}
                  onPress={bulkDelete}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.deleteBtnText}>Xóa</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFiles(true)}
            colors={["#1890ff"]}
          />
        }
      >
        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => setUploadModalVisible(true)}
            disabled={uploading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#1890ff", "#096dd9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.uploadBtnGradient}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={24} color="#fff" />
                  <Text style={styles.uploadBtnText}>Upload File</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.uploadStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{files.length}</Text>
              <Text style={styles.statLabel}>Tổng file</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{filteredFiles.length}</Text>
              <Text style={styles.statLabel}>Hiển thị</Text>
            </View>
          </View>
        </View>

        {/* Filter summary card */}
        <View style={styles.filterSummaryCard}>
          <View style={styles.filterSummaryTop}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              <View style={styles.filterSummaryIcon}>
                <Ionicons name="funnel" size={18} color="#1890ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterSummaryTitle}>Bộ lọc</Text>
                <Text style={styles.filterSummarySub}>
                  {hasActiveFilters()
                    ? `Đang áp dụng ${activeFilterCount()} bộ lọc`
                    : "Chưa áp dụng bộ lọc"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.filterOpenBtn}
              onPress={openFilterSheet}
              activeOpacity={0.85}
            >
              <Text style={styles.filterOpenBtnText}>Mở</Text>
              <Ionicons name="chevron-forward" size={16} color="#1890ff" />
            </TouchableOpacity>
          </View>

          {chips.length > 0 && (
            <View style={styles.filterChipsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {chips.map((c) => (
                  <FilterChip
                    key={c.key}
                    label={c.label}
                    onRemove={() => removeChip(c.key)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {hasActiveFilters() && (
            <TouchableOpacity
              style={styles.clearInlineBtn}
              onPress={clearFilters}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle" size={16} color="#ef4444" />
              <Text style={styles.clearInlineText}>Xóa tất cả bộ lọc</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Files List */}
        <View style={styles.filesSection}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>Đang tải files...</Text>
            </View>
          ) : filteredFiles.length > 0 ? (
            <FlatList
              data={filteredFiles}
              renderItem={renderFileItem}
              keyExtractor={(item) => item._id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.fileGrid}
              contentContainerStyle={styles.fileList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {hasActiveFilters()
                  ? "Không tìm thấy file nào"
                  : "Chưa có file nào"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FILTER SHEET */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.sheetHeaderIcon}>
                  <Ionicons name="funnel" size={18} color="#1890ff" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Bộ lọc file</Text>
                  <Text style={styles.sheetSubTitle}>
                    Tìm file nhanh theo loại, đuôi, ngày
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Search */}
              <Text style={styles.filterLabel}>Tìm kiếm</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  value={draftSearchText}
                  onChangeText={setDraftSearchText}
                  placeholder="Tìm theo tên file..."
                  placeholderTextColor="#9ca3af"
                  returnKeyType="search"
                />
                {!!draftSearchText && (
                  <TouchableOpacity onPress={() => setDraftSearchText("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category */}
              <SelectField<FilterCategory>
                label="Loại file"
                value={draftCategoryFilter}
                placeholder="Chọn loại file"
                options={categoryOptions}
                onChange={setDraftCategoryFilter}
                leftIcon="grid-outline"
              />

              {/* Extension */}
              <SelectField<string>
                label="Đuôi file"
                value={String(draftExtensionFilter)}
                placeholder="Chọn đuôi file"
                options={extensionOptions}
                onChange={(v) => setDraftExtensionFilter(v)}
                leftIcon="pricetag-outline"
              />

              {/* Date presets */}
              <Text style={styles.filterLabel}>Lọc theo thời gian</Text>
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => {
                    const today = dayjs().startOf("day").toDate();
                    const end = dayjs().endOf("day").toDate();
                    setDraftFromDate(today);
                    setDraftToDate(end);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickDateText}>Hôm nay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => {
                    const from = dayjs()
                      .subtract(7, "day")
                      .startOf("day")
                      .toDate();
                    const to = dayjs().endOf("day").toDate();
                    const fixed = clampDateRange(from, to);
                    setDraftFromDate(fixed.from);
                    setDraftToDate(fixed.to);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickDateText}>7 ngày</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => {
                    const from = dayjs()
                      .subtract(30, "day")
                      .startOf("day")
                      .toDate();
                    const to = dayjs().endOf("day").toDate();
                    const fixed = clampDateRange(from, to);
                    setDraftFromDate(fixed.from);
                    setDraftToDate(fixed.to);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickDateText}>30 ngày</Text>
                </TouchableOpacity>
              </View>

              {/* Date range */}
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setDatePickerTarget("from")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateFieldLabel}>Từ ngày</Text>
                    <Text
                      style={[
                        styles.dateFieldValue,
                        !draftFromDate && styles.dateFieldPlaceholder,
                      ]}
                    >
                      {draftFromDate
                        ? formatDateLabel(draftFromDate)
                        : "Chọn ngày bắt đầu"}
                    </Text>
                  </View>
                  {!!draftFromDate && (
                    <TouchableOpacity
                      onPress={() => setDraftFromDate(null)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setDatePickerTarget("to")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateFieldLabel}>Đến ngày</Text>
                    <Text
                      style={[
                        styles.dateFieldValue,
                        !draftToDate && styles.dateFieldPlaceholder,
                      ]}
                    >
                      {draftToDate
                        ? formatDateLabel(draftToDate)
                        : "Chọn ngày kết thúc"}
                    </Text>
                  </View>
                  {!!draftToDate && (
                    <TouchableOpacity
                      onPress={() => setDraftToDate(null)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* DateTimePicker modal */}
              {datePickerTarget && (
                <Modal
                  transparent
                  animationType="fade"
                  visible
                  onRequestClose={() => setDatePickerTarget(null)}
                >
                  <View style={styles.pickerOverlay}>
                    <View style={styles.pickerModal}>
                      <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>
                          {datePickerTarget === "from"
                            ? "Chọn từ ngày"
                            : "Chọn đến ngày"}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setDatePickerTarget(null)}
                        >
                          <Ionicons
                            name="close-circle"
                            size={26}
                            color="#9ca3af"
                          />
                        </TouchableOpacity>
                      </View>

                      <DateTimePicker
                        value={
                          datePickerTarget === "from"
                            ? draftFromDate || new Date()
                            : draftToDate || new Date()
                        }
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={onChangeDate}
                        maximumDate={dayjs().endOf("day").toDate()}
                      />

                      {Platform.OS === "ios" && (
                        <View style={styles.pickerFooter}>
                          <TouchableOpacity
                            style={styles.pickerDoneBtn}
                            onPress={() => setDatePickerTarget(null)}
                            activeOpacity={0.9}
                          >
                            <Text style={styles.pickerDoneText}>Xong</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </Modal>
              )}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.sheetResetBtn}
                onPress={resetDraft}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#374151" />
                <Text style={styles.sheetResetText}>Đặt lại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetApplyBtn}
                onPress={applyDraft}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#1890ff", "#096dd9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sheetApplyGradient}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.sheetApplyText}>Áp dụng</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal
        visible={uploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUploadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.uploadModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload File</Text>
              <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.uploadOptions}>
              <TouchableOpacity
                style={styles.uploadOption}
                onPress={pickImage}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.uploadOptionIcon,
                    { backgroundColor: "#e6f4ff" },
                  ]}
                >
                  <Ionicons name="images" size={32} color="#1890ff" />
                </View>
                <Text style={styles.uploadOptionText}>Chọn ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.uploadOption}
                onPress={pickDocument}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.uploadOptionIcon,
                    { backgroundColor: "#f6ffed" },
                  ]}
                >
                  <Ionicons name="document" size={32} color="#52c41a" />
                </View>
                <Text style={styles.uploadOptionText}>Chọn tài liệu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.previewModalOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewModalVisible(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          {selectedFile && (
            <Image
              source={{ uri: selectedFile.url }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

export default FileManagerScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },

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
  errorText: { fontSize: 14, color: "#6b7280", textAlign: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 13, color: "#6b7280" },

  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },

  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e6f4ff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#91caff",
  },
  selectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1890ff",
    flex: 1,
    marginLeft: 8,
  },
  selectionActions: { flexDirection: "row", gap: 8 },
  selectionBtnText: { fontSize: 14, fontWeight: "600", color: "#1890ff" },
  deleteBtn: { backgroundColor: "#ef4444", paddingHorizontal: 16 },
  deleteBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  uploadSection: { marginHorizontal: 16, marginTop: 16 },
  uploadBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#1890ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 16,
  },
  uploadBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 12,
  },
  uploadBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  uploadStats: { flexDirection: "row", gap: 12 },
  statItem: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1890ff",
    marginBottom: 4,
  },
  statLabel: { fontSize: 13, color: "#6b7280", fontWeight: "700" },

  // Filter summary card
  filterSummaryCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  filterSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterSummaryTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  filterSummarySub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  filterOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
  },
  filterOpenBtnText: { fontSize: 13, fontWeight: "900", color: "#1890ff" },

  filterChipsRow: { marginTop: 12 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f4ff",
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1890ff",
    maxWidth: 230,
  },

  clearInlineBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  clearInlineText: { fontSize: 13, fontWeight: "900", color: "#ef4444" },

  filesSection: { marginHorizontal: 16, marginTop: 16 },
  loadingContainer: { paddingVertical: 40, alignItems: "center" },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },

  fileList: { paddingBottom: 16 },
  fileGrid: { justifyContent: "space-between", marginBottom: 16 },

  fileCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  fileCardSelected: { borderWidth: 2, borderColor: "#1890ff" },
  checkbox: { position: "absolute", top: 8, left: 8, zIndex: 1 },

  filePreview: {
    width: "100%",
    height: 120,
    backgroundColor: "#f9fafb",
    position: "relative",
  },
  fileImage: { width: "100%", height: "100%" },
  fileIconContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  extensionBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  extensionBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },

  fileInfo: { padding: 12 },
  fileName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    lineHeight: 18,
    height: 36,
  },
  fileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  categoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: "900" },
  fileSize: { fontSize: 12, color: "#6b7280", fontWeight: "700" },
  fileDate: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 4,
    fontWeight: "600",
  },
  fileUploader: { fontSize: 11, color: "#6b7280", fontWeight: "700" },

  fileActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },

  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
    fontWeight: "700",
  },

  bottomSpacer: { height: 40 },

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  sheetSubTitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 12 },

  filterLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#374151",
    marginBottom: 8,
    marginTop: 14,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827", fontWeight: "700" },

  selectField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  selectValue: { fontSize: 14, fontWeight: "900", color: "#111827" },
  selectPlaceholder: { color: "#9ca3af" },

  selectOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,
    justifyContent: "center",
  },
  selectModal: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    maxHeight: "80%",
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  selectTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  selectSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    margin: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    gap: 8,
  },
  selectSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
  },
  selectItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectItemActive: { backgroundColor: "#e6f4ff" },
  selectItemText: { fontSize: 14, fontWeight: "900", color: "#111827" },
  selectItemTextActive: { color: "#1890ff" },

  quickDateRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickDateBtn: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickDateText: { fontSize: 13, fontWeight: "900", color: "#374151" },

  dateRow: { gap: 10, marginTop: 6 },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dateFieldLabel: { fontSize: 11, color: "#6b7280", fontWeight: "900" },
  dateFieldValue: {
    marginTop: 2,
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },
  dateFieldPlaceholder: { color: "#9ca3af" },

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  pickerModal: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerTitle: { fontSize: 15, fontWeight: "900", color: "#111827" },
  pickerFooter: { padding: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  pickerDoneBtn: {
    backgroundColor: "#1890ff",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  pickerDoneText: { color: "#fff", fontWeight: "900" },

  sheetFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
  },
  sheetResetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  sheetResetText: { fontSize: 14, fontWeight: "900", color: "#374151" },
  sheetApplyBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  sheetApplyGradient: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sheetApplyText: { fontSize: 14, fontWeight: "900", color: "#fff" },

  // Upload modal / preview modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  uploadModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  uploadOptions: { flexDirection: "row", padding: 20, gap: 16 },
  uploadOption: { flex: 1, alignItems: "center", gap: 12 },
  uploadOptionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadOptionText: { fontSize: 14, fontWeight: "700", color: "#374151" },

  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCloseBtn: { position: "absolute", top: 50, right: 20, zIndex: 1 },
  previewImage: { width: "100%", height: "100%" },
});
