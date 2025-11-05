


/*
  File: src/api/userApi.ts
  Purpose: Full typed API wrapper for user-related endpoints.
  Notes:
   - apiClient is expected to be an Axios instance configured for React Native (baseURL, interceptors).
   - If you store tokens in SecureStore or AsyncStorage, add helpers in apiClient interceptors.
*/

import { RegisterManagerDto, GenericResponse, VerifyOtpDto, LoginDto, SendForgotPasswordOtpDto, ForgotChangePasswordDto, User, UpdateProfileDto, SendPasswordOtpDto, ChangePasswordDto, SoftDeleteUserDto, RestoreUserDto, UpdateUserDto, AuthResponse } from "../type/user";
import apiClient from "./apiClient";

// -------------------- Public routes --------------------
export const registerManager = async (data: RegisterManagerDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/register', data)).data;

export const verifyOtp = async (data: VerifyOtpDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/verify-otp', data)).data;

export const loginUser = async (data: LoginDto): Promise<AuthResponse> =>
  (await apiClient.post<AuthResponse>('/users/login', data)).data;

// refresh token endpoint (reads cookie in BE; client may call to refresh access token)
export const refreshToken = async (): Promise<{ token: string }> =>
  (await apiClient.get<{ token: string }>('/users/refresh-token')).data;

export const sendForgotPasswordOTP = async (data: SendForgotPasswordOtpDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/forgot-password/send-otp', data)).data;

export const forgotChangePassword = async (data: ForgotChangePasswordDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/forgot-password/change', data)).data;

// -------------------- Protected routes --------------------
export const getProfile = async (): Promise<User> =>
  (await apiClient.get<User>('/users/profile')).data;

export const updateProfile = async (data: UpdateProfileDto): Promise<{ message: string; user: User }> =>
  (await apiClient.put<{ message: string; user: User }>('/users/profile', data)).data;

export const sendPasswordOTP = async (data?: SendPasswordOtpDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/password/send-otp', data || {})).data;

export const changePassword = async (data: ChangePasswordDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/password/change', data)).data;

// -------------------- Manager routes --------------------
export const softDeleteUser = async (data: SoftDeleteUserDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/staff/soft-delete', data)).data;

export const restoreUser = async (data: RestoreUserDto): Promise<GenericResponse> =>
  (await apiClient.post<GenericResponse>('/users/staff/restore', data)).data;

// -------------------- Admin / dashboard --------------------
export const getManagerDashboard = async (): Promise<any> =>
  (await apiClient.get<any>('/users/manager-dashboard')).data;

export const getStaffDashboard = async (): Promise<any> =>
  (await apiClient.get<any>('/users/staff-dashboard')).data;

// -------------------- Admin: update user --------------------
export const updateUser = async (userId: string, data: UpdateUserDto): Promise<{ message: string; user: User }> =>
  (await apiClient.put<{ message: string; user: User }>(`/users/${userId}`, data)).data;

// -------------------- Helpers (optional) --------------------
export const logout = async (): Promise<GenericResponse> =>
  // backend route may clear cookie/session
  (await apiClient.post<GenericResponse>('/users/logout')).data;

// -------------------- Example: attach token manually --------------------
// If using token stored in async storage / SecureStore, you can call this helper before requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// -------------------- Export default (convenience) --------------------
export default {
  registerManager,
  verifyOtp,
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

// -------------------- Notes --------------------
// - Adjust return types if your backend wraps data differently (e.g., { data: {...} }).
// - For file uploads (avatar), use FormData and set Content-Type to multipart/form-data.
// - For Expo/React Native, ensure apiClient uses axios with proper baseURL and if you need cookie support, use react-native-cookies or implement token-based refresh flow.
