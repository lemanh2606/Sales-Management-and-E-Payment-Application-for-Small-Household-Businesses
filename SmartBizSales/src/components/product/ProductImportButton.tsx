// src/components/product/ProductImportButton.tsx
import React, { useState } from "react";
import {
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fileService } from "../../services/fileService";
import * as productApi from "../../api/productApi";

interface ProductImportButtonProps {
  storeId: string;
  onImportSuccess?: (result: any) => void;
  onImportError?: (error: string) => void;
  onShowImportModal?: () => void;
}

interface FileData {
  uri: string;
  type: string;
  name: string;
}

export const ProductImportButton: React.FC<ProductImportButtonProps> = ({
  storeId,
  onImportSuccess,
  onImportError,
  onShowImportModal,
}) => {
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (onShowImportModal) {
      onShowImportModal();
      return;
    }

    await handleFileImport();
  };

  const handleFileImport = async () => {
    if (!storeId) {
      Alert.alert("Lỗi", "Không tìm thấy cửa hàng");
      return;
    }

    try {
      setImporting(true);

      const result = await fileService.pickFile({
        type: [
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
        ],
      });

      if (!result.success || !result.file) {
        setImporting(false);
        return;
      }

      // Tạo FormData đúng cách
      const formData = new FormData();

      // Xử lý file data phù hợp với cả iOS và Android
      const fileData: FileData = {
        uri: result.file.uri,
        type:
          result.file.type ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        name: result.file.name || "import.xlsx",
      };

      // Đối với Android, cần thêm tiền tố file://
      if (Platform.OS === "android" && !fileData.uri.startsWith("file://")) {
        fileData.uri = `file://${fileData.uri}`;
      }

      formData.append("file", fileData as any);

      console.log("Starting import for store:", storeId);
      console.log("File data:", {
        uri: fileData.uri,
        type: fileData.type,
        name: fileData.name,
      });

      const importResult = await productApi.importProducts(storeId, formData);

      Alert.alert(
        "Thành công",
        `Import thành công ${importResult.results.success.length} sản phẩm`
      );

      onImportSuccess?.(importResult);
    } catch (error: any) {
      console.error("Lỗi import chi tiết:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        stack: error.stack,
      });

      let errorMessage = "Import thất bại";

      if (error.code === "NETWORK_ERROR" || error.message === "Network Error") {
        errorMessage =
          "Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Lỗi", errorMessage);
      onImportError?.(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, importing && styles.buttonDisabled]}
      onPress={handleImport}
      disabled={importing}
    >
      {importing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="download-outline" size={20} color="#fff" />
      )}
      <Text style={styles.buttonText}>
        {importing ? "Đang import..." : "Import sản phẩm"}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2e7d32",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
