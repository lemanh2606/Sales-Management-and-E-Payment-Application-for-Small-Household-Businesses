// src/services/fileService.ts
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { DownloadOptions } from 'expo-file-system/build/ExpoFileSystem.types';

export interface FileDownloadResult {
    success: boolean;
    file?: File;
    error?: string;
}

export interface FileSaveOptions {
    fileName: string;
    mimeType: string;
    dialogTitle?: string;
}

export interface FilePickResult {
    success: boolean;
    file?: File;
    error?: string;
}

class FileService {
    private downloadsDir: Directory;

    constructor() {
        this.downloadsDir = new Directory(Paths.cache, 'downloads');
        this.initializeDirectory();
    }

    /**
     * Khởi tạo thư mục downloads
     */
    private async initializeDirectory() {
        try {
            await this.downloadsDir.create();
        } catch (error) {
            console.log('Downloads directory already exists');
        }
    }

    /**
     * Tải và lưu file từ blob (hỗ trợ cả React Native Blob và standard Blob)
     */
    async downloadAndSaveFile(
        blob: any,
        options: FileSaveOptions
    ): Promise<FileDownloadResult> {
        try {
            console.log('📥 Processing blob:', {
                blobType: typeof blob,
                hasArrayBuffer: !!blob.arrayBuffer,
                has_data: !!blob._data,
                blobData: blob
            });

            if (Platform.OS === 'web') {
                return await this.downloadFileWeb(blob, options);
            } else {
                return await this.downloadFileMobile(blob, options);
            }
        } catch (error: any) {
            // console.error(' Lỗi download file:', error);
            return {
                success: false,
                error: error.message || 'Download thất bại'
            };
        }
    }

    /**
     * Tải file trên web
     */
    private async downloadFileWeb(
        blob: any,
        options: FileSaveOptions
    ): Promise<FileDownloadResult> {
        try {
            // Sử dụng blob trực tiếp cho web
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = options.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return { success: true };
        } catch (error: any) {
            throw new Error(`Web download failed: ${error.message}`);
        }
    }

    /**
     * Tải file trên mobile - xử lý React Native Blob
     */
    private async downloadFileMobile(
        blob: any,
        options: FileSaveOptions
    ): Promise<FileDownloadResult> {
        try {
            console.log('📱 Processing blob on mobile:', blob);

            // Tạo file mới
            const file = new File(this.downloadsDir, options.fileName);

            let arrayBuffer: ArrayBuffer;

            if (blob._data && blob._data.blobId) {
                // Đây là React Native Blob object - sử dụng fetch để lấy dữ liệu
                console.log('🔄 Processing React Native Blob with blobId:', blob._data.blobId);
                arrayBuffer = await this.readReactNativeBlob(blob);
            } else {
                // Thử các phương pháp khác để đọc blob
                arrayBuffer = await this.readBlobData(blob);
            }

            // Chuyển ArrayBuffer sang Uint8Array và ghi file
            const uint8Array = new Uint8Array(arrayBuffer);
            await file.write(uint8Array);

            console.log('✅ File saved successfully:', file.uri);
            console.log('📊 File size:', arrayBuffer.byteLength, 'bytes');

            // Chia sẻ file
            if (await Sharing.isAvailableAsync()) {
                console.log('📤 Sharing file...');
                await Sharing.shareAsync(file.uri, {
                    mimeType: options.mimeType,
                    dialogTitle: options.dialogTitle || 'Tải file',
                    UTI: this.getUTIForMimeType(options.mimeType)
                });
            } else {
                console.log('ℹ️ Sharing not available');
            }

            return {
                success: true,
                file
            };
        } catch (error: any) {
            // console.error(' Mobile download failed:', error);
            throw new Error(`Mobile download failed: ${error.message}`);
        }
    }

    /**
     * Đọc dữ liệu từ blob bằng nhiều phương pháp
     */
    private async readBlobData(blob: any): Promise<ArrayBuffer> {
        try {
            // Phương pháp 1: Sử dụng arrayBuffer nếu có
            if (blob.arrayBuffer && typeof blob.arrayBuffer === 'function') {
                console.log('🔧 Using blob.arrayBuffer()');
                return await blob.arrayBuffer();
            }

            // Phương pháp 2: Sử dụng Response.arrayBuffer()
            if (typeof Response !== 'undefined' && blob instanceof Blob) {
                console.log('🔧 Using Response.arrayBuffer()');
                const response = new Response(blob);
                return await response.arrayBuffer();
            }

            // Phương pháp 3: Sử dụng FileReader
            console.log('🔧 Using FileReader');
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (reader.result instanceof ArrayBuffer) {
                        resolve(reader.result);
                    } else {
                        reject(new Error('FileReader did not return ArrayBuffer'));
                    }
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(blob);
            });

        } catch (error: any) {
            // console.error(' Error reading blob data:', error);
            throw new Error(`Cannot read blob data: ${error.message}`);
        }
    }

    /**
     * Đọc React Native Blob object thông qua fetch
     */
    private async readReactNativeBlob(blob: any): Promise<ArrayBuffer> {
        try {
            console.log('🔗 Creating blob URL...');
            const blobUrl = URL.createObjectURL(blob);

            console.log('📡 Fetching blob data...');
            const response = await fetch(blobUrl);

            if (!response.ok) {
                throw new Error(`Fetch failed with status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            console.log('🗑️ Revoking blob URL...');
            URL.revokeObjectURL(blobUrl);

            console.log(`📊 Successfully converted blob to ArrayBuffer, size: ${arrayBuffer.byteLength} bytes`);

            return arrayBuffer;
        } catch (error: any) {
            // console.error(' Error reading React Native blob:', error);

            // Fallback: thử đọc trực tiếp từ _data nếu có
            if (blob._data && blob._data.size > 0) {
                console.log('🔄 Trying fallback method...');
                return await this.readBlobData(blob);
            }

            throw new Error(`Cannot read React Native blob: ${error.message}`);
        }
    }

    /**
     * Tải file từ URL
     */
    async downloadFromUrl(
        url: string,
        fileName: DownloadOptions
    ): Promise<FileDownloadResult> {
        try {
            const destination = new Directory(Paths.cache, 'downloads');
            await destination.create();

            const output: any = await File.downloadFileAsync(url, destination, fileName);

            return {
                success: true,
                file: output
            };
        } catch (error: any) {
            console.error('Lỗi download từ URL:', error);
            return {
                success: false,
                error: error.message || 'Download từ URL thất bại'
            };
        }
    }

    /**
     * Chọn file từ thiết bị
     */
    async pickFile(options?: DocumentPicker.DocumentPickerOptions): Promise<FilePickResult> {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                ...options
            });

            if (result.canceled || !result.assets?.[0]) {
                return { success: false, error: 'Người dùng đã hủy chọn file' };
            }

            const asset = result.assets[0];
            const file = new File(asset.uri);

            return {
                success: true,
                file
            };
        } catch (error: any) {
            console.error('Lỗi chọn file:', error);
            return {
                success: false,
                error: error.message || 'Chọn file thất bại'
            };
        }
    }

    /**
     * Đọc nội dung file dạng text
     */
    async readFileAsText(file: File): Promise<string> {
        try {
            return await file.text();
        } catch (error: any) {
            throw new Error(`Đọc file thất bại: ${error.message}`);
        }
    }

    /**
     * Đọc nội dung file dạng ArrayBuffer
     */
    async readFileAsArrayBuffer(p0: globalThis.File, file: File): Promise<ArrayBuffer> {
        try {
            const bytes = await file.bytes();
            return bytes.buffer;
        } catch (error: any) {
            throw new Error(`Đọc file thất bại: ${error.message}`);
        }
    }

    /**
     * Xóa file
     */
    async deleteFile(file: File): Promise<void> {
        try {
            await file.delete();
        } catch (error: any) {
            throw new Error(`Xóa file thất bại: ${error.message}`);
        }
    }

    /**
     * Kiểm tra file có tồn tại không
     */
    async fileExists(file: File): Promise<boolean> {
        try {
            return file.exists; // Đây là property, không phải method
        } catch (error) {
            return false;
        }
    }

    /**
     * Kiểm tra file có tồn tại không (sync)
     */
    fileExistsSync(file: File): boolean {
        try {
            return file.exists; // Đây là property, không phải method
        } catch (error) {
            return false;
        }
    }

    /**
     * Lấy danh sách file trong thư mục downloads
     */
    async listDownloadedFiles(): Promise<File[]> {
        try {
            const contents = this.downloadsDir.list();
            return contents.filter(item => item instanceof File) as File[];
        } catch (error: any) {
            console.error('Lỗi lấy danh sách file:', error);
            return [];
        }
    }

    /**
     * Phương thức đơn giản để xử lý blob từ API response
     */
    async handleApiBlobResponse(blobResponse: any, fileName: string, mimeType: string = 'application/octet-stream'): Promise<FileDownloadResult> {
        return await this.downloadAndSaveFile(blobResponse, {
            fileName,
            mimeType,
            dialogTitle: `Tải ${fileName}`
        });
    }

    /**
     * Lấy UTI cho mime type (iOS)
     */
    private getUTIForMimeType(mimeType: string): string {
        const utiMap: { [key: string]: string } = {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'com.microsoft.excel.xlsx',
            'application/vnd.ms-excel': 'com.microsoft.excel',
            'text/csv': 'public.comma-separated-values-text',
            'application/pdf': 'com.adobe.pdf',
            'image/jpeg': 'public.jpeg',
            'image/png': 'public.png',
            'application/octet-stream': 'public.data'
        };

        return utiMap[mimeType] || 'public.data';
    }
}

export const fileService = new FileService();