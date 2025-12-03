// src/pages/store/EmployeesPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Input,
  Tabs,
  Popconfirm,
  Space,
  Typography,
  Tag,
  Alert,
  Row,
  Col,
  Card,
  Checkbox,
  Divider,
  Empty,
  Skeleton,
} from "antd";
import Swal from "sweetalert2";
import axios from "axios";
import EmployeeForm from "../../components/store/EmployeeForm"; // Giữ nguyên form cũ của bạn
import Layout from "../../components/Layout";
import { getPermissionCatalog, updateUserById } from "../../api/userApi";

const { Search } = Input;
const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl}`;

const filterEmployees = (list = [], text = "") => {
  const normalized = text.toLowerCase();
  if (!normalized) return list;
  return list.filter(
    (emp) =>
      emp.fullName?.toLowerCase().includes(normalized) ||
      emp.user_id?.username?.toLowerCase().includes(normalized) ||
      emp.user_id?.email?.toLowerCase().includes(normalized)
  );
};

const humanizePermission = (permission = "") =>
  permission
    .split(":")
    .map((segment) =>
      segment
        .split("-")
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
        .join(" ")
    )
    .join(" › ");

const PERMISSION_GROUP_ORDER = [
  "store",
  "customers",
  "loyalty",
  "orders",
  "products",
  "product-groups",
  "purchase-orders",
  "purchase-returns",
  "inventory",
  "supplier",
  "tax",
  "reports",
  "users",
  "settings",
  "notifications",
  "subscription",
  "file",
];

const PERMISSION_CATEGORY_LABELS = {
  store: "Quản lý cửa hàng",
  customers: "Khách hàng",
  loyalty: "Chương trình thân thiết",
  orders: "Đơn hàng",
  reports: "Báo cáo",
  products: "Sản phẩm",
  "product-groups": "Nhóm sản phẩm",
  "purchase-orders": "Đơn nhập hàng",
  "purchase-returns": "Trả hàng nhập",
  inventory: "Kiểm kho & xử lý tồn",
  supplier: "Nhà cung cấp",
  tax: "Khai báo thuế",
  users: "Người dùng & quyền",
  settings: "Thiết lập",
  notifications: "Thông báo",
  subscription: "Gói dịch vụ",
  file: "Tệp & xuất liệu",
};

const PERMISSION_LABELS = {
  "store:create": "Tạo cửa hàng",
  "store:view": "Xem cửa hàng",
  "store:update": "Cập nhật cửa hàng",
  "store:delete": "Xóa cửa hàng",
  "store:dashboard:view": "Xem bảng điều khiển",
  "store:staff:assign": "Gán nhân viên vào cửa hàng",
  "store:employee:create": "Tạo nhân viên",
  "store:employee:view": "Xem danh sách nhân viên",
  "store:employee:update": "Chỉnh sửa nhân viên",
  "store:employee:delete": "Xóa nhân viên",
  "store:employee:softDelete": "Xóa mềm nhân viên",
  "store:employee:restore": "Khôi phục nhân viên",
  "customers:create": "Thêm khách hàng",
  "customers:search": "Tìm kiếm khách hàng",
  "customers:update": "Cập nhật khách hàng",
  "customers:delete": "Xóa khách hàng",
  "customers:top-customers": "Xem khách hàng thân thiết",
  "loyalty:view": "Xem cấu hình tích điểm",
  "loyalty:manage": "Quản lý chương trình tích điểm",
  "orders:create": "Tạo đơn hàng",
  "orders:pay": "Thanh toán đơn hàng",
  "orders:print": "In hóa đơn",
  "orders:view": "Xem đơn hàng",
  "orders:refund": "Hoàn tiền đơn hàng",
  "reports:top-products": "Báo cáo sản phẩm bán chạy",
  "reports:revenue:view": "Xem báo cáo doanh thu",
  "reports:revenue:employee": "Doanh thu theo nhân viên",
  "reports:revenue:export": "Xuất báo cáo doanh thu",
  "reports:financial:view": "Xem báo cáo tài chính",
  "reports:financial:export": "Xuất báo cáo tài chính",
  "reports:financial:list": "Danh sách báo cáo tài chính",
  "products:create": "Tạo sản phẩm",
  "products:view": "Xem sản phẩm",
  "products:update": "Cập nhật sản phẩm",
  "products:price": "Chỉnh sửa giá bán",
  "products:delete": "Xóa sản phẩm",
  "products:image:delete": "Xóa hình ảnh sản phẩm",
  "products:search": "Tìm kiếm sản phẩm",
  "products:low-stock": "Xem cảnh báo tồn kho thấp",
  "product-groups:create": "Tạo nhóm sản phẩm",
  "product-groups:view": "Xem nhóm sản phẩm",
  "product-groups:update": "Cập nhật nhóm sản phẩm",
  "product-groups:delete": "Xóa nhóm sản phẩm",
  "purchase-orders:create": "Tạo đơn nhập hàng",
  "purchase-orders:view": "Xem đơn nhập hàng",
  "purchase-orders:update": "Cập nhật đơn nhập hàng",
  "purchase-orders:delete": "Xóa đơn nhập hàng",
  "purchase-returns:create": "Tạo phiếu trả hàng",
  "purchase-returns:view": "Xem phiếu trả hàng",
  "purchase-returns:update": "Cập nhật phiếu trả hàng",
  "purchase-returns:delete": "Xóa phiếu trả hàng",
  "inventory:stock-check:create": "Tạo phiếu kiểm kho",
  "inventory:stock-check:view": "Xem phiếu kiểm kho",
  "inventory:stock-check:detail": "Xem chi tiết kiểm kho",
  "inventory:stock-check:update": "Cập nhật phiếu kiểm kho",
  "inventory:stock-check:delete": "Xóa phiếu kiểm kho",
  "inventory:disposal:create": "Tạo phiếu xử lý hàng hỏng",
  "inventory:disposal:view": "Xem phiếu xử lý hàng hỏng",
  "inventory:disposal:update": "Cập nhật phiếu xử lý",
  "inventory:disposal:delete": "Xóa phiếu xử lý",
  "supplier:create": "Thêm nhà cung cấp",
  "supplier:view": "Xem nhà cung cấp",
  "supplier:update": "Cập nhật nhà cung cấp",
  "supplier:delete": "Xóa nhà cung cấp",
  "tax:preview": "Xem trước tờ khai thuế",
  "tax:create": "Tạo tờ khai thuế",
  "tax:update": "Cập nhật tờ khai thuế",
  "tax:clone": "Nhân bản tờ khai thuế",
  "tax:delete": "Xóa tờ khai thuế",
  "tax:list": "Danh sách tờ khai thuế",
  "tax:export": "Xuất tờ khai thuế",
  "users:manage": "Quản trị người dùng",
  "users:role:update": "Đổi vai trò người dùng",
  "users:menu:update": "Cập nhật quyền menu",
  "users:update": "Cập nhật thông tin người dùng",
  "reports:export": "Xuất dữ liệu báo cáo",
  "reports:activity-log:view": "Xem nhật ký hoạt động",
  "reports:endofday:view": "Xem báo cáo cuối ngày",
  "settings:activity-log": "Thiết lập nhật ký hoạt động",
  "settings:payment-method": "Quản lý phương thức thanh toán",
  "notifications:view": "Xem thông báo",
  "subscription:view": "Xem gói dịch vụ",
  "subscription:manage": "Quản lý gói dịch vụ",
  "subscription:activate": "Kích hoạt gói",
  "subscription:cancel": "Hủy gói",
  "subscription:history": "Lịch sử thanh toán gói",
  "file:view": "Xem & tải tệp",
};

const STAFF_ALLOWED_PREFIXES = ["customers", "orders", "notifications"];
const STAFF_ALLOWED_EXACT = ["store:dashboard:view"];

const isAllowedForStaff = (permission = "") =>
  STAFF_ALLOWED_EXACT.includes(permission) ||
  STAFF_ALLOWED_PREFIXES.some((prefix) => permission.startsWith(`${prefix}:`));

const filterStaffPermissions = (list = []) =>
  Array.from(new Set(list.filter((permission) => isAllowedForStaff(permission))));

const groupPermissions = (permissionList = []) => {
  const groups = {};
  permissionList.forEach((permission) => {
    const [rawCategory] = permission.split(":");
    const categoryKey = rawCategory || "other";
    if (!groups[categoryKey]) {
      groups[categoryKey] = {
        key: categoryKey,
        label: PERMISSION_CATEGORY_LABELS[categoryKey] || humanizePermission(categoryKey),
        items: [],
      };
    }
    groups[categoryKey].items.push({
      key: permission,
      label: PERMISSION_LABELS[permission] || humanizePermission(permission),
    });
  });

  return Object.values(groups)
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.label.localeCompare(b.label, "vi", { sensitivity: "base" })),
    }))
    .sort((a, b) => {
      const orderA = PERMISSION_GROUP_ORDER.indexOf(a.key);
      const orderB = PERMISSION_GROUP_ORDER.indexOf(b.key);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });
};

export default function EmployeesPage() {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  const [activeEmployees, setActiveEmployees] = useState([]);
  const [deletedEmployees, setDeletedEmployees] = useState([]);
  const [filteredActive, setFilteredActive] = useState([]);
  const [filteredDeleted, setFilteredDeleted] = useState([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tabKey, setTabKey] = useState("active");
  const [searchText, setSearchText] = useState("");
  const [loadedTabs, setLoadedTabs] = useState({ active: false, deleted: false });
  const [permissionPanelLoading, setPermissionPanelLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [defaultStaffPermissions, setDefaultStaffPermissions] = useState([]);

  const token = localStorage.getItem("token"); // Token cho auth
  const headers = { Authorization: `Bearer ${token}` };
  const groupedPermissionOptions = useMemo(() => groupPermissions(permissionOptions), [permissionOptions]);
  const selectedPermissionSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);

  const loadEmployees = async (deleted = false, forceReload = false) => {
    // 👉 nếu không force reload thì giữ cơ chế cũ
    if (!forceReload && loadedTabs[deleted ? "deleted" : "active"]) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/stores/${currentStore._id}/employees?deleted=${deleted}`, { headers });
      const list = res.data.employees || [];
      if (deleted) {
        setDeletedEmployees(list);
        setFilteredDeleted(list);
      } else {
        setActiveEmployees(list);
        setFilteredActive(searchText ? filterEmployees(list, searchText) : list);
      }
      setLoadedTabs((prev) => ({ ...prev, [deleted ? "deleted" : "active"]: true }));
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: `Không thể tải danh sách nhân viên ${deleted ? "đã xóa" : "đang làm"}!`,
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const ensurePermissionCatalog = async () => {
    if (permissionOptions.length) {
      return { permissions: permissionOptions, staffDefault: defaultStaffPermissions };
    }
    try {
      const res = await getPermissionCatalog();
      const permissions = filterStaffPermissions(res.permissions || []);
      const staffDefault = filterStaffPermissions(res.staffDefault?.length ? res.staffDefault : permissions);
      setPermissionOptions(permissions);
      setDefaultStaffPermissions(staffDefault);
      return { permissions, staffDefault };
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không thể tải danh sách quyền. Vui lòng thử lại.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
      });
      throw err;
    }
  };

  useEffect(() => {
    if (currentStore._id) {
      loadEmployees(false); // Load active đầu tiên
    } else {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không tìm thấy storeId! Vui lòng chọn cửa hàng.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    }
  }, [currentStore._id]);

  const handleTabChange = (key) => {
    setTabKey(key);
    setSearchText(""); // Reset search khi đổi tab
    if (key === "deleted") {
      loadEmployees(true); // Load deleted khi click tab
    }
    if (key === "permissions") {
      loadEmployees(false, false);
      ensurePermissionCatalog().catch(() => {});
    }
  };

  const handleSearch = (value) => {
    const text = value.toLowerCase();
    setSearchText(text);
    if (tabKey === "deleted") {
      setFilteredDeleted(filterEmployees(deletedEmployees, text));
      return;
    }
    setFilteredActive(filterEmployees(activeEmployees, text));
  };

  const handleCreate = () => {
    setMode("create");
    setCurrent({});
    setOpen(true);
  };

  const handleEdit = (record) => {
    setMode("edit");
    setCurrent(record);
    setOpen(true);
  };

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      if (mode === "create") {
        await axios.post(`${API_BASE}/stores/${currentStore._id}/employees`, payload, { headers });
        Swal.fire({
          title: "🎉 Thành công!",
          text: `Tạo nhân viên thành công`,
          icon: "success",
          timer: 2000,
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
        await loadEmployees(false, true); // Reload active
      } else {
        await axios.put(`${API_BASE}/stores/${currentStore._id}/employees/${current._id}`, payload, { headers });
        Swal.fire({
          title: "🎉 Thành công!",
          text: `Cập nhật nhân viên thành công`,
          icon: "success",
          timer: 2000,
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
        await loadEmployees(tabKey === "active" ? false : true, true); // Reload tab hiện tại
      }
      await loadEmployees();
      setOpen(false);
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi khi lưu nhân viên.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
      console.error(err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleSoftDelete = async (id) => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/stores/${currentStore._id}/employees/${id}/soft`, { headers });
      Swal.fire({
        title: "🎉 Thành công!",
        text: `Xoá nhân viên thành công`,
        icon: "success",
        timer: 2000,
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
      await loadEmployees(false, true); // reload lại tab active
      if (loadedTabs.deleted) await loadEmployees(true, true); // reload deleted nếu đã mở
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi khi xoá.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/stores/${currentStore._id}/employees/${id}/restore`, {}, { headers });
      Swal.fire({
        title: "🎉 Thành công!",
        text: `Khôi phuch nhân viên thành công `,
        icon: "success",
        timer: 2000,
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
      await loadEmployees(true, true); // 👉 reload deleted
      if (loadedTabs.active) await loadEmployees(false, true); // reload active
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi khi khôi phục lại.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const syncUpdatedMenus = (userId, newMenu) => {
    const updater = (list) =>
      list.map((emp) =>
        String(emp.user_id?._id || emp.user_id) === String(userId)
          ? { ...emp, user_id: { ...emp.user_id, menu: newMenu } }
          : emp
      );
    setActiveEmployees((prev) => updater(prev));
    setFilteredActive((prev) => updater(prev));
  };

  const handleSelectStaff = async (record) => {
    if (!record?._id) return;
    if (selectedStaff && String(selectedStaff._id) === String(record._id) && permissionOptions.length) {
      const currentMenu = Array.isArray(record.user_id?.menu) ? record.user_id.menu : [];
      setSelectedPermissions(filterStaffPermissions(currentMenu));
      return;
    }
    setSelectedStaff(record);
    setPermissionPanelLoading(true);
    try {
      const catalog = await ensurePermissionCatalog();
      const catalogKeys = catalog?.permissions || [];
      const currentMenu = Array.isArray(record.user_id?.menu) ? record.user_id.menu : [];
      const mergedCatalog = filterStaffPermissions([...(catalogKeys || []), ...currentMenu]);
      setPermissionOptions(mergedCatalog);
      setSelectedPermissions(filterStaffPermissions(currentMenu));
    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không thể tải quyền của nhân viên này.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
      });
    } finally {
      setPermissionPanelLoading(false);
    }
  };

  const handleTogglePermission = (permissionKey, checked) => {
    setSelectedPermissions((prev) => {
      if (checked) {
        if (prev.includes(permissionKey)) return prev;
        return [...prev, permissionKey];
      }
      return prev.filter((perm) => perm !== permissionKey);
    });
  };

  const handleToggleGroup = (groupKey, checked) => {
    const group = groupedPermissionOptions.find((item) => item.key === groupKey);
    if (!group) return;
    const groupKeys = group.items.map((item) => item.key);
    setSelectedPermissions((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...groupKeys]));
      }
      return prev.filter((perm) => !groupKeys.includes(perm));
    });
  };

  const handlePermissionSave = async () => {
    if (!selectedStaff) return;
    if (!currentStore?._id) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Vui lòng chọn cửa hàng trước khi phân quyền nhân viên.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
      });
      return;
    }

    const userId = selectedStaff.user_id?._id || selectedStaff.user_id;
    const sanitizedMenu = filterStaffPermissions(selectedPermissions);
    setPermissionSaving(true);
    try {
      await updateUserById(userId, { menu: sanitizedMenu, storeId: currentStore._id });
      syncUpdatedMenus(userId, sanitizedMenu);
      setSelectedStaff((prev) => {
        if (!prev) return prev;
        if (String(prev._id) !== String(selectedStaff._id)) return prev;
        return { ...prev, user_id: { ...prev.user_id, menu: [...sanitizedMenu] } };
      });
      Swal.fire({
        title: "🎉 Thành công!",
        text: "Đã cập nhật quyền cho nhân viên.",
        icon: "success",
        timer: 2000,
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: err.response?.data?.message || "Không thể cập nhật quyền.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
      });
    } finally {
      setPermissionSaving(false);
    }
  };

  const handleResetPermissionSelection = () => {
    if (permissionSaving) return;
    setPermissionPanelLoading(false);
    setSelectedStaff(null);
    setSelectedPermissions([]);
  };

  const getColumns = (isDeleted = false) => [
    {
      title: "Tên",
      dataIndex: "fullName",
      key: "fullName",
      width: 230,
    },
    { title: "Username", key: "username", width: 210, render: (_, record) => record.user_id?.username || "—" },
    { title: "Email", key: "email", width: 250, render: (_, record) => record.user_id?.email || "—" },
    {
      title: "Số điện thoại",
      key: "phone",
      width: 140,
      render: (_, record) => {
        const phone = record.user_id?.phone || "";

        // Hàm format số kiểu 4-3-3
        const formatPhone = (num) => {
          const cleaned = num.replace(/\D/g, ""); // bỏ ký tự lạ
          if (cleaned.length === 10) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
          }
          return num; // fallback nếu không đủ 10 số
        };

        return (
          <Space>
            {phone ? (
              <Typography.Text code style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "0.5px" }}>
                {formatPhone(phone)}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: "15px" }}>
                —
              </Typography.Text>
            )}
          </Space>
        );
      },
    },
    { title: "Ca làm việc", dataIndex: "shift", key: "shift" },
    {
      title: "Lương",
      key: "salary",
      render: (_, record) => Number(record.salary ?? 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" }),
      sorter: (a, b) => (a.salary ?? 0) - (b.salary ?? 0),
    },
    {
      title: "Hoa hồng (%)",
      key: "commission_rate",
      render: (_, record) => Number(record.commission_rate ?? 0),
      sorter: (a, b) => (a.commission_rate ?? 0) - (b.commission_rate ?? 0),
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            type="default"
            size="small"
            onClick={() => handleEdit(record)}
            style={{
              borderColor: "#1890ff",
              color: "#1890ff",
              fontWeight: 500,
              borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6f4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Sửa
          </Button>

          {isDeleted ? (
            <Popconfirm
              title="Khôi phục nhân viên này?"
              onConfirm={() => handleRestore(record._id)}
              okText="Có"
              cancelText="Không"
            >
              <Button
                type="default"
                size="small"
                style={{
                  borderColor: "#52c41a",
                  color: "#52c41a",
                  fontWeight: 500,
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f6ffed")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Khôi phục
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Xóa mềm nhân viên này?"
              onConfirm={() => handleSoftDelete(record._id)}
              okText="Có"
              cancelText="Không"
            >
              <Button
                type="default"
                size="small"
                style={{
                  borderColor: "#ff4d4f",
                  color: "#ff4d4f",
                  fontWeight: 500,
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fff1f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Xóa
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const permissionColumns = [
    {
      title: "Tên nhân viên",
      dataIndex: "fullName",
      key: "permissionFullName",
      render: (_, record) => record.fullName || record.user_id?.username || record.user_id?.email || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "permissionEmail",
      render: (_, record) => record.user_id?.email || "—",
    },
  ];

  return (
    <Layout>
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-800">Quản lý nhân viên cửa hàng</h2>
            <span
              className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm
                 hover:bg-[#bae0ff] hover:scale-105 transition-all duration-200"
            >
              {currentStore?.name}
            </span>
          </div>

          <Button type="primary" size="large" onClick={handleCreate} className="bg-blue-500 hover:bg-blue-600">
            + Tạo nhân viên mới
          </Button>
        </div>

        <div className="mb-4">
          <Search
            placeholder="Tìm kiếm theo tên, username hoặc email..."
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            enterButton
            allowClear
            size="large"
            className="w-full max-w-md"
          />
        </div>

        <Tabs
          activeKey={tabKey}
          onChange={handleTabChange}
          animated
          items={[
            {
              key: "active",
              label: "Nhân viên đang làm",
              children: (
                <Table
                  columns={getColumns(false)}
                  dataSource={filteredActive}
                  rowKey="_id"
                  pagination={{
                    position: ["bottomRight"], // 👉 cho thanh phân trang nằm bên phải
                    showSizeChanger: true,
                    responsive: true,
                    showTotal: (total, range) => (
                      <div>
                        Đang xem{" "}
                        <span style={{ color: "#1890ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> nhân viên
                      </div>
                    ),
                  }}
                  loading={loading && tabKey === "active"}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: "Chưa có nhân viên đang làm việc" }}
                />
              ),
            },
            {
              key: "deleted",
              label: "Nhân viên đã xóa",
              children: (
                <Table
                  columns={getColumns(true)}
                  dataSource={filteredDeleted}
                  rowKey="_id"
                  pagination={{
                    position: ["bottomRight"], // 👉 cho thanh phân trang nằm bên phải
                    showSizeChanger: true,
                    responsive: true,
                    showTotal: (total, range) => (
                      <div>
                        Đang xem{" "}
                        <span style={{ color: "#1890ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> nhân viên
                      </div>
                    ),
                  }}
                  loading={loading && tabKey === "deleted"}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: "Chưa có nhân viên bị xóa" }}
                />
              ),
            },
            {
              key: "permissions",
              label: "Phân quyền",
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message="Chọn nhân viên ở danh sách bên trái, sau đó tick quyền ở bảng bên phải để cập nhật."
                    className="mb-4"
                  />
                  <Row gutter={16}>
                    <Col xs={24} lg={10}>
                      <Card
                        title="Danh sách nhân viên"
                        extra={<Typography.Text type="secondary">{filteredActive.length} nhân viên</Typography.Text>}
                        bodyStyle={{ padding: 0 }}
                      >
                        <Table
                          columns={permissionColumns}
                          dataSource={filteredActive}
                          rowKey="_id"
                          pagination={{
                            position: ["bottomRight"],
                            showSizeChanger: true,
                            responsive: true,
                            size: "small",
                          }}
                          loading={loading && tabKey === "permissions"}
                          scroll={{ x: "max-content" }}
                          locale={{ emptyText: "Chưa có nhân viên để phân quyền" }}
                          size="small"
                          onRow={(record) => ({
                            onClick: () => handleSelectStaff(record),
                            style: {
                              cursor: "pointer",
                              backgroundColor:
                                selectedStaff && String(selectedStaff._id) === String(record._id)
                                  ? "#f0f5ff"
                                  : "transparent",
                            },
                          })}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} lg={14}>
                      <Card
                        title={
                          selectedStaff
                            ? `Quyền của ${selectedStaff.fullName || selectedStaff.user_id?.username || "nhân viên"}`
                            : "Chọn nhân viên để phân quyền"
                        }
                        extra={
                          selectedStaff ? (
                            <Button type="link" danger size="small" onClick={handleResetPermissionSelection} disabled={permissionSaving}>
                              Bỏ chọn
                            </Button>
                          ) : null
                        }
                      >
                        {permissionPanelLoading ? (
                          <Skeleton active paragraph={{ rows: 8 }} />
                        ) : !selectedStaff ? (
                          <Empty description="Chọn một nhân viên ở bảng bên trái" />
                        ) : (
                          <>
                            <Space direction="vertical" style={{ width: "100%" }} size="middle">
                              <Typography.Text>
                                Đã chọn {selectedPermissions.length}/{permissionOptions.length} quyền.
                              </Typography.Text>
                              <Space wrap>
                                <Button
                                  onClick={() => setSelectedPermissions([...defaultStaffPermissions])}
                                  disabled={!defaultStaffPermissions.length || permissionSaving}
                                >
                                  Dùng quyền mặc định
                                </Button>
                                <Button
                                  onClick={() => setSelectedPermissions([...permissionOptions])}
                                  disabled={!permissionOptions.length || permissionSaving}
                                >
                                  Chọn tất cả
                                </Button>
                                <Button onClick={() => setSelectedPermissions([])} disabled={permissionSaving}>
                                  Bỏ hết
                                </Button>
                              </Space>
                            </Space>
                            <Divider />
                            {groupedPermissionOptions.length ? (
                              groupedPermissionOptions.map((group) => {
                                const checkedCount = group.items.filter((item) => selectedPermissionSet.has(item.key)).length;
                                const isChecked = checkedCount === group.items.length && group.items.length > 0;
                                const isIndeterminate = checkedCount > 0 && checkedCount < group.items.length;
                                return (
                                  <Card key={group.key} size="small" className="mb-3" bodyStyle={{ padding: 12 }}>
                                    <div className="flex justify-between items-center">
                                      <Checkbox
                                        checked={isChecked}
                                        indeterminate={isIndeterminate}
                                        onChange={(e) => handleToggleGroup(group.key, e.target.checked)}
                                        disabled={permissionSaving}
                                      >
                                        {group.label}
                                      </Checkbox>
                                      <Typography.Text type="secondary">
                                        {checkedCount}/{group.items.length}
                                      </Typography.Text>
                                    </div>
                                    <Divider style={{ margin: "12px 0" }} />
                                    <Row gutter={[12, 8]}>
                                      {group.items.map((item) => (
                                        <Col span={12} key={item.key}>
                                          <Checkbox
                                            checked={selectedPermissionSet.has(item.key)}
                                            onChange={(e) => handleTogglePermission(item.key, e.target.checked)}
                                            disabled={permissionSaving}
                                          >
                                            {item.label}
                                          </Checkbox>
                                        </Col>
                                      ))}
                                    </Row>
                                  </Card>
                                );
                              })
                            ) : (
                              <Empty description="Không có quyền khả dụng" />
                            )}
                            <div className="flex justify-end gap-3 mt-4">
                              <Button onClick={handleResetPermissionSelection} disabled={permissionSaving}>
                                Hủy
                              </Button>
                              <Button type="primary" onClick={handlePermissionSave} loading={permissionSaving}>
                                Lưu phân quyền
                              </Button>
                            </div>
                          </>
                        )}
                      </Card>
                    </Col>
                  </Row>
                </>
              ),
            },
          ]}
        />

        <Modal
          open={open}
          title={mode === "edit" ? "Cập nhật nhân viên" : "Tạo nhân viên mới"}
          onCancel={() => setOpen(false)}
          footer={null}
          destroyOnHidden
          width={600}
        >
          <EmployeeForm mode={mode} initialValues={current} onSubmit={handleSubmit} loading={loading} />
        </Modal>
      </div>
    </Layout>
  );
}
