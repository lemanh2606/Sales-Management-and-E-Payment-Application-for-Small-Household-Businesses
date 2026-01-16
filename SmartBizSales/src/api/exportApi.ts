// src/api/exportApi.ts
import apiClient from "./apiClient";

export type ExportFilterKey = "date" | "status" | "paymentMethod";

export type ExportOption = {
    key: string;
    label: string;
    description?: string;
    filters?: ExportFilterKey[];
};

export type GetOptionsParams = {
    storeId?: string;
    [key: string]: any;
};

export type GetOptionsResult = {
    options: ExportOption[];
};

export type DownloadResourceParams = {
    storeId?: string;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    status?: string;
    paymentMethod?: string;
    [key: string]: any;
};

export const getOptions = (params: GetOptionsParams = {}) =>
    apiClient.get<GetOptionsResult>("/export/options", { params });

/**
 * Web: tải file dạng Blob
 */
export const downloadResourceBlob = (
    resourceKey: string,
    params: DownloadResourceParams = {}
) =>
    apiClient.get<Blob>(`/export/${resourceKey}`, {
        params,
        responseType: "blob",
        headers: {
            Accept:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    });

/**
 * React Native: tải file dạng ArrayBuffer (ổn định hơn blob trong RN)
 */
export const downloadResourceArrayBuffer = (
    resourceKey: string,
    params: DownloadResourceParams = {}
) =>
    apiClient.get<ArrayBuffer>(`/export/${resourceKey}`, {
        params,
        responseType: "arraybuffer",
        headers: {
            Accept:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    });

export const exportApi = {
    getOptions,
    downloadResourceBlob,
    downloadResourceArrayBuffer,
};

export default exportApi;
