// src/screens/settings/FileManagerScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
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
type FilterExtension = "all" | "jpg" | "png" | "pdf" | "docx" | "mp4";

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

  // Filters
  const [searchText, setSearchText] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [extensionFilter, setExtensionFilter] =
    useState<FilterExtension>("all");
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

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

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        console.log(`📡 Fetching files for store: ${storeId}`);

        const response = await apiClient.get<FilesResponse>(
          `/files/store/${storeId}`
        );

        console.log("📊 Response:", response.data);

        // ✅ Handle different response formats
        let filesList: FileItem[] = [];

        if (response.data?.data) {
          filesList = response.data.data;
        } else if (Array.isArray(response.data)) {
          filesList = response.data as any;
        }

        console.log(`✅ Loaded ${filesList.length} files`);
        setFiles(filesList);
      } catch (err: any) {
        console.error("❌ Lỗi tải files:", err);
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
    if (storeId) {
      fetchFiles(false);
    }
  }, [storeId, fetchFiles]);

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
      result = result.filter((f) => f.extension === extensionFilter);
    }

    return result;
  }, [files, searchText, categoryFilter, extensionFilter]);

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
      if (uris.length > 0) {
        await uploadFiles(uris);
      }
    } catch (err: any) {
      console.error("❌ Lỗi pick document:", err);
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
          const sluggedName = slugifyFileName(fileName);

          console.log(`📤 Uploading: ${fileName}`);

          const formData = new FormData();
          formData.append("file", sourceFile as any);
          formData.append("storeId", storeId);

          const response = await fetch(
            `${baseURL}/files/upload?storeId=${storeId}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            }
          );

          console.log("📊 Response status:", response.status);

          const responseText = await response.text();
          console.log("📄 Response body:", responseText);

          let result: UploadResponse;
          try {
            result = JSON.parse(responseText);
          } catch (parseError) {
            console.error("❌ Parse error:", parseError);
            errorCount++;
            continue;
          }

          console.log("✅ Parsed result:", result);

          // ✅ Handle different response formats
          if (result.success && result.file) {
            console.log("✅ Upload thành công - Format 1");
            setFiles((prev) => [result.file!, ...prev]);
            successCount++;
          } else if (result.file) {
            console.log("✅ Upload thành công - Format 2");
            setFiles((prev) => [result.file!, ...prev]);
            successCount++;
          } else {
            console.warn("⚠️ Response format không xác định:", result);
            errorCount++;
          }
        } catch (fileError: any) {
          console.error(
            `❌ Lỗi upload file ${Paths.basename(uri)}:`,
            fileError
          );
          errorCount++;
        }
      }

      // ✅ Show result
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
      console.error("❌ Lỗi upload general:", err);
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
            console.error("❌ Lỗi xóa:", err);
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
            console.error("❌ Lỗi xóa hàng loạt:", err);
            Alert.alert("Lỗi", "Không thể xóa files");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // ========== DOWNLOAD FILE ==========
  const downloadFile = async (fileItem: FileItem): Promise<void> => {
    try {
      const destination = new Directory(Paths.cache, "downloads");
      destination.create();

      const downloadedFile = await File.downloadFileAsync(
        fileItem.url,
        destination
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
      console.error("❌ Lỗi download:", err);
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
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = (): void => {
    setSelectedIds(filteredFiles.map((f) => f._id));
  };

  const deselectAll = (): void => {
    setSelectedIds([]);
  };

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
          if (isSelectionMode) {
            toggleSelection(item._id);
          } else {
            openFile(item);
          }
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

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchFiles(true)}
        >
          <Ionicons name="refresh" size={20} color="#1890ff" />
        </TouchableOpacity>
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

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <View style={styles.filterToggleLeft}>
              <Ionicons name="funnel" size={20} color="#1890ff" />
              <Text style={styles.filterToggleText}>
                {isFilterExpanded ? "Thu gọn" : "Mở rộng"} bộ lọc
              </Text>
            </View>
            <Ionicons
              name={isFilterExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#1890ff"
            />
          </TouchableOpacity>

          {isFilterExpanded && (
            <View style={styles.filterContent}>
              <Text style={styles.filterLabel}>Tìm kiếm</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Tìm kiếm tên file..."
                  placeholderTextColor="#9ca3af"
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.filterLabel}>Loại file</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={categoryFilter}
                  onValueChange={(value: FilterCategory) =>
                    setCategoryFilter(value)
                  }
                  style={styles.picker}
                >
                  <Picker.Item label="Tất cả" value="all" />
                  <Picker.Item label="📷 Hình ảnh" value="image" />
                  <Picker.Item label="📄 Tài liệu" value="document" />
                  <Picker.Item label="🎥 Video" value="video" />
                  <Picker.Item label="📦 Khác" value="other" />
                </Picker>
              </View>

              <Text style={styles.filterLabel}>Đuôi file</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={extensionFilter}
                  onValueChange={(value: FilterExtension) =>
                    setExtensionFilter(value)
                  }
                  style={styles.picker}
                >
                  <Picker.Item label="Tất cả" value="all" />
                  <Picker.Item label="JPG" value="jpg" />
                  <Picker.Item label="PNG" value="png" />
                  <Picker.Item label="PDF" value="pdf" />
                  <Picker.Item label="DOCX" value="docx" />
                  <Picker.Item label="MP4" value="mp4" />
                </Picker>
              </View>
            </View>
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
                {searchText ||
                categoryFilter !== "all" ||
                extensionFilter !== "all"
                  ? "Không tìm thấy file nào"
                  : "Chưa có file nào"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
              <TouchableOpacity style={styles.uploadOption} onPress={pickImage}>
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
    borderRadius: 12,
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
  uploadBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  uploadStats: { flexDirection: "row", gap: 12 },
  statItem: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1890ff",
    marginBottom: 4,
  },
  statLabel: { fontSize: 13, color: "#6b7280" },
  filterSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  filterToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  filterToggleLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterToggleText: { fontSize: 16, fontWeight: "700", color: "#1890ff" },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: { height: 50 },
  filesSection: { marginHorizontal: 16, marginTop: 16 },
  loadingContainer: { paddingVertical: 40, alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  fileList: { paddingBottom: 16 },
  fileGrid: { justifyContent: "space-between", marginBottom: 16 },
  fileCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
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
    bottom: 4,
    right: 4,
    backgroundColor: "#1890ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extensionBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  fileInfo: { padding: 12 },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
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
  categoryBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700" },
  fileSize: { fontSize: 12, color: "#6b7280" },
  fileDate: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  fileUploader: { fontSize: 11, color: "#6b7280" },
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
  },
  bottomSpacer: { height: 40 },
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
  uploadOptionText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCloseBtn: { position: "absolute", top: 50, right: 20, zIndex: 1 },
  previewImage: { width: "100%", height: "100%" },
});
