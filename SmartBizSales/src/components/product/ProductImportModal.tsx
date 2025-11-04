// src/components/product/ProductImportModal.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

interface ProductImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (file: any) => void;
  loading?: boolean;
}

const ProductImportModal: React.FC<ProductImportModalProps> = ({
  visible,
  onClose,
  onImport,
  loading = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
          // Có thể thêm các type khác nếu cần
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/pdf",
          // UTI types (cho iOS)
          "com.microsoft.excel.xlsx",
          "com.microsoft.excel",
          "public.comma-separated-values-text",
          "com.adobe.pdf",
          "public.jpeg",
          "public.png",
          "public.data",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      // Tạo File object từ expo-file-system để đảm bảo đúng định dạng
      const expoFile = new File(file.uri);

      // Kiểm tra file có tồn tại không
      if (!expoFile.exists) {
        Alert.alert("Lỗi", "File không tồn tại hoặc không thể truy cập");
        return;
      }

      console.log("✅ File selected and verified:", {
        name: file.name,
        uri: file.uri,
        size: file.size,
        type: file.mimeType,
      });

      // Lưu cả file gốc và expoFile
      setSelectedFile({
        ...file,
        expoFile: expoFile,
      });
    } catch (error) {
      console.error("Lỗi chọn file:", error);
      Alert.alert("Lỗi", "Không thể chọn file");
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      Alert.alert("Lỗi", "Vui lòng chọn file để import");
      return;
    }

    console.log("🚀 Starting import with file:", {
      name: selectedFile.name,
      uri: selectedFile.uri,
      type: selectedFile.mimeType,
      expoFileExists: selectedFile.expoFile?.exists,
    });

    try {
      // Kiểm tra lại file trước khi import
      if (!selectedFile.expoFile?.exists) {
        Alert.alert("Lỗi", "File không tồn tại. Vui lòng chọn file khác.");
        return;
      }

      // Đọc thông tin file để debug
      const fileInfo = await selectedFile.expoFile.getInfo();
      console.log("📊 File info:", fileInfo);

      // Gọi onImport với file đã được xác thực
      onImport(selectedFile);
    } catch (error) {
      console.error("❌ Error preparing file for import:", error);
      Alert.alert("Lỗi", "Không thể đọc file. Vui lòng chọn file khác.");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);

      // Import động để tránh circular dependencies
      const productApi = await import("../../api/productApi");
      const fileService = await import("../../services/fileService");

      const blob = await productApi.downloadProductTemplate();

      const result = await fileService.fileService.handleApiBlobResponse(
        blob,
        "product_import_template.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      if (result.success) {
        Alert.alert("Thành công", "Template đã được tải xuống");
      } else {
        Alert.alert("Lỗi", result.error || "Tải template thất bại");
      }
    } catch (error: any) {
      console.error("Lỗi download template:", error);
      Alert.alert("Lỗi", "Tải template thất bại");
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onClose();
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
  };

  // Rest of the component remains the same...
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      backdropTransitionOutTiming={0}
      style={styles.modal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header cố định */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Import Sản Phẩm</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Nội dung có thể scroll */}
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
          >
            <View style={styles.modalBody}>
              <Text style={styles.instructionText}>
                Chọn file Excel hoặc CSV để import sản phẩm. File cần theo đúng
                định dạng template.
              </Text>

              {/* Nút download template */}
              <TouchableOpacity
                style={styles.downloadTemplateButton}
                onPress={handleDownloadTemplate}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#1976d2" />
                ) : (
                  <Ionicons name="download-outline" size={20} color="#1976d2" />
                )}
                <Text style={styles.downloadTemplateText}>
                  {downloading ? "Đang tải..." : "Tải Template Mẫu"}
                </Text>
              </TouchableOpacity>

              {/* File selector */}
              {!selectedFile ? (
                <TouchableOpacity
                  style={styles.fileSelector}
                  onPress={handleSelectFile}
                  disabled={loading}
                >
                  <Ionicons name="document-outline" size={48} color="#ccc" />
                  <Text style={styles.fileSelectorText}>Chọn file...</Text>
                  <Text style={styles.fileSelectorSubtext}>
                    Support: .xlsx, .xls, .csv
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.selectedFileContainer}>
                  <View style={styles.selectedFileInfo}>
                    <Ionicons
                      name="document-outline"
                      size={24}
                      color="#2e7d32"
                    />
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {Math.round(selectedFile.size / 1024)} KB
                      </Text>
                      <Text style={styles.fileStatus}>✅ Đã xác thực</Text>
                    </View>
                    <TouchableOpacity
                      onPress={removeSelectedFile}
                      disabled={loading}
                    >
                      <Ionicons name="close-circle" size={20} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.fileReadyText}>
                    File đã sẵn sàng để import
                  </Text>
                </View>
              )}

              <View style={styles.requirements}>
                <Text style={styles.requirementsTitle}>Yêu cầu file:</Text>
                <Text style={styles.requirement}>
                  • Định dạng Excel (.xlsx, .xls) hoặc CSV
                </Text>
                <Text style={styles.requirement}>• Tuân thủ template mẫu</Text>
                <Text style={styles.requirement}>
                  • Dung lượng tối đa: 10MB
                </Text>
                <Text style={styles.requirement}>
                  • Các trường bắt buộc: Tên sản phẩm, Giá bán, Giá vốn
                </Text>
              </View>

              {/* Hướng dẫn sử dụng */}
              <View style={styles.tipsSection}>
                <Text style={styles.tipsTitle}>💡 Mẹo import thành công:</Text>
                <Text style={styles.tip}>
                  • Tải template mẫu và điền theo đúng cấu trúc
                </Text>
                <Text style={styles.tip}>
                  • Đảm bảo định dạng số cho giá bán và giá vốn
                </Text>
                <Text style={styles.tip}>
                  • Kiểm tra trùng lặp SKU trước khi import
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer cố định với nút actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.importButton,
                (!selectedFile || loading) && styles.disabledButton,
              ]}
              onPress={handleImport}
              disabled={!selectedFile || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.importButtonText}>
                    Import ({selectedFile ? "1" : "0"})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  fileStatus: {
    fontSize: 10,
    color: "#2e7d32",
    marginTop: 2,
    fontWeight: "500",
  },
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 16,
  },
  downloadTemplateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e3f2fd",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbdefb",
    marginBottom: 20,
    gap: 8,
  },
  downloadTemplateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1976d2",
  },
  fileSelector: {
    alignItems: "center",
    padding: 30,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    borderRadius: 12,
    marginBottom: 20,
  },
  fileSelectorText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginTop: 12,
  },
  fileSelectorSubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  selectedFileContainer: {
    borderWidth: 2,
    borderColor: "#2e7d32",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    backgroundColor: "#f1f8e9",
  },
  selectedFileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  fileSize: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  fileReadyText: {
    fontSize: 12,
    color: "#2e7d32",
    marginTop: 8,
    fontWeight: "500",
  },
  requirements: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  requirement: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    lineHeight: 16,
  },
  tipsSection: {
    backgroundColor: "#fff3e0",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
    marginBottom: 10,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e65100",
    marginBottom: 8,
  },
  tip: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 12,
    backgroundColor: "#fff",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
  },
  importButton: {
    backgroundColor: "#2e7d32",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  importButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default ProductImportModal;
