// src/api/userApi.ts
import apiClient from "./apiClient";
import type {
  RegisterManagerDto,
  GenericResponse,
  VerifyOtpDto,
  LoginDto,
  SendForgotPasswordOtpDto,
  ForgotChangePasswordDto,
  User,
  UpdateProfileDto,
  SendPasswordOtpDto,
  ChangePasswordDto,
  SoftDeleteUserDto,
  RestoreUserDto,
  UpdateUserDto,
  AuthResponse,
  ResendRegisterOtpDto,
} from "../type/user";

// ==================== PUBLIC ROUTES ====================

/**
 * Đăng ký tài khoản Manager mới
 */
export const registerManager = async (
  data: RegisterManagerDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>("/users/register", data);
  return response.data;
};

/**
 * Xác thực OTP đăng ký
 */
export const verifyOtp = async (data: VerifyOtpDto): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>("/users/verify-otp", data);
  return response.data;
};

/**
 * Gửi lại OTP đăng ký
 */
export const resendRegisterOtp = async (
  data: ResendRegisterOtpDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/resend-register-otp",
    data
  );
  return response.data;
};

/**
 * Đăng nhập hệ thống
 */
export const loginUser = async (data: LoginDto): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>("/users/login", data, {
    skipAuthRefresh: true,
  } as any);
  return response.data;
};

/**
 * Refresh access token bằng refresh token cookie
 */
export const refreshToken = async (): Promise<{ token: string; user?: User }> => {
  const response = await apiClient.get<{ token: string; user?: User }>(
    "/users/refresh-token"
  );
  return response.data;
};

/**
 * Forgot password - gửi OTP
 */
export const sendForgotPasswordOTP = async (
  data: SendForgotPasswordOtpDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/forgot-password/send-otp",
    data
  );
  return response.data;
};

/**
 * Forgot password - đổi mật khẩu
 */
export const forgotChangePassword = async (
  data: ForgotChangePasswordDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/forgot-password/change",
    data
  );
  return response.data;
};

// ==================== PROTECTED ROUTES ====================

/**
 * Lấy thông tin cá nhân (profile)
 */
export const getProfile = async (): Promise<{ user: User }> => {
  const response = await apiClient.get<{ user: User }>("/users/profile");
  return response.data;
};

/**
 * Cập nhật thông tin cá nhân
 * Supports:
 * - Text fields only (JSON)
 * - Base64 image upload (React Native - gửi qua JSON, backend upload lên ImgBB)
 * - Remove image (image: null)
 */
export type UpdateProfileData = {
  fullname?: string;
  email?: string;
  phone?: string;
  image?: string; // nếu backend cho phép lưu url
  avatarPublicId?: string;
};

export type RNImageFile = {
  uri: string;
  name: string;
  type: string; // ví dụ "image/jpeg"
};

export const updateProfile = async (
  data: UpdateProfileData,
  options: { removeImage?: boolean; imageFile?: RNImageFile } = {}
) => {
  // Case 1: remove image
  if (options.removeImage) {
    const res = await apiClient.put("/users/profile", {
      ...data,
      removeImage: true,
    });
    return res.data;
  }

  // Case 2: upload avatar file
  if (options.imageFile) {
    const formData = new FormData();

    Object.keys(data || {}).forEach((key) => {
      const k = key as keyof UpdateProfileData;
      const v = data[k];
      if (v !== undefined && v !== null && v !== "") {
        formData.append(k, String(v));
      }
    });

    // ⚠️ Field name phải đúng backend: web của bạn đang dùng "avatar"
    formData.append("avatar", options.imageFile as any);

    const res = await apiClient.put("/users/profile", formData, {
      timeout: 30000,
      // ✅ khuyến nghị: KHÔNG set Content-Type ở RN để axios tự gắn boundary [web:1509]
      // headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  }

  // Case 3: text only
  const res = await apiClient.put("/users/profile", data);
  return res.data;
};

/**
 * Gửi OTP đổi mật khẩu
 */
export const sendPasswordOTP = async (
  data?: SendPasswordOtpDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/password/send-otp",
    data || {}
  );
  return response.data;
};

/**
 * Đổi mật khẩu bằng OTP
 */
export const changePassword = async (
  data: ChangePasswordDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/password/change",
    data
  );
  return response.data;
};

// ==================== MANAGER ROUTES ====================

/**
 * Xóa mềm nhân viên theo store hiện tại
 */
export const softDeleteUser = async (
  data: SoftDeleteUserDto
): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/staff/soft-delete",
    data
  );
  return response.data;
};

/**
 * Khôi phục nhân viên theo store hiện tại
 */
export const restoreUser = async (data: RestoreUserDto): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>(
    "/users/staff/restore",
    data
  );
  return response.data;
};

// ==================== DASHBOARD ROUTES ====================

/**
 * Dashboard dành riêng cho Manager
 */
export const getManagerDashboard = async (): Promise<any> => {
  const response = await apiClient.get<any>("/users/manager-dashboard");
  return response.data;
};

/**
 * Dashboard dành riêng cho Staff
 */
export const getStaffDashboard = async (): Promise<any> => {
  const response = await apiClient.get<any>("/users/staff-dashboard");
  return response.data;
};

// ==================== ADMIN ROUTES ====================

/**
 * Cập nhật thông tin user (Admin/Manager)
 */
export const updateUser = async (
  userId: string,
  data: UpdateUserDto
): Promise<{ message: string; user: User }> => {
  const response = await apiClient.put<{ message: string; user: User }>(
    `/users/${userId}`,
    data
  );
  return response.data;
};

// ==================== HELPERS ====================

/**
 * Đăng xuất (clear cookie/session)
 */
export const logout = async (): Promise<GenericResponse> => {
  const response = await apiClient.post<GenericResponse>("/users/logout");
  return response.data;
};

/**
 * Set auth token manually (if needed)
 */
export const setAuthToken = (token: string | null): void => {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
};

export const getPermissionCatalog = async () =>
  (await apiClient.get("/users/permissions/catalog")).data;

export const updateUserById = async (userId: string, data: any) =>
  (await apiClient.put(`/users/${userId}`, data)).data;

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
  getManagerDashboard,
  getStaffDashboard,
  updateUser,
  logout,
  setAuthToken,
};
