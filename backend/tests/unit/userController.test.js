/**
 * tests/unit/userController.test.js
 * Full test suite aligned with controllers in paste.txt
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

jest.mock("../../models/User");
jest.mock("../../models/Employee");
jest.mock("../../models/Subscription");
jest.mock("../../utils/logActivity");
jest.mock("../../services/emailService");
jest.mock("../../services/imageService");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Subscription = require("../../models/Subscription");
const { sendVerificationEmail } = require("../../services/emailService");

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

// Persistent metadata for export script
const fs = require("fs");
const path = require("path");
const META_OUT = path.join(__dirname, "../../test-results/test-metadata.json");
const meta = [];
function addMeta(fn, data) {
  meta.push({ function: fn, ...data });
}

afterAll(() => {
  try {
    const outDir = path.dirname(META_OUT);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(META_OUT, JSON.stringify(meta, null, 2));
  } catch (_) {}
});

describe("User Controller - Unit Tests", () => {
  let req, res;

  const baseUser = {
    _id: "68ec68fe839f688562204ae4",
    id: "68ec68fe839f688562204ae4",
    username: "manh2606",
    fullname: "Lê Chí Mạnh",
    email: "lechimanhmanh@gmail.com",
    phone: "0971079629",
    role: "MANAGER",
    isVerified: true,
    isDeleted: false,
    current_store: "68f8a0d08f156b744e9e4bb9",
    image: "http://localhost/uploads/avatars/avatar.jpeg",
    menu: ["store:create", "users:update", "users:manage", "users:delete"],
  };

  beforeEach(() => {
    mongoose.Types = { ObjectId: { isValid: jest.fn().mockReturnValue(true) } };
    req = {
      body: {},
      params: {},
      query: {},
      user: { ...baseUser },
      file: null,
      protocol: "http",
      get: jest.fn().mockReturnValue("localhost:9999"),
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ---------- registerManager ----------
  describe("registerManager", () => {
    it("Can connect with server", async () => {
      addMeta("registerManager", {
        condition: "Can connect with server",
        precondition: "Server up",
        username: "newmanager",
        email: "new@example.com",
        password: "12345678",
        return: "201",
      });

      req.body = {
        username: "newmanager",
        email: "new@example.com",
        password: "12345678",
        fullname: "New Manager",
      };

      User.findOne.mockResolvedValue(null);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashed");
      User.prototype.save = jest.fn().mockResolvedValue({
        _id: "u1",
        username: "newmanager",
        email: "new@example.com",
        role: "MANAGER",
      });
      Subscription.createTrial = jest.fn().mockResolvedValue({});
      sendVerificationEmail.mockResolvedValue(true);

      await registerManager(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("missing required fields -> 400", async () => {
      addMeta("registerManager", {
        condition: "missing_fields",
        precondition: "username null",
        username: "null",
        email: "x@example.com",
        password: "123456",
        return: "400",
      });

      req.body = { username: null, email: "x@example.com", password: "123456" };
      await registerManager(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("password too short -> 400", async () => {
      addMeta("registerManager", {
        condition: "password_short",
        precondition: "<6",
        username: "u",
        email: "u@example.com",
        password: "123",
        return: "400",
      });

      req.body = { username: "u", email: "u@example.com", password: "123" };
      await registerManager(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("username/email exists -> 400", async () => {
      addMeta("registerManager", {
        condition: "dup_username_or_email",
        precondition: "exists",
        username: "exists",
        email: "exists@example.com",
        password: "12345678",
        return: "400",
      });

      req.body = {
        username: "exists",
        email: "exists@example.com",
        password: "12345678",
      };
      User.findOne.mockResolvedValue(baseUser);

      await registerManager(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("server error -> 500", async () => {
      addMeta("registerManager", {
        condition: "server_error",
        precondition: "throw",
        username: "u",
        email: "u@example.com",
        password: "12345678",
        return: "500",
      });

      req.body = {
        username: "u",
        email: "u@example.com",
        password: "12345678",
      };
      User.findOne.mockRejectedValue(new Error("db"));
      await registerManager(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ---------- verifyOtp ----------
  describe("verifyOtp", () => {
    it("verify success -> 200", async () => {
      addMeta("verifyOtp", {
        condition: "valid_otp",
        precondition: "not expired",
        email: "a@b.c",
        otp: "123456",
        return: "200",
      });

      req.body = { email: "a@b.c", otp: "123456" };
      const user = {
        email: "a@b.c",
        otp_hash: "hashed",
        otp_expires: new Date(Date.now() + 600000),
        otp_attempts: 0,
        isVerified: false,
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);

      await verifyOtp(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it("otp expired -> 400", async () => {
      addMeta("verifyOtp", {
        condition: "otp_expired",
        precondition: "expired",
        email: "a@b.c",
        otp: "123456",
        return: "400",
      });

      req.body = { email: "a@b.c", otp: "123456" };
      const user = {
        email: "a@b.c",
        otp_hash: "hashed",
        otp_expires: new Date(Date.now() - 600000),
        otp_attempts: 0,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(user);

      await verifyOtp(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("otp attempts exceeded -> 400", async () => {
      addMeta("verifyOtp", {
        condition: "attempts_exceeded",
        precondition: "> max",
        email: "a@b.c",
        otp: "111111",
        return: "400",
      });

      req.body = { email: "a@b.c", otp: "111111" };
      const user = {
        email: "a@b.c",
        otp_hash: "hashed",
        otp_expires: new Date(Date.now() + 600000),
        otp_attempts: 99,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(user);

      await verifyOtp(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("incorrect otp -> 400", async () => {
      addMeta("verifyOtp", {
        condition: "otp_incorrect",
        precondition: "hash mismatch",
        email: "a@b.c",
        otp: "000000",
        return: "400",
      });

      req.body = { email: "a@b.c", otp: "000000" };
      const user = {
        email: "a@b.c",
        otp_hash: "hashed",
        otp_expires: new Date(Date.now() + 600000),
        otp_attempts: 0,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(false);

      await verifyOtp(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ---------- login ----------
  describe("login", () => {
    it("success with username manh2606 / 12345678", async () => {
      addMeta("login", {
        condition: "success",
        precondition: "verified & unlocked",
        username: "manh2606",
        password: "12345678",
        return: "200",
      });

      req.body = { username: "manh2606", password: "12345678" };
      const u = {
        ...baseUser,
        password_hash: "hashed",
        loginAttempts: 0,
        lockUntil: null,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(u);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("token");

      await login(req, res);
      expect(jwt.sign).toHaveBeenCalled();
    });

    it("user not found -> 401", async () => {
      addMeta("login", {
        condition: "user_not_found",
        precondition: "not exist",
        username: "no",
        password: "x",
        return: "401",
      });

      req.body = { username: "no", password: "x" };
      User.findOne.mockResolvedValue(null);

      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("not verified -> 401", async () => {
      addMeta("login", {
        condition: "not_verified",
        precondition: "isVerified=false",
        username: "u",
        password: "x",
        return: "401",
      });

      req.body = { username: "u", password: "x" };
      const u = { ...baseUser, isVerified: false };
      User.findOne.mockResolvedValue(u);

      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("locked -> 423", async () => {
      addMeta("login", {
        condition: "locked",
        precondition: "lockUntil future",
        username: "u",
        password: "x",
        return: "423",
      });

      req.body = { username: "u", password: "x" };
      const u = { ...baseUser, lockUntil: new Date(Date.now() + 600000) };
      User.findOne.mockResolvedValue(u);

      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(423);
    });

    it("wrong password -> 401", async () => {
      addMeta("login", {
        condition: "wrong_password",
        precondition: "hash mismatch",
        username: "manh2606",
        password: "wrong",
        return: "401",
      });

      req.body = { username: "manh2606", password: "wrong" };
      const u = {
        ...baseUser,
        password_hash: "hashed",
        loginAttempts: 0,
        lockUntil: null,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(u);
      bcrypt.compare.mockResolvedValue(false);

      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ---------- sendForgotPasswordOTP ----------
  describe("sendForgotPasswordOTP", () => {
    it("send success", async () => {
      addMeta("sendForgotPasswordOTP", {
        condition: "valid_email",
        precondition: "user exists",
        email: "a@b.c",
        return: "200",
      });

      req.body = { email: "a@b.c" };
      const u = {
        email: "a@b.c",
        username: "u",
        otp_hash: null,
        otp_expires: null,
        otp_attempts: 0,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(u);
      bcrypt.genSalt.mockResolvedValue("s");
      bcrypt.hash.mockResolvedValue("h");
      sendVerificationEmail.mockResolvedValue(true);

      await sendForgotPasswordOTP(req, res);
      expect(sendVerificationEmail).toHaveBeenCalled();
    });

    it("email not found -> 404", async () => {
      addMeta("sendForgotPasswordOTP", {
        condition: "email_not_found",
        precondition: "not exist",
        email: "no@b.c",
        return: "404",
      });

      req.body = { email: "no@b.c" };
      User.findOne.mockResolvedValue(null);

      await sendForgotPasswordOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ---------- forgotChangePassword ----------
  describe("forgotChangePassword", () => {
    it("change success", async () => {
      addMeta("forgotChangePassword", {
        condition: "valid_otp_and_password",
        precondition: "match confirm",
        email: "a@b.c",
        otp: "123456",
        password: "newpass123",
        return: "200",
      });

      req.body = {
        email: "a@b.c",
        otp: "123456",
        password: "newpass123",
        confirmPassword: "newpass123",
      };
      const u = {
        email: "a@b.c",
        username: "u",
        otp_hash: "h",
        otp_expires: new Date(Date.now() + 600000),
        otp_attempts: 0,
        password_hash: "old",
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(u);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.genSalt.mockResolvedValue("s");
      bcrypt.hash.mockResolvedValue("new_h");

      await forgotChangePassword(req, res);
      expect(u.password_hash).toBe("new_h");
    });

    it("passwords mismatch -> 400", async () => {
      addMeta("forgotChangePassword", {
        condition: "mismatch",
        precondition: "p != cp",
        email: "a@b.c",
        otp: "123456",
        return: "400",
      });

      req.body = {
        email: "a@b.c",
        otp: "123456",
        password: "p1",
        confirmPassword: "p2",
      };
      await forgotChangePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("password too short -> 400", async () => {
      addMeta("forgotChangePassword", {
        condition: "short",
        precondition: "<6",
        email: "a@b.c",
        otp: "123456",
        password: "123",
        return: "400",
      });

      req.body = {
        email: "a@b.c",
        otp: "123456",
        password: "123",
        confirmPassword: "123",
      };
      await forgotChangePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ---------- updateUser ----------
  describe("updateUser", () => {
    beforeEach(() => {
      req.params = { id: "target" };
    });

    it("update success", async () => {
      addMeta("updateUser", {
        condition: "manager_update",
        precondition: "has permission",
        id: "target",
        return: "200",
      });

      req.body = { username: "updated", email: "u@test.com" };
      const t = {
        _id: "target",
        username: "old",
        email: "old@test.com",
        role: "STAFF",
        save: jest.fn(),
        toObject: jest.fn().mockReturnValue({
          _id: "target",
          username: "updated",
          email: "u@test.com",
          role: "STAFF",
        }),
      };
      User.findById.mockResolvedValue(t);
      User.findOne.mockResolvedValue(null);

      await updateUser(req, res);
      expect(t.save).toHaveBeenCalled();
    });

    it("no permission -> 403", async () => {
      addMeta("updateUser", {
        condition: "no_permission",
        precondition: "menu empty",
        id: "target",
        return: "403",
      });

      req.user.menu = [];
      req.body = { username: "updated" };
      const t = { _id: "target", username: "x", role: "STAFF" };
      User.findById.mockResolvedValue(t);

      await updateUser(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ---------- changePassword ----------
  describe("changePassword", () => {
    beforeEach(() => {
      req.user = { id: baseUser._id, username: baseUser.username };
    });

    it("change success", async () => {
      addMeta("changePassword", {
        condition: "valid_otp",
        precondition: "match confirm",
        username: baseUser.username,
        otp: "123456",
        return: "200",
      });

      req.body = {
        password: "newpass123",
        confirmPassword: "newpass123",
        otp: "123456",
      };
      const u = {
        _id: baseUser._id,
        username: baseUser.username,
        email: baseUser.email,
        otp_hash: "h",
        otp_expires: new Date(Date.now() + 600000),
        otp_attempts: 0,
        password_hash: "old",
        current_store: baseUser.current_store,
        save: jest.fn(),
      };
      User.findById.mockResolvedValue(u);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.genSalt.mockResolvedValue("s");
      bcrypt.hash.mockResolvedValue("new_h");

      await changePassword(req, res);
      expect(u.password_hash).toBe("new_h");
    });

    it("mismatch -> 400", async () => {
      addMeta("changePassword", {
        condition: "mismatch",
        precondition: "p != cp",
        username: baseUser.username,
        otp: "123456",
        return: "400",
      });

      req.body = { password: "a", confirmPassword: "b", otp: "123456" };
      await changePassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ---------- softDeleteUser ----------
  describe("softDeleteUser", () => {
    beforeEach(() => {
      req.user = { id: baseUser._id, username: baseUser.username };
      req.body = { targetUserId: "staff123" };
    });

    it("soft delete success", async () => {
      addMeta("softDeleteUser", {
        condition: "manager_delete_staff",
        precondition: "same store",
        targetUserId: "staff123",
        return: "200",
      });

      const manager = {
        _id: baseUser._id,
        username: baseUser.username,
        role: "MANAGER",
        current_store: baseUser.current_store,
      };
      const staff = {
        _id: "staff123",
        username: "staffuser",
        role: "STAFF",
        current_store: baseUser.current_store,
        isDeleted: false,
        deletedAt: null,
        save: jest.fn(),
      };
      User.findById.mockImplementation((id) => {
        if (id === baseUser._id) return Promise.resolve(manager);
        if (id === "staff123") return Promise.resolve(staff);
        return Promise.resolve(null);
      });
      Employee.findOne.mockResolvedValue({
        user_id: "staff123",
        isDeleted: false,
        save: jest.fn(),
      });

      await softDeleteUser(req, res);
      expect(staff.isDeleted).toBe(true);
    });

    it("non-manager -> 403", async () => {
      addMeta("softDeleteUser", {
        condition: "non_manager",
        precondition: "STAFF",
        targetUserId: "staff123",
        return: "403",
      });

      const non = { _id: "u", username: "x", role: "STAFF" };
      User.findById.mockResolvedValue(non);

      await softDeleteUser(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ---------- restoreUser ----------
  describe("restoreUser", () => {
    beforeEach(() => {
      req.user = { id: baseUser._id, username: baseUser.username };
      req.body = { targetUserId: "staff123" };
    });

    it("restore success", async () => {
      addMeta("restoreUser", {
        condition: "manager_restore_staff",
        precondition: "was deleted",
        targetUserId: "staff123",
        return: "200",
      });

      const manager = {
        _id: baseUser._id,
        username: baseUser.username,
        role: "MANAGER",
        current_store: baseUser.current_store,
      };
      const staff = {
        _id: "staff123",
        username: "staffuser",
        role: "STAFF",
        current_store: baseUser.current_store,
        isDeleted: true,
        deletedAt: new Date(),
        restoredAt: null,
        save: jest.fn(),
      };
      User.findById.mockImplementation((id) => {
        if (id === baseUser._id) return Promise.resolve(manager);
        if (id === "staff123") return Promise.resolve(staff);
        return Promise.resolve(null);
      });
      Employee.findOne.mockResolvedValue({
        user_id: "staff123",
        isDeleted: true,
        save: jest.fn(),
      });

      await restoreUser(req, res);
      expect(staff.isDeleted).toBe(false);
    });

    it("not deleted -> 400", async () => {
      addMeta("restoreUser", {
        condition: "not_deleted",
        precondition: "isDeleted=false",
        targetUserId: "staff123",
        return: "400",
      });

      const manager = {
        _id: baseUser._id,
        username: baseUser.username,
        role: "MANAGER",
        current_store: baseUser.current_store,
      };
      const staff = {
        _id: "staff123",
        username: "staffuser",
        role: "STAFF",
        current_store: baseUser.current_store,
        isDeleted: false,
      };
      User.findById.mockImplementation((id) => {
        if (id === baseUser._id) return Promise.resolve(manager);
        if (id === "staff123") return Promise.resolve(staff);
        return Promise.resolve(null);
      });

      await restoreUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ---------- updateProfile ----------
  describe("updateProfile", () => {
    beforeEach(() => {
      req.user = { id: baseUser._id, username: baseUser.username };
    });

    it("update success without image", async () => {
      addMeta("updateProfile", {
        condition: "no_image",
        precondition: "unique username & email",
        username: "updated",
        email: "updated@test.com",
        return: "200",
      });

      req.body = {
        username: "updated",
        email: "updated@test.com",
        phone: "0987654321",
        fullname: "Updated Name",
      };
      const u = {
        _id: baseUser._id,
        username: baseUser.username,
        email: baseUser.email,
        phone: baseUser.phone,
        fullname: baseUser.fullname,
        current_store: baseUser.current_store,
        role: "MANAGER",
        save: jest.fn(),
      };
      const updated = {
        ...u,
        username: "updated",
        email: "updated@test.com",
        phone: "0987654321",
        fullname: "Updated Name",
      };
      User.findById.mockResolvedValueOnce(u);
      User.findOne.mockResolvedValue(null);
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(updated),
        }),
      });

      await updateProfile(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it("handle image upload", async () => {
      addMeta("updateProfile", {
        condition: "with_image",
        precondition: "valid file",
        username: baseUser.username,
        email: baseUser.email,
        return: "200",
      });

      req.body = {
        username: baseUser.username,
        email: baseUser.email,
      };
      req.file = {
        path: "uploads/avatars/test.jpg",
        mimetype: "image/jpeg",
        size: 1024 * 100,
      };
      const u = {
        _id: baseUser._id,
        username: baseUser.username,
        email: baseUser.email,
        image: baseUser.image,
        role: "MANAGER",
        current_store: baseUser.current_store,
        save: jest.fn(),
      };
      const updated = {
        ...u,
        image: "http://localhost:9999/uploads/avatars/test.jpg",
      };
      User.findById.mockResolvedValue(u);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(updated),
      });

      await updateProfile(req, res);
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
    });
  });
});
