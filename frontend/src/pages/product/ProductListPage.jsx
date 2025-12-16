// src/pages/product/ProductListPage.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Space,
  Typography,
  Card,
  Input,
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
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import ProductForm from "../../components/product/ProductForm";
import { getProductsByStore, importProductsByExcel, exportProducts } from "../../api/productApi";
import * as XLSX from "xlsx";

const { Title, Text } = Typography;
const apiUrl = import.meta.env.VITE_API_URL;

export default function ProductListPage() {
  const [api, contextHolder] = notification.useNotification();

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;
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
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  const allColumns = [
    { key: "name", label: "Tên sản phẩm", default: true },
    { key: "sku", label: "SKU", default: true },
    { key: "price", label: "Giá bán", default: true },
    { key: "stock_quantity", label: "Tồn kho", default: true },
    { key: "status", label: "Trạng thái", default: true },
    { key: "cost_price", label: "Giá vốn", default: false },
    { key: "supplier", label: "Nhà cung cấp", default: false },
    { key: "group", label: "Nhóm sản phẩm", default: false },
    { key: "unit", label: "Đơn vị", default: false },
    { key: "min_stock", label: "Tồn tối thiểu", default: false },
    { key: "max_stock", label: "Tồn tối đa", default: false },
    { key: "image", label: "Hình ảnh", default: false },
    { key: "createdAt", label: "Ngày tạo", default: false },
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
      const response = await fetch(`${apiUrl}/products/template/download?format=excel`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Không thể tải template (mã ${response.status})`);
      }

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
        message: "✅ Đã tải template",
        description: "Vui lòng nhập dữ liệu theo file vừa tải.",
        placement: "topRight",
      });
    } catch (err) {
      console.error("Download template failed", err);
      api.error({
        message: "❌ Tải template thất bại",
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
        message: "❌ Lỗi tải dữ liệu",
        description: err?.message || "Không thể tải danh sách sản phẩm. Vui lòng thử lại.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchProducts();
    }
  }, [storeId]);

  useEffect(() => {
    if (!searchValue.trim()) {
      setFilteredProducts(allProducts);
      setCurrentPage(1);
      return;
    }

    const searchLower = searchValue.toLowerCase().trim();
    const filtered = allProducts.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      const supplierName = (product.supplier?.name || "").toLowerCase();
      const groupName = (product.group?.name || "").toLowerCase();

      return name.includes(searchLower) || sku.includes(searchLower) || supplierName.includes(searchLower) || groupName.includes(searchLower);
    });

    setFilteredProducts(filtered);
    setCurrentPage(1);
    // if (searchValue.trim()) {
    //   api.info({
    //     message: `🔍 Kết quả tìm kiếm`,
    //     description: `Tìm thấy ${filtered.length} sản phẩm phù hợp với từ khóa "${searchValue}"`,
    //     placement: "topRight",
    //     duration: 2,
    //   });
    // }
  }, [searchValue, allProducts]);

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <ShoppingOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>{product.name}</span>
          </Space>
          <Text type="secondary" style={{ fontSize: "clamp(10px, 2.5vw, 12px)" }}>
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
      message: "✅ Đã làm mới!",
      description: "Dữ liệu sản phẩm đã được cập nhật",
      placement: "topRight",
      duration: 2,
      key: "refresh",
    });
  };

  const toggleColumn = (checkedValues) => {
    setVisibleColumns(checkedValues);
    localStorage.setItem("productVisibleColumns", JSON.stringify(checkedValues));

    // api.success({
    //   message: "✅ Cập nhật cột thành công",
    //   description: `Hiện tại hiển thị ${checkedValues.length} cột`,
    //   placement: "bottomRight",
    //   duration: 2,
    // });
  };

  const resetImportState = () => {
    setImportFile(null);
    setPreviewRows([]);
    setPreviewError("");
    setPreviewLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        message: "❌ Định dạng không hỗ trợ",
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
      message: `✏️ Chỉnh sửa sản phẩm`,
      description: `Đang chỉnh sửa: ${product.name}`,
      placement: "topRight",
      duration: 2,
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };

  const onFormSuccess = () => {
    fetchProducts(false);
    closeModal();

    api.success({
      message: modalProduct ? "🎉 Cập nhật thành công!" : "🎉 Tạo sản phẩm thành công!",
      description: modalProduct
        ? `Sản phẩm "${modalProduct.name}" đã được cập nhật trong hệ thống.`
        : "Sản phẩm mới đã được thêm vào danh sách thành công.",
      placement: "topRight",
      duration: 4,
    });
  };

  const totalValue = filteredProducts.reduce((sum, p) => sum + (p.price * p.stock_quantity || 0), 0);
  const totalStock = filteredProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
  const activeProducts = filteredProducts.filter((p) => p.status === "Đang kinh doanh").length;

  useEffect(() => {
    if (allProducts.length > 0) {
      const lowStockProducts = allProducts.filter((p) => p.stock_quantity > 0 && p.min_stock && p.stock_quantity <= p.min_stock);

      if (lowStockProducts.length > 0) {
        api.warning({
          message: "⚠️ Cảnh báo tồn kho thấp",
          description: (
            <div>
              <p style={{ marginBottom: 8 }}>
                Có <strong>{lowStockProducts.length}</strong> sản phẩm đang ở mức tồn kho tối thiểu:
              </p>
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                {lowStockProducts.slice(0, 3).map((p) => (
                  <li key={p._id}>
                    {p.name}: <strong>{p.stock_quantity}</strong> (min: {p.min_stock})
                  </li>
                ))}
                {lowStockProducts.length > 3 && <li>... và {lowStockProducts.length - 3} sản phẩm khác</li>}
              </ul>
            </div>
          ),
          placement: "bottomRight",
          duration: 8,
        });
      }
    }
  }, [allProducts]);

  const getTableColumns = () => {
    const columnConfigs = {
      name: {
        title: (
          <Space>
            <ShoppingOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Tên sản phẩm</span>
          </Space>
        ),
        dataIndex: "name",
        key: "name",
        width: isMobile ? 180 : 250,
        ellipsis: true,
        render: (text) => (
          <Text strong style={{ color: "#1890ff", fontSize: "clamp(12px, 2.5vw, 14px)" }}>
            {text}
          </Text>
        ),
      },
      sku: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>SKU</span>,
        dataIndex: "sku",
        key: "sku",
        width: isMobile ? 100 : 150,
        render: (text) => (
          <Tag color="cyan" style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
            {text || "-"}
          </Tag>
        ),
      },
      price: {
        title: (
          <Space>
            <DollarOutlined style={{ color: "#52c41a" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Giá bán</span>
          </Space>
        ),
        dataIndex: "price",
        key: "price",
        width: isMobile ? 110 : 150,
        align: "right",
        render: (value) => (
          <Text strong style={{ color: "#52c41a", fontSize: "clamp(11px, 2.5vw, 13px)" }}>
            {value ? `${value.toLocaleString()}₫` : "-"}
          </Text>
        ),
      },
      stock_quantity: {
        title: (
          <Space>
            <StockOutlined style={{ color: "#faad14" }} />
            <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Tồn kho</span>
          </Space>
        ),
        dataIndex: "stock_quantity",
        key: "stock_quantity",
        width: isMobile ? 90 : 120,
        align: "center",
        render: (value, record) => {
          const isLowStock = record.min_stock && value <= record.min_stock && value > 0;
          return (
            <Tooltip title={isLowStock ? "Tồn kho thấp!" : ""}>
              <Badge
                count={value || 0}
                overflowCount={999999}
                showZero
                style={{
                  backgroundColor: value > 10 ? "#52c41a" : value > 0 ? "#faad14" : "#f5222d",
                  fontSize: "clamp(10px, 2vw, 12px)",
                }}
              />
            </Tooltip>
          );
        },
      },
      status: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Trạng thái</span>,
        dataIndex: "status",
        key: "status",
        fixed: "right",
        width: isMobile ? 140 : 170,
        align: "center",
        render: (value) => (
          <Tag
            icon={value === "Đang kinh doanh" ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={value === "Đang kinh doanh" ? "success" : "error"}
            style={{ fontSize: "clamp(10px, 2vw, 12px)" }}
          >
            {value || "Chưa xác định"}
          </Tag>
        ),
      },
      cost_price: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Giá vốn</span>,
        dataIndex: "cost_price",
        key: "cost_price",
        width: isMobile ? 110 : 130,
        align: "center",
        render: (value) =>
          value ? (
            <Tag
              color="#a1ec44d2" // xanh lá nhạt trong suốt
              style={{
                borderRadius: 6,
                padding: "2px 8px",
                border: "1px solid #56AB2F55",
                color: "black",
                fontSize: "clamp(11px, 2.5vw, 13px)",
              }}
            >
              {value.toLocaleString()}₫
            </Tag>
          ) : (
            "-"
          ),
      },
      supplier: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Nhà cung cấp</span>,
        dataIndex: "supplier",
        key: "supplier",
        width: isMobile ? 120 : 150,
        ellipsis: true,
        render: (value) => <Text style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{value?.name || "-"}</Text>,
      },
      group: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Nhóm sản phẩm</span>,
        dataIndex: "group",
        key: "group",
        width: isMobile ? 120 : 150,
        ellipsis: true,
        render: (value) => (
          <Tag color="purple" style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
            {value?.name || "-"}
          </Tag>
        ),
      },
      unit: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Đơn vị</span>,
        dataIndex: "unit",
        align: "center",
        key: "unit",
        width: 100,
        render: (value) => <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{value || "-"}</span>,
      },
      min_stock: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Tồn tối thiểu</span>,
        dataIndex: "min_stock",
        key: "min_stock",
        width: 100,
        align: "center",
        render: (value) => <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{value || 0}</span>,
      },
      max_stock: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Tồn tối đa</span>,
        dataIndex: "max_stock",
        key: "max_stock",
        width: 100,
        align: "center",
        render: (value) => <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{value || 0}</span>,
      },
      image: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Ảnh</span>,
        dataIndex: "image",
        key: "image",
        width: 100,
        align: "center",
        render: (value, record) =>
          value?.url ? (
            <Image
              src={value.url}
              alt={record.name}
              width={isMobile ? 40 : 50}
              height={isMobile ? 40 : 50}
              style={{ objectFit: "cover", borderRadius: "8px" }}
              preview={{ mask: <EyeOutlined /> }}
            />
          ) : (
            <Text type="secondary" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
              -
            </Text>
          ),
      },
      createdAt: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Ngày tạo</span>,
        dataIndex: "createdAt",
        key: "createdAt",
        width: 120,
        align: "center",
        render: (value) => <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{value ? new Date(value).toLocaleDateString("vi-VN") : "-"}</span>,
      },
      updatedAt: {
        title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Cập nhật</span>,
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 120,
        align: "center",
        render: (value) => <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{value ? new Date(value).toLocaleDateString("vi-VN") : "-"}</span>,
      },
    };

    // Thứ tự cố định mong muốn cho các cột chính, từ trái qua phải
    const leftFixedOrder = ["name", "sku", "price", "stock_quantity"];
    // các cột luôn phải nằm ngay trước cột hành động
    const rightFixed = ["status"];
    // Xây danh sách các cột "middle":
    // Đây là những cột được chọn hiển thị (visibleColumns),nhưng KHÔNG nằm trong nhóm cố định bên trái (leftFixedOrder)
    // và KHÔNG phải cột "status" (rightFixed). Những cột này sẽ được chèn vào giữa "tồn kho" và "trạng thái".
    const middleColumnsKeys = allColumns
      .map((c) => c.key) // Giữ thứ tự chuẩn theo allColumns để tránh việc các cột bị lộn xộn
      .filter(
        (key) =>
          visibleColumns.includes(key) && // Chỉ lấy các cột mà người dùng đang bật
          !leftFixedOrder.includes(key) && // Loại bỏ các cột cố định bên trái
          !rightFixed.includes(key) // Loại bỏ cột trạng thái (sẽ thêm sau)
      );

    // Xây cấu trúc mảng columns theo thứ tự mong muốn:
    // 1. Nhóm cố định bên trái (nếu đang được bật)
    // 2. Các cột middle người dùng chọn thêm
    // 3. Cột trạng thái (nếu bật)
    // 4. Cuối cùng sẽ push thêm cột Thao tác ở dưới (ngoài đoạn này)
    const columns = [
      // Thêm các cột cố định bên trái (nếu người dùng bật)
      ...leftFixedOrder.filter((k) => visibleColumns.includes(k)).map((k) => columnConfigs[k]),
      // Thêm các cột middle (các cột chọn thêm)
      ...middleColumnsKeys.map((k) => columnConfigs[k]),
      // Thêm cột trạng thái (nếu có bật)
      ...(visibleColumns.includes("status") ? [columnConfigs["status"]] : []),
    ].filter(Boolean); // Lọc bỏ giá trị null/undefined để tránh lỗ

    columns.push({
      title: <span style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>Thao tác</span>,
      key: "action",
      width: isMobile ? 80 : 120,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Tooltip title="Chỉnh sửa">
          <Button
            type="primary"
            icon={<EditOutlined />}
            size={isMobile ? "small" : "middle"}
            onClick={() => openEditModal(record)}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
            }}
          />
        </Tooltip>
      ),
    });

    return columns;
  };

  const columnSelectorContent = (
    <Card
      style={{ width: "100%", border: "1px solid #8c8c8c", maxHeight: isMobile ? "70vh" : 400, overflowY: "auto" }}
      styles={{ body: { padding: 16 } }}
    >
      <Text strong style={{ fontSize: "clamp(13px, 3vw, 14px)" }}>
        Chọn cột hiển thị
      </Text>
      <Divider style={{ margin: "8px 0" }} />
      <Checkbox.Group value={visibleColumns} onChange={toggleColumn} style={{ width: "100%" }}>
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {allColumns.map((col) => (
            <Checkbox key={col.key} value={col.key} style={{ fontSize: "clamp(12px, 2.5vw, 14px)" }}>
              {col.label}
            </Checkbox>
          ))}
        </Space>
      </Checkbox.Group>
    </Card>
  );

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setItemsPerPage(pagination.pageSize);
  };

  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    return Object.keys(previewRows[0]).map((key) => ({
      title: <span style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>{key}</span>,
      dataIndex: key,
      key,
      ellipsis: true,
      render: (text) => <span style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>{text}</span>,
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

      const resultData = response?.results || {};
      const hasResultPayload = Array.isArray(resultData?.success) || Array.isArray(resultData?.failed);
      const successRows = resultData.success || [];
      const failedRows = resultData.failed || [];
      const totalRows = resultData.total ?? successRows.length + failedRows.length;

      if (!hasResultPayload) {
        await fetchProducts(false);
        api.success({
          message: response?.message || "🎉 Nhập sản phẩm thành công",
          description: "Danh sách sản phẩm đã được cập nhật",
          placement: "topRight",
          duration: 4,
        });
        setImportModalOpen(false);
        resetImportState();
        return;
      }

      if (successRows.length > 0) {
        await fetchProducts(false);
      }

      if (failedRows.length > 0) {
        api.warning({
          message: response?.message || "Import hoàn tất với cảnh báo",
          description: (
            <div>
              <p>
                Thành công {successRows.length}/{totalRows}. Có {failedRows.length} dòng lỗi đầu tiên:
              </p>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {failedRows.slice(0, 3).map((item) => (
                  <li key={item.row} style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
                    Dòng {item.row}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ),
          placement: "topRight",
          duration: 6,
        });
      } else {
        api.success({
          message: response?.message || "🎉 Nhập sản phẩm thành công",
          description: `Đã thêm ${successRows.length} sản phẩm vào hệ thống`,
          placement: "topRight",
          duration: 4,
        });
      }

      if (successRows.length > 0) {
        setImportModalOpen(false);
        resetImportState();
      }
    } catch (error) {
      console.error("Import products error:", error);
      const serverData = error?.response?.data;
      const failedRows = serverData?.results?.failed || [];

      api.error({
        message: serverData?.message || "❌ Nhập sản phẩm thất bại",
        description: failedRows.length ? (
          <div>
            <p>{`Thất bại ${failedRows.length}/${serverData?.results?.total ?? failedRows.length}.`}</p>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {failedRows.slice(0, 3).map((item) => (
                <li key={item.row} style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
                  Dòng {item.row}: {item.error}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          serverData?.error || error?.message || "Vui lòng kiểm tra file và thử lại"
        ),
        placement: "topRight",
        duration: 6,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!storeId) {
      return api.warning({
        message: "⚠️ Chưa chọn cửa hàng",
        description: "Vui lòng chọn cửa hàng trước khi xuất Excel",
        placement: "topRight",
      });
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

      // api.success({
      //   message: "🎉 Xuất Excel thành công",
      //   description: "File đã được tải xuống",
      //   placement: "topRight",
      // });
    } catch (error) {
      console.error("Export Excel error:", error);
      api.error({
        message: "❌ Xuất Excel thất bại",
        description: error?.message || "Không thể xuất file",
        placement: "topRight",
      });
    }
  };

  if (!storeId) {
    return (
      <Layout>
        {contextHolder}
        <Card style={{ border: "1px solid #8c8c8c", margin: isMobile ? 12 : 0, borderRadius: 16 }}>
          <Title level={2} style={{ fontSize: "clamp(20px, 5vw, 32px)" }}>
            Danh sách sản phẩm
          </Title>
          <Card style={{ background: "#FFF9C4", border: "none", marginTop: 16 }}>
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

      <div
        style={{
          padding: isMobile ? 1 : 0,
          minHeight: "100vh",
        }}
      >
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
                background: "#ffffff",
                WebkitBackgroundClip: "text",
                fontSize: "clamp(20px, 6vw, 32px)",
                fontWeight: 700,
                marginBottom: isMobile ? 4 : 8,
                color: "black",
              }}
            >
              📦 Quản lý Sản phẩm
            </Title>
            {!isMobile && (
              <Text type="secondary" style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
                Quản lý danh mục sản phẩm - giá bán, tồn kho và thông tin chi tiết
              </Text>
            )}
          </div>

          <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: isMobile ? 16 : 24 }}>
            <Col xs={12} sm={12} md={6}>
              <Tooltip title="Tổng số sản phẩm trong cửa hàng hiện tại">
                <Card
                  style={{
                    background: "#2C5364",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span style={{ color: "#fff", fontSize: "clamp(10px, 2.5vw, 14px)", fontWeight: 500 }}>
                        Tổng sản phẩm <InfoCircleOutlined style={{ color: "#2196F3", fontSize: 15 }} />{" "}
                      </span>
                    }
                    value={filteredProducts.length}
                    prefix={<AppstoreOutlined style={{ fontSize: "clamp(14px, 4vw, 20px)" }} />}
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
                    cursor: "pointer",
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span style={{ color: "#fff", fontSize: "clamp(10px, 2.5vw, 14px)", fontWeight: 500 }}>
                        Đang kinh doanh <InfoCircleOutlined style={{ color: "#2196F3", fontSize: 15 }} />
                      </span>
                    }
                    value={activeProducts}
                    prefix={<CheckCircleOutlined style={{ fontSize: "clamp(14px, 4vw, 20px)" }} />}
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
                    cursor: "pointer",
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span style={{ color: "#fff", fontSize: "clamp(10px, 2.5vw, 14px)", fontWeight: 500 }}>
                        Tồn kho <InfoCircleOutlined style={{ color: "#2196F3", fontSize: 15 }} />{" "}
                      </span>
                    }
                    value={totalStock}
                    prefix={<StockOutlined style={{ fontSize: "clamp(14px, 4vw, 20px)" }} />}
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
                    cursor: "pointer",
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 20 } }}
                >
                  <Statistic
                    title={
                      <span style={{ color: "#fff", fontSize: "clamp(10px, 2.5vw, 14px)", fontWeight: 500 }}>
                        Giá trị <InfoCircleOutlined style={{ color: "#2196F3", fontSize: 15 }} />{" "}
                      </span>
                    }
                    value={totalValue}
                    prefix={<DollarOutlined style={{ fontSize: "clamp(14px, 4vw, 20px)" }} />}
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

          {/* Thanh tìm kiếm và 4 nút hành động chính */}
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
              style={{ width: isMobile ? "100%" : 400, minWidth: isMobile ? "auto" : 300 }}
              size={isMobile ? "middle" : "large"}
              placeholder={isMobile ? "Tìm kiếm..." : "Tìm kiếm sản phẩm theo tên, SKU..."}
              allowClear
              onClear={() => setSearchValue("")}
            >
              <Input
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                suffix={
                  searchValue && (
                    <Text type="secondary" style={{ fontSize: "clamp(10px, 2vw, 12px)" }}>
                      {filteredProducts.length} kết quả
                    </Text>
                  )
                }
              />
            </AutoComplete>

            <Space size={isMobile ? 8 : 12} wrap style={{ width: isMobile ? "100%" : "auto" }}>
              <Button size={isMobile ? "middle" : "large"} icon={<ReloadOutlined />} onClick={handleRefresh}>
                {!isMobile && "Làm mới"}
              </Button>

              <Button
                size={isMobile ? "middle" : "large"}
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                style={{
                  borderColor: "#52c41a",
                  color: "#52c41a",
                }}
              >
                {!isMobile ? "Xuất Excel" : "Xuất"}
              </Button>

              {isMobile ? (
                <Button size="middle" icon={<MenuOutlined />} onClick={() => setDrawerVisible(true)}>
                  Cột
                </Button>
              ) : (
                <Dropdown
                  dropdownRender={() => <div style={{ width: 280 }}>{columnSelectorContent}</div>}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button size="large" icon={<SettingOutlined />}>
                    Cài đặt cột
                  </Button>
                </Dropdown>
              )}

              <Button size={isMobile ? "middle" : "large"} icon={<FileExcelOutlined />} loading={isImporting} onClick={handleExcelButtonClick}>
                Tải lên Sản phẩm
              </Button>

              <Button
                type="primary"
                size={isMobile ? "middle" : "large"}
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                }}
              >
                {isMobile ? "Thêm" : "Thêm sản phẩm"}
              </Button>
            </Space>
          </Space>
          {/* Hết thanh tìm kiếm và 4 nút */}

          <div style={{ overflowX: "auto" }}>
            <Table
              columns={getTableColumns()}
              dataSource={filteredProducts}
              rowKey="_id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: itemsPerPage,
                total: filteredProducts.length,
                showSizeChanger: !isMobile,
                showTotal: (total, range) => (
                  <div
                    style={{
                      fontSize: isMobile ? 12 : 14,
                      textAlign: isMobile ? "center" : "left",
                      padding: isMobile ? "0 8px" : 0,
                    }}
                  >
                    Đang xem{" "}
                    <span style={{ color: "#1890ff", fontWeight: 600 }}>
                      {range[0]} – {range[1]}
                    </span>{" "}
                    trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản phẩm
                  </div>
                ),
                pageSizeOptions: ["5", "10", "20", "50", "100"],
                style: { marginTop: 16 },
              }}
              onChange={handleTableChange}
              scroll={{ x: "max-content" }}
              size={isMobile ? "small" : "middle"}
              rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
              locale={{
                emptyText: (
                  <div style={{ padding: isMobile ? "24px 0" : "48px 0" }}>
                    <ShoppingOutlined style={{ fontSize: isMobile ? 32 : 48, color: "#d9d9d9" }} />
                    <div style={{ marginTop: 16, color: "#999", fontSize: "clamp(12px, 3vw, 14px)" }}>
                      {searchValue ? `Không tìm thấy sản phẩm nào với từ khóa "${searchValue}"` : "Chưa có sản phẩm nào"}
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </Card>

        <Drawer
          title={<span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>Chọn cột hiển thị</span>}
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
              <span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>{modalProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}</span>
            </Space>
          }
          open={isModalOpen}
          onCancel={closeModal}
          footer={null}
          width={isMobile ? "100%" : 900}
          styles={{
            body: {
              maxHeight: isMobile ? "calc(100vh - 100px)" : "calc(100vh - 200px)",
              overflowY: "auto",
              padding: isMobile ? 16 : 24,
            },
          }}
        >
          <ProductForm storeId={storeId} product={modalProduct} onSuccess={onFormSuccess} onCancel={closeModal} />
        </Modal>

        <Modal
          open={importModalOpen}
          onCancel={() => {
            setImportModalOpen(false);
            resetImportState();
          }}
          title={<span style={{ fontSize: "clamp(14px, 3.5vw, 16px)" }}>Tải lên sản phẩm bằng Excel</span>}
          width={isMobile ? "95%" : 720}
          centered
          okText="Xác nhận import"
          cancelText="Hủy"
          onOk={handleConfirmImport}
          confirmLoading={isImporting}
          okButtonProps={{ disabled: !importFile || !!previewError || previewLoading }}
          styles={{
            body: {
              padding: isMobile ? 12 : 24,
            },
          }}
        >
          <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleExcelFileChange} />

          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            <Text style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
              Sử dụng template chuẩn để đảm bảo dữ liệu hợp lệ.
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                loading={downloadingTemplate}
                style={{ marginLeft: 8, padding: 0, fontSize: "clamp(12px, 3vw, 14px)" }}
              >
                Tải template
              </Button>
            </Text>

            <Button
              icon={<FileExcelOutlined />}
              onClick={() => fileInputRef.current?.click()}
              loading={previewLoading}
              size={isMobile ? "middle" : "large"}
              style={{ fontSize: "clamp(12px, 3vw, 14px)" }}
            >
              Chọn file Excel / CSV
            </Button>
            <Text type="secondary" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
              Hỗ trợ .xlsx, .xls, .csv. File nên nhỏ hơn 20MB.
            </Text>

            {previewError && (
              <Alert
                type="error"
                message={previewError}
                showIcon
                closable
                onClose={() => setPreviewError("")}
                style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
              />
            )}

            {previewRows.length > 0 && (
              <Card size="small" styles={{ body: { padding: 0 } }}>
                <div style={{ padding: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <Text strong style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
                    Preview ({previewRows.length} dòng đầu tiên)
                  </Text>
                  <Text type="secondary" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
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
            )}

            {!previewRows.length && !previewError && (
              <Alert
                type="info"
                message="Chưa có file nào được chọn"
                description="Chọn file Excel/CSV theo template để xem trước dữ liệu trước khi import."
                showIcon
                style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
              />
            )}
          </Space>
        </Modal>
      </div>

      <style jsx>{`
        :global(.table-row-light) {
          background-color: #ffffff;
        }
        :global(.table-row-dark) {
          background-color: #fafafa;
        }
        :global(.table-row-light:hover),
        :global(.table-row-dark:hover) {
          background-color: #e6f7ff !important;
        }

        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar {
          height: ${isMobile ? "8px" : "14px"};
        }
        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar-track {
          background: #f5f5f5;
          border-radius: 10px;
        }
        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          border: ${isMobile ? "2px" : "3px"} solid #f5f5f5;
        }

        /* Mobile specific styles */
        @media (max-width: 768px) {
          :global(.ant-space-item) {
            width: 100%;
          }

          :global(.ant-card-body) {
            padding: 12px !important;
          }

          :global(.ant-statistic-title) {
            margin-bottom: 4px !important;
          }

          :global(.ant-table-pagination) {
            margin: 12px 0 !important;
          }

          :global(.ant-pagination-item),
          :global(.ant-pagination-prev),
          :global(.ant-pagination-next) {
            min-width: 28px !important;
            height: 28px !important;
            line-height: 26px !important;
            font-size: 12px !important;
          }
        }
      `}</style>

      <style jsx global>{`
        .ant-notification-notice {
          border-radius: 12px !important;
        }

        @media (max-width: 768px) {
          .ant-notification {
            margin-right: 12px !important;
            width: calc(100vw - 24px) !important;
          }

          .ant-notification-notice {
            padding: 12px 16px !important;
          }

          .ant-notification-notice-message {
            font-size: 13px !important;
            margin-bottom: 4px !important;
          }

          .ant-notification-notice-description {
            font-size: 12px !important;
          }
        }
      `}</style>
    </Layout>
  );
}
