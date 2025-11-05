// src/components/product/ProductExportButton.tsx
import React, { useState } from "react";
import {
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fileService, FileSaveOptions } from "../../services/fileService";
import * as productApi from "../../api/productApi";

interface ProductExportButtonProps {
  storeId: string;
  onExportSuccess?: () => void;
  onExportError?: (error: string) => void;
}

export const ProductExportButton: React.FC<ProductExportButtonProps> = ({
  storeId,
  onExportSuccess,
  onExportError,
}) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!storeId) {
      Alert.alert("Lỗi", "Không tìm thấy cửa hàng");
      return;
    }

    try {
      setExporting(true);

      const blob = await productApi.exportProducts(storeId);
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:]/g, "-");

      const options: FileSaveOptions = {
        fileName: `products_export_${timestamp}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Xuất sản phẩm",
      };

      const result = await fileService.downloadAndSaveFile(blob, options);

      if (result.success) {
        Alert.alert("Thành công", "File export đã được tải xuống");
        onExportSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Lỗi export:", error);
      const errorMessage = error.message || "Export thất bại";
      Alert.alert("Lỗi", errorMessage);
      onExportError?.(errorMessage);
    } finally {
      setExporting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, exporting && styles.buttonDisabled]}
      onPress={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="share-outline" size={20} color="#fff" />
      )}
      <Text style={styles.buttonText}>
        {exporting ? "Đang export..." : "Export sản phẩm"}
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
