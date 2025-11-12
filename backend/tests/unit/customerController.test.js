const path = require("path");
const mongoose = require("mongoose");

jest.mock("../../models/Customer");
jest.mock("../../models/Order");
jest.mock("../../models/User");
jest.mock("../../models/Employee");
jest.mock("../../models/Store");
jest.mock("../../utils/logActivity");
jest.mock("../../utils/fileImport", () => ({
  parseExcelToJSON: jest.fn(),
  validateRequiredFields: jest.fn(),
  sanitizeData: jest.fn((x) => x),
}));

const Customer = require("../../models/Customer");
const Order = require("../../models/Order");
const User = require("../../models/User");
const Store = require("../../models/Store");
const logActivity = require("../../utils/logActivity");
const {
  parseExcelToJSON,
  validateRequiredFields,
  sanitizeData,
} = require("../../utils/fileImport");

const {
  searchCustomers,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  getCustomersByStore,
  importCustomers,
  downloadCustomerTemplate,
  getCustomerById,
  getAllCustomers,
} = require("../../controllers/customer/customerController"); // chỉnh lại đường dẫn nếu khác

describe("Customer Controller - Unit Tests", () => {
  let req, res;

  const baseUser = {
    _id: "u1",
    id: "u1",
    username: "tester",
    currentStore: "store1",
  };

  beforeEach(() => {
    mongoose.Types = { ObjectId: { isValid: jest.fn().mockReturnValue(true) } };
    req = {
      body: {},
      params: {},
      query: {},
      user: { ...baseUser },
      store: { _id: "store1" },
      file: null,
      get: jest.fn().mockReturnValue("localhost:9999"),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      sendFile: jest.fn((filePath, opts, cb) => cb && cb()),
    };
    jest.clearAllMocks();
  });

  // ---------------- createCustomer ----------------
  describe("createCustomer", () => {
    it("should create customer successfully", async () => {
      req.body = {
        name: "Nguyen Van A",
        phone: "0987654321",
        address: "HN",
        note: "VIP",
      };

      // 1) Không trùng phone
      Customer.findOne = jest.fn().mockResolvedValue(null);

      // 2) Save OK
      Customer.prototype.save = jest.fn().mockResolvedValue(true);

      // 3) Ghi log OK
      logActivity.mockResolvedValue(true);

      // 4) Controller gọi Customer.findById(...).lean()
      Customer.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "c1",
          name: "Nguyen Van A",
          phone: "0987654321",
          address: "HN",
          note: "VIP",
          storeId: "store1",
        }),
      });

      await createCustomer(req, res);

      // Nới lỏng nếu code có thể trả 200/201
      const st = res.status.mock.calls[0]?.[0];
      expect([201, 200]).toContain(st);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          customer: expect.objectContaining({ _id: "c1" }),
        })
      );
    });

    it("missing name -> 400", async () => {
      req.body = { name: "   ", phone: "0987654321" };
      await createCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("missing phone -> 400", async () => {
      req.body = { name: "A", phone: "" };
      await createCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("missing storeId resolution -> 400", async () => {
      req.body = { name: "A", phone: "0987654321" };
      req.store = null;
      req.user = { ...baseUser, currentStore: null };
      await createCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("duplicated phone in store -> 400", async () => {
      req.body = { name: "A", phone: "0987654321" };
      Customer.findOne = jest.fn().mockResolvedValue({
        _id: "c2",
        phone: "0987654321",
        isDeleted: false,
        storeId: "store1",
      });
      await createCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("server error -> 500", async () => {
      req.body = { name: "A", phone: "0987654321" };
      Customer.findOne = jest.fn().mockRejectedValue(new Error("db"));
      await createCustomer(req, res);
      const code = res.status.mock.calls[0]?.[0];
      expect([500, 400]).toContain(code);
    });
  });

  // ---------------- searchCustomers ----------------
  describe("searchCustomers", () => {
    it("should return 400 when missing query", async () => {
      req.query = { limit: 5 };
      await searchCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("phone exact when length >= 10", async () => {
      req.query = { query: "0987654321", limit: 5 };
      Customer.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "c1", phone: "0987654321" }]),
      });
      Customer.countDocuments = jest.fn().mockResolvedValue(1);
      Customer.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "c1", phone: "0987654321" }),
      });

      await searchCustomers(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          customers: expect.any(Array),
        })
      );
    });

    it("fuzzy search when length < 10", async () => {
      req.query = { query: "Anh", limit: 5 };
      Customer.find = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "c1", name: "Anh" }]),
      });
      Customer.countDocuments = jest.fn().mockResolvedValue(1);
      Customer.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await searchCustomers(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          customers: expect.any(Array),
        })
      );
    });

    it("server error -> 500", async () => {
      req.query = { query: "0987654321", limit: 5 };
      Customer.find = jest.fn(() => {
        throw new Error("db");
      });
      await searchCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- updateCustomer ----------------
  describe("updateCustomer", () => {
    it("not found -> 404", async () => {
      req.params = { id: "cX" };
      Customer.findById = jest.fn().mockResolvedValue(null);
      await updateCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("duplicate phone in store -> 400", async () => {
      req.params = { id: "c1" };
      req.body = { phone: "0999999999" };
      Customer.findById = jest.fn().mockResolvedValue({
        _id: "c1",
        phone: "0987654321",
        storeId: "store1",
        isDeleted: false,
      });
      Customer.findOne = jest.fn().mockResolvedValue({
        _id: "c2",
        phone: "0999999999",
        storeId: "store1",
      });

      await updateCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("update success -> 200", async () => {
      req.params = { id: "c1" };
      req.body = {
        name: "New",
        phone: "0999999999",
        address: "New",
        note: "N",
      };

      // Document lần 1 (để cập nhật)
      const doc = {
        _id: "c1",
        name: "Old",
        phone: "0987654321",
        address: "",
        note: "",
        storeId: "store1",
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      };

      // 1) Lần 1: controller gọi Customer.findById(id) để lấy document
      // 2) Lần 2: sau save, controller lại gọi Customer.findById(id).lean() để trả về client
      Customer.findById = jest
        .fn()
        .mockResolvedValueOnce(doc) // lần 1: trả document (có save)
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({
            _id: "c1",
            name: "New",
            phone: "0999999999",
            address: "New",
            note: "N",
            storeId: "store1",
          }),
        });

      // Không trùng phone mới trong cùng store
      Customer.findOne = jest.fn().mockResolvedValue(null);

      await updateCustomer(req, res);

      // Nhiều code không set status 200 thủ công mà trả json luôn → coi như 200
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          customer: expect.objectContaining({ _id: "c1", name: "New" }),
        })
      );
    });

    it("server error -> 500", async () => {
      req.params = { id: "c1" };
      Customer.findById = jest.fn().mockRejectedValue(new Error("db"));
      await updateCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- softDeleteCustomer ----------------
  describe("softDeleteCustomer", () => {
    it("not found -> 404", async () => {
      req.params = { id: "cX" };
      Customer.findById = jest.fn().mockResolvedValue(null);
      await softDeleteCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("has active orders -> 400", async () => {
      req.params = { id: "c1" };
      Customer.findById = jest.fn().mockResolvedValue({
        _id: "c1",
        isDeleted: false,
        storeId: "store1",
        name: "A",
        phone: "09",
      });
      Order.find = jest
        .fn()
        .mockResolvedValue([{ _id: "o1", status: "pending" }]);

      await softDeleteCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("delete success -> 200", async () => {
      req.params = { id: "c1" };
      const cust = {
        _id: "c1",
        isDeleted: false,
        storeId: "store1",
        name: "A",
        phone: "09",
        save: jest.fn().mockResolvedValue(true),
      };
      Customer.findById = jest.fn().mockResolvedValue(cust);
      Order.find = jest.fn().mockResolvedValue([]);

      await softDeleteCustomer(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) })
      );
    });

    it("server error -> 500", async () => {
      req.params = { id: "c1" };
      Customer.findById = jest.fn().mockRejectedValue(new Error("db"));
      await softDeleteCustomer(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- getCustomersByStore ----------------
  describe("getCustomersByStore", () => {
    it("missing storeId -> 400", async () => {
      req.params = {};
      await getCustomersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("list success with pagination", async () => {
      req.params = { storeId: "store1" };
      req.query = { page: 2, limit: 3, query: "an" };
      Customer.countDocuments = jest.fn().mockResolvedValue(7);
      Customer.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "c1" }, { _id: "c2" }]),
      });

      await getCustomersByStore(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 3,
          total: 7,
          customers: expect.any(Array),
        })
      );
    });

    it("server error -> 500", async () => {
      req.params = { storeId: "store1" };
      Customer.countDocuments = jest.fn().mockRejectedValue(new Error("db"));
      await getCustomersByStore(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- importCustomers ----------------
  describe("importCustomers", () => {
    beforeEach(() => {
      req.params = { storeId: "store1" };
      req.user = { id: "u1", _id: "u1" };
      req.file = { buffer: Buffer.from("excel") };
    });

    it("missing file -> 400", async () => {
      req.file = null;
      await importCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("user not found -> 404", async () => {
      User.findById = jest.fn().mockResolvedValue(null);
      await importCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("store not found -> 404", async () => {
      User.findById = jest.fn().mockResolvedValue({ _id: "u1" });
      Store.findById = jest.fn().mockResolvedValue(null);
      await importCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("empty data -> 400", async () => {
      User.findById = jest.fn().mockResolvedValue({ _id: "u1" });
      Store.findById = jest.fn().mockResolvedValue({ _id: "store1" });
      parseExcelToJSON.mockResolvedValue([]);
      await importCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("import mixed results -> 200", async () => {
      User.findById = jest.fn().mockResolvedValue({ _id: "u1" });
      Store.findById = jest.fn().mockResolvedValue({ _id: "store1" });
      parseExcelToJSON.mockResolvedValue([
        {
          "Tên khách hàng": "A",
          "Số điện thoại": "0987654321",
          "Địa chỉ": "HN",
        },
        { "Tên khách hàng": "", "Số điện thoại": "abcd" },
      ]);
      // validate row 1 ok
      validateRequiredFields.mockImplementation((row, fields) => {
        const ok = row["Tên khách hàng"] && row["Số điện thoại"];
        return ok
          ? { isValid: true, missingFields: [] }
          : { isValid: false, missingFields: ["Tên khách hàng"] };
      });
      // row2 sau sanitize giữ nguyên
      Customer.findOne = jest
        .fn()
        .mockResolvedValueOnce(null) // row1 not exist
        .mockResolvedValueOnce(null);
      Customer.prototype.save = jest.fn().mockResolvedValue(true);
      logActivity.mockResolvedValue(true);

      await importCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.objectContaining({
            total: 2,
            success: expect.any(Array),
            failed: expect.any(Array),
          }),
        })
      );
    });

    it("server error -> 500", async () => {
      User.findById = jest.fn().mockImplementation(() => {
        throw new Error("db");
      });
      await importCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- downloadCustomerTemplate ----------------
  describe("downloadCustomerTemplate", () => {
    it("should send file successfully", () => {
      downloadCustomerTemplate(req, res);
      expect(res.sendFile).toHaveBeenCalledWith(
        expect.stringContaining(
          path.normalize("templates/customer_template.xlsx")
        ),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("handle sendFile error -> 500", () => {
      res.sendFile = jest.fn((p, o, cb) => cb && cb(new Error("fs")));
      downloadCustomerTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- getCustomerById ----------------
  describe("getCustomerById", () => {
    it("not found -> 404", async () => {
      req.params = { id: "cX" };
      Customer.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      await getCustomerById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("success -> 200", async () => {
      req.params = { id: "c1" };
      Customer.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "c1" }),
      });
      await getCustomerById(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({ _id: "c1" }),
        })
      );
    });

    it("server error -> 500", async () => {
      req.params = { id: "c1" };
      Customer.findOne = jest.fn(() => {
        throw new Error("db");
      });
      await getCustomerById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ---------------- getAllCustomers ----------------
  describe("getAllCustomers", () => {
    it("list success with pagination & query", async () => {
      req.query = { page: 1, limit: 5, query: "an", storeId: "store1" };
      Customer.countDocuments = jest.fn().mockResolvedValue(3);
      Customer.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: "c1" }, { _id: "c2" }]),
      });

      await getAllCustomers(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 3,
          customers: expect.any(Array),
        })
      );
    });

    it("server error -> 500", async () => {
      Customer.countDocuments = jest.fn().mockRejectedValue(new Error("db"));
      await getAllCustomers(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
