// src/components/supplier/SupplierExportButton.tsx
import React, { useState } from "react";
import {
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fileService, FileSaveOptions } from "../../services/fileService";
import * as supplierApi from "../../api/supplierApi";

interface SupplierExportButtonProps {
  storeId: string;
  onExportSuccess?: () => void;
  onExportError?: (error: string) => void;
}

export const SupplierExportButton: React.FC<SupplierExportButtonProps> = ({
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

      const blob = await supplierApi.exportSuppliers(storeId);
      const timestamp = new Date()
        .toISOString()
        .slice(0, 10);

      const options: FileSaveOptions = {
        fileName: `nha_cung_cap_${timestamp}.xlsx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Xuất nhà cung cấp",
      };

      const result = await fileService.downloadAndSaveFile(blob, options);

      if (result.success) {
        Alert.alert("Thành công", "File đã được tải xuống");
        onExportSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Lỗi export NCC:", error);
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
        <Ionicons name="download-outline" size={20} color="#fff" />
      )}
      <Text style={styles.buttonText}>
        {exporting ? "Đang export..." : "Xuất Excel"}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
