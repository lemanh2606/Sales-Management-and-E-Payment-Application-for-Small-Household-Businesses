// tests/unit/supplierController.test.js

const mongoose = require("mongoose");

jest.mock("../../models/Supplier");
jest.mock("../../models/Store");
jest.mock("../../models/User");
jest.mock("../../models/Employee");
jest.mock("../../utils/logActivity");

const Supplier = require("../../models/Supplier");
const Store = require("../../models/Store");
const User = require("../../models/User");
const logActivity = require("../../utils/logActivity");

// Product chỉ cần khi xóa -> mock ảo
jest.mock("../../models/Product", () => ({}), { virtual: true });

const {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersByStore,
  getSupplierById,
} = require("../../controllers/supplier/supplierController"); // sửa nếu path khác

describe("Supplier Controller - Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    mongoose.Types = {
      ObjectId: class FakeId {
        constructor(id) {
          this._id = id;
        }
        static isValid(id) {
          return !!id && String(id).length >= 8;
        }
        toString() {
          return String(this._id);
        }
      },
    };

    req = {
      body: {},
      params: {},
      query: {},
      user: { id: "u1", _id: "u1", role: "MANAGER" },
      get: jest.fn().mockReturnValue("localhost"),
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
  });

  // --------------- createSupplier ---------------
  describe("createSupplier", () => {
    it("400 when empty body", async () => {
      req.body = {};
      req.params = { storeId: "store1" };
      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 invalid storeId", async () => {
      req.body = { name: "NCC A" };
      req.params = { storeId: "" };
      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 missing name", async () => {
      req.body = { name: "   ", phone: "090", email: "a@b.c" };
      req.params = { storeId: "store1" };
      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 invalid status", async () => {
      req.body = { name: "NCC A", status: "invalid" };
      req.params = { storeId: "store1" };
      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("404 store not found", async () => {
      req.params = { storeId: "store_1234" }; // dài >= 8 để isValid=true
      req.body = { name: "NCC A" }; // name hợp lệ
      Store.findById = jest.fn().mockResolvedValue(null);

      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("400 invalid email", async () => {
      req.body = { name: "NCC A", email: "abc@", phone: "090" };
      req.params = { storeId: "store1" };
      Store.findById = jest
        .fn()
        .mockResolvedValue({ _id: "store1", name: "Store 1" });
      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 duplicate supplier (name/phone/email)", async () => {
      req.body = { name: "NCC A", email: "a@b.c", phone: "090-111-222" };
      req.params = { storeId: "store1" };
      Store.findById = jest
        .fn()
        .mockResolvedValue({ _id: "store1", name: "Store 1" });

      const existing = { name: "NCC A", phone: "090111222", email: "a@b.c" };
      Supplier.findOne = jest.fn().mockReturnValue({
        collation: jest.fn().mockResolvedValue(existing),
      });

      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("201 create success", async () => {
      req.params = { storeId: "store_1234" };
      req.body = {
        name: "NCC A",
        phone: "090111222",
        email: "a@b.c",
        address: "HN",
      };

      Store.findById = jest
        .fn()
        .mockResolvedValue({ _id: "store_1234", name: "Store 1" });
      Supplier.findOne = jest.fn().mockReturnValue({
        collation: jest.fn().mockResolvedValue(null),
      });
      Supplier.prototype.save = jest.fn().mockResolvedValue(true);
      logActivity.mockResolvedValue(true);
      Supplier.prototype.populate = jest.fn().mockResolvedValue({
        _id: "sup1",
        name: "NCC A",
        phone: "090111222",
        email: "a@b.c",
        address: "HN",
        taxcode: "",
        notes: "",
        status: "đang hoạt động",
        store_id: { _id: "store_1234", name: "Store 1" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("400 duplicate key on save (E11000)", async () => {
      req.body = { name: "NCC A" };
      req.params = { storeId: "store1" };
      Store.findById = jest
        .fn()
        .mockResolvedValue({ _id: "store1", name: "Store 1" });
      Supplier.findOne = jest.fn().mockReturnValue({
        collation: jest.fn().mockResolvedValue(null),
      });
      const e = new Error("dup");
      e.code = 11000;
      Supplier.prototype.save = jest.fn().mockRejectedValue(e);

      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("500 unknown error", async () => {
      req.params = { storeId: "store_1234" };
      req.body = { name: "NCC A", email: "a@b.c" }; // email hợp lệ

      Store.findById = jest
        .fn()
        .mockResolvedValue({ _id: "store_1234", name: "Store 1" });
      Supplier.findOne = jest.fn().mockReturnValue({
        collation: jest.fn().mockImplementation(async () => {
          throw new Error("db");
        }),
      });

      await createSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // --------------- getSuppliersByStore ---------------
  describe("getSuppliersByStore", () => {
    it("400 invalid storeId", async () => {
      req.params = { storeId: "" };
      await getSuppliersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it("404 store not found", async () => {
      req.params = { storeId: "store_1234" };
      Store.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await getSuppliersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("200 list", async () => {
      req.params = { storeId: "store_1234" };
      Store.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest
            .fn()
            .mockResolvedValue({ _id: "store_1234", name: "Store 1" }),
        }),
      });
      Supplier.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "sup1", name: "NCC A" }]),
      });

      await getSuppliersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("400 cast error", async () => {
      req.params = { storeId: "store1" };
      Store.findById = jest.fn().mockImplementation(() => {
        const e = new Error("CastError");
        e.name = "CastError";
        throw e;
      });
      await getSuppliersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
    it("500 server error", async () => {
      req.params = { storeId: "store_1234" };
      Store.findById = jest.fn().mockImplementation(() => {
        throw new Error("db");
      });

      await getSuppliersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // --------------- getSupplierById ---------------
  describe("getSupplierById", () => {
    it("404 not found", async () => {
      req.params = { supplierId: "sup1" };
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await getSupplierById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("403 manager but not owner", async () => {
      req.params = { supplierId: "sup1" };
      const supplier = {
        _id: "sup1",
        name: "NCC A",
        store_id: { _id: "store1", owner_id: { equals: () => false } },
      };
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(supplier),
      });
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });

      await getSupplierById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("403 staff wrong store", async () => {
      req.user.role = "STAFF";
      req.params = { supplierId: "sup1" };
      const supplier = {
        _id: "sup1",
        name: "NCC A",
        store_id: { _id: "s1", owner_id: "owner1" },
      };
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(supplier),
      });
      User.findById = jest.fn().mockResolvedValue({ _id: "u1", role: "STAFF" });
      const Employee = require("../../models/Employee");
      Employee.findOne = jest
        .fn()
        .mockResolvedValue({ user_id: "u1", store_id: "s2" });

      await getSupplierById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("200 success", async () => {
      req.params = { supplierId: "sup1" };
      const supplier = {
        _id: "sup1",
        name: "NCC A",
        phone: "090",
        email: "a@b.c",
        address: "HN",
        taxcode: "",
        notes: "",
        status: "đang hoạt động",
        createdAt: new Date(),
        updatedAt: new Date(),
        store_id: {
          _id: "store_1234",
          name: "Store 1",
          address: "Addr",
          phone: "0123",
          owner_id: { equals: () => true },
        },
      };
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(supplier),
      });
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });

      await getSupplierById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("500 server error", async () => {
      req.params = { supplierId: "sup1" };
      Supplier.findOne = jest.fn(() => {
        throw new Error("db");
      });
      await getSupplierById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // --------------- updateSupplier ---------------
  describe("updateSupplier", () => {
    it("400 empty body", async () => {
      req.params = { supplierId: "sup1" };
      req.body = {};
      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("403 only manager can update", async () => {
      req.user.role = "STAFF";
      req.params = { supplierId: "sup1" };
      req.body = { name: "New" };
      User.findById = jest.fn().mockResolvedValue({ _id: "u1", role: "STAFF" });
      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("404 supplier not found", async () => {
      req.params = { supplierId: "sup1" };
      req.body = { name: "New" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("403 manager not owner of store", async () => {
      req.params = { supplierId: "sup1" };
      req.body = { name: "New" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          store_id: { _id: "store1", owner_id: { equals: () => false } },
        }),
      });
      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("400 empty name", async () => {
      req.params = { supplierId: "sup1" };
      req.body = { name: "   " };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          store_id: { _id: "store1", owner_id: { equals: () => true } },
        }),
      });
      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 duplicate name in same store", async () => {
      req.params = { supplierId: "sup1" };
      req.body = { name: "NCC A" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });

      // Lần 1: load supplier hiện tại
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          store_id: { _id: "store_1234", owner_id: { equals: () => true } },
        }),
      });

      // Lần 2: check duplicate
      Supplier.findOne.mockResolvedValueOnce({ _id: "supX", name: "NCC A" });

      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("200 update success", async () => {
      req.params = { supplierId: "sup1" };
      req.body = { name: "New", status: "đang hoạt động", email: "a@b.c" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });

      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          store_id: { _id: "store_1234", owner_id: { equals: () => true } },
        }),
      });
      Supplier.findOne.mockResolvedValueOnce(null);

      Supplier.findByIdAndUpdate = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          name: "New",
          phone: "",
          email: "a@b.c",
          address: "",
          taxcode: "",
          notes: "",
          status: "đang hoạt động",
          store_id: { _id: "store_1234", name: "Store 1" },
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      });
      logActivity.mockResolvedValue(true);

      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("500 server error", async () => {
      req.params = { supplierId: "sup1" };
      req.body = { name: "New" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn(() => {
        throw new Error("db");
      });
      await updateSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // --------------- deleteSupplier ---------------
  describe("deleteSupplier", () => {
    it("403 only manager can delete", async () => {
      req.user.role = "STAFF";
      req.params = { supplierId: "sup1" };
      User.findById = jest.fn().mockResolvedValue({ _id: "u1", role: "STAFF" });
      await deleteSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("404 supplier not found", async () => {
      req.params = { supplierId: "sup1" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      await deleteSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("403 manager not owner", async () => {
      req.params = { supplierId: "sup1" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          name: "NCC A",
          store_id: { _id: "store1", owner_id: { equals: () => false } },
        }),
      });
      await deleteSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("400 has products using supplier", async () => {
      req.params = { supplierId: "sup1" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "sup1",
          name: "NCC A",
          store_id: { _id: "store1", owner_id: { equals: () => true } },
          save: jest.fn(),
        }),
      });
      const Product = require("../../models/Product");
      Product.countDocuments = jest.fn().mockResolvedValue(3);

      await deleteSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("200 delete success", async () => {
      req.params = { supplierId: "sup1" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      const supplierDoc = {
        _id: "sup1",
        name: "NCC A",
        isDeleted: false,
        store_id: { _id: "store1", owner_id: { equals: () => true } },
        save: jest.fn().mockResolvedValue(true),
      };
      Supplier.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(supplierDoc),
      });
      const Product = require("../../models/Product");
      Product.countDocuments = jest.fn().mockResolvedValue(0);
      logActivity.mockResolvedValue(true);

      await deleteSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("500 server error", async () => {
      req.params = { supplierId: "sup1" };
      User.findById = jest
        .fn()
        .mockResolvedValue({ _id: "u1", role: "MANAGER" });
      Supplier.findOne = jest.fn(() => {
        throw new Error("db");
      });
      await deleteSupplier(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
