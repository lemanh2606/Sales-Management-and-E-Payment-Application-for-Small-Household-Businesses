import apiClient from "./apiClient";

export const getOptions = (params = {}) =>
  apiClient.get("/export/options", { params });

export const downloadResource = (resourceKey, params = {}) =>
  apiClient.get(`/export/${resourceKey}`, {
    params,
    responseType: "blob",
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
