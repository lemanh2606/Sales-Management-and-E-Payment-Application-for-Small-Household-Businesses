//frontend/src/pages/inventory/InventoryVoucherPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification,
} from "antd";
import {
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  SwapOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import Layout from "../../components/Layout";

import { getProductsByStore } from "../../api/productApi";
import {
  approveInventoryVoucher,
  cancelInventoryVoucher,
  createInventoryVoucher,
  deleteInventoryVoucher,
  getInventoryVoucherById,
  getInventoryVouchers,
  postInventoryVoucher,
  reverseInventoryVoucher,
  updateInventoryVoucher,
} from "../../api/inventoryVoucherApi";

// NEW: lấy NCC giống SupplierListPage
import { getSuppliers } from "../../api/supplierApi";
import { getWarehouses } from "../../api/warehouseApi";

import { useAuth } from "../../context/AuthContext";

const { Title, Text } = Typography;
const { Option } = Select;

const getId = (obj) => obj?._id || obj?.id;
const normalizeStatus = (st) =>
  String(st || "")
    .trim()
    .toUpperCase();

const normalizeMongoId = (idLike) => {
  if (!idLike) return null;
  if (typeof idLike === "object" && idLike.$oid) return String(idLike.$oid);
  if (typeof idLike === "object" && typeof idLike.toString === "function") return String(idLike.toString());
  if (typeof idLike === "string") return idLike;
  return String(idLike);
};

const normalizeSupplier = (s) => {
  const _id = normalizeMongoId(s?._id) || normalizeMongoId(s?.id);
  return { ...s, _id };
};

const toNumberDecimal = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (typeof v === "object") {
    const s = v.$numberDecimal ?? v.numberDecimal ?? v.value ?? null;
    if (s !== null && s !== undefined) return Number(s) || 0;
  }
  return 0;
};

const formatCurrency = (n) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(n || 0));

const statusColor = (stRaw) => {
  const st = normalizeStatus(stRaw);
  return STATUS_COLOR[st] || "default";
};

const typeColor = (t) => (t === "IN" ? "green" : "volcano");

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const computeLineCost = (qty, unitCost) => safeNumber(qty, 0) * safeNumber(unitCost, 0);

const computeTotalsFromItems = (items = []) => {
  const totalQty = (items || []).reduce((s, it) => s + safeNumber(it?.qty_actual, 0), 0);
  const totalCost = (items || []).reduce((s, it) => s + computeLineCost(it?.qty_actual, toNumberDecimal(it?.unit_cost)), 0);
  return { totalQty, totalCost };
};

const STATUS_LABEL = {
  DRAFT: "Nháp",
  APPROVED: "Đã duyệt",
  POSTED: "Đã ghi sổ",
  CANCELLED: "Đã hủy",
};

const STATUS_COLOR = {
  DRAFT: "default",
  APPROVED: "blue",
  POSTED: "green",
  CANCELLED: "red",
};

const ROLE_LABEL = {
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
};
const ROLE_COLOR = {
  MANAGER: "blue",
  STAFF: "green",
};

// ====== UI styles (gọn + đẹp + chống tràn) ======
const S = {
  page: { padding: 0, minHeight: "100vh" },
  card: { borderRadius: 12, border: "1px solid #8c8c8c" },
  divider: { margin: "15px 0", background: "#d9d9d9" },
  tableWrap: { overflowX: "auto" },
  rowGutter: [8, 8],

  pill: {
    background: "#f8fafc",
    border: "1px solid #8c8c8c",
    borderRadius: 10,
    padding: "10px 10px",
    fontSize: 12,
    color: "#334155",
    whiteSpace: "nowrap",
  },

  modalBody: { padding: 12, maxHeight: "calc(100vh - 180px)", overflowY: "auto" },
  modalFooter: {
    padding: "10px 12px",
    border: "1px solid #8c8c8c",
    background: "#fff",
  },

  ellipsis1: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  wrapText: { wordBreak: "break-word", overflowWrap: "anywhere" },

  sectionCard: {
    borderRadius: 12,
    border: "1px solid #8c8c8c",
    boxShadow: "0 1px 0 rgba(15,23,42,0.03)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },

  itemsCard: {
    borderRadius: 12,
    border: "1px solid #8c8c8c",
    overflow: "hidden",
  },
  itemsHeader: {
    background: "#f8fafc",
    borderBottom: "1px solid #8c8c8c",
    padding: "8px 10px",
  },
  itemsRow: {
    padding: "10px 10px",
    borderBottom: "1px solid #8c8c8c",
  },
  itemsRowLast: {
    padding: "10px 10px",
  },
  headerCell: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  moneyBox: {
    background: "#f8fafc",
    border: "1px solid #8c8c8c",
    borderRadius: 10,
    padding: "8px 10px",
    lineHeight: 1.2,
  },
};

export default function InventoryVoucherPage() {
  const [api, notificationContextHolder] = notification.useNotification();
  const [modal, modalContextHolder] = Modal.useModal();
  // Warehouses
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const { token } = useAuth();

  const storeObj = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentStore") || "null");
    } catch {
      return null;
    }
  }, []);
  const storeId = storeObj?.id || storeObj?._id || null;

  const userObj = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const userRole = String(userObj?.role || "").toUpperCase();
  const isManager = userRole === "MANAGER";

  const userDisplayName = userObj?.fullName || userObj?.fullname || userObj?.name || userObj?.username || userObj?.email || "";

  const userPhone = userObj?.phone || userObj?.phoneNumber || userObj?.phonenumber || "";

  // data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });

  // products
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // suppliers (NEW)
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [type, setType] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);

  // UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerVoucher, setDrawerVoucher] = useState(null);

  // Track form changes for totalsLive recalculation
  const [formChangeKey, setFormChangeKey] = useState(0);

  const [form] = Form.useForm();

  const fetchProducts = async () => {
    if (!storeId) return;
    try {
      setLoadingProducts(true);
      const data = await getProductsByStore(storeId, { page: 1, limit: 10000 });
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      api.error({
        message: "Lỗi tải sản phẩm",
        description: err?.response?.data?.message || err?.message || "Không thể tải danh sách sản phẩm.",
        placement: "topRight",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  // NEW: fetch suppliers
  const fetchSuppliers = async () => {
    if (!storeId || !token) return;
    try {
      setLoadingSuppliers(true);
      // lấy NCC đang hoạt động; nếu backend bạn khác thì chỉnh params
      const res = await getSuppliers(storeId, { deleted: false, status: "đang hoạt động", page: 1, limit: 10000 });
      const list = Array.isArray(res?.suppliers) ? res.suppliers : [];
      setSuppliers(list.map(normalizeSupplier));
    } catch (err) {
      api.error({
        message: "Lỗi tải nhà cung cấp",
        description: err?.response?.data?.message || err?.message || "Không thể tải danh sách nhà cung cấp.",
        placement: "topRight",
      });
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchVouchers = async (opts = {}) => {
    if (!storeId) return;

    const page = opts.page ?? meta.page ?? 1;
    const limit = opts.limit ?? meta.limit ?? 20;

    const from = dateRange?.[0] ? dayjs(dateRange[0]).startOf("day").toISOString() : undefined;
    const to = dateRange?.[1] ? dayjs(dateRange[1]).endOf("day").toISOString() : undefined;

    try {
      setLoading(true);
      const data = await getInventoryVouchers(storeId, {
        page,
        limit,
        q: q?.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
        from,
        to,
        sort: "-voucher_date",
      });

      setRows(Array.isArray(data?.data) ? data.data : []);
      setMeta(data?.meta || { page, limit, total: 0 });
    } catch (err) {
      api.error({
        message: "Lỗi tải phiếu kho",
        description: err?.response?.data?.message || err?.message || "Không thể tải danh sách phiếu kho.",
        placement: "topRight",
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchWarehouses = async () => {
    if (!storeId) return;
    try {
      setLoadingWarehouses(true);
      const res = await getWarehouses(storeId, {
        page: 1,
        limit: 10000,
        deleted: false,
        status: "active", // nếu backend có filter này; nếu không thì bỏ
      });

      const list = Array.isArray(res?.warehouses) ? res.warehouses : [];
      setWarehouses(list);
    } catch (err) {
      api.error({
        message: "Lỗi tải kho",
        description: err?.response?.data?.message || err?.message || "Không thể tải danh sách kho.",
        placement: "topRight",
      });
    } finally {
      setLoadingWarehouses(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;
    fetchProducts();
    fetchSuppliers(); // NEW
    fetchWarehouses(); // NEW
    fetchVouchers({ page: 1 });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, token]);

  useEffect(() => {
    if (!storeId) return;
    fetchVouchers({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, status, dateRange]);

  const supplierOptions = useMemo(() => {
    return (suppliers || []).map((s) => {
      const name = s?.name || "N/A";
      const phone = s?.phone || "";
      const taxcode = s?.taxcode || "";
      const contact = s?.contact_person || "";
      const label = `${name}${phone ? ` • ${phone}` : ""}${taxcode ? ` • MST:${taxcode}` : ""}`;

      return {
        value: s?._id,
        label,
        searchText: `${name} ${phone} ${taxcode} ${contact} ${s?.email || ""}`.toLowerCase(),
      };
    });
  }, [suppliers]);

  const filterSupplierOption = (input, option) => {
    const s = String(input || "")
      .trim()
      .toLowerCase();
    if (!s) return true;
    return String(option?.searchText || "").includes(s);
  };

  const setSupplierToForm = (supplierId) => {
    const s = suppliers.find((x) => String(x?._id) === String(supplierId));
    if (!s) return;

    // auto-fill: người giao + thông tin NCC
    form.setFieldsValue({
      supplier_id: s._id,
      supplier_name_snapshot: s.name || "",
      supplier_phone_snapshot: s.phone || "",
      supplier_email_snapshot: s.email || "",
      supplier_address_snapshot: s.address || "",
      supplier_taxcode_snapshot: s.taxcode || "",
      supplier_contact_person_snapshot: s.contact_person || "",

      deliverer_name: s.contact_person || s.name || "",
      deliverer_phone: s.phone || "",

      // receiver: mặc định user
      receiver_name: form.getFieldValue("receiver_name") || userDisplayName || "",
      receiver_phone: form.getFieldValue("receiver_phone") || userPhone || "",
    });
  };
  const warehouseOptions = useMemo(() => {
    return warehouses.map((w) => {
      const id = getId(w) || w?._id || w?.id; // tuỳ object trả về
      const code = w?.code || "";
      const name = w?.name || "Kho";
      const label = code ? `${name} (${code})` : name;

      const address = w?.address || [w?.ward, w?.district, w?.city].filter(Boolean).join(", ");

      return {
        value: String(id),
        label,
        searchText: `${name} ${code} ${address}`.toLowerCase(),
        meta: { id: String(id), name, code, address },
      };
    });
  }, [warehouses]);

  const filterWarehouseOption = (input, option) => {
    const s = String(input || "")
      .trim()
      .toLowerCase();
    if (!s) return true;
    return String(option?.searchText || "").includes(s);
  };

  const setWarehouseToForm = (warehouseId) => {
    const w = warehouses.find((x) => String(getId(x) || x?._id || x?.id) === String(warehouseId));
    if (!w) return;

    // Lưu đúng theo logic backend bạn đang dùng cho voucher (warehouse_id, warehouse_name)
    // và giữ backward compatible với 2 field text cũ.
    form.setFieldsValue({
      warehouse_id: String(getId(w) || w?._id || w?.id),
      warehouse_name: w?.name || "",
      warehousename: w?.name || "",
      // optional: auto-fill vị trí/khu vực bằng địa chỉ kho (nếu bạn muốn)
      warehouse_location: w?.address || "",
    });
  };

  const openCreateModal = () => {
    setEditingVoucher(null);
    setIsModalOpen(true);

    form.resetFields();
    form.setFieldsValue({
      type: "IN",
      voucher_date: dayjs(),
      voucher_code: "",
      reason: "",

      // auto fill người nhận theo user
      receiver_name: userDisplayName || "",
      receiver_phone: userPhone || "",

      // người giao để trống cho tới khi chọn NCC (hoặc tự nhập)
      deliverer_name: "",
      deliverer_phone: "",

      items: [{ product_id: null, qty_actual: 1, unit_cost: 0, note: "" }],

      // nâng cao
      attached_docs: 0,
      warehouse_id: defaultWh?.id || null,
      warehouse_name: defaultWh?.name || "",
      warehousename: defaultWh?.name || "",

      warehouse_location: defaultWh?.address || "",
      ref_no: "",
      ref_date: null,

      // supplier fields (NEW)
      supplier_id: null,
      supplier_name_snapshot: "",
      supplier_phone_snapshot: "",
      supplier_email_snapshot: "",
      supplier_address_snapshot: "",
      supplier_taxcode_snapshot: "",
      supplier_contact_person_snapshot: "",
    });
  };

  const openEditModal = async (record) => {
    try {
      setEditingVoucher(record);
      setIsModalOpen(true);

      const id = getId(record);
      const res = await getInventoryVoucherById(storeId, id);
      const v = res?.voucher;
      if (!v) throw new Error("Không có dữ liệu phiếu");

      form.resetFields();
      form.setFieldsValue({
        type: v.type,
        voucher_code: v.voucher_code,
        voucher_date: v.voucher_date ? dayjs(v.voucher_date) : dayjs(),
        reason: v.reason || "",
        attached_docs: Number(v.attached_docs || 0),

        deliverer_name: v.deliverer_name || "",
        receiver_name: v.receiver_name || "",
        deliverer_phone: v.deliverer_phone || "",
        receiver_phone: v.receiver_phone || "",

        warehouse_id: v.warehouse_id || null,
        warehouse_name: v.warehouse_name || "",
        warehousename: v.warehouse_name || "",
        warehouse_location: v.warehouse_location || "",
        ref_no: v.ref_no || "",
        ref_date: v.ref_date ? dayjs(v.ref_date) : null,

        // NEW: supplier (nếu backend có lưu)
        supplier_id: v.supplier_id || v.supplier?._id || null,
        supplier_name_snapshot: v.supplier_name_snapshot || v.supplier?.name || "",
        supplier_phone_snapshot: v.supplier_phone_snapshot || v.supplier?.phone || "",
        supplier_email_snapshot: v.supplier_email_snapshot || v.supplier?.email || "",
        supplier_address_snapshot: v.supplier_address_snapshot || v.supplier?.address || "",
        supplier_taxcode_snapshot: v.supplier_taxcode_snapshot || v.supplier?.taxcode || "",
        supplier_contact_person_snapshot: v.supplier_contact_person_snapshot || v.supplier?.contact_person || "",

        items: (v.items || []).map((it) => ({
          product_id: it.product_id?._id || it.product_id,
          sku_snapshot: it.sku_snapshot || "",
          name_snapshot: it.name_snapshot || "",
          unit_snapshot: it.unit_snapshot || "",
          qty_actual: Number(it.qty_actual || 0),
          unit_cost: toNumberDecimal(it.unit_cost),
          note: it.note || "",
        })),
      });

      // nếu phiếu NHẬP có supplier_id nhưng snapshot trống, thử fill từ list hiện tại
      const t = v.type;
      const sid = v.supplier_id || v.supplier?._id || null;
      if (t === "IN" && sid) {
        const snap = form.getFieldValue("supplier_name_snapshot");
        if (!snap) setSupplierToForm(sid);
      }
    } catch (err) {
      api.error({
        message: "Không thể mở phiếu để sửa",
        description: err?.response?.data?.message || err?.message || "Vui lòng thử lại.",
        placement: "topRight",
      });
      setIsModalOpen(false);
      setEditingVoucher(null);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVoucher(null);
    form.resetFields();
  };

  const submitForm = async () => {
    try {
      const values = await form.validateFields();

      // NEW: nếu NHẬP mà chưa chọn NCC => warn (bạn có thể bỏ rule này nếu muốn optional)
      if (values.type === "IN" && !values.supplier_id) {
        return api.warning({
          message: "Thiếu nhà cung cấp",
          description: "Phiếu NHẬP nên chọn nhà cung cấp để tự động điền thông tin.",
          placement: "topRight",
        });
      }

      const payload = {
        type: values.type,
        voucher_code: values.voucher_code || undefined,
        voucher_date: values.voucher_date ? values.voucher_date.toISOString() : undefined,

        reason: values.reason || "",
        attached_docs: Number(values.attached_docs || 0),

        deliverer_name: values.deliverer_name || "",
        receiver_name: values.receiver_name || "",
        deliverer_phone: values.deliverer_phone || "",
        receiver_phone: values.receiver_phone || "",
        warehouse_id: values.warehouse_id || null,
        warehouse_name: values.warehouse_name || "",
        warehouse_location: values.warehouse_location || "",
        ref_no: values.ref_no || "",
        ref_date: values.ref_date ? values.ref_date.toISOString() : null,

        // NEW: supplier (chỉ gửi nếu có)
        ...(values.supplier_id
          ? {
              supplier_id: values.supplier_id,
              supplier_name_snapshot: values.supplier_name_snapshot || "",
              supplier_phone_snapshot: values.supplier_phone_snapshot || "",
              supplier_email_snapshot: values.supplier_email_snapshot || "",
              supplier_address_snapshot: values.supplier_address_snapshot || "",
              supplier_taxcode_snapshot: values.supplier_taxcode_snapshot || "",
              supplier_contact_person_snapshot: values.supplier_contact_person_snapshot || "",
            }
          : {}),

        items: (values.items || [])
          .filter((x) => x && x.product_id)
          .map((x) => ({
            product_id: x.product_id,
            qty_actual: Number(x.qty_actual || 0),
            unit_cost: Number(x.unit_cost || 0),
            note: x.note || "",
            sku_snapshot: x.sku_snapshot || "",
            name_snapshot: x.name_snapshot || "",
            unit_snapshot: x.unit_snapshot || "",
          })),
      };

      if (!payload.items.length) {
        return api.warning({
          message: "Thiếu dòng hàng",
          description: "Vui lòng chọn ít nhất 1 sản phẩm trong danh sách.",
          placement: "topRight",
        });
      }

      const editId = getId(editingVoucher);
      if (editId) {
        await updateInventoryVoucher(storeId, editId, payload);
        api.success({ message: "Cập nhật thành công", description: "Phiếu kho đã được cập nhật.", placement: "topRight" });
      } else {
        await createInventoryVoucher(storeId, payload);
        api.success({
          message: "Tạo phiếu thành công",
          description: isManager ? "Phiếu đã tạo. Có thể duyệt/ghi sổ." : "Phiếu đã tạo (NHÁP) chờ MANAGER duyệt.",
          placement: "topRight",
        });
      }

      closeModal();
      fetchVouchers({ page: 1 });
    } catch (err) {
      if (err?.errorFields) return;
      api.error({
        message: "Lưu phiếu thất bại",
        description: err?.response?.data?.message || err?.message || "Vui lòng thử lại.",
        placement: "topRight",
      });
    }
  };

  const openDrawer = async (record) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerVoucher(null);

    try {
      const res = await getInventoryVoucherById(storeId, getId(record));
      setDrawerVoucher(res?.voucher || null);
    } catch (err) {
      api.error({
        message: "Lỗi tải chi tiết phiếu",
        description: err?.response?.data?.message || err?.message || "Không thể tải chi tiết phiếu.",
        placement: "topRight",
      });
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const doDeleteDraft = (record) => {
    modal.confirm({
      title: <span style={{ fontWeight: 600, fontSize: 16 }}>Xóa phiếu kho</span>,
      icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
      content: (
        <div style={{ marginTop: 8, lineHeight: 1.6 }}>
          <div>
            Bạn có chắc muốn xóa phiếu <b style={{ color: "#1677ff" }}>{record.voucher_code}</b>?
          </div>

          <div style={{ marginTop: 8, color: "#fa541c" }}>
            ⚠️ Lưu ý:
            <ul style={{ paddingLeft: 18, margin: "6px 0" }}>
              <li>
                Chỉ xóa được phiếu ở trạng thái <b>NHÁP</b>
              </li>
              <li>
                Phiếu đã xóa <b>không thể khôi phục</b>
              </li>
            </ul>
          </div>
        </div>
      ),
      okText: "Xóa phiếu",
      cancelText: "Hủy",
      okType: "danger",
      centered: true,
      onOk: async () => {
        await deleteInventoryVoucher(storeId, getId(record));
        api.success({
          message: "Đã xóa phiếu",
          description: `Phiếu: ${record.voucher_code}`,
          placement: "topRight",
        });
        fetchVouchers({ page: 1 });
      },
    });
  };

  const doApprove = async (record) => {
    try {
      await approveInventoryVoucher(storeId, getId(record));
      api.success({ message: "Đã duyệt phiếu", description: record.voucher_code, placement: "topRight" });
      fetchVouchers({ page: meta.page });
    } catch (err) {
      api.error({
        message: "Duyệt thất bại",
        description: err?.response?.data?.message || err?.message || "Vui lòng thử lại.",
        placement: "topRight",
      });
    }
  };

  const doPost = async (record) => {
    try {
      await postInventoryVoucher(storeId, getId(record));
      api.success({ message: "Đã ghi sổ", description: record.voucher_code, placement: "topRight" });
      fetchVouchers({ page: meta.page });
    } catch (err) {
      api.error({
        message: "Ghi sổ thất bại",
        description: err?.response?.data?.message || err?.message || "Vui lòng thử lại.",
        placement: "topRight",
      });
    }
  };

  const doCancel = (record) => {
    let reason = "";

    modal.confirm({
      title: (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
          Hủy phiếu kho
        </span>
      ),
      icon: null,
      content: (
        <div style={{ paddingTop: 8 }}>
          <div style={{ marginBottom: 6, fontSize: 14 }}>Bạn đang hủy phiếu:</div>

          <div
            style={{
              marginBottom: 12,
              fontWeight: 600,
              color: "#1677ff",
              fontSize: 15,
            }}
          >
            {record.voucher_code}
          </div>

          <div style={{ marginBottom: 6, color: "#595959" }}>
            Nhập lý do hủy <i>(không bắt buộc)</i>:
          </div>

          <Input.TextArea rows={3} placeholder="Ví dụ: Nhập sai số lượng, tạo nhầm phiếu..." onChange={(e) => (reason = e.target.value)} />

          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "#fa541c",
            }}
          >
            ⚠️ Phiếu đã hủy sẽ không thể tiếp tục xử lý.
          </div>
        </div>
      ),
      okText: "Hủy phiếu",
      cancelText: "Đóng",
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        await cancelInventoryVoucher(storeId, getId(record), {
          cancel_reason: reason,
        });

        api.success({
          message: "Đã hủy phiếu",
          description: record.voucher_code,
          placement: "topRight",
        });

        fetchVouchers({ page: meta.page });
      },
    });
  };

  const doReverse = (record) => {
    modal.confirm({
      title: <span style={{ fontWeight: 600, fontSize: 16 }}>Đảo phiếu tồn kho</span>,
      icon: <SwapOutlined style={{ color: "#fa541c" }} />,
      content: (
        <div style={{ marginTop: 8, lineHeight: 1.6 }}>
          <div>
            Bạn có chắc muốn đảo phiếu <b style={{ color: "#1677ff" }}>{record.voucher_code}</b>?
          </div>

          <div style={{ marginTop: 8, color: "#fa541c" }}>
            ⚠️ Hệ thống sẽ:
            <ul style={{ paddingLeft: 18, margin: "6px 0" }}>
              <li>
                Tạo <b>phiếu đảo ngược</b>
              </li>
              <li>
                Cập nhật lại <b>tồn kho</b>
              </li>
              <li>Không thể hoàn tác thao tác này</li>
            </ul>
          </div>
        </div>
      ),
      okText: "Đảo phiếu",
      cancelText: "Hủy",
      okType: "danger",
      centered: true,
      onOk: async () => {
        await reverseInventoryVoucher(storeId, getId(record));
        api.success({
          message: "Đã đảo phiếu",
          description: `Phiếu: ${record.voucher_code}`,
          placement: "topRight",
        });
        fetchVouchers({ page: meta.page });
      },
    });
  };

  // Product select: label gọn trong ô chọn, dropdown vẫn chi tiết
  const productOptions = useMemo(() => {
    return (products || []).map((p) => {
      const stock = safeNumber(p.stockquantity ?? p.stock_quantity ?? 0, 0);
      const cost = toNumberDecimal(p.costprice ?? p.cost_price ?? 0);
      const price = toNumberDecimal(p.price ?? 0);
      const unit = p.unit || "Trống";
      const sku = p.sku || "N/A";
      const name = p.name || "";

      return {
        value: getId(p),
        label: `${name} (${sku})`,
        searchText: `${name} ${sku} ${unit}`.toLowerCase(),
        meta: { name, sku, unit, stock, cost, price },
      };
    });
  }, [products]);

  const filterProductOption = (input, option) => {
    const s = String(input || "")
      .trim()
      .toLowerCase();
    if (!s) return true;
    return String(option?.searchText || "").includes(s);
  };

  // Drawer item table
  const itemColumns = [
    {
      title: "Sản phẩm",
      key: "product",
      width: 300,
      ellipsis: true,
      render: (_, it) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, ...S.ellipsis1 }}>{it?.name_snapshot || it?.product_id?.name || "Trống"}</div>
          <Text type="secondary" style={{ fontSize: 12, ...S.ellipsis1, display: "block" }}>
            SKU: <Tag color="blue">{it?.sku_snapshot || it?.product_id?.sku || "Trống"}</Tag> | Đơn vị:{" "}
            <Tag color="blue">{it?.unit_snapshot || it?.product_id?.unit || "Trống"}</Tag>
          </Text>
        </div>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "qty_actual",
      key: "qty_actual",
      width: 85,
      align: "center",
      render: (v) => Number(v || 0).toLocaleString("vi-VN"),
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_cost",
      key: "unit_cost",
      width: 120,
      align: "right",
      render: (v) => formatCurrency(toNumberDecimal(v)),
    },
    {
      title: "Thành tiền",
      key: "line_cost",
      width: 130,
      align: "right",
      render: (_, it) => {
        const line = computeLineCost(it?.qty_actual, toNumberDecimal(it?.unit_cost));
        return <Text strong>{formatCurrency(line)}</Text>;
      },
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      align: "center",
      key: "note",
      width: 220,
      ellipsis: true,
      render: (v) => <span style={S.ellipsis1}>{v || "Trống"}</span>,
    },
  ];

  // List table
  const columns = [
    {
      title: "Số phiếu",
      dataIndex: "voucher_code",
      key: "voucher_code",
      width: 170,
      ellipsis: true,
      render: (t) => <Text style={{ color: "#1677ff", fontWeight: 650, ...S.ellipsis1 }}>{t}</Text>,
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 80,
      align: "center",
      render: (t) => (
        <Tag color={typeColor(t)} style={{ marginInlineEnd: 0 }}>
          {t === "IN" ? "NHẬP" : "XUẤT"}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 110,
      align: "center",
      render: (t) => {
        const st = normalizeStatus(t);
        return (
          <Tag color={STATUS_COLOR[st]} style={{ marginInlineEnd: 0 }}>
            {STATUS_LABEL[st] || "Trống"}
          </Tag>
        );
      },
    },
    {
      title: "Ngày",
      dataIndex: "voucher_date",
      key: "voucher_date",
      width: 110,
      align: "center",
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "Trống"),
    },
    {
      title: "Lý do",
      dataIndex: "reason",
      key: "reason",
      width: 240,
      ellipsis: true,
      render: (v) => <span style={S.ellipsis1}>{v || "Trống"}</span>,
    },
    {
      title: "Số lượng",
      dataIndex: "total_qty",
      key: "total_qty",
      width: 85,
      align: "center",
      render: (v, r) => {
        const qty = v ?? computeTotalsFromItems(r?.items || []).totalQty;
        return <Text>{Number(qty || 0).toLocaleString("vi-VN")}</Text>;
      },
    },
    {
      title: "Tổng tiền",
      dataIndex: "total_cost",
      key: "total_cost",
      width: 110,
      align: "right",
      render: (v, r) => {
        const cost = v ?? computeTotalsFromItems(r?.items || []).totalCost;
        return <Text strong>{formatCurrency(toNumberDecimal(cost))}</Text>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 260,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const st = normalizeStatus(record.status);
        const canEdit = st === "DRAFT";
        const canApprove = st === "DRAFT" && isManager;
        const canPost = (st === "APPROVED" || st === "DRAFT") && isManager;
        const canReverse = st === "POSTED" && isManager;
        const canCancel = st !== "POSTED" && st !== "CANCELLED";

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Space size={6} wrap>
              <Tooltip title="Xem chi tiết phiếu này">
                <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(record)} />
              </Tooltip>

              <Tooltip title={canEdit ? "Sửa (NHÁP)" : "Chỉ sửa được NHÁP"}>
                <Button size="small" icon={<EditOutlined />} disabled={!canEdit} onClick={() => openEditModal(record)} type="primary" />
              </Tooltip>

              <Tooltip title={canEdit ? "Xóa (NHÁP)" : "Chỉ xóa được NHÁP"}>
                <Button size="small" icon={<DeleteOutlined />} danger disabled={!canEdit} onClick={() => doDeleteDraft(record)} />
              </Tooltip>

              <Tooltip title={isManager ? "Duyệt phiếu này" : "Chỉ MANAGER duyệt"}>
                <Button size="small" icon={<CheckCircleOutlined />} disabled={!canApprove} onClick={() => doApprove(record)}>
                  Duyệt
                </Button>
              </Tooltip>

              <Tooltip title={isManager ? "Ghi sổ" : "Chỉ MANAGER ghi sổ"}>
                <Button size="small" icon={<UploadOutlined />} disabled={!canPost} onClick={() => doPost(record)}>
                  Ghi sổ
                </Button>
              </Tooltip>

              <Tooltip title="Hủy phiếu">
                <Button size="small" icon={<CloseCircleOutlined />} disabled={!canCancel} onClick={() => doCancel(record)}>
                  Hủy
                </Button>
              </Tooltip>

              <Tooltip title={isManager ? "Đảo phiếu" : "Chỉ MANAGER đảo"}>
                <Button size="small" icon={<SwapOutlined />} disabled={!canReverse} onClick={() => doReverse(record)}>
                  Đảo
                </Button>
              </Tooltip>
            </Space>
          </div>
        );
      },
    },
  ];

  const totalsLive = useMemo(() => {
    const items = form.getFieldValue("items") || [];
    return computeTotalsFromItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formChangeKey, isModalOpen]);

  if (!storeId) {
    return (
      <Layout>
        {notificationContextHolder}
        {modalContextHolder}
        <Card size="small" style={S.card}>
          <Alert type="warning" showIcon message="Chưa chọn cửa hàng" description="Vui lòng chọn cửa hàng trước khi quản lý phiếu nhập/xuất kho." />
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {notificationContextHolder}
      {modalContextHolder}

      <div style={S.page}>
        <Card size="small" style={S.card}>
          <Row gutter={S.rowGutter} align="middle" justify="space-between">
            <Col style={{ minWidth: 0 }}>
              <Title level={2} style={{ margin: 0, lineHeight: 1.2 }}>
                Phiếu nhập xuất kho
              </Title>
              <div style={{ marginTop: 15, marginBottom: 10 }}>
                <Space size={8} wrap>
                  <span style={S.pill}>
                    Vai trò:{" "}
                    <Tag color={ROLE_COLOR[userRole] || "default"} style={{ marginLeft: 6 }}>
                      {ROLE_LABEL[userRole] || "N/A"}
                    </Tag>
                  </span>
                  <span style={S.pill}>
                    Nhà cung cấp:{" "}
                    <Tag color="blue" style={{ marginLeft: 6 }}>
                      {suppliers.length}
                    </Tag>
                  </span>
                </Space>
              </div>
            </Col>

            <Col>
              <Space size={8} wrap>
                <Button size="medium" icon={<ReloadOutlined />} onClick={() => fetchVouchers({ page: meta.page })} loading={loading}>
                  Làm mới
                </Button>

                <Button
                  size="medium"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                  style={{
                    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                    border: "none",
                  }}
                >
                  Tạo phiếu
                </Button>

                <Tooltip title="Tải lại danh sách nhà cung cấp">
                  <Button size="medium" onClick={fetchSuppliers} loading={loadingSuppliers}>
                    Tải nhà cung cấp
                  </Button>
                </Tooltip>

                <Tooltip title="Tải lại danh sách sản phẩm">
                  <Button size="medium" onClick={fetchProducts} loading={loadingProducts}>
                    Tải sản phẩm
                  </Button>
                </Tooltip>
              </Space>
            </Col>
          </Row>

          <Divider style={S.divider} />

          <Row gutter={S.rowGutter}>
            <Col xs={24} md={8}>
              <Input
                size="medium"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm số phiếu, lý do, người giao/nhận..."
                allowClear
              />
            </Col>

            <Col xs={12} md={4}>
              <Select size="medium" value={type} onChange={setType} allowClear placeholder="Lọc theo loại" style={{ width: "100%" }}>
                <Option value="IN">
                  <Tag color="green">NHẬP</Tag>
                </Option>
                <Option value="OUT">
                  <Tag color="volcano">XUẤT</Tag>
                </Option>
              </Select>
            </Col>

            <Col xs={12} md={5}>
              <Select size="medium" value={status} onChange={setStatus} allowClear placeholder="Lọc theo trạng thái" style={{ width: "100%" }}>
                <Option value="DRAFT">
                  <Tag color={STATUS_COLOR.DRAFT}>{STATUS_LABEL.DRAFT}</Tag>
                </Option>
                <Option value="APPROVED">
                  <Tag color={STATUS_COLOR.APPROVED}>{STATUS_LABEL.APPROVED}</Tag>
                </Option>
                <Option value="POSTED">
                  <Tag color={STATUS_COLOR.POSTED}>{STATUS_LABEL.POSTED}</Tag>
                </Option>
                <Option value="CANCELLED">
                  <Tag color={STATUS_COLOR.CANCELLED}>{STATUS_LABEL.CANCELLED}</Tag>
                </Option>
              </Select>
            </Col>

            <Col xs={24} md={7}>
              <DatePicker.RangePicker
                size="medium"
                value={dateRange}
                onChange={setDateRange}
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                allowClear
              />
            </Col>
          </Row>

          <Divider style={S.divider} />

          <div style={S.tableWrap}>
            <Table
              size="small"
              columns={columns}
              dataSource={rows}
              rowKey={(r) => getId(r)}
              loading={loading}
              pagination={{
                size: "small",
                current: meta.page,
                pageSize: meta.limit,
                total: meta.total,
                showSizeChanger: true,
                onChange: (page, pageSize) => fetchVouchers({ page, limit: pageSize }),
              }}
              scroll={{ x: "max-content" }}
            />
          </div>
        </Card>

        {/* ===== CREATE/EDIT MODAL ===== */}
        <Modal
          open={isModalOpen}
          onCancel={closeModal}
          width={1124}
          centered
          modalRender={(modal) => <div style={{ margin: "22px 0" }}>{modal}</div>}
          closeIcon={<CloseOutlined style={{ fontSize: 18 }} />}
          styles={{
            mask: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
            body: { padding: "16px 16px" },
          }}
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 20,
                  fontWeight: "bold",
                }}
              >
                {editingVoucher ? "✏️" : "📦"}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{editingVoucher ? "Cập nhật phiếu kho" : "Tạo phiếu kho mới"}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  {editingVoucher ? `Trạng thái: ${STATUS_LABEL.DRAFT}` : "Phiếu sẽ ở trạng thái nháp sau khi tạo"}
                </div>
              </div>
              {!isManager && !editingVoucher && (
                <Tag color="gold" style={{ fontWeight: 600, borderRadius: 8, padding: "4px 10px" }}>
                  STAFF: chờ MANAGER duyệt
                </Tag>
              )}
            </div>
          }
          footer={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 0 8px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "10px 16px",
                    minWidth: 140,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ fontSize: 17, color: "#64748b", marginBottom: 4 }}>
                    Tổng số lượng:{" "}
                    <span style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>{totalsLive.totalQty.toLocaleString("vi-VN")}</span>
                  </div>
                </div>
                <div
                  style={{
                    background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                    borderRadius: 12,
                    padding: "10px 16px",
                    minWidth: 160,
                    color: "white",
                    boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  }}
                >
                  <div style={{ fontSize: 17, opacity: 0.9, marginBottom: 4 }}>
                    Tổng tiền: {" "}
                    <span style={{ fontSize: 17, fontWeight: 900 }}>{formatCurrency(totalsLive.totalCost)}</span>
                  </div>
                </div>
              </div>

              <Space size={12}>
                <Button size="large" onClick={closeModal}>
                  Đóng
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={submitForm}
                  style={{
                    background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                    border: "none",
                    fontWeight: 800,
                    borderRadius: 10,
                    padding: "0 28px",
                    boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  }}
                >
                  {editingVoucher ? "Cập nhật phiếu" : "Tạo phiếu kho"}
                </Button>
              </Space>
            </div>
          }
        >
          <Form
            form={form}
            layout="vertical"
            size="middle"
            requiredMark="optional"
            colon={false}
            onValuesChange={(changed) => {
              // Trigger totalsLive recalculation whenever form values change
              setFormChangeKey((k) => k + 1);

              if (Object.prototype.hasOwnProperty.call(changed, "type")) {
                const t = changed.type;
                if (t === "OUT") {
                  form.setFieldsValue({
                    supplier_id: null,
                    supplier_name_snapshot: "",
                    supplier_phone_snapshot: "",
                    supplier_email_snapshot: "",
                    supplier_address_snapshot: "",
                    supplier_taxcode_snapshot: "",
                    supplier_contact_person_snapshot: "",
                  });
                } else {
                  const rn = form.getFieldValue("receiver_name");
                  if (!rn) form.setFieldsValue({ receiver_name: userDisplayName || "", receiver_phone: userPhone || "" });
                }
              }
            }}
          >
            {/* THÔNG TIN PHIẾU */}
            <Card
              size="small"
              style={{
                borderRadius: 16,
                boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                border: "1px solid #e2e8f0",
                marginBottom: 12,
              }}
              bodyStyle={{ padding: "16px 20px" }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>📄</span> Thông tin phiếu
              </div>

              <Row gutter={20}>
                <Col xs={24} md={6}>
                  <Form.Item name="type" label="Loại phiếu" rules={[{ required: true, message: "Chọn loại phiếu" }]}>
                    <Select size="large" style={{ borderRadius: 10 }}>
                      <Option value="IN">NHẬP KHO</Option>
                      <Option value="OUT">XUẤT KHO</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="voucher_code" label="Số phiếu">
                    <Input placeholder="Để trống hệ thống tự sinh" disabled={!!editingVoucher} size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="voucher_date" label="Ngày chứng từ" rules={[{ required: true, message: "Chọn ngày" }]}>
                    <DatePicker style={{ width: "100%", borderRadius: 10 }} format="DD/MM/YYYY" size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="attached_docs" label="Số chứng từ kèm">
                    <InputNumber min={0} placeholder="Số chứng từ kèm theo" style={{ width: "100%", borderRadius: 10 }} size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: "Nhập lý do" }]}>
                    <Input placeholder="VD: Nhập hàng từ NCC / Xuất bán lẻ / Xuất hủy..." size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="deliverer_name" label="Người giao" rules={[{ required: true, message: "Nhập người giao" }]}>
                    <Input placeholder="Tự nhập hoặc chọn từ NCC" size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="receiver_name" label="Người nhận" rules={[{ required: true, message: "Nhập người nhận" }]}>
                    <Input placeholder="Mặc định là bạn (có thể sửa)" size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="deliverer_phone" label="SĐT người giao">
                    <Input placeholder="Tuỳ chọn" size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item name="receiver_phone" label="SĐT người nhận">
                    <Input placeholder="Tuỳ chọn" size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* NHÀ CUNG CẤP - chỉ cho phiếu NHẬP */}
            <Form.Item shouldUpdate noStyle>
              {() => {
                const t = form.getFieldValue("type");
                if (t !== "IN") return null;

                return (
                  <Card
                    size="small"
                    style={{
                      borderRadius: 16,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                      border: "1px solid #e2e8f0",
                      marginBottom: 12,
                    }}
                    bodyStyle={{ padding: "16px 20px" }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#0f172a",
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>🏢</span> Nhà cung cấp
                    </div>

                    <Row gutter={20}>
                      <Col xs={24} md={12}>
                        <Form.Item name="supplier_id" label="Chọn nhà cung cấp" rules={[{ required: true, message: "Chọn nhà cung cấp" }]}>
                          <Select
                            showSearch
                            allowClear
                            size="large"
                            placeholder="Tìm tên / SĐT / MST..."
                            options={supplierOptions}
                            filterOption={filterSupplierOption}
                            loading={loadingSuppliers}
                            onChange={(val) => val && setSupplierToForm(val)}
                            style={{ borderRadius: 10 }}
                            dropdownRender={(menu) => (
                              <div>
                                <div style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                  <Space size={8}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                      Không thấy Nhà cung cấp?
                                    </Text>
                                    <Button size="small" onClick={fetchSuppliers} loading={loadingSuppliers}>
                                      Tải lại
                                    </Button>
                                  </Space>
                                </div>
                                {menu}
                              </div>
                            )}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item name="supplier_phone_snapshot" label="SĐT">
                          <Input disabled size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item name="supplier_taxcode_snapshot" label="Mã số thuế">
                          <Input disabled size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item name="supplier_email_snapshot" label="Email">
                          <Input disabled size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item name="supplier_contact_person_snapshot" label="Người liên hệ">
                          <Input disabled size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item name="supplier_address_snapshot" label="Địa chỉ">
                          <Input disabled size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Form.Item name="supplier_name_snapshot" hidden>
                        <Input />
                      </Form.Item>
                    </Row>
                  </Card>
                );
              }}
            </Form.Item>

            {/* THÔNG TIN NÂNG CAO */}
            <Collapse
              size="large"
              style={{ borderRadius: 16, marginBottom: 12 }}
              items={[
                {
                  key: "adv",
                  label: (
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      <span style={{ marginRight: 8 }}>⚙️</span> Thông tin nâng cao
                    </span>
                  ),
                  children: (
                    <Row gutter={20}>
                      <Col xs={24} md={8}>
                        <Form.Item name="warehouse_id" label="Kho lưu trữ">
                          <Select
                            showSearch
                            allowClear
                            size="large"
                            placeholder="Chọn kho (mặc định theo cửa hàng)"
                            options={warehouseOptions}
                            loading={loadingWarehouses}
                            filterOption={filterWarehouseOption}
                            onChange={(val) =>
                              val ? setWarehouseToForm(val) : form.setFieldsValue({ warehouse_id: null, warehouse_name: "", warehousename: "" })
                            }
                            style={{ borderRadius: 10 }}
                            dropdownRender={(menu) => (
                              <div>
                                <div style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                  <Space size={8}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                      Không thấy kho?
                                    </Text>
                                    <Button size="small" onClick={fetchWarehouses} loading={loadingWarehouses}>
                                      Tải lại <ReloadOutlined style={{ marginRight: 6 }} />
                                    </Button>
                                  </Space>
                                </div>
                                {menu}
                              </div>
                            )}
                          />
                        </Form.Item>
                        <Form.Item name="warehouse_name" hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name="warehousename" hidden>
                          <Input />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={5}>
                        <Form.Item name="warehouse_location" label="Vị trí trong kho">
                          <Input placeholder="VD: Kệ A - Tầng 2 - Ô 05" size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={5}>
                        <Form.Item name="ref_no" label="Số chứng từ gốc">
                          <Input placeholder="VD: HD00123" size="large" style={{ borderRadius: 10 }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={6}>
                        <Form.Item name="ref_date" label="Ngày chứng từ gốc">
                          <DatePicker style={{ width: "100%", borderRadius: 10 }} format="DD/MM/YYYY" size="large" />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />

            {/* DANH SÁCH HÀNG HÓA */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>📋</span> Danh sách hàng hóa
              </div>

              <Card
                style={{
                  borderRadius: 16,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                  border: "1px solid #e2e8f0",
                }}
                bodyStyle={{ padding: 0 }}
              >
                {/* Header bảng */}
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "12px 20px",
                    borderBottom: "1px solid #e2e8f0",
                    borderRadius: "16px 16px 0 0",
                  }}
                >
                  <Row gutter={20} align="middle">
                    <Col xs={24} md={10}>
                      <div style={{ fontWeight: 700, color: "#334155" }}>Sản phẩm</div>
                    </Col>
                    <Col xs={8} md={3}>
                      <div style={{ fontWeight: 700, color: "#334155", textAlign: "center" }}>Số lượng</div>
                    </Col>
                    <Col xs={8} md={3}>
                      <div style={{ fontWeight: 700, color: "#334155", textAlign: "right" }}>Đơn giá</div>
                    </Col>
                    <Col xs={8} md={3}>
                      <div style={{ fontWeight: 700, color: "#334155", textAlign: "right" }}>Thành tiền</div>
                    </Col>
                    <Col xs={24} md={4}>
                      <div style={{ fontWeight: 700, color: "#334155" }}>Ghi chú</div>
                    </Col>
                    <Col xs={24} md={1} />
                  </Row>
                </div>

                <Form.List name="items">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }, idx) => (
                        <div
                          key={key}
                          style={{
                            padding: "12px 20px",
                            borderBottom: idx === fields.length - 1 ? "none" : "1px solid #f1f5f9",
                            background: idx % 2 === 0 ? "#ffffff" : "#fafbfc",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#ffffff" : "#fafbfc")}
                        >
                          <Row gutter={20} align="middle">
                            <Col xs={24} md={10}>
                              <Form.Item
                                {...restField}
                                name={[name, "product_id"]}
                                rules={[{ required: true, message: "Chọn sản phẩm" }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  showSearch
                                  placeholder="Tìm tên / SKU sản phẩm..."
                                  options={productOptions}
                                  filterOption={filterProductOption}
                                  size="large"
                                  style={{ borderRadius: 10 }}
                                  popupMatchSelectWidth={560}
                                  optionRender={(opt) => {
                                    const d = opt?.data;
                                    const meta = d?.meta || {};
                                    return (
                                      <div style={{ lineHeight: 1.3 }}>
                                        <div style={{ fontWeight: 700, ...S.ellipsis1 }}>
                                          {meta.name || d?.label} <Text type="secondary">(Mã sku: {meta.sku || "Trống"})</Text>
                                        </div>
                                        <div style={{ fontSize: 12, color: "#64748b" }}>
                                          Đơn vị tính:{" "}
                                          <Tag color="blue" style={{ fontSize: 12 }}>
                                            {meta.unit || "Trống"}
                                          </Tag>
                                          • Tồn:{" "}
                                          <Tag color="blue" style={{ fontSize: 12 }}>
                                            {(meta.stock ?? 0).toLocaleString("vi-VN")}
                                          </Tag>{" "}
                                          • Giá vốn:{" "}
                                          <Tag color="blue" style={{ fontSize: 12 }}>
                                            {formatCurrency(meta.cost ?? 0)}
                                          </Tag>
                                        </div>
                                      </div>
                                    );
                                  }}
                                  onChange={(val) => {
                                    const p = products.find((x) => String(getId(x)) === String(val));
                                    if (!p) return;

                                    const items = form.getFieldValue("items") || [];
                                    const next = items.map((it, i) => {
                                      if (i !== idx) return it;
                                      const currentUnitCost = it?.unit_cost !== undefined ? it.unit_cost : undefined;
                                      return {
                                        ...it,
                                        sku_snapshot: p.sku || "",
                                        name_snapshot: p.name || "",
                                        unit_snapshot: p.unit || "",
                                        unit_cost:
                                          currentUnitCost !== undefined ? currentUnitCost : toNumberDecimal(p.costprice ?? p.cost_price ?? 0),
                                      };
                                    });
                                    form.setFieldsValue({ items: next });
                                  }}
                                />
                              </Form.Item>
                            </Col>

                            <Col xs={8} md={3}>
                              <Form.Item
                                {...restField}
                                name={[name, "qty_actual"]}
                                rules={[
                                  { required: true, message: "Nhập Số lượng" },
                                  { type: "number", min: 1, message: "SL >= 1" },
                                ]}
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber min={1} style={{ width: "100%", borderRadius: 10 }} size="large" />
                              </Form.Item>
                            </Col>

                            <Col xs={8} md={3}>
                              <Form.Item {...restField} name={[name, "unit_cost"]} rules={[{ type: "number", min: 0 }]} style={{ marginBottom: 0 }}>
                                <InputNumber
                                  min={0}
                                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                  style={{ width: "100%", borderRadius: 10 }}
                                  size="large"
                                />
                              </Form.Item>
                            </Col>

                            <Col xs={8} md={3}>
                              <Form.Item shouldUpdate noStyle>
                                {() => {
                                  const items = form.getFieldValue("items") || [];
                                  const it = items[idx] || {};
                                  const line = computeLineCost(it?.qty_actual, it?.unit_cost);
                                  return (
                                    <div style={{ textAlign: "right", fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{formatCurrency(line)}</div>
                                  );
                                }}
                              </Form.Item>
                            </Col>

                            <Col xs={24} md={4}>
                              <Form.Item {...restField} name={[name, "note"]} style={{ marginBottom: 0 }}>
                                <Input placeholder="Ghi chú..." size="large" style={{ borderRadius: 10 }} />
                              </Form.Item>
                            </Col>

                            <Col xs={24} md={1} style={{ textAlign: "right" }}>
                              <Button
                                size="middle"
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => remove(name)}
                                style={{ borderRadius: 8 }}
                              />
                            </Col>

                            {/* Hidden fields */}
                            <Form.Item {...restField} name={[name, "sku_snapshot"]} hidden>
                              <Input />
                            </Form.Item>
                            <Form.Item {...restField} name={[name, "name_snapshot"]} hidden>
                              <Input />
                            </Form.Item>
                            <Form.Item {...restField} name={[name, "unit_snapshot"]} hidden>
                              <Input />
                            </Form.Item>
                          </Row>
                        </div>
                      ))}

                      <div style={{ padding: "12px 20px", background: "#f8fafc" }}>
                        <Button
                          block
                          size="large"
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ product_id: null, qty_actual: 1, unit_cost: 0, note: "" })}
                          style={{ height: 48, borderRadius: 12, fontWeight: 600 }}
                        >
                          Thêm dòng hàng hóa
                        </Button>
                      </div>
                    </>
                  )}
                </Form.List>
              </Card>
            </div>
          </Form>
        </Modal>

        {/* ===== DETAIL DRAWER ===== */}
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} width={980} title="Chi tiết phiếu kho" styles={{ body: { padding: 12 } }}>
          {drawerLoading ? (
            <Alert type="info" showIcon message="Đang tải..." />
          ) : !drawerVoucher ? (
            <Alert type="warning" showIcon message="Không có dữ liệu phiếu" />
          ) : (
            (() => {
              const totals = computeTotalsFromItems(drawerVoucher.items || []);
              const totalQty = drawerVoucher.total_qty ?? totals.totalQty;
              const totalCost = drawerVoucher.total_cost ?? totals.totalCost;

              return (
                <>
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Số phiếu">
                      <span style={S.wrapText}>
                        <b>{drawerVoucher.voucher_code}</b>
                      </span>
                    </Descriptions.Item>

                    <Descriptions.Item label="Loại">
                      <Tag color={typeColor(drawerVoucher.type)} style={{ marginInlineEnd: 0 }}>
                        {drawerVoucher.type === "IN" ? "NHẬP" : "XUẤT"}
                      </Tag>
                    </Descriptions.Item>

                    <Descriptions.Item label="Trạng thái">
                      {(() => {
                        const st = normalizeStatus(drawerVoucher.status);
                        return (
                          <Tag color={STATUS_COLOR[st]} style={{ marginInlineEnd: 0 }}>
                            {STATUS_LABEL[st] || "Trống"}
                          </Tag>
                        );
                      })()}
                    </Descriptions.Item>

                    <Descriptions.Item label="Ngày">
                      {drawerVoucher.voucher_date ? dayjs(drawerVoucher.voucher_date).format("DD/MM/YYYY") : "Trống"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Lý do">
                      <span style={S.wrapText}>{drawerVoucher.reason || "Trống"}</span>
                    </Descriptions.Item>

                    <Descriptions.Item label="Chứng từ kèm">{drawerVoucher.attached_docs ?? 0}</Descriptions.Item>

                    <Descriptions.Item label="Người giao">
                      <span style={S.wrapText}>{drawerVoucher.deliverer_name || "Trống"}</span>
                      {drawerVoucher.deliverer_phone && <div style={{ fontSize: 12, color: "#64748b" }}>SĐT: {drawerVoucher.deliverer_phone}</div>}
                    </Descriptions.Item>

                    <Descriptions.Item label="Người nhận">
                      <span style={S.wrapText}>{drawerVoucher.receiver_name || "Trống"}</span>
                      {drawerVoucher.receiver_phone && <div style={{ fontSize: 12, color: "#64748b" }}>SĐT: {drawerVoucher.receiver_phone}</div>}
                    </Descriptions.Item>

                    {/* NCC */}
                    <Descriptions.Item label="Nhà cung cấp" span={2}>
                      {drawerVoucher.supplier_name_snapshot ? (
                        <div style={{ ...S.wrapText, lineHeight: 1.3 }}>
                          <div>
                            <b>{drawerVoucher.supplier_name_snapshot || "Trống"}</b>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            {drawerVoucher.supplier_contact_person_snapshot && <>Liên hệ: {drawerVoucher.supplier_contact_person_snapshot} · </>}
                            {drawerVoucher.supplier_phone_snapshot && <>SĐT: {drawerVoucher.supplier_phone_snapshot} · </>}
                            {drawerVoucher.supplier_email_snapshot && <>Email: {drawerVoucher.supplier_email_snapshot} · </>}
                            {drawerVoucher.supplier_taxcode_snapshot && <>MST: {drawerVoucher.supplier_taxcode_snapshot}</>}
                          </div>
                          {drawerVoucher.supplier_address_snapshot && (
                            <div style={{ fontSize: 12, color: "#64748b" }}>Đ/c: {drawerVoucher.supplier_address_snapshot}</div>
                          )}
                        </div>
                      ) : (
                        <span>Trống</span>
                      )}
                    </Descriptions.Item>

                    <Descriptions.Item label="Kho">
                      <span style={S.wrapText}>{drawerVoucher.warehouse_name || "Trống"}</span>
                    </Descriptions.Item>

                    <Descriptions.Item label="Vị trí kho">
                      <span style={S.wrapText}>{drawerVoucher.warehouse_location || "Trống"}</span>
                    </Descriptions.Item>

                    <Descriptions.Item label="Chứng từ gốc (số)">
                      <span style={S.wrapText}>{drawerVoucher.ref_no || "Trống"}</span>
                    </Descriptions.Item>

                    <Descriptions.Item label="Chứng từ gốc">
                      {drawerVoucher.ref_date ? dayjs(drawerVoucher.ref_date).format("DD/MM/YYYY") : "Trống"}
                    </Descriptions.Item>

                    <Descriptions.Item label="Tổng số lượng">{Number(totalQty || 0).toLocaleString("vi-VN")}</Descriptions.Item>
                    <Descriptions.Item label="Tổng tiền">
                      <b>{formatCurrency(toNumberDecimal(totalCost))}</b>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider style={S.divider} />

                  <Table
                    size="small"
                    columns={itemColumns}
                    dataSource={drawerVoucher.items || []}
                    rowKey={(_, idx) => idx}
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                </>
              );
            })()
          )}
        </Drawer>
      </div>
    </Layout>
  );
}
