// src/components/product/TemplateDownloadButton.tsx
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

interface TemplateDownloadButtonProps {
  onDownloadSuccess?: () => void;
  onDownloadError?: (error: string) => void;
}

export const TemplateDownloadButton: React.FC<TemplateDownloadButtonProps> = ({
  onDownloadSuccess,
  onDownloadError,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);

      const blob = await productApi.downloadProductTemplate();

      const options: FileSaveOptions = {
        fileName: "product_template.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Template sản phẩm",
      };

      const result = await fileService.downloadAndSaveFile(blob, options);

      if (result.success) {
        Alert.alert("Thành công", "Template đã được tải xuống");
        onDownloadSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Lỗi download template:", error);
      const errorMessage = error.message || "Tải template thất bại";
      Alert.alert("Lỗi", errorMessage);
      onDownloadError?.(errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, downloading && styles.buttonDisabled]}
      onPress={handleDownloadTemplate}
      disabled={downloading}
    >
      {downloading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="document-outline" size={20} color="#fff" />
      )}
      <Text style={styles.buttonText}>
        {downloading ? "Đang tải..." : "Tải template"}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1976d2",
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
