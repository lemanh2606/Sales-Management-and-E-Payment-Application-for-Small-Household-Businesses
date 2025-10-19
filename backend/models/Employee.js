// models/Employee.js (update từ file cũ - add fullName cho populate dễ)
const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, maxlength: 150, trim: true }, // 👈 Thêm: Họ tên đầy đủ nhân viên (dễ populate ở Order, ko cần chain User)
    phone: { type: String, default: '', maxlength: 15, trim: true },
    salary: { type: mongoose.Schema.Types.Decimal128, required: true }, // Lương cơ bản
    shift: { type: String, maxlength: 50 }, // Ca làm việc (sáng/chiều/tối)
    commission_rate: { type: mongoose.Schema.Types.Decimal128 }, // Tỷ lệ hoa hồng (%)
    hired_date: { type: Date, default: Date.now }, // Ngày tuyển dụng
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Nối với User (auth/login)
    store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true }, // Liên kết store (nhân viên chỉ 1 store)
  },
  {
    timestamps: true, // Tự động createdAt/updatedAt
    collection: "employees",
  }
);

// Index cho query nhanh theo store + user
employeeSchema.index({ store_id: 1, user_id: 1 }, { unique: true }); // Unique per store-user

module.exports = mongoose.model("Employee", employeeSchema);
