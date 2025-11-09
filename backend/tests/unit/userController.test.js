// tests/unit/userController.test.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Mock các dependencies để test độc lập
jest.mock("../../models/User");
jest.mock("../../models/Employee");
jest.mock("../../models/Subscription");
jest.mock("../../utils/logActivity");
jest.mock("../../services/emailService");
jest.mock("../../services/imageService");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

// Import các model và services đã mock
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Subscription = require("../../models/Subscription");
const logActivity = require("../../utils/logActivity");
const { sendVerificationEmail } = require("../../services/emailService");

// Import các controller functions cần test
const {
  registerManager,
  verifyOtp,
  login,
  sendForgotPasswordOTP,
  forgotChangePassword,
  updateUser,
  updateProfile,
  changePassword,
  softDeleteUser,
  restoreUser,
} = require("../../controllers/user/userController");

/**
 * Test Suite cho User Controller
 * Kiểm tra tất cả các chức năng chính của userController
 */
describe("User Controller - Unit Tests", () => {
  let mockReq, mockRes;

  /**
   * Khởi tạo mock request và response trước mỗi test
   */
  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      user: {},
      file: null,
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };

    // Clear all mocks trước mỗi test
    jest.clearAllMocks();
  });

  /**
   * Test Group: Đăng ký Manager
   */
  describe("registerManager", () => {
    it("should register manager successfully with valid data", async () => {
      // Arrange - Chuẩn bị dữ liệu test
      mockReq.body = {
        username: "testmanager",
        email: "test@example.com",
        password: "password123",
        fullname: "Test Manager",
      };

      // Mock các function được gọi trong controller
      User.findOne.mockResolvedValue(null); // Không có user trùng
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashed_password");
      User.prototype.save = jest.fn().mockResolvedValue({
        _id: "user123",
        username: "testmanager",
        email: "test@example.com",
        role: "MANAGER",
      });
      Subscription.createTrial.mockResolvedValue({});
      sendVerificationEmail.mockResolvedValue(true);

      // Act - Gọi function cần test
      await registerManager(mockReq, mockRes);

      // Assert - Kiểm tra kết quả
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: "testmanager" }, { email: "test@example.com" }],
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", "salt");
      expect(User.prototype.save).toHaveBeenCalled();
      expect(Subscription.createTrial).toHaveBeenCalledWith("user123");
      expect(sendVerificationEmail).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Đăng ký thành công, kiểm tra email để xác minh OTP",
      });
    });

    it("should return 400 when missing required fields", async () => {
      // Arrange - Thiếu trường bắt buộc
      mockReq.body = {
        username: "testuser",
        email: "test@example.com",
        // Thiếu password và fullname
      };

      // Act
      await registerManager(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Thiếu username, email hoặc password",
      });
    });

    it("should return 400 when password is too short", async () => {
      // Arrange - Password quá ngắn
      mockReq.body = {
        username: "testuser",
        email: "test@example.com",
        password: "123", // Password chỉ 3 ký tự
        fullname: "Test User",
      };

      // Act
      await registerManager(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Password phải ít nhất 6 ký tự",
      });
    });

    it("should return 400 when username or email already exists", async () => {
      // Arrange - User đã tồn tại
      mockReq.body = {
        username: "existinguser",
        email: "existing@example.com",
        password: "password123",
        fullname: "Existing User",
      };

      User.findOne.mockResolvedValue({
        username: "existinguser",
        email: "existing@example.com",
      });

      // Act
      await registerManager(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Username hoặc email đã tồn tại",
      });
    });

    it("should handle server error during registration", async () => {
      // Arrange - Lỗi server
      mockReq.body = {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        fullname: "Test User",
      };

      User.findOne.mockRejectedValue(new Error("Database error"));

      // Act
      await registerManager(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Lỗi server khi đăng ký",
      });
    });
  });

  /**
   * Test Group: Xác minh OTP
   */
  describe("verifyOtp", () => {
    it("should verify OTP successfully", async () => {
      // Arrange
      mockReq.body = {
        email: "test@example.com",
        otp: "123456",
      };

      const mockUser = {
        email: "test@example.com",
        otp_hash: "hashed_otp",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000), // 10 phút sau
        otp_attempts: 0,
        isVerified: false,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true); // OTP khớp

      // Act
      await verifyOtp(mockReq, mockRes);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed_otp");
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.isVerified).toBe(true);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Xác minh thành công",
      });
    });

    it("should return 400 when OTP is expired", async () => {
      // Arrange - OTP hết hạn
      mockReq.body = {
        email: "test@example.com",
        otp: "123456",
      };

      const mockUser = {
        email: "test@example.com",
        otp_hash: "hashed_otp",
        otp_expires: new Date(Date.now() - 10 * 60 * 1000), // 10 phút trước
        otp_attempts: 0,
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      await verifyOtp(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "OTP không hợp lệ hoặc đã hết hạn",
      });
    });

    it("should return 400 when OTP attempts exceeded", async () => {
      // Arrange - Vượt quá số lần thử
      mockReq.body = {
        email: "test@example.com",
        otp: "123456",
      };

      const mockUser = {
        email: "test@example.com",
        otp_hash: "hashed_otp",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        otp_attempts: 5, // Vượt quá max attempts
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      await verifyOtp(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Quá số lần thử, vui lòng yêu cầu OTP mới",
      });
    });

    it("should return 400 when OTP is incorrect", async () => {
      // Arrange - OTP sai
      mockReq.body = {
        email: "test@example.com",
        otp: "wrong_otp",
      };

      const mockUser = {
        email: "test@example.com",
        otp_hash: "hashed_otp",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        otp_attempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // OTP không khớp

      // Act
      await verifyOtp(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "OTP không đúng, thử lại",
      });
      expect(mockUser.otp_attempts).toBe(1);
    });
  });

  /**
   * Test Group: Đăng nhập
   */
  describe("login", () => {
    it("should login successfully with correct credentials", async () => {
      // Arrange
      mockReq.body = {
        username: "testuser",
        password: "password123",
      };

      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        password_hash: "hashed_password",
        role: "MANAGER",
        isVerified: true,
        loginAttempts: 0,
        lockUntil: null,
        last_login: null,
        current_store: null,
        menu: [],
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true); // Password khớp
      jwt.sign.mockReturnValue("mock_jwt_token");

      // Act
      await login(mockReq, mockRes);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { username: "testuser" },
          { email: "testuser" }, // identifier được trim()
        ],
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashed_password"
      );
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.loginAttempts).toBe(0);
      expect(mockUser.lockUntil).toBeNull();
      expect(jwt.sign).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Đăng nhập thành công",
        token: "mock_jwt_token",
        user: expect.objectContaining({
          id: "user123",
          username: "testuser",
          role: "MANAGER",
        }),
        store: null,
      });
    });

    it("should return 401 when user not found", async () => {
      // Arrange - User không tồn tại
      mockReq.body = {
        username: "nonexistent",
        password: "password123",
      };

      User.findOne.mockResolvedValue(null);

      // Act
      await login(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Username hoặc password không đúng",
      });
    });

    it("should return 401 when account is not verified", async () => {
      // Arrange - Tài khoản chưa xác minh
      mockReq.body = {
        username: "testuser",
        password: "password123",
      };

      const mockUser = {
        username: "testuser",
        isVerified: false,
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      await login(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Tài khoản chưa được xác minh",
      });
    });

    it("should return 423 when account is locked", async () => {
      // Arrange - Tài khoản bị khóa
      mockReq.body = {
        username: "testuser",
        password: "password123",
      };

      const mockUser = {
        username: "testuser",
        isVerified: true,
        lockUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 phút sau
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      await login(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(423);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Tài khoản bị khóa tạm thời",
      });
    });

    it("should return 401 when password is incorrect", async () => {
      // Arrange - Password sai
      mockReq.body = {
        username: "testuser",
        password: "wrongpassword",
      };

      const mockUser = {
        username: "testuser",
        password_hash: "hashed_password",
        isVerified: true,
        loginAttempts: 0,
        lockUntil: null,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Password không khớp

      // Act
      await login(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Username hoặc password không đúng",
      });
      expect(mockUser.loginAttempts).toBe(1);
    });
  });

  /**
   * Test Group: Quên mật khẩu
   */
  describe("sendForgotPasswordOTP", () => {
    it("should send OTP successfully for existing email", async () => {
      // Arrange
      mockReq.body = {
        email: "test@example.com",
      };

      const mockUser = {
        email: "test@example.com",
        username: "testuser",
        otp_hash: null,
        otp_expires: null,
        otp_attempts: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashed_otp");
      sendVerificationEmail.mockResolvedValue(true);

      // Act
      await sendForgotPasswordOTP(mockReq, mockRes);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(sendVerificationEmail).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "OTP đã gửi tới email, hết hạn sau 5 phút",
      });
    });

    it("should return 404 when email not found", async () => {
      // Arrange - Email không tồn tại
      mockReq.body = {
        email: "nonexistent@example.com",
      };

      User.findOne.mockResolvedValue(null);

      // Act
      await sendForgotPasswordOTP(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Email không tồn tại trong hệ thống",
      });
    });
  });

  /**
   * Test Group: Đổi mật khẩu khi quên
   */
  describe("forgotChangePassword", () => {
    it("should change password successfully with valid OTP", async () => {
      // Arrange
      mockReq.body = {
        email: "test@example.com",
        otp: "123456",
        password: "newpassword123",
        confirmPassword: "newpassword123",
      };

      const mockUser = {
        email: "test@example.com",
        username: "testuser",
        otp_hash: "hashed_otp",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        otp_attempts: 0,
        password_hash: "old_hashed_password",
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true); // OTP khớp
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("new_hashed_password");

      // Act
      await forgotChangePassword(mockReq, mockRes);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed_otp");
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", "salt");
      expect(mockUser.password_hash).toBe("new_hashed_password");
      expect(mockUser.otp_hash).toBeNull();
      expect(mockUser.otp_expires).toBeNull();
      expect(mockUser.otp_attempts).toBe(0);
      expect(logActivity).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Đổi mật khẩu thành công",
      });
    });

    it("should return 400 when passwords do not match", async () => {
      // Arrange - Password và confirm không khớp
      mockReq.body = {
        email: "test@example.com",
        otp: "123456",
        password: "newpassword123",
        confirmPassword: "differentpassword",
      };

      // Act
      await forgotChangePassword(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mật khẩu và xác nhận không khớp",
      });
    });

    it("should return 400 when password is too short", async () => {
      // Arrange - Password quá ngắn
      mockReq.body = {
        email: "test@example.com",
        otp: "123456",
        password: "123", // Chỉ 3 ký tự
        confirmPassword: "123",
      };

      // Act
      await forgotChangePassword(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mật khẩu phải ít nhất 6 ký tự",
      });
    });
  });

  /**
   * Test Group: Cập nhật user
   */
  describe("updateUser", () => {
    beforeEach(() => {
      mockReq.user = {
        _id: "requester123",
        username: "admin",
        role: "MANAGER",
        menu: ["users:manage", "users:role:update"],
        current_store: "store123",
      };
      mockReq.params.id = "targetuser123";
    });

    it("should update user successfully with valid permissions", async () => {
      // Arrange
      mockReq.body = {
        username: "updateduser",
        email: "updated@example.com",
        role: "STAFF",
      };

      const mockTargetUser = {
        _id: "targetuser123",
        username: "olduser",
        email: "old@example.com",
        role: "STAFF",
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: "targetuser123",
          username: "updateduser",
          email: "updated@example.com",
          role: "STAFF",
        }),
      };

      User.findById.mockResolvedValue(mockTargetUser);
      User.findOne.mockResolvedValue(null); // No duplicate username/email

      // Act
      await updateUser(mockReq, mockRes);

      // Assert
      expect(User.findById).toHaveBeenCalledWith("targetuser123");
      expect(mockTargetUser.save).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Cập nhật thành công",
        user: expect.any(Object),
      });
    });

    it("should return 403 when no permission to update", async () => {
      // Arrange - Không có quyền
      mockReq.user.menu = []; // Không có quyền nào
      mockReq.body = {
        role: "MANAGER",
      };

      const mockTargetUser = {
        _id: "targetuser123",
        username: "testuser",
        role: "STAFF",
      };

      User.findById.mockResolvedValue(mockTargetUser);

      // Act
      await updateUser(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Không có quyền thay đổi role người dùng",
      });
    });
  });

  /**
   * Test Group: Đổi mật khẩu (cần OTP)
   */
  describe("changePassword", () => {
    beforeEach(() => {
      mockReq.user = {
        id: "user123",
        username: "testuser",
      };
    });

    it("should change password successfully with valid OTP", async () => {
      // Arrange
      mockReq.body = {
        password: "newpassword123",
        confirmPassword: "newpassword123",
        otp: "123456",
      };

      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        otp_hash: "hashed_otp",
        otp_expires: new Date(Date.now() + 10 * 60 * 1000),
        otp_attempts: 0,
        password_hash: "old_hashed_password",
        current_store: "store123",
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true); // OTP khớp
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("new_hashed_password");

      // Act
      await changePassword(mockReq, mockRes);

      // Assert
      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(bcrypt.compare).toHaveBeenCalledWith("123456", "hashed_otp");
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", "salt");
      expect(mockUser.password_hash).toBe("new_hashed_password");
      expect(logActivity).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Đổi mật khẩu thành công",
      });
    });

    it("should return 400 when passwords do not match", async () => {
      // Arrange
      mockReq.body = {
        password: "newpassword123",
        confirmPassword: "differentpassword",
        otp: "123456",
      };

      // Act
      await changePassword(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Mật khẩu mới và xác nhận không khớp",
      });
    });
  });

  /**
   * Test Group: Xóa mềm user
   */
  describe("softDeleteUser", () => {
    beforeEach(() => {
      mockReq.user = {
        id: "manager123",
        username: "manager",
      };
      mockReq.body = {
        targetUserId: "staff123",
      };
    });

    it("should soft delete staff successfully", async () => {
      // Arrange
      const mockManager = {
        _id: "manager123",
        username: "manager",
        role: "MANAGER",
        current_store: "store123",
      };

      const mockStaff = {
        _id: "staff123",
        username: "staffuser",
        role: "STAFF",
        current_store: "store123",
        isDeleted: false,
        deletedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockImplementation((id) => {
        if (id === "manager123") return Promise.resolve(mockManager);
        if (id === "staff123") return Promise.resolve(mockStaff);
        return Promise.resolve(null);
      });

      Employee.findOne.mockResolvedValue({
        user_id: "staff123",
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      });

      // Act
      await softDeleteUser(mockReq, mockRes);

      // Assert
      expect(mockStaff.isDeleted).toBe(true);
      expect(mockStaff.deletedAt).toBeInstanceOf(Date);
      expect(Employee.findOne).toHaveBeenCalledWith({ user_id: "staff123" });
      expect(logActivity).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Xóa mềm nhân viên thành công",
      });
    });

    it("should return 403 when non-manager tries to delete", async () => {
      // Arrange - Người dùng không phải manager
      const mockNonManager = {
        _id: "user123",
        username: "regularuser",
        role: "STAFF", // Không phải manager
      };

      User.findById.mockResolvedValue(mockNonManager);

      // Act
      await softDeleteUser(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Chỉ manager mới được xóa nhân viên",
      });
    });
  });

  /**
   * Test Group: Khôi phục user
   */
  describe("restoreUser", () => {
    beforeEach(() => {
      mockReq.user = {
        id: "manager123",
        username: "manager",
      };
      mockReq.body = {
        targetUserId: "staff123",
      };
    });

    it("should restore staff successfully", async () => {
      // Arrange
      const mockManager = {
        _id: "manager123",
        username: "manager",
        role: "MANAGER",
        current_store: "store123",
      };

      const mockStaff = {
        _id: "staff123",
        username: "staffuser",
        role: "STAFF",
        current_store: "store123",
        isDeleted: true,
        deletedAt: new Date(),
        restoredAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockImplementation((id) => {
        if (id === "manager123") return Promise.resolve(mockManager);
        if (id === "staff123") return Promise.resolve(mockStaff);
        return Promise.resolve(null);
      });

      Employee.findOne.mockResolvedValue({
        user_id: "staff123",
        isDeleted: true,
        save: jest.fn().mockResolvedValue(true),
      });

      // Act
      await restoreUser(mockReq, mockRes);

      // Assert
      expect(mockStaff.isDeleted).toBe(false);
      expect(mockStaff.restoredAt).toBeInstanceOf(Date);
      expect(Employee.findOne).toHaveBeenCalledWith({ user_id: "staff123" });
      expect(logActivity).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Khôi phục nhân viên thành công",
      });
    });

    it("should return 400 when staff is not deleted", async () => {
      // Arrange - Nhân viên chưa bị xóa
      const mockManager = {
        _id: "manager123",
        username: "manager",
        role: "MANAGER",
        current_store: "store123",
      };

      const mockStaff = {
        _id: "staff123",
        username: "staffuser",
        role: "STAFF",
        current_store: "store123",
        isDeleted: false, // Chưa bị xóa
      };

      User.findById.mockImplementation((id) => {
        if (id === "manager123") return Promise.resolve(mockManager);
        if (id === "staff123") return Promise.resolve(mockStaff);
        return Promise.resolve(null);
      });

      // Act
      await restoreUser(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Nhân viên chưa bị xóa mềm",
      });
    });
  });

  /**
   * Test Group: Cập nhật profile
   */
  describe("updateProfile", () => {
    beforeEach(() => {
      mockReq.user = {
        id: "user123",
        username: "testuser",
      };
    });

    it("should update profile successfully without image", async () => {
      // Arrange
      mockReq.body = {
        username: "updateduser",
        email: "updated@example.com",
        phone: "123456789",
        fullname: "Updated User",
      };

      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        phone: "",
        fullname: "Test User",
        current_store: "store123",
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);
      User.findOne.mockResolvedValue(null); // No duplicate

      // Act
      await updateProfile(mockReq, mockRes);

      // Assert
      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.username).toBe("updateduser");
      expect(mockUser.email).toBe("updated@example.com");
    });

    it("should handle image upload successfully", async () => {
      // Arrange - Có file ảnh
      mockReq.body = {
        username: "testuser",
        email: "test@example.com",
      };
      mockReq.file = {
        path: "uploads/images/test.jpg",
        mimetype: "image/jpeg",
      };
      mockReq.protocol = "http";
      mockReq.get = jest.fn().mockReturnValue("localhost:3000");

      const mockUser = {
        _id: "user123",
        username: "testuser",
        email: "test@example.com",
        image: null,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        image: "http://localhost:3000/uploads/images/test.jpg",
      });

      // Act
      await updateProfile(mockReq, mockRes);

      // Assert
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Profile updated successfully",
        user: expect.any(Object),
      });
    });
  });
});
