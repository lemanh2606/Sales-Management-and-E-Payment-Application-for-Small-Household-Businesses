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
export const updateProfile = async (
  data: UpdateProfileDto,
  options?: {
    imageBase64?: string; // Base64 string with data:image prefix
    removeImage?: boolean; // Set to true to remove image
  }
): Promise<{ message: string; user: User }> => {
  try {
    console.log("📝 Updating profile...", {
      hasData: !!data,
      hasImageBase64: !!options?.imageBase64,
      removeImage: !!options?.removeImage,
    });

    // ✅ Case 1: Upload base64 image (React Native)
    if (options?.imageBase64) {
      console.log("📤 Uploading base64 image to ImgBB via backend...");

      // Validate base64 format
      if (!options.imageBase64.startsWith("data:image")) {
        throw new Error("Invalid base64 image format. Must start with data:image");
      }

      // Calculate size
      const base64Size = (options.imageBase64.length * 0.75) / (1024 * 1024);
      console.log(`📊 Base64 image size: ${base64Size.toFixed(2)}MB`);

      if (base64Size > 5) {
        throw new Error("Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 5MB");
      }

      const response = await apiClient.put<{ message: string; user: User }>(
        "/users/profile",
        {
          ...data,
          image: options.imageBase64, // Backend sẽ upload lên ImgBB
        },
        {
          timeout: 30000,
        }
      );

      console.log("✅ Profile updated with base64 image:", response.data);
      return response.data;
    }

    // ✅ Case 2: Remove image
    if (options?.removeImage) {
      console.log("🗑️ Removing image...");

      const response = await apiClient.put<{ message: string; user: User }>(
        "/users/profile",
        {
          ...data,
          image: null, // Backend sẽ xóa ảnh trên ImgBB
        }
      );

      console.log("✅ Image removed:", response.data);
      return response.data;
    }

    // ✅ Case 3: Update text fields only
    console.log("📝 Updating text fields only...");

    const response = await apiClient.put<{ message: string; user: User }>(
      "/users/profile",
      data
    );

    console.log("✅ Profile updated:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ Update profile error:", error);
    console.error("Error response:", error.response?.data);
    throw error;
  }
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
