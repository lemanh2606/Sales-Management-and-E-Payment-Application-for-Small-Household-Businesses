// src/utils/pdfSave.ts
import { Platform, Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Directory } from "expo-file-system";

// ─────────────────────────────────────────────────────────────
// Chia sẻ / lưu PDF qua share sheet (iOS + Android)
// ─────────────────────────────────────────────────────────────
export async function sharePdf(uri: string, fileName = "hoa-don.pdf") {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        Alert.alert("Không hỗ trợ", "Thiết bị hiện tại không hỗ trợ chia sẻ/lưu file.");
        return;
    }

    // Share sheet: người dùng có thể chọn “Lưu vào Tệp/Files”, Drive, Zalo, v.v.
    await Sharing.shareAsync(uri, {
        dialogTitle: "Lưu hóa đơn PDF",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
    });
}

// ─────────────────────────────────────────────────────────────
// Android: lưu PDF vào thư mục người dùng chọn (API mới)
// Sử dụng Directory.pickDirectoryAsync + File.write
// ─────────────────────────────────────────────────────────────
export async function savePdfToAndroidFolderWithPicker(params: {
    sourceUri: string;
    fileName: string;
}) {
    // Với iOS (hoặc platform khác), fallback sang share sheet cho đơn giản
    if (Platform.OS !== "android") {
        await sharePdf(params.sourceUri, params.fileName);
        return;
    }

    try {
        // 1) Hỏi người dùng chọn thư mục (Downloads / bất kỳ)
        //    Trả về một Directory instance (API mới của expo-file-system). [web:1038]
        const directory = await Directory.pickDirectoryAsync();
        // Người dùng bấm back hoặc hủy
        if (!directory) {
            return;
        }

        // 2) Tạo File từ uri nguồn (PDF tạm trong cache)
        //    File trong API mới implement Blob nên đọc được bytes trực tiếp. [web:1038]
        const srcFile = new File(params.sourceUri);
        const bytes = await srcFile.bytes(); // Uint8Array

        // 3) Tạo file đích trong thư mục đã chọn, mimeType là PDF
        const destFile = directory.createFile(params.fileName, "application/pdf");

        // 4) Ghi nội dung (bytes) vào file mới
        destFile.write(bytes);

        Alert.alert("Đã lưu", `Đã lưu file: ${params.fileName}`);
    } catch (error: any) {
        console.error("savePdfToAndroidFolderWithPicker error", error);
        Alert.alert("Lỗi", error?.message || "Không thể lưu file PDF");
    }
}
