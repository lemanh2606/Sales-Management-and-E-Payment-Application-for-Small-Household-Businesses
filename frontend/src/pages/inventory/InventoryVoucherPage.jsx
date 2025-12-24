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
const normalizeStatus = (st) => String(st || "").trim().toUpperCase();

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

const formatCurrency = (n) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(n || 0));

const statusColor = (stRaw) => {
    const st = normalizeStatus(stRaw);
    switch (st) {
        case "DRAFT":
            return "default";
        case "APPROVED":
            return "blue";
        case "POSTED":
            return "green";
        case "CANCELLED":
            return "red";
        default:
            return "default";
    }
};

const typeColor = (t) => (t === "IN" ? "green" : "volcano");

const safeNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const computeLineCost = (qty, unitCost) => safeNumber(qty, 0) * safeNumber(unitCost, 0);

const computeTotalsFromItems = (items = []) => {
    const totalQty = (items || []).reduce((s, it) => s + safeNumber(it?.qty_actual, 0), 0);
    const totalCost = (items || []).reduce(
        (s, it) => s + computeLineCost(it?.qty_actual, toNumberDecimal(it?.unit_cost)),
        0
    );
    return { totalQty, totalCost };
};

// ====== UI styles (gọn + đẹp + chống tràn) ======
const S = {
    page: { padding: 8, minHeight: "100vh" },
    card: { borderRadius: 12, border: "1px solid #e5e7eb" },
    divider: { margin: "10px 0" },
    tableWrap: { overflowX: "auto" },
    rowGutter: [8, 8],

    pill: {
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 12,
        color: "#334155",
        whiteSpace: "nowrap",
    },

    modalBody: { padding: 12, maxHeight: "calc(100vh - 180px)", overflowY: "auto" },
    modalFooter: {
        padding: "10px 12px",
        borderTop: "1px solid #eef2f7",
        background: "#fff",
    },

    ellipsis1: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    wrapText: { wordBreak: "break-word", overflowWrap: "anywhere" },

    sectionCard: {
        borderRadius: 12,
        border: "1px solid #eef2f7",
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
        border: "1px solid #eef2f7",
        overflow: "hidden",
    },
    itemsHeader: {
        background: "#f8fafc",
        borderBottom: "1px solid #eef2f7",
        padding: "8px 10px",
    },
    itemsRow: {
        padding: "10px 10px",
        borderBottom: "1px solid #f1f5f9",
    },
    itemsRowLast: {
        padding: "10px 10px",
    },
    headerCell: { fontSize: 12, color: "#64748b", fontWeight: 600 },
    moneyBox: {
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
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

    const userDisplayName =
        userObj?.fullName || userObj?.fullname || userObj?.name || userObj?.username || userObj?.email || "";

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
        const s = String(input || "").trim().toLowerCase();
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

            const address =
                w?.address ||
                [w?.ward, w?.district, w?.city].filter(Boolean).join(", ");

            return {
                value: String(id),
                label,
                searchText: `${name} ${code} ${address}`.toLowerCase(),
                meta: { id: String(id), name, code, address },
            };
        });
    }, [warehouses]);
    const filterWarehouseOption = (input, option) => {
        const s = String(input || "").trim().toLowerCase();
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
            warehouselocation: w?.address || "",
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

            warehouselocation: defaultWh?.address || "",
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
                    description: isManager ? "Phiếu đã tạo. Có thể duyệt/ghi sổ." : "Phiếu đã tạo (DRAFT) chờ MANAGER duyệt.",
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
            title: "Xóa phiếu kho?",
            icon: <ExclamationCircleOutlined />,
            content: `Bạn có chắc muốn xóa phiếu ${record.voucher_code}? (chỉ xóa được DRAFT)`,
            okText: "Xóa",
            cancelText: "Hủy",
            okButtonProps: { danger: true },
            onOk: async () => {
                await deleteInventoryVoucher(storeId, getId(record));
                api.success({ message: "Đã xóa", description: record.voucher_code, placement: "topRight" });
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
            title: "Hủy phiếu kho?",
            icon: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
            content: (
                <div style={S.wrapText}>
                    <div style={{ marginBottom: 8 }}>
                        Nhập lý do hủy (tuỳ chọn) cho phiếu <b>{record.voucher_code}</b>
                    </div>
                    <Input size="small" onChange={(e) => (reason = e.target.value)} placeholder="Lý do hủy..." />
                </div>
            ),
            okText: "Hủy phiếu",
            cancelText: "Đóng",
            okButtonProps: { danger: true },
            onOk: async () => {
                await cancelInventoryVoucher(storeId, getId(record), { cancel_reason: reason });
                api.success({ message: "Đã hủy phiếu", description: record.voucher_code, placement: "topRight" });
                fetchVouchers({ page: meta.page });
            },
        });
    };

    const doReverse = (record) => {
        modal.confirm({
            title: "Đảo phiếu (tạo phiếu đảo)?",
            icon: <SwapOutlined />,
            content: `Bạn có chắc muốn đảo phiếu ${record.voucher_code}? Hệ thống sẽ tạo phiếu ngược lại và cập nhật tồn kho.`,
            okText: "Đảo phiếu",
            cancelText: "Hủy",
            onOk: async () => {
                await reverseInventoryVoucher(storeId, getId(record));
                api.success({ message: "Đã đảo phiếu", description: record.voucher_code, placement: "topRight" });
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
            const unit = p.unit || "-";
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
        const s = String(input || "").trim().toLowerCase();
        if (!s) return true;
        return String(option?.searchText || "").includes(s);
    };

    // Drawer item table
    const itemColumns = [
        {
            title: "Sản phẩm",
            key: "product",
            width: 360,
            ellipsis: true,
            render: (_, it) => (
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, ...S.ellipsis1 }}>
                        {it?.name_snapshot || it?.product_id?.name || "-"}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, ...S.ellipsis1, display: "block" }}>
                        SKU: {it?.sku_snapshot || it?.product_id?.sku || "N/A"} | ĐV: {it?.unit_snapshot || it?.product_id?.unit || "-"}
                    </Text>
                </div>
            ),
        },
        {
            title: "SL",
            dataIndex: "qty_actual",
            key: "qty_actual",
            width: 70,
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
            width: 140,
            align: "right",
            render: (_, it) => {
                const line = computeLineCost(it?.qty_actual, toNumberDecimal(it?.unit_cost));
                return <Text strong>{formatCurrency(line)}</Text>;
            },
        },
        {
            title: "Ghi chú",
            dataIndex: "note",
            key: "note",
            width: 220,
            ellipsis: true,
            render: (v) => <span style={S.ellipsis1}>{v || "-"}</span>,
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
            render: (t) => (
                <Tag color={statusColor(t)} style={{ marginInlineEnd: 0 }}>
                    {normalizeStatus(t) || "-"}
                </Tag>
            ),
        },
        {
            title: "Ngày",
            dataIndex: "voucher_date",
            key: "voucher_date",
            width: 110,
            align: "center",
            render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
        },
        {
            title: "Lý do",
            dataIndex: "reason",
            key: "reason",
            width: 240,
            ellipsis: true,
            render: (v) => <span style={S.ellipsis1}>{v || "-"}</span>,
        },
        {
            title: "Tổng SL",
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
            width: 130,
            align: "right",
            render: (v, r) => {
                const cost = v ?? computeTotalsFromItems(r?.items || []).totalCost;
                return <Text strong>{formatCurrency(toNumberDecimal(cost))}</Text>;
            },
        },
        {
            title: "Thao tác",
            key: "actions",
            width: 270,
            fixed: "right",
            render: (_, record) => {
                const st = normalizeStatus(record.status);
                const canEdit = st === "DRAFT";
                const canApprove = st === "DRAFT" && isManager;
                const canPost = (st === "APPROVED" || st === "DRAFT") && isManager;
                const canReverse = st === "POSTED" && isManager;
                const canCancel = st !== "POSTED" && st !== "CANCELLED";

                return (
                    <Space size={6} wrap>
                        <Tooltip title="Xem chi tiết">
                            <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(record)} />
                        </Tooltip>

                        <Tooltip title={canEdit ? "Sửa (DRAFT)" : "Chỉ sửa được DRAFT"}>
                            <Button size="small" icon={<EditOutlined />} disabled={!canEdit} onClick={() => openEditModal(record)} type="primary" />
                        </Tooltip>

                        <Tooltip title={canEdit ? "Xóa (DRAFT)" : "Chỉ xóa được DRAFT"}>
                            <Button size="small" icon={<DeleteOutlined />} danger disabled={!canEdit} onClick={() => doDeleteDraft(record)} />
                        </Tooltip>

                        <Tooltip title={isManager ? "Duyệt phiếu" : "Chỉ MANAGER duyệt"}>
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
                );
            },
        },
    ];

    const totalsLive = useMemo(() => {
        const items = form.getFieldValue("items") || [];
        return computeTotalsFromItems(items);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, isModalOpen]);

    if (!storeId) {
        return (
            <Layout>
                {notificationContextHolder}
                {modalContextHolder}
                <Card size="small" style={S.card}>
                    <Alert
                        type="warning"
                        showIcon
                        message="Chưa chọn cửa hàng"
                        description="Vui lòng chọn cửa hàng trước khi quản lý phiếu nhập/xuất kho."
                    />
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
                            <Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
                                Phiếu nhập xuất kho
                            </Title>
                            <div style={{ marginTop: 4 }}>
                                <Space size={8} wrap>
                                    <span style={S.pill}>Role: {userRole || "N/A"}</span>
                                    <span style={S.pill}>NCC: {suppliers.length}</span>
                                </Space>
                            </div>
                        </Col>

                        <Col>
                            <Space size={8} wrap>
                                <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchVouchers({ page: meta.page })} loading={loading}>
                                    Làm mới
                                </Button>

                                <Button
                                    size="small"
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
                                    <Button size="small" onClick={fetchSuppliers} loading={loadingSuppliers}>
                                        Tải NCC
                                    </Button>
                                </Tooltip>

                                <Tooltip title="Tải danh sách sản phẩm (để chọn nhanh)">
                                    <Button size="small" onClick={fetchProducts} loading={loadingProducts}>
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
                                size="small"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Tìm số phiếu, lý do, người giao/nhận..."
                                allowClear
                            />
                        </Col>

                        <Col xs={12} md={4}>
                            <Select size="small" value={type} onChange={setType} allowClear placeholder="Loại" style={{ width: "100%" }}>
                                <Option value="IN">NHẬP</Option>
                                <Option value="OUT">XUẤT</Option>
                            </Select>
                        </Col>

                        <Col xs={12} md={5}>
                            <Select size="small" value={status} onChange={setStatus} allowClear placeholder="Trạng thái" style={{ width: "100%" }}>
                                <Option value="DRAFT">DRAFT</Option>
                                <Option value="APPROVED">APPROVED</Option>
                                <Option value="POSTED">POSTED</Option>
                                <Option value="CANCELLED">CANCELLED</Option>
                            </Select>
                        </Col>

                        <Col xs={24} md={7}>
                            <DatePicker.RangePicker
                                size="small"
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
                    width={980}
                    centered
                    styles={{ body: S.modalBody, footer: S.modalFooter }}
                    title={
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: "#0f172a", ...S.ellipsis1 }}>
                                {editingVoucher ? "Cập nhật phiếu kho (DRAFT)" : "Tạo phiếu kho"}
                            </div>
                            {!isManager && !editingVoucher ? <Tag color="gold">STAFF: chờ MANAGER duyệt</Tag> : null}
                        </div>
                    }
                    footer={
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <div style={S.moneyBox}>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>Tổng SL</div>
                                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{totalsLive.totalQty.toLocaleString("vi-VN")}</div>
                                </div>
                                <div style={S.moneyBox}>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>Tổng tiền</div>
                                    <div style={{ fontWeight: 900, color: "#0f172a" }}>{formatCurrency(totalsLive.totalCost)}</div>
                                </div>
                            </div>

                            <Space size={8}>
                                <Button onClick={closeModal}>Đóng</Button>
                                <Button
                                    type="primary"
                                    onClick={submitForm}
                                    style={{
                                        background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
                                        border: "none",
                                        fontWeight: 800,
                                    }}
                                >
                                    {editingVoucher ? "Cập nhật" : "Tạo phiếu"}
                                </Button>
                            </Space>
                        </div>
                    }
                >
                    <Form
                        form={form}
                        layout="vertical"
                        size="small"
                        requiredMark="optional"
                        colon={false}
                        onValuesChange={(changed) => {
                            // nếu đổi type: IN/OUT -> nếu OUT thì clear supplier
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
                                    // IN: auto-fill người nhận nếu đang trống
                                    const rn = form.getFieldValue("receiver_name");
                                    if (!rn) form.setFieldsValue({ receiver_name: userDisplayName || "", receiver_phone: userPhone || "" });
                                }
                            }
                        }}
                    >
                        {/* THÔNG TIN PHIẾU */}
                        <Card size="small" style={S.sectionCard}>
                            <div style={S.sectionTitle}>Thông tin phiếu</div>

                            <Row gutter={S.rowGutter}>
                                <Col xs={24} md={6}>
                                    <Form.Item name="type" label="Loại phiếu" rules={[{ required: true, message: "Chọn loại phiếu" }]} style={{ marginBottom: 10 }}>
                                        <Select>
                                            <Option value="IN">NHẬP</Option>
                                            <Option value="OUT">XUẤT</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={6}>
                                    <Form.Item name="voucher_code" label="Số phiếu (tuỳ chọn)" style={{ marginBottom: 10 }}>
                                        <Input placeholder="Để trống hệ thống tự sinh" disabled={!!editingVoucher} />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={6}>
                                    <Form.Item name="voucher_date" label="Ngày chứng từ" rules={[{ required: true, message: "Chọn ngày" }]} style={{ marginBottom: 10 }}>
                                        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={6}>
                                    <Form.Item name="attached_docs" label="CT kèm (tuỳ chọn)" rules={[{ type: "number", min: 0, message: "Phải >= 0" }]} style={{ marginBottom: 10 }}>
                                        <InputNumber min={0} style={{ width: "100%" }} />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={12}>
                                    <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: "Nhập lý do" }]} style={{ marginBottom: 0 }}>
                                        <Input placeholder="VD: Nhập hàng / Xuất bán / Xuất hủy..." />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={6}>
                                    <Form.Item name="deliverer_name" label="Người giao" rules={[{ required: true, message: "Nhập người giao" }]} style={{ marginBottom: 0 }}>
                                        <Input placeholder="Tự nhập hoặc chọn NCC (phiếu nhập)" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={6}>
                                    <Form.Item name="receiver_name" label="Người nhận" rules={[{ required: true, message: "Nhập người nhận" }]} style={{ marginBottom: 0 }}>
                                        <Input placeholder="Tự động theo user (có thể sửa)" />
                                    </Form.Item>
                                </Col>

                                {/* phone row (NEW) */}
                                <Col xs={24} md={6}>
                                    <Form.Item name="deliverer_phone" label="SĐT người giao (tuỳ chọn)" style={{ marginBottom: 0, marginTop: 10 }}>
                                        <Input placeholder="Tự động theo NCC nếu có" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={6}>
                                    <Form.Item name="receiver_phone" label="SĐT người nhận (tuỳ chọn)" style={{ marginBottom: 0, marginTop: 10 }}>
                                        <Input placeholder="Tự động theo user nếu có" />
                                    </Form.Item>
                                </Col>

                                <Col xs={24} md={12} />
                            </Row>
                        </Card>

                        {/* NCC: chỉ áp dụng cho IN */}
                        <Form.Item shouldUpdate noStyle>
                            {() => {
                                const t = form.getFieldValue("type");
                                if (t !== "IN") return null;

                                return (
                                    <div style={{ marginTop: 10 }}>
                                        <Card size="small" style={S.sectionCard}>
                                            <div style={S.sectionTitle}>Nhà cung cấp (phiếu nhập)</div>

                                            <Row gutter={S.rowGutter}>
                                                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                                                    <Form.Item
                                                        name="supplier_id"
                                                        label="Chọn nhà cung cấp"
                                                        rules={[{ required: true, message: "Chọn nhà cung cấp" }]}
                                                        style={{ marginBottom: 10 }}
                                                    >
                                                        <Select
                                                            showSearch
                                                            allowClear
                                                            placeholder="Tìm theo tên / SĐT / MST..."
                                                            options={supplierOptions}
                                                            filterOption={filterSupplierOption}
                                                            loading={loadingSuppliers}
                                                            onChange={(val) => {
                                                                if (!val) return;
                                                                setSupplierToForm(val);
                                                            }}
                                                            dropdownRender={(menu) => (
                                                                <div>
                                                                    <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                                                        <Space size={8} wrap>
                                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                                Không thấy NCC?
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
                                                    <Form.Item name="supplier_phone_snapshot" label="SĐT NCC" style={{ marginBottom: 10 }}>
                                                        <Input disabled placeholder="Tự động" />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24} md={6}>
                                                    <Form.Item name="supplier_taxcode_snapshot" label="MST" style={{ marginBottom: 10 }}>
                                                        <Input disabled placeholder="Tự động" />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24} md={12}>
                                                    <Form.Item name="supplier_email_snapshot" label="Email" style={{ marginBottom: 10 }}>
                                                        <Input disabled placeholder="Tự động" />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24} md={12}>
                                                    <Form.Item name="supplier_contact_person_snapshot" label="Người liên hệ" style={{ marginBottom: 10 }}>
                                                        <Input disabled placeholder="Tự động" />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24}>
                                                    <Form.Item name="supplier_address_snapshot" label="Địa chỉ" style={{ marginBottom: 0 }}>
                                                        <Input disabled placeholder="Tự động" />
                                                    </Form.Item>
                                                </Col>

                                                {/* hidden: name snapshot */}
                                                <Form.Item name="supplier_name_snapshot" hidden>
                                                    <Input />
                                                </Form.Item>
                                            </Row>
                                        </Card>
                                    </div>
                                );
                            }}
                        </Form.Item>

                        {/* NÂNG CAO */}
                        <div style={{ marginTop: 10 }}>
                            <Collapse
                                size="small"
                                items={[
                                    {
                                        key: "adv",
                                        label: "Thông tin nâng cao ",
                                        children: (
                                            <Row gutter={S.rowGutter}>
                                                <Col xs={24} md={6}>
                                                    {/* <Form.Item name="warehouse_name" label="Kho" style={{ marginBottom: 10 }}>
                                                        <Input placeholder="VD: Kho chính" />
                                                    </Form.Item> */}
                                                    <Col xs={24} md={12} style={{ minWidth: 0 }}>
                                                        <Form.Item name="warehouse_id" label="Chọn kho" style={{ marginBottom: 10 }}>
                                                            <Select
                                                                showSearch
                                                                allowClear
                                                                placeholder="Chọn kho (mặc định lấy theo cửa hàng)"
                                                                options={warehouseOptions}
                                                                loading={loadingWarehouses}
                                                                filterOption={filterWarehouseOption}
                                                                onChange={(val) => {
                                                                    if (!val) {
                                                                        form.setFieldsValue({
                                                                            warehouse_id: null,
                                                                            warehouse_name: "",
                                                                            warehousename: "",
                                                                        });
                                                                        return;
                                                                    }
                                                                    setWarehouseToForm(val);
                                                                }}
                                                                dropdownRender={(menu) => (
                                                                    <div>
                                                                        <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                                                                            <Space size={8} wrap>
                                                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                                                    Không thấy kho?
                                                                                </Text>
                                                                                <Button size="small" onClick={fetchWarehouses} loading={loadingWarehouses}>
                                                                                    Tải lại
                                                                                </Button>
                                                                            </Space>
                                                                        </div>
                                                                        {menu}
                                                                    </div>
                                                                )}
                                                            />
                                                        </Form.Item>

                                                        {/* Giữ hidden để backend nhận warehouse_name nếu cần */}
                                                        <Form.Item name="warehouse_name" hidden>
                                                            <Input />
                                                        </Form.Item>

                                                        {/* Backward compatible với UI/Drawer cũ đang hiển thị warehousename */}
                                                        <Form.Item name="warehousename" hidden>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>

                                                </Col>

                                                <Col xs={24} md={6}>
                                                    <Form.Item name="warehouse_location" rules={[{ required: true }]} label="Vị trí kho" style={{ marginBottom: 10 }}>
                                                        <Input placeholder="VD: Kệ A - Tầng 2 - Ô 05" />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24} md={6}>
                                                    <Form.Item name="ref_no" label="Số CT gốc" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                                                        <Input placeholder="VD: HĐ 000123" />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24} md={6}>
                                                    <Form.Item name="ref_date" label="Ngày CT gốc" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        ),
                                    },
                                ]}
                            />
                        </div>

                        <Divider style={S.divider} />

                        {/* HÀNG HÓA */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Danh sách hàng</div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Tìm theo tên/SKU trong ô chọn sản phẩm.
                            </Text>
                        </div>

                        <Card size="small" style={S.itemsCard} bodyStyle={{ padding: 0 }}>
                            <div style={S.itemsHeader}>
                                <Row gutter={S.rowGutter} align="middle">
                                    <Col xs={24} md={10}><div style={S.headerCell}>Sản phẩm</div></Col>
                                    <Col xs={8} md={3}><div style={S.headerCell}>Số lượng</div></Col>
                                    <Col xs={8} md={3}><div style={S.headerCell}>Đơn giá</div></Col>
                                    <Col xs={8} md={3}><div style={S.headerCell}>Thành tiền</div></Col>
                                    <Col xs={24} md={4}><div style={S.headerCell}>Ghi chú</div></Col>
                                    <Col xs={24} md={1}><div style={S.headerCell}>&nbsp;</div></Col>
                                </Row>
                            </div>

                            <Form.List name="items">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }, idx) => (
                                            <div key={key} style={idx === fields.length - 1 ? S.itemsRowLast : S.itemsRow}>
                                                <Row gutter={S.rowGutter} align="middle">
                                                    <Col xs={24} md={10} style={{ minWidth: 0 }}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, "product_id"]}
                                                            rules={[{ required: true, message: "Chọn sản phẩm" }]}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <Select
                                                                showSearch
                                                                placeholder="Chọn sản phẩm"
                                                                options={productOptions}
                                                                filterOption={filterProductOption}
                                                                popupMatchSelectWidth={520}
                                                                optionRender={(opt) => {
                                                                    const d = opt?.data;
                                                                    const meta = d?.meta || {};
                                                                    return (
                                                                        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
                                                                            <div style={{ fontWeight: 700, ...S.ellipsis1 }}>
                                                                                {meta.name || d?.label} <Text type="secondary">({meta.sku || "N/A"})</Text>
                                                                            </div>
                                                                            <div style={{ fontSize: 12, color: "#64748b", ...S.ellipsis1 }}>
                                                                                ĐVT: {meta.unit || "-"} • Tồn: {(meta.stock ?? 0).toLocaleString("vi-VN")} • Giá vốn: {formatCurrency(meta.cost ?? 0)} • Giá bán: {formatCurrency(meta.price ?? 0)}
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
                                                                        const currentUnitCost =
                                                                            it?.unit_cost !== undefined && it?.unit_cost !== null ? it.unit_cost : undefined;

                                                                        return {
                                                                            ...it,
                                                                            sku_snapshot: p.sku || "",
                                                                            name_snapshot: p.name || "",
                                                                            unit_snapshot: p.unit || "",
                                                                            unit_cost:
                                                                                currentUnitCost !== undefined
                                                                                    ? currentUnitCost
                                                                                    : toNumberDecimal(p.costprice ?? p.cost_price ?? 0),
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
                                                                { required: true, message: "Nhập SL" },
                                                                { type: "number", min: 1, message: "SL >= 1" },
                                                            ]}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <InputNumber min={1} style={{ width: "100%" }} />
                                                        </Form.Item>
                                                    </Col>

                                                    <Col xs={8} md={3}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, "unit_cost"]}
                                                            rules={[{ type: "number", min: 0, message: ">= 0" }]}
                                                            style={{ marginBottom: 0 }}
                                                        >
                                                            <InputNumber min={0} style={{ width: "100%" }} />
                                                        </Form.Item>
                                                    </Col>

                                                    <Col xs={8} md={3}>
                                                        <Form.Item shouldUpdate noStyle>
                                                            {() => {
                                                                const items = form.getFieldValue("items") || [];
                                                                const it = items[idx] || {};
                                                                const line = computeLineCost(it?.qty_actual, it?.unit_cost);
                                                                return (
                                                                    <div style={{ textAlign: "right", paddingRight: 6, ...S.ellipsis1 }}>
                                                                        <Text strong>{formatCurrency(line)}</Text>
                                                                    </div>
                                                                );
                                                            }}
                                                        </Form.Item>
                                                    </Col>

                                                    <Col xs={24} md={4} style={{ minWidth: 0 }}>
                                                        <Form.Item {...restField} name={[name, "note"]} style={{ marginBottom: 0 }}>
                                                            <Input placeholder="Tuỳ chọn" />
                                                        </Form.Item>
                                                    </Col>

                                                    <Col xs={24} md={1} style={{ display: "flex", justifyContent: "flex-end" }}>
                                                        <Tooltip title="Xóa dòng">
                                                            <Button
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={() => remove(name)}
                                                            />
                                                        </Tooltip>
                                                    </Col>

                                                    {/* hidden snapshots */}
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

                                        <div style={{ padding: "10px 10px" }}>
                                            <Button
                                                block
                                                size="small"
                                                type="dashed"
                                                icon={<PlusOutlined />}
                                                onClick={() => add({ product_id: null, qty_actual: 1, unit_cost: 0, note: "" })}
                                            >
                                                Thêm dòng hàng
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form.List>
                        </Card>
                    </Form>
                </Modal>

                {/* ===== DETAIL DRAWER ===== */}
                <Drawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    width={980}
                    title="Chi tiết phiếu kho"
                    styles={{ body: { padding: 12 } }}
                >
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
                                            <Tag color={statusColor(drawerVoucher.status)} style={{ marginInlineEnd: 0 }}>
                                                {normalizeStatus(drawerVoucher.status)}
                                            </Tag>
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Ngày">
                                            {drawerVoucher.voucher_date ? dayjs(drawerVoucher.voucher_date).format("DD/MM/YYYY") : "-"}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Lý do">
                                            <span style={S.wrapText}>{drawerVoucher.reason || "-"}</span>
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Chứng từ kèm">
                                            {drawerVoucher.attached_docs ?? 0}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Người giao">
                                            <span style={S.wrapText}>{drawerVoucher.deliverer_name || "-"}</span>
                                            {drawerVoucher.deliverer_phone && (
                                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                                    SĐT: {drawerVoucher.deliverer_phone}
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Người nhận">
                                            <span style={S.wrapText}>{drawerVoucher.receiver_name || "-"}</span>
                                            {drawerVoucher.receiver_phone && (
                                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                                    SĐT: {drawerVoucher.receiver_phone}
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        {/* NCC */}
                                        <Descriptions.Item label="Nhà cung cấp" span={2}>
                                            {drawerVoucher.supplier_name_snapshot ? (
                                                <div style={{ ...S.wrapText, lineHeight: 1.3 }}>
                                                    <div><b>{drawerVoucher.supplier_name_snapshot}</b></div>
                                                    <div style={{ fontSize: 12, color: "#64748b" }}>
                                                        {drawerVoucher.supplier_contact_person_snapshot && (
                                                            <>Liên hệ: {drawerVoucher.supplier_contact_person_snapshot} · </>
                                                        )}
                                                        {drawerVoucher.supplier_phone_snapshot && (
                                                            <>SĐT: {drawerVoucher.supplier_phone_snapshot} · </>
                                                        )}
                                                        {drawerVoucher.supplier_email_snapshot && (
                                                            <>Email: {drawerVoucher.supplier_email_snapshot} · </>
                                                        )}
                                                        {drawerVoucher.supplier_taxcode_snapshot && (
                                                            <>MST: {drawerVoucher.supplier_taxcode_snapshot}</>
                                                        )}
                                                    </div>
                                                    {drawerVoucher.supplier_address_snapshot && (
                                                        <div style={{ fontSize: 12, color: "#64748b" }}>
                                                            Đ/c: {drawerVoucher.supplier_address_snapshot}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Kho">
                                            <span style={S.wrapText}>{drawerVoucher.warehouse_name || "-"}</span>
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Vị trí kho">
                                            <span style={S.wrapText}>{drawerVoucher.warehouse_location || "-"}</span>
                                        </Descriptions.Item>

                                        <Descriptions.Item label="CT gốc (số)">
                                            <span style={S.wrapText}>{drawerVoucher.ref_no || "-"}</span>
                                        </Descriptions.Item>

                                        <Descriptions.Item label="CT gốc (ngày)">
                                            {drawerVoucher.ref_date ? dayjs(drawerVoucher.ref_date).format("DD/MM/YYYY") : "-"}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="Tổng SL">
                                            {Number(totalQty || 0).toLocaleString("vi-VN")}
                                        </Descriptions.Item>
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
