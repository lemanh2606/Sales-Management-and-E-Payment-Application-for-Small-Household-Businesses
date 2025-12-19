<!-- # 📋 FIX SUMMARY - Báo Cáo Cuối Ngày & Cập Nhật Tên Nhân Viên

## 🐛 Vấn Đề Gốc

### Vấn Đề 1: MANAGER bán hàng → Không hiển thị trong báo cáo cuối ngày
- **Nguyên nhân**: `generateEndOfDayReport` chỉ lấy Order có `employeeId != null`, loại trừ Manager (employeeId = null)
- **Kết quả**: Khi Manager bán hàng, không có trong bảng "Doanh thu theo nhân viên"

### Vấn Đề 2: STAFF bán hàng → Mất tên nhân viên trong báo cáo
- **Nguyên nhân**: Có 2 lỗi xảy ra:
  1. **Frontend (OrderPOSHome.tsx dòng 343)**: Gửi `employeeId: loggedInUser.id` (User ID, không phải Employee ID)
  2. **Khôn kế hợp**: Khi lấy dữ liệu từ MongoDB, không match được vì ID không đúng
- **Kết quả**: Order có employeeId sai → Không tìm thấy Employee record → Không hiển thị tên

### Vấn Đề 3: Cập nhật tên STAFF → Chỉ cập nhật Users, không sync sang Employees
- **Nguyên nhân**: 
  - `updateProfile` ở `userController.js` dòng 980 dùng `employee.fullname` (sai field name)
  - Model Employee dùng `fullName` (camelCase), User dùng `fullname` (camelCase)
- **Kết quả**: Tên ở Employee không được cập nhật → Báo cáo hiển thị tên cũ

---

## ✅ CÁC FIX ĐÃ THỰC HIỆN

### 📝 1. Backend: `financialController.js` - Xử lý Manager bán hàng

**File**: `backend/controllers/financialController.js`

#### Fix 1a: Dòng ~390 - `byEmployee` aggregation
```javascript
// ❌ CŨ: Chỉ lấy employeeId != null
const byEmployee = await Order.aggregate([
  {
    $match: {
      storeId: new mongoose.Types.ObjectId(storeId),
      employeeId: { $ne: null }, // ❌ Loại Manager
      createdAt: { $gte: start, $lte: end },
      status: { $in: ["paid", "partially_refunded"] },
    },
  },
  // ...
  {
    $project: {
      _id: "$_id",
      name: { $arrayElemAt: ["$employee.fullName", 0] }, // ❌ Null nếu không có employee
      revenue: 1,
      orders: 1,
      avgOrderValue: { $divide: ["$revenue", "$orders"] },
    },
  },
]);
```

```javascript
// ✅ MỚI: Lấy cả Manager + STAFF, gán tên "Quản lý cửa hàng" cho Manager
const byEmployee = await Order.aggregate([
  {
    $match: {
      storeId: new mongoose.Types.ObjectId(storeId),
      // ✅ Bỏ điều kiện employeeId != null
      createdAt: { $gte: start, $lte: end },
      status: { $in: ["paid", "partially_refunded"] },
    },
  },
  {
    $group: {
      _id: "$employeeId", // null nếu Manager bán, hoặc Employee._id nếu STAFF bán
      revenue: { $sum: "$totalAmount" },
      orders: { $sum: 1 },
    },
  },
  {
    $lookup: {
      from: "employees",
      localField: "_id",
      foreignField: "_id",
      as: "employee",
    },
  },
  {
    // ✅ FIX: Nếu không có employee (employeeId = null) → gán "Quản lý cửa hàng"
    $project: {
      _id: "$_id",
      name: {
        $cond: [
          { $eq: [{ $size: "$employee" }, 0] },
          "Quản lý cửa hàng", // ✅ Manager bán hàng
          { $arrayElemAt: ["$employee.fullName", 0] }, // ✅ STAFF bán hàng
        ],
      },
      revenue: 1,
      orders: 1,
      avgOrderValue: { $divide: ["$revenue", "$orders"] },
    },
  },
]);
```

#### Fix 1b: Dòng ~530 - `refundsByEmployee` aggregation
```javascript
// ✅ MỚI: Thêm lookup orders để filter theo storeId, xử lý Manager + STAFF
const refundsByEmployee = await OrderRefund.aggregate([
  { $match: { refundedAt: { $gte: start, $lte: end } } },
  {
    $lookup: {
      from: "employees",
      localField: "refundedBy",
      foreignField: "_id",
      as: "employee",
    },
  },
  {
    $lookup: {
      from: "orders",
      localField: "orderId",
      foreignField: "_id",
      as: "order",
    },
  },
  {
    $match: {
      "order.storeId": new mongoose.Types.ObjectId(storeId),
    },
  },
  {
    $project: {
      _id: 0,
      refundedBy: "$refundedBy",
      name: {
        $cond: [
          { $eq: [{ $size: "$employee" }, 0] },
          "Quản lý cửa hàng", // Manager hoàn hàng
          { $arrayElemAt: ["$employee.fullName", 0] }, // STAFF hoàn hàng
        ],
      },
      refundAmount: 1,
      refundedAt: 1,
    },
  },
]);
```

---

### 📝 2. Backend: `userController.js` - Fix fullName sync cho STAFF

**File**: `backend/controllers/user/userController.js`

**Dòng ~980 - updateProfile() function**

```javascript
// ❌ CŨ: Dùng fullname (sai field name ở Employee model)
if (fullname && changedFields.includes("fullname")) {
  employee.fullname = fullname.trim(); // ❌ Employee dùng fullName!
  employeeChanged = true;
}

// ✅ MỚI: Dùng fullName (đúng field name)
if (fullname && changedFields.includes("fullname")) {
  employee.fullName = fullname.trim(); // ✅ FIX: fullName (camelCase đúng)
  employeeChanged = true;
}
```

**Chi tiết**:
- Employee model: `fullName` (field)
- User model: `fullname` (field)
- Trước đây sync sai tên field → dữ liệu không cập nhật
- Giờ đã sửa → STAFF đổi tên ở Profile → cập nhật cả Users + Employees

---

### 📝 3. Frontend: `OrderPOSHome.tsx` - Fix employeeId cho STAFF

**File**: `frontend/src/pages/order/OrderPOSHome.tsx`

**Dòng ~315 - loadEmployees() function**

```javascript
// ❌ CŨ: Tạo object từ user info, gán employeeId = user.id
if (loggedInUser.role === "STAFF") {
  const staffEmployee: Seller = {
    _id: loggedInUser.id, // ❌ User ID!
    fullName: loggedInUser.fullname || loggedInUser.username || "Nhân viên",
    user_id: { _id: loggedInUser.id, ... },
  };

  setCurrentUserEmployee(staffEmployee);
  setEmployees([staffEmployee as Employee]);

  // ❌ Gửi User ID thay vì Employee ID
  setOrders((prev) =>
    prev.map((tab) => ({
      ...tab,
      employeeId: loggedInUser.id, // ❌ SAI: Đây là User ID!
    }))
  );

  return;
}
```

```javascript
// ✅ MỚI: Gọi API để lấy Employee ID chính xác
if (loggedInUser.role === "STAFF") {
  try {
    // ✅ Gọi API để lấy Employee record của STAFF này
    const res = await axios.get(`${API_BASE}/stores/${storeId}/employees?deleted=false`, { headers });
    const employeesList: Employee[] = res.data.employees || [];
    
    // ✅ Tìm employee có user_id trùng với user đang login
    const currentStaffEmployee = employeesList.find((e) => e.user_id?._id === loggedInUser.id);
    
    if (currentStaffEmployee) {
      // ✅ Tìm thấy → lưu Employee record với ID chính xác
      setCurrentUserEmployee(currentStaffEmployee);
      setEmployees([currentStaffEmployee]);

      // ✅ Gửi Employee._id (không phải User.id)
      setOrders((prev) =>
        prev.map((tab) => ({
          ...tab,
          employeeId: currentStaffEmployee._id, // ✅ FIX: Employee._id đúng!
        }))
      );
    } else {
      // Fallback nếu không tìm thấy employee record
      // ...
    }
  } catch (apiErr) {
    // Fallback nếu lỗi API
    // ...
  }

  return;
}
```

**Chi tiết**:
- Trước: FE tạo object STAFF từ user info, dùng `loggedInUser.id` (User ID)
- Sau: FE gọi API để lấy Employee record của STAFF, dùng `employee._id` (Employee ID)
- Kết quả: Order sẽ có `employeeId = Employee._id` → match được dữ liệu → báo cáo hiển thị tên đúng

---

## 🎯 KẾT QUẢ SAU FIX

### ✅ MANAGER bán hàng
- Order được tạo với `employeeId = null`
- Báo cáo cuối ngày sẽ hiển thị "Quản lý cửa hàng" với doanh thu + số đơn

### ✅ STAFF bán hàng
- Order được tạo với `employeeId = Employee._id` (đúng ID)
- Báo cáo cuối ngày hiển thị tên STAFF (fullName từ Employees collection)
- Khi STAFF cập nhật tên → cập nhật cả Users + Employees → báo cáo hiển thị tên mới ngay

### ✅ Hoàn hàng
- Manager hoàn hàng: hiển thị "Quản lý cửa hàng"
- STAFF hoàn hàng: hiển thị tên STAFF (fullName)

---

## 📊 QUY TRÌNH KIỂM TRA

### Test Case 1: MANAGER bán hàng
1. Đăng nhập bằng tài khoản MANAGER
2. Vào POS → Bán hàng → In hóa đơn (trạng thái paid)
3. Vào Báo cáo cuối ngày
4. Kiểm tra bảng "Doanh thu theo nhân viên" → Phải hiển thị "Quản lý cửa hàng" + doanh thu

### Test Case 2: STAFF bán hàng
1. Đăng nhập bằng tài khoản STAFF (ví dụ: Nguyen Duc Huy Staff)
2. Vào POS → Bán hàng → In hóa đơn (trạng thái paid)
3. Vào Báo cáo cuối ngày
4. Kiểm tra bảng "Doanh thu theo nhân viên" → Phải hiển thị "Nguyen Duc Huy Staff" + doanh thu + số đơn

### Test Case 3: STAFF cập nhật tên
1. STAFF vào Profile → Đổi tên (vd: "Nguyen Duc Huy Staff" → "NguYen Huy")
2. Lưu thay đổi
3. Vào MongoDB → Check:
   - Users collection → fullname = "NguYen Huy" ✅
   - Employees collection → fullName = "NguYen Huy" ✅
4. Vào Báo cáo cuối ngày → Tên đã cập nhật ✅

### Test Case 4: STAFF hoàn hàng
1. STAFF vào POS → Tạo đơn, in hoá đơn (paid)
2. Quay lại, chọn đơn → Hoàn hàng
3. Vào Báo cáo cuối ngày → Bảng "Hoàn hàng" → Phải hiển thị tên STAFF ✅

---

## 📚 Files Thay Đổi

| File | Dòng | Chi tiết |
|------|------|----------|
| `backend/controllers/financialController.js` | ~390-410 | Sửa byEmployee aggregation |
| `backend/controllers/financialController.js` | ~530-570 | Sửa refundsByEmployee aggregation |
| `backend/controllers/user/userController.js` | ~980 | Sửa fullName sync (fullname → fullName) |
| `frontend/src/pages/order/OrderPOSHome.tsx` | ~315-395 | Sửa loadEmployees() để lấy Employee ID chính xác |

---

## 🎉 TÓNG TẮT

**Vấn đề chính**: Hệ thống lấy nhầm User ID thay vì Employee ID, và không xử lý case Manager bán hàng

**Fix**:
1. ✅ Backend: Xử lý `employeeId = null` (Manager) trong aggregation → hiển thị "Quản lý cửa hàng"
2. ✅ Backend: Fix `fullName` field khi sync STAFF profile
3. ✅ Frontend: Gọi API để lấy `Employee._id` chính xác cho STAFF thay vì dùng `User.id`

**Kết quả**: Cả Manager và STAFF đều hiển thị đúng trong báo cáo cuối ngày ✨ -->
