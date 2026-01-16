// src/pages/product/ProductListPage.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  Table,
  Button,
  Modal,
  Space,
  Typography,
  Card,
  Input,
  InputNumber,
  Tag,
  Tooltip,
  notification,
  Dropdown,
  Checkbox,
  Image,
  Statistic,
  Row,
  Col,
  Badge,
  Divider,
  Drawer,
  AutoComplete,
  Alert,
  Select,
  Form,
  DatePicker,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  SettingOutlined,
  AppstoreOutlined,
  DollarOutlined,
  StockOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ShoppingOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  MenuOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  CalendarOutlined, //  icon cho Expiry
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import ProductForm from "../../components/product/ProductForm";
import {
  getProductsByStore,
  importProductsByExcel,
  exportProducts,
} from "../../api/productApi";
import { getWarehouses } from "../../api/warehouseApi"; //  NEW
import * as XLSX from "xlsx";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const apiUrl = import.meta.env.VITE_API_URL;

export default function ProductListPage() {
  const [api, contextHolder] = notification.useNotification();

  const storeObj =
    JSON.parse(localStorage.getItem("currentStore") || "null") || {};
  const storeId = storeObj._id || storeObj.id || null;
  const userObj = JSON.parse(localStorage.getItem("user") || "null") || {}; //  NEW
  const token = localStorage.getItem("token");

  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [editingBatch, setEditingBatch] = useState(null); // State cho việc edit lô hàng
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [warehouses, setWarehouses] = useState([]); //  NEW: Dân sách kho hàng

  //  thêm warehouse
  const allColumns = [
    { key: "name", label: "Tên sản phẩm", default: true },
    { key: "sku", label: "SKU", default: true },
    { key: "warehouse", label: "Kho hàng", default: true }, //  NEW
    { key: "price", label: "Giá bán", default: true },
    { key: "stock_quantity", label: "Tồn kho", default: true },
    { key: "status", label: "Trạng thái", default: true },
    { key: "cost_price", label: "Giá vốn", default: true },
    { key: "supplier", label: "Nhà cung cấp", default: false },
    { key: "group", label: "Nhóm sản phẩm", default: false },
    { key: "unit", label: "Đơn vị", default: true },
    { key: "min_stock", label: "Tồn tối thiểu", default: false },
    { key: "max_stock", label: "Tồn tối đa", default: false },
    { key: "image", label: "Hình ảnh", default: false },
    { key: "expiry", label: "Hạn sử dụng", default: true }, //  NEW
    { key: "createdAt", label: "Ngày nhập", default: false },
    { key: "updatedAt", label: "Cập nhật", default: false },
  ];

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("productVisibleColumns");
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn("Không thể tải cấu hình cột:", err);
    }
    return allColumns.filter((col) => col.default).map((col) => col.key);
  });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const fileInputRef = useRef(null);

  const handleDownloadTemplate = async () => {
    if (!token) {
      api.warning({
        message: "⚠️ Chưa đăng nhập",
        description: "Vui lòng đăng nhập lại để tải template.",
        placement: "topRight",
      });
      return;
    }

    try {
      setDownloadingTemplate(true);
      const response = await fetch(
        `${apiUrl}/products/template/download?format=excel`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok)
        throw new Error(`Không thể tải template (mã ${response.status})`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "product_template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      api.success({
        message: " Đã tải template",
        description: "Vui lòng nhập dữ liệu theo file vừa tải.",
        placement: "topRight",
      });
    } catch (err) {
      console.error("Download template failed", err);
      api.error({
        message: " Tải template thất bại",
        description: err?.message || "Vui lòng thử lại sau.",
        placement: "topRight",
      });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchProducts = async (showNotification = false) => {
    if (!storeId) {
      api.warning({
        message: "⚠️ Chưa chọn cửa hàng",
        description: "Vui lòng chọn cửa hàng để xem danh sách sản phẩm",
        placement: "topRight",
        duration: 3,
      });
      return;
    }

    try {
      setLoading(true);
      const data = await getProductsByStore(storeId, { page: 1, limit: 10000 });
      const productList = Array.isArray(data?.products) ? data.products : [];
      setAllProducts(productList);
      setFilteredProducts(productList);

      if (showNotification) {
        api.success({
          message: "🎯 Tải dữ liệu thành công",
          description: `Đã tải ${productList.length} sản phẩm vào hệ thống`,
          placement: "topRight",
          duration: 3,
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
      api.error({
        message: " Lỗi tải dữ liệu",
        description:
          err?.message || "Không thể tải danh sách sản phẩm. Vui lòng thử lại.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    if (!storeId) return;
    try {
      const data = await getWarehouses(storeId);
      setWarehouses(data?.warehouses || []);
    } catch (err) {
      console.error("Lỗi tải danh sách kho:", err);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchProducts();
      fetchWarehouses();
    }
  }, [storeId]);

  const [viewMode, setViewMode] = useState("merge"); // "merge" | "split"

  // Logic làm phẳng (flatten) sản phẩm theo lô - PHẢI ĐỊNH NGHĨA TRƯỚC handleViewModeChange
  const flattenProducts = useMemo(() => {
    return allProducts.reduce((acc, product) => {
      const batches =
        product.batches && product.batches.length > 0
          ? product.batches.filter((b) => b.quantity > 0) // Chỉ lấy lô còn hàng
          : [];

      if (batches.length === 0) {
        // Nếu không có lô hoặc hết hàng -> giữ nguyên 1 dòng
        acc.push({ ...product, uniqueId: product._id, isBatch: false });
      } else {
        // Tách mỗi lô thành 1 dòng
        batches.forEach((batch, index) => {
          acc.push({
            ...product, // Kế thừa thông tin chung
            uniqueId: `${product._id}_${batch.batch_no}_${index}`,
            isBatch: true,
            // Override thông tin riêng của lô
            stock_quantity: batch.quantity,
            cost_price: batch.cost_price,
            expiry_date: batch.expiry_date,
            batch_no: batch.batch_no,
            warehouse: batch.warehouse_id || product.warehouse, // Lấy kho của lô nếu có
            createdAt: batch.created_at || product.createdAt, // Ngày nhập của lô
          });
        });
      }
      return acc;
    }, []);
  }, [allProducts]);

  // Xử lý chuyển chế độ xem - reset dữ liệu bảng để render lại đúng
  const handleViewModeChange = useCallback(
    (newMode) => {
      // 1. Reset state trước
      setExpandedRowKeys([]);
      setFilteredProducts([]); // Clear table data để tránh hiển thị sai
      setCurrentPage(1);

      // 2. Đổi viewMode - dùng setTimeout để đảm bảo render lại hoàn toàn
      setTimeout(() => {
        setViewMode(newMode);
        // 3. Set lại dữ liệu dựa trên mode mới
        const newData = newMode === "split" ? flattenProducts : allProducts;
        if (!searchValue.trim()) {
          setFilteredProducts(newData);
        } else {
          const searchLower = searchValue.toLowerCase().trim();
          const filtered = newData.filter((product) => {
            const name = (product.name || "").toLowerCase();
            const sku = (product.sku || "").toLowerCase();
            const batchNo = (product.batch_no || "").toLowerCase();
            return (
              name.includes(searchLower) ||
              sku.includes(searchLower) ||
              batchNo.includes(searchLower)
            );
          });
          setFilteredProducts(filtered);
        }
      }, 50); // Delay nhỏ để React render lại table trống trước
    },
    [allProducts, flattenProducts, searchValue]
  );

  //  SEARCH & FILTER
  useEffect(() => {
    // 1. Chọn nguồn dữ liệu dựa trên viewMode
    const sourceData = viewMode === "split" ? flattenProducts : allProducts;

    if (!searchValue.trim()) {
      setFilteredProducts(sourceData);
      setCurrentPage(1);
      return;
    }

    const searchLower = searchValue.toLowerCase().trim();
    const filtered = sourceData.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      const batchNo = (product.batch_no || "").toLowerCase(); // Search cả số lô
      const supplierName = (product.supplier?.name || "").toLowerCase();
      const groupName = (product.group?.name || "").toLowerCase();
      const warehouseName = (product.warehouse?.name || product.warehouse || "")
        .toString()
        .toLowerCase();

      return (
        name.includes(searchLower) ||
        sku.includes(searchLower) ||
        batchNo.includes(searchLower) ||
        supplierName.includes(searchLower) ||
        groupName.includes(searchLower) ||
        warehouseName.includes(searchLower)
      );
    });

    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [searchValue, allProducts, flattenProducts, viewMode]);

  const searchOptions = useMemo(() => {
    if (!searchValue.trim()) return [];

    const searchLower = searchValue.toLowerCase();
    const matches = allProducts
      .filter((product) => {
        const name = (product.name || "").toLowerCase();
        const sku = (product.sku || "").toLowerCase();
        return name.includes(searchLower) || sku.includes(searchLower);
      })
      .slice(0, 10);

    return matches.map((product) => ({
      value: product.name,
      label: (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space>
            <ShoppingOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
              {product.name}
            </span>
          </Space>
          <Text
            type="secondary"
            style={{ fontSize: "clamp(10px, 2.5vw, 12px)" }}
          >
            {product.sku}
          </Text>
        </div>
      ),
    }));
  }, [searchValue, allProducts]);

  const handleRefresh = async () => {
    api.info({
      message: "🔄 Đang làm mới...",
      description: "Đang tải lại dữ liệu sản phẩm",
      placement: "topRight",
      duration: 1,
      key: "refresh",
    });

    await fetchProducts(false);
    setSearchValue("");

    api.success({
      message: " Đã làm mới!",
      description: "Dữ liệu sản phẩm đã được cập nhật",
      placement: "topRight",
      duration: 2,
      key: "refresh",
    });
  };

  const toggleColumn = (checkedValues) => {
    setVisibleColumns(checkedValues);
    localStorage.setItem(
      "productVisibleColumns",
      JSON.stringify(checkedValues)
    );
  };

  const resetImportState = () => {
    setImportFile(null);
    setPreviewRows([]);
    setPreviewError("");
    setPreviewLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExcelButtonClick = () => {
    if (!storeId) {
      api.warning({
        message: "⚠️ Chưa chọn cửa hàng",
        description: "Vui lòng chọn cửa hàng trước khi nhập sản phẩm",
        placement: "topRight",
        duration: 3,
      });
      return;
    }
    resetImportState();
    setImportModalOpen(true);
  };

  const handleExcelFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!isExcel) {
      api.error({
        message: " Định dạng không hỗ trợ",
        description: "Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV",
        placement: "topRight",
      });
      event.target.value = "";
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!json.length) {
        setPreviewError("File không có dữ liệu hoặc chưa đúng định dạng");
        setPreviewRows([]);
        setImportFile(null);
      } else {
        setPreviewRows(json.slice(0, 20));
        setImportFile(file);
      }
    } catch (error) {
      console.error("Parse excel error:", error);
      setPreviewError("Không thể đọc file. Vui lòng kiểm tra và thử lại");
      setPreviewRows([]);
      setImportFile(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalProduct(null);
    setIsModalOpen(true);
    api.info({
      message: "📝 Thêm sản phẩm mới",
      description: "Vui lòng điền đầy đủ thông tin sản phẩm",
      placement: "topRight",
      duration: 2,
    });
  };

  const openEditModal = (product) => {
    setModalProduct(product);
    setIsModalOpen(true);
    api.info({
      message: ` Chỉnh sửa sản phẩm`,
      description: `Đang chỉnh sửa: ${product.name}`,
      placement: "topRight",
      duration: 2,
    });
  };

  // Mở modal chỉnh sửa lô hàng
  const openEditBatch = (product, batch) => {
    // Debug log
    console.log("openEditBatch called with:", {
      product_id: product._id,
      product_name: product.name,
      batch_no: batch.batch_no,
      product_full: product,
    });
    // Tạo object chứa thông tin product + batch để edit
    setEditingBatch({ product, batch });
    setBatchModalOpen(true);
    api.info({
      message: ` Chỉnh sửa lô hàng`,
      description: `Lô: ${batch.batch_no} - ${product.name}`,
      placement: "topRight",
      duration: 2,
    });
  };

  const closeBatchModal = () => {
    setBatchModalOpen(false);
    setEditingBatch(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  const onFormSuccess = () => {
    fetchProducts(false);
    closeModal();

    api.success({
      message: modalProduct
        ? "🎉 Cập nhật thành công!"
        : "🎉 Tạo sản phẩm thành công!",
      description: modalProduct
        ? `Sản phẩm "${modalProduct.name}" đã được cập nhật trong hệ thống.`
        : "Sản phẩm mới đã được thêm vào danh sách thành công.",
      placement: "topRight",
      duration: 4,
    });
  };

  const totalValue = filteredProducts.reduce(
    (sum, p) => sum + (p.price || 0) * (p.stock_quantity || 0),
    0
  );
  const totalStock = filteredProducts.reduce(
    (sum, p) => sum + (p.stock_quantity || 0),
    0
  );
  const activeProducts = filteredProducts.filter(
    (p) => p.status === "Đang kinh doanh"
  ).length;

  useEffect(() => {
    if (allProducts.length > 0) {
      const lowStockProducts = allProducts.filter(
        (p) =>
          (p.stock_quantity || 0) > 0 &&
          p.min_stock &&
          (p.stock_quantity || 0) <= p.min_stock
      );

      if (lowStockProducts.length > 0) {
        api.warning({
          message: "⚠️ Cảnh báo tồn kho thấp",
          description: (
            <div>
              <p style={{ marginBottom: 8 }}>
                Có <strong>{lowStockProducts.length}</strong> sản phẩm đang ở
                mức tồn kho tối thiểu:
              </p>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                {lowStockProducts.slice(0, 3).map((p) => (
                  <li key={p._id || p.id}>
                    {p.name}: <strong>{p.stock_quantity}</strong> (min:{" "}
                    {p.min_stock})
                  </li>
                ))}
                {lowStockProducts.length > 3 && (
                  <li>... và {lowStockProducts.length - 3} sản phẩm khác</li>
                )}
              </ul>
            </div>
          ),
          placement: "bottomRight",
          duration: 8,
        });
      }
    }
  }, [allProducts]);

  //  COLUMN CONFIGS (thêm warehouse)
  const columnConfigs = useMemo(() => {
    return {
      name: {
        title: (
          <Space>
            <ShoppingOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
              Tên sản phẩm
            </span>
          </Space>
        ),
        dataIndex: "name",
        key: "name",
        width: isMobile ? 180 : 230,
        ellipsis: true,
        render: (text) => (
          <Text
            strong
            style={{ color: "#1890ff", fontSize: "clamp(12px, 2.5vw, 14px)" }}
          >
            {text}
          </Text>
        ),
      },
      sku: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>SKU</span>
        ),
        dataIndex: "sku",
        key: "sku",
        width: isMobile ? 100 : 140,
        render: (text) => (
          <Tag color="cyan" style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
            {text || "Trống"}
          </Tag>
        ),
      },

      //  NEW: warehouse
      warehouse: {
        title: (
          <Space>
            <EnvironmentOutlined style={{ color: "#faad14" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
              Kho hàng
            </span>
          </Space>
        ),
        dataIndex: "warehouse",
        key: "warehouse",
        width: isMobile ? 120 : 170,
        ellipsis: true,
        render: (value) => {
          // hỗ trợ warehouse là object {name}, hoặc string
          const name = typeof value === "string" ? value : value?.name;
          return (
            <Tag color="blue" style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
              {name || "Trống"}
            </Tag>
          );
        },
      },

      price: {
        title: (
          <Space>
            <DollarOutlined style={{ color: "#52c41a" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
              Giá bán
            </span>
          </Space>
        ),
        dataIndex: "price",
        key: "price",
        width: isMobile ? 150 : 180,
        align: "center",
        render: (value, record) => {
          const batches = record.batches || [];
          // Nếu không có batches hoặc đang ở chế độ split mode
          if (batches.length === 0 || record.isBatch) {
            return (
              <Text
                strong
                style={{
                  color: "#52c41a",
                  fontSize: "clamp(11px, 2.5vw, 13px)",
                }}
              >
                {value ? Number(value).toLocaleString() : "Trống"}
              </Text>
            );
          }
          // Group batches by selling_price (use product price as fallback)
          const priceGroups = {};
          batches.forEach((b) => {
            const price = b.selling_price || Number(value) || 0;
            if (!priceGroups[price]) priceGroups[price] = 0;
            priceGroups[price] += 1;
          });
          const entries = Object.entries(priceGroups).sort(
            (a, b) => Number(b[0]) - Number(a[0])
          ); // Sort descending
          // Nếu tất cả lô cùng giá bán, hiển thị đơn giản
          if (entries.length === 1) {
            return (
              <Text
                strong
                style={{
                  color: "#52c41a",
                  fontSize: "clamp(11px, 2.5vw, 13px)",
                }}
              >
                {Number(entries[0][0]).toLocaleString()}
              </Text>
            );
          }
          // Hiển thị chi tiết theo từng mức giá bán
          return (
            <Tooltip
              title={
                <div style={{ padding: 4 }}>
                  <div
                    style={{
                      marginBottom: 4,
                      borderBottom: "1px solid rgba(255,255,255,0.2)",
                      paddingBottom: 4,
                    }}
                  >
                    CHI TIẾT GIÁ BÁN THEO LÔ
                  </div>
                  {entries.map(([price, count]) => (
                    <div
                      key={price}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span>{count} lô:</span>
                      <span style={{ fontWeight: 600 }}>
                        {Number(price).toLocaleString()}đ
                      </span>
                    </div>
                  ))}
                </div>
              }
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                {entries.map(([price, count]) => (
                  <Tag
                    key={price}
                    color="green"
                    style={{ margin: 0, fontSize: 10 }}
                  >
                    {count} lô: {Number(price).toLocaleString()}
                  </Tag>
                ))}
              </div>
            </Tooltip>
          );
        },
      },
      stock_quantity: {
        title: (
          <Space>
            <StockOutlined style={{ color: "#faad14" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
              Tồn kho
            </span>
          </Space>
        ),
        dataIndex: "stock_quantity",
        key: "stock_quantity",
        width: isMobile ? 90 : 100,
        align: "center",
        render: (value, record) => {
          const qtyTotal = Number(value || 0);
          const min = Number(record?.min_stock || 0);

          // Tính tồn khả dụng (trừ hết hạn)
          const avail = (record.batches || []).reduce(
            (sum, b) => {
              const isExp =
                b.expiry_date && new Date(b.expiry_date) < new Date();
              return isExp ? sum : sum + (b.quantity || 0);
            },
            record.batches?.length > 0 ? 0 : qtyTotal
          );

          const isLowStock = min > 0 && avail > 0 && avail <= min;
          const hasExpired = qtyTotal > avail;

          return (
            <Tooltip
              title={
                <div style={{ padding: "4px" }}>
                  <div
                    style={{
                      marginBottom: 4,
                      borderBottom: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    CHI TIẾT TỒN KHO
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 20,
                    }}
                  >
                    <span>Tổng tồn:</span>
                    <span style={{ fontWeight: 600 }}>{qtyTotal}</span>
                  </div>
                  {hasExpired && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 20,
                        color: "#ff4d4f",
                      }}
                    >
                      <span>Hết hạn:</span>
                      <span style={{ fontWeight: 600 }}>
                        -{qtyTotal - avail}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 20,
                      color: "#52c41a",
                      marginTop: 4,
                      paddingTop: 4,
                      borderTop: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <span>KHẢ DỤNG:</span>
                    <span style={{ fontWeight: 800 }}>{avail}</span>
                  </div>
                  {isLowStock && (
                    <div
                      style={{ color: "#faad14", fontSize: 11, marginTop: 4 }}
                    >
                      ⚠️ Cảnh báo: Dưới mức tối thiểu!
                    </div>
                  )}
                </div>
              }
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Badge
                  count={avail}
                  overflowCount={999999}
                  showZero
                  style={{
                    backgroundColor:
                      avail >= 10
                        ? "#52c41a"
                        : avail === 0
                        ? "#f5222d"
                        : "#faad14",
                    fontSize: "clamp(10px, 2vw, 12px)",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                />
                {hasExpired && (
                  <Text
                    delete
                    type="danger"
                    style={{ fontSize: 10, opacity: 0.7 }}
                  >
                    {qtyTotal}
                  </Text>
                )}
              </div>
            </Tooltip>
          );
        },
      },
      status: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
            Trạng thái
          </span>
        ),
        dataIndex: "status",
        key: "status",
        fixed: "right",
        width: isMobile ? 140 : 170,
        align: "center",
        render: (value) => (
          <Tag
            icon={
              value === "Đang kinh doanh" ? (
                <CheckCircleOutlined />
              ) : (
                <CloseCircleOutlined />
              )
            }
            color={value === "Đang kinh doanh" ? "success" : "error"}
            style={{ fontSize: "clamp(10px, 2vw, 12px)" }}
          >
            {value || "Chưa xác định"}
          </Tag>
        ),
      },
      cost_price: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Giá vốn</span>
        ),
        dataIndex: "cost_price",
        key: "cost_price",
        width: isMobile ? 150 : 180,
        align: "center",
        render: (value, record) => {
          const batches = record.batches || [];
          // Nếu không có batches hoặc đang ở chế độ split mode
          if (batches.length === 0 || record.isBatch) {
            return value ? (
              <Tag color="lime">{Number(value).toLocaleString()}</Tag>
            ) : (
              "Trống"
            );
          }
          // Group batches by cost_price
          const priceGroups = {};
          batches.forEach((b) => {
            const price = b.cost_price || 0;
            if (!priceGroups[price]) priceGroups[price] = 0;
            priceGroups[price] += 1;
          });
          const entries = Object.entries(priceGroups).sort(
            (a, b) => Number(a[0]) - Number(b[0])
          );
          // Nếu tất cả lô cùng giá vốn, hiển thị đơn giản
          if (entries.length === 1) {
            return (
              <Tag color="lime">{Number(entries[0][0]).toLocaleString()}</Tag>
            );
          }
          // Hiển thị chi tiết theo từng mức giá vốn
          return (
            <Tooltip
              title={
                <div style={{ padding: 4 }}>
                  <div
                    style={{
                      marginBottom: 4,
                      borderBottom: "1px solid rgba(255,255,255,0.2)",
                      paddingBottom: 4,
                    }}
                  >
                    CHI TIẾT GIÁ VỐN THEO LÔ
                  </div>
                  {entries.map(([price, count]) => (
                    <div
                      key={price}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span>{count} lô:</span>
                      <span style={{ fontWeight: 600 }}>
                        {Number(price).toLocaleString()}đ
                      </span>
                    </div>
                  ))}
                </div>
              }
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                {entries.map(([price, count]) => (
                  <Tag
                    key={price}
                    color="lime"
                    style={{ margin: 0, fontSize: 10 }}
                  >
                    {count} lô: {Number(price).toLocaleString()}
                  </Tag>
                ))}
              </div>
            </Tooltip>
          );
        },
      },
      supplier: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
            Nhà cung cấp
          </span>
        ),
        dataIndex: "supplier",
        key: "supplier",
        width: isMobile ? 120 : 150,
        ellipsis: true,
        render: (value) => (
          <Text style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
            {value?.name || "Trống"}
          </Text>
        ),
      },
      group: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
            Nhóm sản phẩm
          </span>
        ),
        dataIndex: "group",
        key: "group",
        width: isMobile ? 120 : 150,
        ellipsis: true,
        render: (value) => <Tag color="purple">{value?.name || "Trống"}</Tag>,
      },
      unit: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Đơn vị</span>
        ),
        dataIndex: "unit",
        key: "unit",
        width: 80,
        align: "center",
        render: (value) => (
          <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
            {value || "Trống"}
          </span>
        ),
      },
      min_stock: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
            Tồn tối thiểu
          </span>
        ),
        dataIndex: "min_stock",
        key: "min_stock",
        width: 110,
        align: "center",
        render: (value) => (
          <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
            {Number(value || 0)}
          </span>
        ),
      },
      max_stock: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
            Tồn tối đa
          </span>
        ),
        dataIndex: "max_stock",
        key: "max_stock",
        width: 110,
        align: "center",
        render: (value) => (
          <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
            {Number(value || 0)}
          </span>
        ),
      },
      image: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Ảnh</span>
        ),
        dataIndex: "image",
        key: "image",
        width: 100,
        align: "center",
        render: (value, record) =>
          value?.url ? (
            <Image
              src={value.url}
              alt={record?.name}
              width={isMobile ? 40 : 50}
              height={isMobile ? 40 : 50}
              style={{ objectFit: "cover", borderRadius: 8 }}
              preview={{ mask: <EyeOutlined /> }}
            />
          ) : (
            "Trống"
          ),
      },
      createdAt: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Ngày tạo</span>
        ),
        dataIndex: "createdAt",
        key: "createdAt",
        width: 120,
        align: "center",
        render: (value) =>
          value ? new Date(value).toLocaleDateString("vi-VN") : "Trống",
      },
      updatedAt: {
        title: (
          <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Cập nhật</span>
        ),
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 120,
        align: "center",
        render: (value) =>
          value ? new Date(value).toLocaleDateString("vi-VN") : "Trống",
      },
      expiry: {
        title: (
          <Space>
            <CalendarOutlined style={{ color: "#ff4d4f" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
              Hạn sử dụng
            </span>
          </Space>
        ),
        key: "expiry",
        width: isMobile ? 120 : 150,
        align: "center",
        render: (_, record) => {
          // 1. Chế độ Split Mode (Tách lô) -> Hiển thị chính xác ngày của lô đó
          if (record.isBatch) {
            if (!record.expiry_date) return <Tag>Không có hạn</Tag>;
            const expiryDate = new Date(record.expiry_date);
            const now = new Date();
            const diffTime = expiryDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let color = "green";
            let text = expiryDate.toLocaleDateString("vi-VN");
            if (diffDays < 0) {
              color = "red";
              text = `Hết hạn ${text}`;
            } else if (diffDays <= 30) color = "orange";
            else if (diffDays <= 90) color = "blue";

            return (
              <Tag color={color} style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
                {text}
              </Tag>
            );
          }

          // 2. Chế độ Merge (Gộp sản phẩm) -> Đếm số lô còn hạn/hết hạn
          const batches = record.batches || [];
          if (batches.length === 0) return <Tag>Không có hạn</Tag>;

          const now = new Date();
          const expiredBatches = batches.filter(
            (b) => b.expiry_date && new Date(b.expiry_date) < now
          );
          const validBatches = batches.filter(
            (b) => !b.expiry_date || new Date(b.expiry_date) >= now
          );

          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                alignItems: "center",
              }}
            >
              {validBatches.length > 0 && (
                <Tag color="success" style={{ margin: 0, fontSize: 10 }}>
                  {validBatches.length} lô còn hạn
                </Tag>
              )}
              {expiredBatches.length > 0 && (
                <Tag color="error" style={{ margin: 0, fontSize: 10 }}>
                  {expiredBatches.length} lô hết hạn
                </Tag>
              )}
            </div>
          );
        },
      },
    };
  }, [isMobile]);

  //  sắp xếp: name, sku, warehouse, price, stock_quantity ... status ... action
  const leftFixedOrder = [
    "name",
    "sku",
    "warehouse",
    "price",
    "stock_quantity",
  ];
  const rightFixed = ["status"];

  const middleColumnsKeys = useMemo(() => {
    return allColumns
      .map((c) => c.key)
      .filter(
        (key) =>
          visibleColumns.includes(key) &&
          !leftFixedOrder.includes(key) &&
          !rightFixed.includes(key)
      );
  }, [visibleColumns]);

  const getTableColumns = useCallback(() => {
    const cols = [
      ...leftFixedOrder
        .filter((k) => visibleColumns.includes(k))
        .map((k) => columnConfigs[k])
        .filter(Boolean),

      ...middleColumnsKeys.map((k) => columnConfigs[k]).filter(Boolean),

      ...(visibleColumns.includes("status") ? [columnConfigs.status] : []),
    ].filter(Boolean);

    cols.push({
      title: (
        <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Thao tác</span>
      ),
      key: "action",
      width: isMobile ? 100 : 150,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        // Chế độ Split (Chi tiết lô) - cho phép edit từng lô
        if (viewMode === "split" && record.isBatch) {
          return (
            <Tooltip title="Chỉnh sửa lô này">
              <Button
                type="primary"
                icon={<EditOutlined />}
                size={isMobile ? "small" : "middle"}
                onClick={(e) => {
                  e.stopPropagation();
                  // Tìm batch tương ứng trong product gốc
                  const batch = {
                    batch_no: record.batch_no,
                    expiry_date: record.expiry_date,
                    cost_price: record.cost_price,
                    selling_price: record.selling_price || record.price,
                    quantity: record.stock_quantity,
                    warehouse_id: record.warehouse?._id || record.warehouse,
                  };
                  openEditBatch(record, batch);
                }}
                style={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                }}
              />
            </Tooltip>
          );
        }

        // Chế độ Merge (Gộp theo SP) - sửa thông tin SP + xem chi tiết lô
        if (viewMode === "merge") {
          const hasBatches = record.batches && record.batches.length > 0;
          return (
            <Space size="small">
              <Tooltip title="Sửa thông tin sản phẩm">
                <Button
                  type="default"
                  icon={<SettingOutlined />}
                  size={isMobile ? "small" : "middle"}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(record);
                  }}
                  style={{ borderColor: "#52c41a", color: "#52c41a" }}
                />
              </Tooltip>
              <Tooltip
                title={
                  hasBatches
                    ? "Click hàng để xem chi tiết lô"
                    : "Sản phẩm chưa có lô"
                }
              >
                <Button
                  type={hasBatches ? "default" : "dashed"}
                  icon={<EyeOutlined />}
                  size={isMobile ? "small" : "middle"}
                  disabled={!hasBatches}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasBatches) {
                      const key = record._id || record.id;
                      setExpandedRowKeys((prev) =>
                        prev.includes(key)
                          ? prev.filter((k) => k !== key)
                          : [...prev, key]
                      );
                    }
                  }}
                  style={
                    hasBatches
                      ? { borderColor: "#1890ff", color: "#1890ff" }
                      : {}
                  }
                >
                  {!isMobile && (hasBatches ? "Xem lô" : "Không có lô")}
                </Button>
              </Tooltip>
            </Space>
          );
        }

        return null;
      },
    });

    return cols;
  }, [visibleColumns, columnConfigs, middleColumnsKeys, isMobile]);

  const columnSelectorContent = (
    <Card
      style={{
        width: "100%",
        border: "1px solid #8c8c8c",
        maxHeight: isMobile ? "70vh" : 400,
        overflowY: "auto",
      }}
    >
      <div style={{ padding: 5 }}>
        <Text strong style={{ fontSize: "clamp(13px, 3vw, 14px)" }}>
          Chọn cột hiển thị thêm:
        </Text>
        <Divider style={{ margin: "8px 0" }} />
        <Checkbox.Group
          value={visibleColumns}
          onChange={toggleColumn}
          style={{ width: "100%" }}
        >
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            {allColumns.map((col) => (
              <Checkbox
                key={col.key}
                value={col.key}
                style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}
              >
                {col.label}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </div>
    </Card>
  );

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setItemsPerPage(pagination.pageSize);
  };

  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    return Object.keys(previewRows[0]).map((key) => ({
      title: (
        <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{key}</span>
      ),
      dataIndex: key,
      key,
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
          {String(text ?? "")}
        </span>
      ),
    }));
  }, [previewRows]);

  const handleConfirmImport = async () => {
    if (!importFile) {
      api.warning({
        message: "⚠️ Chưa chọn file",
        description: "Vui lòng chọn file Excel trước khi nhập",
        placement: "topRight",
      });
      return;
    }

    try {
      setIsImporting(true);
      const response = await importProductsByExcel(storeId, importFile);
      await fetchProducts(false);

      const results = response?.results || {};
      const newlyCreated =
        response?.newlyCreated || results?.newlyCreated || {};
      const successCount = results?.success?.length || 0;
      const failedCount = results?.failed?.length || 0;

      let description = `Thành công: ${successCount}/${
        results?.total || successCount
      } dòng`;

      // Show newly created items
      const createdParts = [];
      if (newlyCreated.products > 0)
        createdParts.push(`${newlyCreated.products} sản phẩm mới`);
      if (newlyCreated.suppliers > 0)
        createdParts.push(`${newlyCreated.suppliers} nhà cung cấp`);
      if (newlyCreated.productGroups > 0)
        createdParts.push(`${newlyCreated.productGroups} nhóm sản phẩm`);
      if (newlyCreated.warehouses > 0)
        createdParts.push(`${newlyCreated.warehouses} kho hàng`);

      if (createdParts.length > 0) {
        description += `. Đã tạo mới: ${createdParts.join(", ")}`;
      }

      if (failedCount > 0) {
        description += `. Thất bại: ${failedCount} dòng`;
        api.warning({
          message: "⚠️ Import hoàn tất một phần",
          description,
          placement: "topRight",
          duration: 8,
        });
      } else {
        api.success({
          message: " Nhập sản phẩm thành công",
          description,
          placement: "topRight",
          duration: 5,
        });
      }

      setImportModalOpen(false);
      resetImportState();
    } catch (error) {
      console.error("Import products error:", error);
      api.error({
        message: " Nhập sản phẩm thất bại",
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Vui lòng kiểm tra file và thử lại",
        placement: "topRight",
        duration: 6,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!storeId) {
      api.warning({
        message: "⚠️ Chưa chọn cửa hàng",
        description: "Vui lòng chọn cửa hàng trước khi xuất Excel",
        placement: "topRight",
      });
      return;
    }

    try {
      api.info({
        message: "⏳ Đang xuất file...",
        description: "Vui lòng đợi trong giây lát",
        placement: "topRight",
        duration: 1.5,
      });

      const response = await exportProducts(storeId);

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products_${storeId}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export Excel error:", error);
      api.error({
        message: " Xuất Excel thất bại",
        description: error?.message || "Không thể xuất file",
        placement: "topRight",
      });
    }
  };

  if (!storeId) {
    return (
      <Layout>
        {contextHolder}
        <Card
          style={{
            border: "1px solid #8c8c8c",
            margin: isMobile ? 12 : 0,
            borderRadius: 16,
          }}
        >
          <Title level={2} style={{ fontSize: "clamp(20px, 5vw, 32px)" }}>
            Danh sách sản phẩm
          </Title>
          <Card
            style={{ background: "#FFF9C4", border: "none", marginTop: 16 }}
          >
            <Text strong style={{ fontSize: "clamp(13px, 3vw, 15px)" }}>
              ⚠️ Không tìm thấy cửa hàng hiện hành.
            </Text>
          </Card>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {contextHolder}

      <div style={{ padding: isMobile ? 1 : 0, minHeight: "100vh" }}>
        <Card
          style={{
            borderRadius: 16,
            border: "1px solid #8c8c8c",
            marginBottom: isMobile ? 10 : 15,
          }}
        >
          <div style={{ marginBottom: isMobile ? 10 : 20 }}>
            <Title
              level={2}
              style={{
                margin: 0,
                fontSize: "clamp(20px, 6vw, 32px)",
                fontWeight: 700,
                marginBottom: isMobile ? 4 : 8,
                color: "black",
              }}
            >
              Quản lý Sản phẩm
            </Title>
            {!isMobile && (
              <Text
                type="secondary"
                style={{ fontSize: "clamp(12px, 3vw, 14px)" }}
              >
                Quản lý danh mục sản phẩm - giá bán, tồn kho và thông tin chi
                tiết
              </Text>
            )}
          </div>

          <Row
            gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
            style={{ marginBottom: isMobile ? 16 : 24 }}
          >
            <Col xs={12} sm={12} md={6}>
              <Tooltip title="Tổng số sản phẩm trong cửa hàng hiện tại">
                <Card
                  style={{
                    background: "#2C5364",
                    border: "none",
                    borderRadius: 12,
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span
                        style={{
                          color: "#fff",
                          fontSize: "clamp(10px, 2.5vw, 14px)",
                          fontWeight: 500,
                        }}
                      >
                        Tổng sản phẩm{" "}
                        <InfoCircleOutlined
                          style={{ color: "#2196F3", fontSize: 15 }}
                        />
                      </span>
                    }
                    value={filteredProducts.length}
                    prefix={
                      <AppstoreOutlined
                        style={{ fontSize: "clamp(14px, 4vw, 20px)" }}
                      />
                    }
                    valueStyle={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "clamp(16px, 5vw, 24px)",
                    }}
                  />
                </Card>
              </Tooltip>
            </Col>

            <Col xs={12} sm={12} md={6}>
              <Tooltip title="Số lượng mặt hàng đang được kinh doanh">
                <Card
                  style={{
                    background: "#2C5364",
                    border: "none",
                    borderRadius: 12,
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span
                        style={{
                          color: "#fff",
                          fontSize: "clamp(10px, 2.5vw, 14px)",
                          fontWeight: 500,
                        }}
                      >
                        Đang kinh doanh{" "}
                        <InfoCircleOutlined
                          style={{ color: "#2196F3", fontSize: 15 }}
                        />
                      </span>
                    }
                    value={activeProducts}
                    prefix={
                      <CheckCircleOutlined
                        style={{ fontSize: "clamp(14px, 4vw, 20px)" }}
                      />
                    }
                    valueStyle={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "clamp(16px, 5vw, 24px)",
                    }}
                  />
                </Card>
              </Tooltip>
            </Col>

            <Col xs={12} sm={12} md={6}>
              <Tooltip title="Số lượng tồn kho hiện tại của tất cả sản phẩm">
                <Card
                  style={{
                    background: "#2C5364",
                    border: "none",
                    borderRadius: 12,
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span
                        style={{
                          color: "#fff",
                          fontSize: "clamp(10px, 2.5vw, 14px)",
                          fontWeight: 500,
                        }}
                      >
                        Tồn kho{" "}
                        <InfoCircleOutlined
                          style={{ color: "#2196F3", fontSize: 15 }}
                        />
                      </span>
                    }
                    value={totalStock}
                    prefix={
                      <StockOutlined
                        style={{ fontSize: "clamp(14px, 4vw, 20px)" }}
                      />
                    }
                    valueStyle={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "clamp(16px, 5vw, 24px)",
                    }}
                  />
                </Card>
              </Tooltip>
            </Col>

            <Col xs={12} sm={12} md={6}>
              <Tooltip title="Công thức tính: 'Tồn kho' x 'Giá bán'">
                <Card
                  style={{
                    background: "#2C5364",
                    border: "none",
                    borderRadius: 12,
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span
                        style={{
                          color: "#fff",
                          fontSize: "clamp(10px, 2.5vw, 14px)",
                          fontWeight: 500,
                        }}
                      >
                        Giá trị{" "}
                        <InfoCircleOutlined
                          style={{ color: "#2196F3", fontSize: 15 }}
                        />
                      </span>
                    }
                    value={totalValue}
                    prefix={
                      <DollarOutlined
                        style={{ fontSize: "clamp(14px, 4vw, 20px)" }}
                      />
                    }
                    suffix="₫"
                    valueStyle={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: "clamp(12px, 4vw, 18px)",
                    }}
                  />
                </Card>
              </Tooltip>
            </Col>
          </Row>

          {!isMobile && <Divider />}

          <Space
            direction={isMobile ? "vertical" : "horizontal"}
            style={{
              marginBottom: isMobile ? 16 : 24,
              width: "100%",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
            size={isMobile ? 12 : 16}
          >
            <AutoComplete
              value={searchValue}
              options={searchOptions}
              onChange={(value) => setSearchValue(value)}
              onSelect={(value) => setSearchValue(value)}
              style={{
                width: isMobile ? "100%" : 400,
                minWidth: isMobile ? "auto" : 300,
              }}
            >
              <Input
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                placeholder={
                  isMobile
                    ? "Tìm kiếm..."
                    : "Tìm kiếm sản phẩm theo tên, SKU, nhà cung cấp, nhóm, kho..."
                }
                allowClear
                onClear={() => setSearchValue("")}
              />
            </AutoComplete>

            <Space
              size={isMobile ? 8 : 12}
              wrap
              style={{ width: isMobile ? "100%" : "auto" }}
            >
              <Button
                size={isMobile ? "middle" : "large"}
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
              >
                {!isMobile ? "Làm mới" : null}
              </Button>

              <Button
                size={isMobile ? "middle" : "large"}
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                style={{ borderColor: "#52c41a", color: "#52c41a" }}
              >
                {!isMobile ? "Xuất Excel" : "Xuất"}
              </Button>

              {isMobile ? (
                <Button
                  size="middle"
                  icon={<MenuOutlined />}
                  onClick={() => setDrawerVisible(true)}
                >
                  Cột
                </Button>
              ) : (
                <Dropdown
                  dropdownRender={() => (
                    <div style={{ width: 280 }}>{columnSelectorContent}</div>
                  )}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button size="large" icon={<SettingOutlined />}>
                    Cài đặt cột
                  </Button>
                </Dropdown>
              )}

              <Button
                size={isMobile ? "middle" : "large"}
                icon={<FileExcelOutlined />}
                loading={isImporting}
                onClick={handleExcelButtonClick}
              >
                Tải lên
              </Button>

              <Space>
                <Text strong>Chế độ xem:</Text>
                <Select
                  value={viewMode}
                  onChange={handleViewModeChange}
                  style={{ width: 140 }}
                  options={[
                    { value: "merge", label: "Gộp theo SP" },
                    { value: "split", label: "Chi tiết Lô" },
                  ]}
                />
                <Button
                  type="primary"
                  size={isMobile ? "middle" : "large"}
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                  style={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                    boxShadow: "0 2px 8px rgba(118, 75, 162, 0.4)",
                  }}
                >
                  {isMobile ? "Thêm" : "Thêm sản phẩm"}
                </Button>
              </Space>
            </Space>
          </Space>

          <div style={{ overflowX: "auto" }}>
            <Table
              columns={getTableColumns()}
              dataSource={filteredProducts}
              rowKey={(r) =>
                viewMode === "split" ? r.uniqueId : r._id || r.id
              }
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: itemsPerPage,
                total: filteredProducts.length,
                showSizeChanger: !isMobile,
                pageSizeOptions: ["5", "10", "20", "50", "100"],
                showTotal: (total, range) => (
                  <div
                    style={{
                      fontSize: isMobile ? 12 : 14,
                      textAlign: isMobile ? "center" : "left",
                    }}
                  >
                    Đang xem{" "}
                    <span style={{ color: "#1890ff", fontWeight: 600 }}>
                      {range[0]}-{range[1]}
                    </span>{" "}
                    trên tổng{" "}
                    <span style={{ color: "#d4380d", fontWeight: 600 }}>
                      {total}
                    </span>{" "}
                    dòng
                  </div>
                ),
              }}
              onChange={handleTableChange}
              scroll={{ x: "max-content" }}
              size={isMobile ? "small" : "middle"}
              locale={{
                emptyText: (
                  <div style={{ padding: isMobile ? "24px 0" : "48px 0" }}>
                    <ShoppingOutlined
                      style={{ fontSize: isMobile ? 32 : 48, color: "#d9d9d9" }}
                    />
                    <div
                      style={{
                        marginTop: 16,
                        color: "#999",
                        fontSize: "clamp(12px, 3vw, 14px)",
                      }}
                    >
                      {searchValue
                        ? `Không tìm thấy sản phẩm nào với từ khóa "${searchValue}"`
                        : "Chưa có sản phẩm nào"}
                    </div>
                  </div>
                ),
              }}
              expandable={
                viewMode === "merge"
                  ? {
                      expandedRowRender: (record) => {
                        const data = record.batches || [];
                        if (data.length === 0) {
                          return (
                            <Text
                              type="secondary"
                              italic
                              style={{ paddingLeft: 48 }}
                            >
                              Chưa có thông tin lô hàng
                            </Text>
                          );
                        }

                        const batchColumns = [
                          {
                            title: "Số lô",
                            dataIndex: "batch_no",
                            key: "batch_no",
                            render: (val) => (
                              <Tag color="blue">{val || "N/A"}</Tag>
                            ),
                          },
                          {
                            title: "Hạn sử dụng",
                            dataIndex: "expiry_date",
                            key: "expiry_date",
                            render: (val) => {
                              if (!val) return <Tag>Không có hạn</Tag>;
                              const expiryDate = new Date(val);
                              const now = new Date();
                              const diffDays = Math.ceil(
                                (expiryDate - now) / (1000 * 60 * 60 * 24)
                              );
                              let color = "green";
                              let prefix = "";
                              if (diffDays < 0) {
                                color = "red";
                                prefix = "Hết hạn: ";
                              } else if (diffDays <= 30) {
                                color = "orange";
                                prefix = "⚠️ ";
                              } else if (diffDays <= 90) color = "blue";
                              return (
                                <Tag color={color}>
                                  {prefix}
                                  {expiryDate.toLocaleDateString("vi-VN")}
                                </Tag>
                              );
                            },
                          },
                          {
                            title: "Giá nhập",
                            dataIndex: "cost_price",
                            key: "cost_price",
                            render: (val) => (
                              <Tag color="purple" style={{ fontWeight: 500 }}>
                                {val ? Number(val).toLocaleString() : 0}đ
                              </Tag>
                            ),
                          },
                          {
                            title: "Giá bán",
                            dataIndex: "selling_price",
                            key: "selling_price",
                            render: (val, b) => (
                              <Tag color="green" style={{ fontWeight: 600 }}>
                                {val
                                  ? Number(val).toLocaleString()
                                  : record.price
                                  ? Number(record.price).toLocaleString()
                                  : 0}
                                đ
                              </Tag>
                            ),
                          },
                          {
                            title: "Số lượng",
                            dataIndex: "quantity",
                            key: "quantity",
                            render: (val) => (
                              <Badge
                                count={val}
                                overflowCount={9999}
                                style={{
                                  backgroundColor:
                                    val > 0 ? "#1890ff" : "#d9d9d9",
                                }}
                              />
                            ),
                          },
                          {
                            title: "Ngày nhập",
                            dataIndex: "created_at",
                            key: "created_at",
                            render: (val) => (
                              <span style={{ fontSize: 11, color: "#8c8c8c" }}>
                                {val
                                  ? new Date(val).toLocaleDateString("vi-VN")
                                  : "N/A"}
                              </span>
                            ),
                          },
                          {
                            title: "Thao tác",
                            key: "action",
                            width: 80,
                            align: "center",
                            render: (_, batch) => (
                              <Tooltip title="Chỉnh sửa lô này">
                                <Button
                                  type="primary"
                                  icon={<EditOutlined />}
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditBatch(record, batch);
                                  }}
                                  style={{
                                    background:
                                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    border: "none",
                                  }}
                                />
                              </Tooltip>
                            ),
                          },
                        ];

                        return (
                          <div
                            style={{
                              margin: 0,
                              padding: "12px 24px 12px 48px",
                              background: "#fdfdfd",
                              borderRadius: 8,
                              border: "1px solid #f0f0f0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                marginBottom: 12,
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  width: 4,
                                  height: 16,
                                  background: "#1890ff",
                                  borderRadius: 2,
                                }}
                              ></div>
                              <Text
                                strong
                                style={{ color: "#262626", fontSize: 13 }}
                              >
                                CHI TIẾT LÔ HÀNG & HẠN SỬ DỤNG
                              </Text>
                            </div>
                            <Table
                              columns={batchColumns}
                              dataSource={data}
                              pagination={false}
                              size="small"
                              rowKey={(item) => item.batch_no + item.created_at}
                              rowClassName={(b) =>
                                b.expiry_date &&
                                new Date(b.expiry_date) < new Date()
                                  ? "expired-row-bg"
                                  : ""
                              }
                              bordered
                            />
                            <style>{`
                        .expired-row-bg { background-color: #fff1f0 !important; }
                        .expired-row-bg td { color: #cf1322 !important; }
                      `}</style>
                          </div>
                        );
                      },
                      rowExpandable: (record) =>
                        record.batches && record.batches.length > 0,
                      expandedRowKeys: expandedRowKeys,
                      onExpand: (expanded, record) => {
                        const key = record._id || record.id;
                        if (expanded) {
                          setExpandedRowKeys((prev) => [...prev, key]);
                        } else {
                          setExpandedRowKeys((prev) =>
                            prev.filter((k) => k !== key)
                          );
                        }
                      },
                    }
                  : undefined
              }
              onRow={(record) => ({
                onClick: () => {
                  // Chỉ xử lý click để expand khi ở chế độ merge và có batches
                  if (
                    viewMode === "merge" &&
                    record.batches &&
                    record.batches.length > 0
                  ) {
                    const key = record._id || record.id;
                    setExpandedRowKeys((prev) =>
                      prev.includes(key)
                        ? prev.filter((k) => k !== key)
                        : [...prev, key]
                    );
                  }
                },
                style:
                  viewMode === "merge" &&
                  record.batches &&
                  record.batches.length > 0
                    ? { cursor: "pointer" }
                    : {},
              })}
            />
          </div>
        </Card>

        <Drawer
          title={
            <span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>
              Chọn cột hiển thị
            </span>
          }
          placement="bottom"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          height="70vh"
        >
          {columnSelectorContent}
        </Drawer>

        <Modal
          title={
            <Space>
              <ShoppingOutlined style={{ color: "#1890ff" }} />
              <span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>
                {modalProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
              </span>
            </Space>
          }
          open={isModalOpen}
          onCancel={closeModal}
          footer={null}
          width={isMobile ? "100%" : 900}
          styles={{
            body: {
              maxHeight: isMobile
                ? "calc(100vh - 100px)"
                : "calc(100vh - 200px)",
              overflowY: "auto",
              padding: isMobile ? 16 : 24,
            },
          }}
        >
          <ProductForm
            storeId={storeId}
            product={modalProduct}
            onSuccess={onFormSuccess}
            onCancel={closeModal}
          />
        </Modal>

        <Modal
          open={importModalOpen}
          onCancel={() => {
            setImportModalOpen(false);
            resetImportState();
          }}
          title={
            <span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>
              Tải lên sản phẩm bằng Excel
            </span>
          }
          width={isMobile ? "95%" : 720}
          centered
          okText="Xác nhận import"
          cancelText="Hủy"
          onOk={handleConfirmImport}
          confirmLoading={isImporting}
          okButtonProps={{
            disabled: !importFile || !!previewError || previewLoading,
          }}
          styles={{ body: { padding: isMobile ? 12 : 24 } }}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleExcelFileChange}
          />

          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            <Text style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
              Sử dụng template chuẩn để đảm bảo dữ liệu hợp lệ.{" "}
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                loading={downloadingTemplate}
                style={{ padding: 0 }}
              >
                Tải template
              </Button>
            </Text>

            <Button
              icon={<FileExcelOutlined />}
              onClick={() => fileInputRef.current?.click()}
              loading={previewLoading}
              size={isMobile ? "middle" : "large"}
            >
              Chọn file Excel / CSV
            </Button>

            {previewError && (
              <Alert
                type="error"
                message={previewError}
                showIcon
                closable
                onClose={() => setPreviewError("")}
              />
            )}

            {previewRows.length > 0 ? (
              <Card size="small" styles={{ body: { padding: 0 } }}>
                <div
                  style={{
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}
                >
                  <Text strong>Preview {previewRows.length} dòng đầu tiên</Text>
                  <Text type="secondary">
                    Tổng cột: {previewColumns.length}
                  </Text>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <Table
                    columns={previewColumns}
                    dataSource={previewRows}
                    rowKey={(_, idx) => idx}
                    size="small"
                    pagination={false}
                    scroll={{ x: true, y: isMobile ? 200 : 240 }}
                  />
                </div>
              </Card>
            ) : (
              !previewError && (
                <Alert
                  type="info"
                  message="Chưa có file nào được chọn"
                  description="Chọn file Excel/CSV theo template để xem trước dữ liệu trước khi import."
                  showIcon
                />
              )
            )}
          </Space>
        </Modal>

        {/* Modal chỉnh sửa lô hàng */}
        <Modal
          title={
            <Space>
              <EditOutlined style={{ color: "#764ba2" }} />
              <span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>
                Chỉnh sửa lô hàng: {editingBatch?.batch?.batch_no}
              </span>
            </Space>
          }
          open={batchModalOpen}
          onCancel={closeBatchModal}
          footer={null}
          width={isMobile ? "100%" : 600}
          styles={{ body: { padding: isMobile ? 16 : 24 } }}
        >
          {editingBatch && (
            <Form
              key={`${editingBatch.product._id}-${editingBatch.batch.batch_no}`}
              layout="vertical"
              initialValues={{
                batch_no: editingBatch.batch.batch_no,
                expiry_date: editingBatch.batch.expiry_date
                  ? dayjs(editingBatch.batch.expiry_date)
                  : null,
                cost_price: editingBatch.batch.cost_price || 0,
                selling_price:
                  editingBatch.batch.selling_price ||
                  (editingBatch.product.price?.$numberDecimal
                    ? Number(editingBatch.product.price.$numberDecimal)
                    : editingBatch.product.price) ||
                  0,
                quantity: editingBatch.batch.quantity || 0,
                warehouse_id:
                  editingBatch.batch.warehouse_id ||
                  editingBatch.product.default_warehouse_id?._id ||
                  editingBatch.product.default_warehouse_id,
                //  Tự động điền thông tin
                deliverer_name:
                  editingBatch.product.supplier?.contact_person ||
                  editingBatch.product.supplier?.name ||
                  "",
                deliverer_phone:
                  editingBatch.product.supplier_id?.phone ||
                  editingBatch.product.supplier?.phone ||
                  "",
                receiver_name:
                  userObj.fullname || userObj.name || userObj.userName || "",
                receiver_phone: userObj.phone || "",
              }}
              onFinish={async (values) => {
                try {
                  // Validation: Kiểm tra tồn kho tối đa
                  const newQty = Number(values.quantity) || 0;
                  const oldQty = Number(editingBatch.batch.quantity) || 0;
                  const qtyDelta = newQty - oldQty;

                  // Lấy tồn kho hiện tại của sản phẩm
                  const currentStock =
                    Number(editingBatch.product.stock_quantity) || 0;
                  const projectedStock = currentStock + qtyDelta;

                  // Lấy max_stock của sản phẩm
                  const maxStock =
                    editingBatch.product.max_stock !== undefined &&
                    editingBatch.product.max_stock !== null
                      ? Number(editingBatch.product.max_stock)
                      : 0;

                  console.log("Validate Max Stock:", {
                    currentStock,
                    oldQty,
                    newQty,
                    qtyDelta,
                    projectedStock,
                    maxStock,
                  });

                  if (maxStock > 0 && projectedStock > maxStock) {
                    Modal.warning({
                      title: "Không thể lưu - Vượt tồn kho tối đa",
                      content: (
                        <div>
                          <p>
                            Tổng số lượng tồn kho dự kiến (
                            <b>{projectedStock}</b>) vượt quá hạn mức tối đa cho
                            phép (<b>{maxStock}</b>).
                          </p>
                          <div
                            style={{
                              background: "#f5f5f5",
                              padding: "10px",
                              borderRadius: "4px",
                              marginTop: "10px",
                            }}
                          >
                            <p style={{ margin: 0 }}>
                              Tồn kho hiện tại: {currentStock}
                            </p>
                            <p style={{ margin: 0 }}>
                              Thay đổi:{" "}
                              <span
                                style={{
                                  color: qtyDelta >= 0 ? "green" : "red",
                                }}
                              >
                                {qtyDelta >= 0 ? "+" : ""}
                                {qtyDelta}
                              </span>
                            </p>
                            <p style={{ margin: 0, fontWeight: "bold" }}>
                              Dự kiến sau sửa: {projectedStock}
                            </p>
                          </div>
                        </div>
                      ),
                    });
                    return;
                  }

                  if (newQty < 0) {
                    Modal.error({
                      title: "Lỗi",
                      content: "Số lượng không được âm",
                    });
                    return;
                  }

                  // Gọi API update batch thông qua update product
                  let productId =
                    editingBatch.product._id || editingBatch.product.id;
                  // Đảm bảo productId là string
                  if (typeof productId === "object") {
                    productId = productId.toString
                      ? productId.toString()
                      : String(productId);
                  }
                  console.log("Submitting batch update:", {
                    productId,
                    values,
                  });
                  const response = await fetch(
                    `${apiUrl}/products/${productId}/batch`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        old_batch_no: editingBatch.batch.batch_no,
                        new_batch_no: values.batch_no,
                        expiry_date: values.expiry_date
                          ? values.expiry_date.toISOString()
                          : null,
                        cost_price: values.cost_price,
                        selling_price: values.selling_price,
                        quantity: values.quantity,
                        warehouse_id: values.warehouse_id,
                        deliverer_name: values.deliverer_name,
                        deliverer_phone: values.deliverer_phone,
                        receiver_name: values.receiver_name,
                        receiver_phone: values.receiver_phone,
                      }),
                    }
                  );

                  const result = await response.json().catch(() => ({}));

                  if (!response.ok) {
                    throw new Error(
                      result.message || "Cập nhật lô hàng thất bại"
                    );
                  }

                  // Hiển thị thông báo với thông tin phiếu kho
                  let description = `Lô ${values.batch_no} đã được cập nhật`;
                  if (result.voucher) {
                    description += `\nĐã tạo phiếu ${
                      result.voucher.type === "IN" ? "nhập" : "xuất"
                    } kho: ${result.voucher.code}`;
                  }

                  api.success({
                    message: " Cập nhật lô hàng thành công!",
                    description,
                    placement: "topRight",
                    duration: 5,
                  });
                  closeBatchModal();
                  fetchProducts(false); // Refresh data
                } catch (err) {
                  api.error({
                    message: " Lỗi cập nhật lô hàng",
                    description: err.message,
                    placement: "topRight",
                  });
                }
              }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Số lô"
                    name="batch_no"
                    rules={[{ required: true, message: "Vui lòng nhập số lô" }]}
                  >
                    <Input placeholder="VD: LOT-001" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Hạn sử dụng" name="expiry_date">
                    <DatePicker
                      format="DD/MM/YYYY"
                      style={{ width: "100%" }}
                      placeholder="Chọn ngày hết hạn"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Kho lưu trữ"
                    name="warehouse_id"
                    rules={[{ required: true, message: "Vui lòng chọn kho" }]}
                  >
                    <Select
                      placeholder="Chọn kho hàng"
                      options={warehouses.map((w) => ({
                        label: w.name,
                        value: w._id,
                      }))}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Giá nhập"
                    name="cost_price"
                    rules={[{ required: true, message: "Nhập giá vốn" }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      min={0}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                      addonAfter="đ"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Giá bán"
                    name="selling_price"
                    rules={[{ required: true, message: "Nhập giá bán" }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      min={0}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                      addonAfter="đ"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Số lượng"
                    name="quantity"
                    rules={[{ required: true, message: "Nhập số lượng" }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={0} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ margin: "12px 0" }}>
                <Space>
                  <EnvironmentOutlined />{" "}
                  <Text type="secondary">Thông tin giao nhận (Tùy chọn)</Text>
                </Space>
              </Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Người giao" name="deliverer_name">
                    <Input placeholder="Tên người giao hàng" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="SĐT người giao" name="deliverer_phone">
                    <Input placeholder="Số điện thoại" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Người nhận" name="receiver_name">
                    <Input placeholder="Tên người nhận (thủ kho/NV)" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="SĐT người nhận" name="receiver_phone">
                    <Input placeholder="Số điện thoại" />
                  </Form.Item>
                </Col>
              </Row>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <Button onClick={closeBatchModal}>Hủy</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                  }}
                >
                  Lưu thay đổi
                </Button>
              </div>

              <Alert
                style={{ marginTop: 16 }}
                type="info"
                message="Lưu ý"
                description="Thay đổi giá nhập/giá bán của lô sẽ ảnh hưởng đến báo cáo lợi nhuận. Vui lòng kiểm tra kỹ trước khi lưu."
                showIcon
              />
            </Form>
          )}
        </Modal>

        <style>{`
          .ant-notification-notice {
            border-radius: 12px !important;
          }
          @media (max-width: 768px) {
            .ant-notification {
              margin-right: 12px !important;
              width: calc(100vw - 24px) !important;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
}
