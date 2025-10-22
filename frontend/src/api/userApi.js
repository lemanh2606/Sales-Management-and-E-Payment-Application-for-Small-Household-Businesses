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

// =============== PROTECTED ROUTES ===============

// Lấy thông tin cá nhân (profile)
export const getProfile = async () =>
  (await apiClient.get("/users/profile")).data;

// Cập nhật thông tin cá nhân
export const updateProfile = async (data) =>
  (await apiClient.put("/users/profile", data)).data;

// Gửi OTP đổi mật khẩu
export const sendPasswordOTP = async () =>
  (await apiClient.post("/users/password/send-otp")).data;

// Đổi mật khẩu bằng OTP
export const changePassword = async (data) =>
  (await apiClient.post("/users/password/change", data)).data;

// =============== MANAGER ROUTES ===============

// Xóa mềm nhân viên theo store hiện tại
export const softDeleteUser = async (data) =>
  (await apiClient.post("/users/delete-staff", data)).data;

// Khôi phục nhân viên theo store hiện tại
export const restoreUser = async (data) =>
  (await apiClient.post("/users/restore-staff", data)).data;

// =============== DEMO ROLE TEST ===============

// Dashboard dành riêng cho Manager
export const getManagerDashboard = async () =>
  (await apiClient.get("/users/manager-dashboard")).data;

// Dashboard dành riêng cho Staff
export const getStaffDashboard = async () =>
  (await apiClient.get("/users/staff-dashboard")).data;
