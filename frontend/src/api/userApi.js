import apiClient from "./apiClient";

// =============== PUBLIC ROUTES ===============

// Đăng ký tài khoản Manager mới
export const registerManager = async (data) =>
  (await apiClient.post("/users/register", data)).data;

// Xác thực OTP đăng ký
export const verifyOtp = async (data) =>
  (await apiClient.post("/users/verify-otp", data)).data;

// Đăng nhập hệ thống
export const loginUser = async (data) =>
  (await apiClient.post("/users/login", data)).data;

// Refresh access token bằng refresh token cookie
export const refreshToken = async () =>
  (await apiClient.get("/users/refresh-token")).data;

// Forgot password - gửi OTP
export const sendForgotPasswordOTP = async (data) =>
  (await apiClient.post("/users/forgot-password/send-otp", data)).data;

// Forgot password - đổi mật khẩu
export const forgotChangePassword = async (data) =>
  (await apiClient.post("/users/forgot-password/change", data)).data;

// =============== PROTECTED ROUTES ===============

// Lấy thông tin cá nhân (profile)
export const getProfile = async () =>
  (await apiClient.get("/users/profile")).data;

// Cập nhật thông tin cá nhân
// export const updateProfile = async (data) =>
//   (await apiClient.put("/users/profile", data)).data;
// api/userApi.js
export const updateProfile = async (data, options = {}) => {
  try {
    // Nếu có ảnh, dùng FormData
    if (options?.imageFile || options?.imageUri) {
      const formData = new FormData();

      // Thêm các trường dữ liệu
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value);
        }
      });

      // Xử lý ảnh từ Web
      if (options?.imageFile) {
        formData.append("avatar", options.imageFile);
      }

      // Xử lý ảnh từ React Native
      if (options?.imageUri) {
        const fileType = options.imageUri.split(".").pop();
        const file = {
          uri: options.imageUri,
          type: `image/${fileType}`,
          name: `avatar-${Date.now()}.${fileType}`,
        };
        formData.append("avatar", file);
      }

      const response = await apiClient.put("/users/profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
      });

      return response.data;
    } else {
      // Không có ảnh, gửi JSON thông thường
      const response = await apiClient.put("/users/profile", data);
      return response.data;
    }
  } catch (error) {
    console.error("Update profile error:", error);
    throw error;
  }
};
// Gửi OTP đổi mật khẩu
export const sendPasswordOTP = async () =>
  (await apiClient.post("/users/password/send-otp")).data;

// Đổi mật khẩu bằng OTP
export const changePassword = async (data) =>
  (await apiClient.post("/users/password/change", data)).data;

// =============== MANAGER ROUTES ===============

// Xóa mềm nhân viên theo store hiện tại
export const softDeleteUser = async (data) =>
  (await apiClient.post("/users/staff/soft-delete", data)).data;

// Khôi phục nhân viên theo store hiện tại
export const restoreUser = async (data) =>
  (await apiClient.post("/users/staff/restore", data)).data;

// =============== DEMO ROLE TEST ===============

// Dashboard dành riêng cho Manager
export const getManagerDashboard = async () =>
  (await apiClient.get("/users/manager-dashboard")).data;

// Dashboard dành riêng cho Staff
export const getStaffDashboard = async () =>
  (await apiClient.get("/users/staff-dashboard")).data;
