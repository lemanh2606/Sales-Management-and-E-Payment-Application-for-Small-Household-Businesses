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
  message,
  Alert,
  Row,
  Col,
  Card,
  Checkbox,
  Divider,
  Empty,
  Skeleton,
  Tooltip,
} from "antd";
import { FileExcelOutlined, CalendarOutlined } from "@ant-design/icons";
import Swal from "sweetalert2";
import axios from "axios";
import dayjs from "dayjs";
import EmployeeForm from "../../components/store/EmployeeForm";
import Layout from "../../components/Layout";
import { updateUserById } from "../../api/userApi";

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
  // "product-groups",
  // "purchase-orders",
  "purchase-returns",
  "inventory",
  // "suppliers",
  // "taxes",
  "reports",
  // "employees",
  "users",
  "settings",
  "notifications",
  // "subscription",
  "files",
];

const PERMISSION_CATEGORY_LABELS = {
  store: "Quản lý cửa hàng",
  customers: "Khách hàng",
  loyalty: "Chương trình thân thiết",
  orders: "Đơn hàng",
  reports: "Báo cáo",
  products: "Sản phẩm",
  // "product-groups": "Nhóm sản phẩm",
  // "purchase-orders": "Đơn nhập hàng",
  "purchase-returns": "Trả hàng",
  inventory: "Kiểm kho & xử lý tồn",
  // suppliers: "Nhà cung cấp",
  // taxes: "Khai báo thuế",
  // employees: "Nhân sự toàn hệ thống",
  users: "Người dùng & quyền",
  settings: "Thiết lập hệ thống",
  notifications: "Thông báo",
  // subscription: "Gói dịch vụ",
  files: "Tệp & xuất liệu",
};

// === CHỈNH Ở ĐÂY ĐỂ ẨN/HIỆN QUYỀN TRÊN UI ===
const PERMISSION_LABELS = {
  // ========== STORE PERMISSIONS ==========
  // "store:create": "Tạo cửa hàng",
  // "store:view": "Xem cửa hàng",
  // "store:update": "Cập nhật cửa hàng",
  // "store:delete": "Xóa cửa hàng",
  "store:dashboard:view": "Xem bảng điều khiển",
  // "store:staff:assign": "Gán nhân viên vào cửa hàng",
  // "store:employee:create": "Tạo nhân viên",
  // "store:employee:view": "Xem danh sách nhân viên",
  // "store:employee:update": "Chỉnh sửa nhân viên",
  // "store:employee:delete": "Xóa nhân viên",
  // "store:employee:softDelete": "Xóa mềm nhân viên",
  // "store:employee:restore": "Khôi phục nhân viên",
  // "store:employee:view_deleted": "Xem nhân viên đã xóa",

  // ========== CUSTOMER PERMISSIONS ==========
  "customers:create": "Thêm khách hàng",
  "customers:search": "Tìm kiếm khách hàng",
  "customers:update": "Cập nhật khách hàng",
  "customers:delete": "Xóa khách hàng",
  "customers:top-customers": "Xem khách hàng thân thiết",
  "customers:view": "Xem khách hàng",

  // ========== LOYALTY PERMISSIONS ==========
  "loyalty:view": "Xem cấu hình tích điểm",
  "loyalty:manage": "Quản lý chương trình tích điểm",

  // ========== ORDER PERMISSIONS ==========
  "orders:create": "Tạo đơn hàng",
  "orders:pay": "Thanh toán đơn hàng",
  "orders:print": "In hóa đơn",
  "orders:view": "Xem đơn hàng",
  "orders:refund": "Hoàn tiền đơn hàng",

  // ========== REPORT PERMISSIONS ==========
  "reports:top-products": "Báo cáo sản phẩm bán chạy",
  "reports:revenue:view": "Xem báo cáo doanh thu",
  "reports:revenue:employee": "Doanh thu theo nhân viên",
  "reports:revenue:export": "Xuất báo cáo doanh thu",
  "reports:financial:view": "Xem báo cáo tài chính",
  "reports:financial:export": "Xuất báo cáo tài chính",
  "reports:financial:list": "Danh sách báo cáo tài chính",
  "reports:export": "Xuất dữ liệu báo cáo",
  "reports:activity-log:view": "Xem nhật ký hoạt động",
  "reports:endofday:view": "Xem báo cáo cuối ngày",

  // ========== PRODUCT PERMISSIONS ==========
  // "products:create": "Tạo sản phẩm",
  // "products:view": "Xem sản phẩm",
  // "products:update": "Cập nhật sản phẩm",
  // "products:price": "Chỉnh sửa giá bán",
  // "products:delete": "Xóa sản phẩm",
  // "products:image:delete": "Xóa hình ảnh sản phẩm",
  "products:search": "Tìm kiếm sản phẩm",
  "products:view": "Xem danh sách sản phẩm",
  // "products:low-stock": "Xem cảnh báo tồn kho thấp",

  // ========== PRODUCT GROUP PERMISSIONS ==========
  // "product-groups:create": "Tạo nhóm sản phẩm",
  // "product-groups:view": "Xem nhóm sản phẩm",
  // "product-groups:update": "Cập nhật nhóm sản phẩm",
  // "product-groups:delete": "Xóa nhóm sản phẩm",

  // ========== PURCHASE ORDER PERMISSIONS ==========
  // "purchase-orders:create": "Tạo đơn nhập hàng",
  // "purchase-orders:view": "Xem đơn nhập hàng",
  // "purchase-orders:update": "Cập nhật đơn nhập hàng",
  // "purchase-orders:delete": "Xóa đơn nhập hàng",

  // ========== PURCHASE RETURN PERMISSIONS ==========
  "purchase-returns:create": "Tạo phiếu trả hàng",
  "purchase-returns:view": "Xem phiếu trả hàng",
  "purchase-returns:update": "Cập nhật phiếu trả hàng",
  "purchase-returns:delete": "Xóa phiếu trả hàng",

  // ========== INVENTORY PERMISSIONS ==========
  // "inventory:stock-check:create": "Tạo phiếu kiểm kho",
  "inventory:stock-check:view": "Báo cáo tồn kho",
  // "inventory:stock-check:detail": "Xem chi tiết kiểm kho",
  // "inventory:stock-check:update": "Cập nhật phiếu kiểm kho",
  // "inventory:stock-check:delete": "Xóa phiếu kiểm kho",
  // "inventory:disposal:create": "Tạo phiếu xử lý hàng hỏng",
  // "inventory:disposal:view": "Xem phiếu xử lý hàng hỏng",
  // "inventory:disposal:update": "Cập nhật phiếu xử lý",
  // "inventory:disposal:delete": "Xóa phiếu xử lý",

  // ========== SUPPLIER PERMISSIONS ==========
  // "suppliers:create": "Thêm nhà cung cấp",
  // "suppliers:view": "Xem nhà cung cấp",
  // "suppliers:update": "Cập nhật nhà cung cấp",
  // "suppliers:delete": "Xóa nhà cung cấp",
  // "suppliers:restore": "Khôi phục nhà cung cấp",
  // "suppliers:export": "Xuất danh sách nhà cung cấp",

  // ========== TAX PERMISSIONS ==========
  // "taxes:preview": "Xem trước tờ khai thuế",
  // "taxes:create": "Tạo tờ khai thuế",
  // "taxes:update": "Cập nhật tờ khai thuế",
  // "taxes:clone": "Nhân bản tờ khai thuế",
  // "taxes:delete": "Xóa tờ khai thuế",
  // "taxes:list": "Danh sách tờ khai thuế",
  // "taxes:export": "Xuất tờ khai thuế",
  // "taxes:view": "Xem thuế",

  // ========== EMPLOYEE (GLOBAL) PERMISSIONS ==========
  // "employees:view": "Xem danh sách nhân sự",
  // "employees:assign": "Gán nhân sự vào cửa hàng",
  // "employees:manage": "Quản lý nhân sự toàn hệ thống",

  // ========== USER PERMISSIONS ==========
  "users:view": "Xem hồ sơ cá nhân",
  // "users:manage": "Quản trị người dùng",
  "users:role:update": "Đổi vai trò người dùng",
  // "users:menu:update": "Cập nhật quyền menu",
  "users:update": "Cập nhật thông tin người dùng",
  // "users:create": "Tạo người dùng",
  "users:delete": "Xóa người dùng",

  // ========== SETTINGS PERMISSIONS ==========
  // "settings:activity-log": "Thiết lập nhật ký hoạt động",
  // "settings:payment-method": "Quản lý phương thức thanh toán",
  "settings:view": "Xem thiết lập",
  "settings:update": "Cập nhật thiết lập",

  // ========== NOTIFICATION PERMISSIONS ==========
  "notifications:view": "Xem thông báo",
  "notifications:manage": "Quản lý thông báo",

  // ========== SUBSCRIPTION PERMISSIONS ==========
  // "subscription:view": "Xem gói dịch vụ",
  // "subscription:manage": "Quản lý gói dịch vụ",
  // "subscription:activate": "Kích hoạt gói",
  // "subscription:cancel": "Hủy gói",
  // "subscription:history": "Lịch sử thanh toán gói",

  // ========== FILE PERMISSIONS ==========
  "files:view": "Xem & tải tệp",
  "files:upload": "Tải lên tệp",
  "files:delete": "Xóa tệp",

  // ========== WILDCARDS (có label nhưng mặc định ẩn khỏi UI) ==========
  // "*": "Toàn quyền hệ thống",
  // "*:*": "Toàn quyền hệ thống",
  // "all": "Toàn quyền hệ thống",
  // "store:*": "Toàn quyền cửa hàng",
  // "products:*": "Toàn quyền sản phẩm",
  "orders:*": "Toàn quyền đơn hàng",
  "customers:*": "Toàn quyền khách hàng",
  "reports:*": "Toàn quyền báo cáo",
  // "inventory:*": "Toàn quyền kho",
  // "taxes:*": "Toàn quyền thuế",
  "users:*": "Toàn quyền người dùng",
};

const normalizePermissions = (list = []) =>
  Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .filter((permission) => typeof permission === "string")
        .map((permission) => permission.trim())
        .filter(Boolean)
    )
  );

// Lấy danh sách key hiển thị trên UI từ PERMISSION_LABELS
// (ẩn wildcard và module:* nếu không muốn user thấy)
const getVisiblePermissionKeys = () =>
  Object.keys(PERMISSION_LABELS).filter(
    (key) => key !== "*" && key !== "*:*" && key !== "all" && !key.endsWith(":*") // nếu muốn cho chọn module:* thì bỏ điều kiện này
  );

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
  const [loadedTabs, setLoadedTabs] = useState({
    active: false,
    deleted: false,
  });

  // Phân quyền
  const [permissionPanelLoading, setPermissionPanelLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  // Dùng mảng string rỗng là đủ, không cần any
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [defaultStaffPermissions, setDefaultStaffPermissions] = useState([]);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // Khởi tạo catalog quyền từ PERMISSION_LABELS (ẩn/hiện theo comment)
  const ensurePermissionCatalog = () => {
    if (permissionOptions.length) {
      return {
        permissions: permissionOptions,
        staffDefault: defaultStaffPermissions,
      };
    }
    const visibleKeys = getVisiblePermissionKeys();
    setPermissionOptions(visibleKeys);
    setDefaultStaffPermissions(visibleKeys);
    return { permissions: visibleKeys, staffDefault: visibleKeys };
  };
  //biến đếm đơn giản cho 2 tab nhân viên đang làm và đã xoá
  const activeCount = useMemo(() => activeEmployees.length, [activeEmployees]);
  const deletedCount = useMemo(() => deletedEmployees.length, [deletedEmployees]);

  const groupedPermissionOptions = useMemo(() => groupPermissions(permissionOptions), [permissionOptions]);
  const selectedPermissionSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);

  const loadEmployees = async (deleted = false, forceReload = false) => {
    if (!forceReload && loadedTabs[deleted ? "deleted" : "active"]) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/stores/${currentStore._id}/employees?deleted=${deleted}`, { headers });
      const list = res.data.employees || res.data.data || [];
      if (deleted) {
        setDeletedEmployees(list);
        setFilteredDeleted(list);
      } else {
        setActiveEmployees(list);
        setFilteredActive(searchText ? filterEmployees(list, searchText) : list);
      }
      setLoadedTabs((prev) => ({
        ...prev,
        [deleted ? "deleted" : "active"]: true,
      }));
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

  useEffect(() => {
    if (currentStore._id) {
      loadEmployees(false);
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
    setSearchText("");
    if (key === "deleted") {
      loadEmployees(true);
    }
    if (key === "permissions") {
      loadEmployees(false, false);
      ensurePermissionCatalog();
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
        await loadEmployees(false, true);
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
        await loadEmployees(tabKey === "active" ? false : true, true);
      }
      await loadEmployees();
      setOpen(false);
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: err.response?.data?.message,
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
      await loadEmployees(false, true);
      if (loadedTabs.deleted) await loadEmployees(true, true);
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
        text: `Khôi phục nhân viên thành công `,
        icon: "success",
        timer: 2000,
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
      await loadEmployees(true, true);
      if (loadedTabs.active) await loadEmployees(false, true);
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
      list.map((emp) => (String(emp.user_id?._id || emp.user_id) === String(userId) ? { ...emp, user_id: { ...emp.user_id, menu: newMenu } } : emp));
    setActiveEmployees((prev) => updater(prev));
    setFilteredActive((prev) => updater(prev));
  };

  const handleSelectStaff = async (record) => {
    if (!record?._id) return;

    if (selectedStaff && String(selectedStaff._id) === String(record._id) && permissionOptions.length) {
      const currentMenu = Array.isArray(record.user_id?.menu) ? record.user_id.menu : [];
      setSelectedPermissions(normalizePermissions(currentMenu).filter((p) => permissionOptions.includes(p)));
      return;
    }

    setSelectedStaff(record);
    setPermissionPanelLoading(true);
    try {
      const catalog = ensurePermissionCatalog();
      const catalogKeys = catalog?.permissions || [];
      const currentMenu = Array.isArray(record.user_id?.menu) ? record.user_id.menu : [];

      const mergedCatalog = normalizePermissions([...catalogKeys, ...currentMenu.filter((p) => PERMISSION_LABELS[p])]);

      setPermissionOptions(mergedCatalog);
      setSelectedPermissions(normalizePermissions(currentMenu).filter((p) => mergedCatalog.includes(p)));
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
    const sanitizedMenu = normalizePermissions(selectedPermissions).filter((p) => PERMISSION_LABELS[p]);

    setPermissionSaving(true);
    try {
      await updateUserById(userId, {
        menu: sanitizedMenu,
        storeId: currentStore._id,
      });
      syncUpdatedMenus(userId, sanitizedMenu);
      setSelectedStaff((prev) => {
        if (!prev) return prev;
        if (String(prev._id) !== String(selectedStaff._id)) return prev;
        return {
          ...prev,
          user_id: { ...prev.user_id, menu: [...sanitizedMenu] },
        };
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

  const handleExportExcel = async () => {
    if (!currentStore?._id) {
      message.error("Vui lòng chọn cửa hàng");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const url = `${apiUrl}/stores/${currentStore._id}/employees/export`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Lỗi tải file");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Danh_Sach_Nhan_Vien_${currentStore.name}_${dayjs().format("DD-MM-YYYY")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      message.success("Xuất Excel thành công!");
    } catch (err) {
      console.error(err);
      message.error("Lỗi xuất Excel: " + err.message);
    }
  };

  const getColumns = (isDeleted = false) => [
    {
      title: "Tên nhân viên",
      dataIndex: "fullName",
      key: "fullName",
      width: 200,
    },
    {
      title: "Username",
      key: "username",
      width: 175,
      render: (_, record) => record.user_id?.username || "—",
    },
    {
      title: "Email",
      key: "email",
      width: 210,
      render: (_, record) => record.user_id?.email || "—",
    },
    {
      title: "Số điện thoại",
      key: "phone",
      width: 140,
      render: (_, record) => {
        const phone = record.user_id?.phone || "";
        const formatPhone = (num) => {
          const cleaned = num.replace(/\D/g, "");
          if (cleaned.length === 10) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
          }
          return num;
        };
        return (
          <Space>
            {phone ? (
              <Typography.Text
                code
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
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
    {
      title: "Ca làm",
      dataIndex: "shift",
      key: "shift",
      width: 90,
      align: "center",
    },
    {
      title: "Lương",
      key: "salary",
      render: (_, record) =>
        Number(record.salary ?? 0).toLocaleString("vi-VN", {
          style: "currency",
          currency: "VND",
        }),
      sorter: (a, b) => (a.salary ?? 0) - (b.salary ?? 0),
    },
    {
      title: "Hoa hồng",
      key: "commission_rate",
      width: 70,
      render: (_, record) => `${Number(record.commission_rate ?? 0)} %`,
      sorter: (a, b) => (a.commission_rate ?? 0) - (b.commission_rate ?? 0),
    },
    {
      title: "Ngày tuyển dụng",
      dataIndex: "hired_date",
      key: "hired_date",
      align: "center",
      width: 145,
      render: (date) => (
        <Space>
          <CalendarOutlined style={{ color: "#722ed1" }} />
          <Tooltip title={dayjs(date).format("DD/MM/YYYY HH:mm")}>
            <Typography.Text>{dayjs(date).format("DD/MM/YYYY")}</Typography.Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      align: "center",
      fixed: "right",
      width: 90,
      render: (_, record) => (
        <div className="flex justify-center gap-2">
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
            <Popconfirm title="Khôi phục nhân viên này?" onConfirm={() => handleRestore(record._id)} okText="Có" cancelText="Không">
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
            <Popconfirm title="Xóa nhân viên này?" onConfirm={() => handleSoftDelete(record._id)} okText="Có" cancelText="Không">
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

  const [paginationActive, setPaginationActive] = useState({
    current: 1,
    pageSize: 10,
  });

  const [paginationDeleted, setPaginationDeleted] = useState({
    current: 1,
    pageSize: 10,
  });

  const [permissionPagination, setPermissionPagination] = useState({
    current: 1,
    pageSize: 10,
  });

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
      <div className="p-6 bg-white rounded-lg" style={{ border: "1px solid #8c8c8c" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <Typography.Title
              level={2}
              style={{
                margin: 0,
                color: "#1890ff",
                lineHeight: 1.2,
              }}
            >
              {currentStore?.name || "Đang tải..."}
            </Typography.Title>

            <Typography.Text
              style={{
                color: "#595959",
                fontSize: 16,
                display: "block",
                marginTop: 6,
              }}
            >
              Quản lý danh sách nhân viên, trạng thái làm việc và phân quyền hệ thống
            </Typography.Text>
          </div>

          <Space size="middle">
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              size="large"
              style={{
                backgroundColor: "#22c55e",
                color: "white",
                border: "none",
              }}
            >
              Xuất Excel
            </Button>

            <Button
              size="large"
              onClick={handleCreate}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
              }}
            >
              + Tạo nhân viên mới
            </Button>
          </Space>
        </div>

        <div style={{ borderBottom: "2px solid #e8e8e8", margin: "16px 0" }} />

        <Alert
          message="Quản lý nhân viên đang làm việc, nhân viên đã xóa và phân quyền truy cập hệ thống."
          type="info"
          showIcon
          style={{ borderRadius: 8, marginBottom: 20, cursor: "pointer" }}
        />

        <div className="mb-4">
          <Search
            placeholder="Tìm kiếm theo tên, username hoặc email..."
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            enterButton
            allowClear
            size="large"
            className="w-full max-w-2xl"
            style={{ width: "100%", maxWidth: "600px" }}
          />
        </div>

        <Tabs
          activeKey={tabKey}
          onChange={handleTabChange}
          animated
          items={[
            {
              key: "active",
              label: `Nhân viên đang làm (${activeCount})`,
              children: (
                <Table
                  columns={getColumns(false)}
                  dataSource={filteredActive}
                  rowKey="_id"
                  pagination={{
                    position: ["bottomRight"],
                    showSizeChanger: true,
                    responsive: true,
                    current: paginationActive.current,
                    pageSize: paginationActive.pageSize,
                    total: filteredActive.length,
                    showTotal: (total, range) => (
                      <div>
                        Đang xem{" "}
                        <span
                          style={{
                            color: "#1890ff",
                            fontWeight: 600,
                          }}
                        >
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số{" "}
                        <span
                          style={{
                            color: "#d4380d",
                            fontWeight: 600,
                          }}
                        >
                          {total}
                        </span>{" "}
                        nhân viên
                      </div>
                    ),
                  }}
                  loading={loading && tabKey === "active"}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: "Chưa có nhân viên đang làm việc" }}
                  onChange={(pag) =>
                    setPaginationActive({
                      current: pag.current,
                      pageSize: pag.pageSize,
                    })
                  }
                />
              ),
            },
            {
              key: "deleted",
              label: `Nhân viên đã xoá (${deletedCount})`,
              children: (
                <Table
                  columns={getColumns(true)}
                  dataSource={filteredDeleted}
                  rowKey="_id"
                  pagination={{
                    position: ["bottomRight"],
                    showSizeChanger: true,
                    responsive: true,
                    current: paginationDeleted.current,
                    pageSize: paginationDeleted.pageSize,
                    total: filteredDeleted.length,
                    showTotal: (total, range) => (
                      <div>
                        Đang xem{" "}
                        <span
                          style={{
                            color: "#1890ff",
                            fontWeight: 600,
                          }}
                        >
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số{" "}
                        <span
                          style={{
                            color: "#d4380d",
                            fontWeight: 600,
                          }}
                        >
                          {total}
                        </span>{" "}
                        nhân viên
                      </div>
                    ),
                  }}
                  loading={loading && tabKey === "deleted"}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: "Chưa có nhân viên bị xóa" }}
                  onChange={(pag) =>
                    setPaginationDeleted({
                      current: pag.current,
                      pageSize: pag.pageSize,
                    })
                  }
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
                            current: permissionPagination.current,
                            pageSize: permissionPagination.pageSize,
                            total: filteredActive.length,
                            showTotal: (total, range) => (
                              <div>
                                Đang xem{" "}
                                <span
                                  style={{
                                    color: "#1890ff",
                                    fontWeight: 600,
                                  }}
                                >
                                  {range[0]} – {range[1]}
                                </span>{" "}
                                trên tổng số{" "}
                                <span
                                  style={{
                                    color: "#d4380d",
                                    fontWeight: 600,
                                  }}
                                >
                                  {total}
                                </span>{" "}
                                nhân viên
                              </div>
                            ),
                          }}
                          loading={loading && tabKey === "permissions"}
                          scroll={{ x: "max-content" }}
                          size="small"
                          onChange={(pag) =>
                            setPermissionPagination({
                              current: pag.current,
                              pageSize: pag.pageSize,
                            })
                          }
                          onRow={(record) => ({
                            onClick: () => handleSelectStaff(record),
                            style: {
                              cursor: "pointer",
                              backgroundColor: selectedStaff && String(selectedStaff._id) === String(record._id) ? "#f0f5ff" : "transparent",
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
