// src/api/userApi.js
import apiClient from "./apiClient";

// ==================== PUBLIC ROUTES ====================

/**
 * Đăng ký tài khoản Manager mới
 */
export const registerManager = async (data) =>
  (await apiClient.post("/users/register", data)).data;

/**
 * Xác thực OTP đăng ký
 */
export const verifyOtp = async (data) =>
  (await apiClient.post("/users/verify-otp", data)).data;

/**
 * Gửi lại OTP đăng ký
 */
export const resendRegisterOtp = async (data) =>
  (await apiClient.post("/users/resend-register-otp", data)).data;

/**
 * Đăng nhập hệ thống
 */
export const loginUser = async (data) =>
  (await apiClient.post("/users/login", data, { skipAuthRefresh: true })).data;

/**
 * Refresh access token bằng refresh token cookie
 */
export const refreshToken = async () =>
  (await apiClient.get("/users/refresh-token")).data;

/**
 * Forgot password - gửi OTP
 */
export const sendForgotPasswordOTP = async (data) =>
  (await apiClient.post("/users/forgot-password/send-otp", data)).data;

/**
 * Forgot password - đổi mật khẩu
 */
export const forgotChangePassword = async (data) =>
  (await apiClient.post("/users/forgot-password/change", data)).data;

// ==================== PROTECTED ROUTES ====================

/**
 * Lấy thông tin cá nhân (profile)
 */
export const getProfile = async () =>
  (await apiClient.get("/users/profile")).data;

/**
 * Cập nhật thông tin cá nhân
 * Supports:
 * - Text fields only (JSON)
 * - File upload from Web (FormData với field "avatar")
 * - Xóa ảnh bằng cờ removeImage
 */
export const updateProfile = async (data, options = {}) => {
  try {
    //  Case 1: Xóa ảnh
    if (options?.removeImage) {
      console.log("🗑️ Removing avatar via backend...");

      const response = await apiClient.put("/users/profile", {
        ...data,
        removeImage: true, // backend sẽ xoá avatar trên Cloudinary [file:313]
      });

      console.log(" Avatar removed:", response.data);
      return response.data;
    }

    //  Case 2: Upload file avatar (FormData)
    if (options?.imageFile) {
      const formData = new FormData();

      // Thêm các trường text
      Object.keys(data || {}).forEach((key) => {
        const value = data[key];
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value);
        }
      });

      // Thêm file ảnh với field "avatar"
      formData.append("avatar", options.imageFile);

      console.log("📤 Uploading avatar file via backend (Cloudinary)...");

      const response = await apiClient.put("/users/profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
      });

      console.log(" Profile updated with avatar:", response.data);
      return response.data;
    }

    //  Case 3: Không có ảnh, chỉ update text fields
    console.log("📝 Updating profile text fields only...");

    const response = await apiClient.put("/users/profile", data);

    console.log(" Profile updated:", response.data);
    return response.data;
  } catch (error) {
    console.error(" Update profile error:", error);
    console.error("Error response:", error.response?.data);
    throw error;
  }
};

/**
 * Gửi OTP đổi mật khẩu
 */
export const sendPasswordOTP = async (data = {}) =>
  (await apiClient.post("/users/password/send-otp", data)).data;

/**
 * Đổi mật khẩu bằng OTP
 */
export const changePassword = async (data) =>
  (await apiClient.post("/users/password/change", data)).data;

// ==================== MANAGER ROUTES ====================

/**
 * Xóa mềm nhân viên theo store hiện tại
 */
export const softDeleteUser = async (data) =>
  (await apiClient.post("/users/staff/soft-delete", data)).data;

/**
 * Khôi phục nhân viên theo store hiện tại
 */
export const restoreUser = async (data) =>
  (await apiClient.post("/users/staff/restore", data)).data;

export const getPermissionCatalog = async () =>
  (await apiClient.get("/users/permissions/catalog")).data;

export const updateUserById = async (userId, data) =>
  (await apiClient.put(`/users/${userId}`, data)).data;

// ==================== DASHBOARD ROUTES ====================

/**
 * Dashboard dành riêng cho Manager
 */
export const getManagerDashboard = async () =>
  (await apiClient.get("/users/manager-dashboard")).data;

/**
 * Dashboard dành riêng cho Staff
 */
export const getStaffDashboard = async () =>
  (await apiClient.get("/users/staff-dashboard")).data;

// ==================== EXPORT DEFAULT ====================
export default {
  registerManager,
  verifyOtp,
  resendRegisterOtp,
  loginUser,
  refreshToken,
  sendForgotPasswordOTP,
  forgotChangePassword,
  getProfile,
  updateProfile,
  sendPasswordOTP,
  changePassword,
  softDeleteUser,
  restoreUser,
  getPermissionCatalog,
  updateUserById,
  getManagerDashboard,
  getStaffDashboard,
};
