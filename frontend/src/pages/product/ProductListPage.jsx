// src/pages/product/ProductListPage.jsx
import React, { useEffect, useState, useMemo } from "react";
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
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import ProductForm from "../../components/product/ProductForm";
import { getProductsByStore } from "../../api/productApi";

const { Title, Text } = Typography;

export default function ProductListPage() {
  // ✅ Only useNotification
  const [api, contextHolder] = notification.useNotification();

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
      console.warn("Lỗi load visibleColumns:", err);
    }
    return allColumns.filter((col) => col.default).map((col) => col.key);
  });

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

      const data = await getProductsByStore(storeId, {
        page: 1,
        limit: 10000,
      });

      const productList = Array.isArray(data?.products) ? data.products : [];
      setAllProducts(productList);
      setFilteredProducts(productList);

      if (showNotification) {
        api.success({
          message: "🎉 Tải dữ liệu thành công",
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

      return (
        name.includes(searchLower) ||
        sku.includes(searchLower) ||
        supplierName.includes(searchLower) ||
        groupName.includes(searchLower)
      );
    });

    setFilteredProducts(filtered);
    setCurrentPage(1);

    if (searchValue.trim()) {
      api.info({
        message: `🔍 Kết quả tìm kiếm`,
        description: `Tìm thấy ${filtered.length} sản phẩm phù hợp với từ khóa "${searchValue}"`,
        placement: "topRight",
        duration: 2,
      });
    }
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
            <span>{product.name}</span>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
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

    api.success({
      message: "✅ Cập nhật cột thành công",
      description: `Hiện tại hiển thị ${checkedValues.length} cột`,
      placement: "bottomRight",
      duration: 2,
    });
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
      const lowStockProducts = allProducts.filter(
        (p) => p.stock_quantity > 0 && p.min_stock && p.stock_quantity <= p.min_stock
      );

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
            <span>Tên sản phẩm</span>
          </Space>
        ),
        dataIndex: "name",
        key: "name",
        width: isMobile ? 180 : 250,
        ellipsis: true,
        render: (text) => (
          <Text strong style={{ color: "#1890ff" }}>
            {text}
          </Text>
        ),
      },
      sku: {
        title: "SKU",
        dataIndex: "sku",
        key: "sku",
        width: 150,
        render: (text) => <Tag color="cyan">{text || "-"}</Tag>,
      },
      price: {
        title: (
          <Space>
            <DollarOutlined style={{ color: "#52c41a" }} />
            <span>Giá bán</span>
          </Space>
        ),
        dataIndex: "price",
        key: "price",
        width: 150,
        align: "right",
        render: (value) => (
          <Text strong style={{ color: "#52c41a" }}>
            {value ? `${value.toLocaleString()}₫` : "-"}
          </Text>
        ),
      },
      stock_quantity: {
        title: (
          <Space>
            <StockOutlined style={{ color: "#faad14" }} />
            <span>Tồn kho</span>
          </Space>
        ),
        dataIndex: "stock_quantity",
        key: "stock_quantity",
        width: 120,
        align: "center",
        render: (value, record) => {
          const isLowStock = record.min_stock && value <= record.min_stock && value > 0;
          return (
            <Tooltip title={isLowStock ? "Tồn kho thấp!" : ""}>
              <Badge
                count={value || 0}
                overflowCount={999999} //không hiển thị 99+ mà hiển đầy đủ, mặc định Badge hiện là 99+ nếu lớn hơn 99
                showZero
                style={{
                  backgroundColor: value > 10 ? "#52c41a" : value > 0 ? "#faad14" : "#f5222d",
                }}
              />
            </Tooltip>
          );
        },
      },
      status: {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 170,
        align: "center",
        render: (value) => (
          <Tag
            icon={value === "Đang kinh doanh" ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={value === "Đang kinh doanh" ? "success" : "error"}
          >
            {value || "Chưa xác định"}
          </Tag>
        ),
      },
      cost_price: {
        title: "Giá vốn",
        dataIndex: "cost_price",
        key: "cost_price",
        width: 150,
        align: "right",
        render: (value) => <Text type="secondary">{value ? `${value.toLocaleString()}₫` : "-"}</Text>,
      },
      supplier: {
        title: "NCC",
        dataIndex: "supplier",
        key: "supplier",
        width: 150,
        ellipsis: true,
        render: (value) => <Text>{value?.name || "-"}</Text>,
      },
      group: {
        title: "Nhóm",
        dataIndex: "group",
        key: "group",
        width: 150,
        ellipsis: true,
        render: (value) => <Tag color="purple">{value?.name || "-"}</Tag>,
      },
      unit: {
        title: "ĐV",
        dataIndex: "unit",
        key: "unit",
        width: 100,
        render: (value) => value || "-",
      },
      min_stock: {
        title: "Min",
        dataIndex: "min_stock",
        key: "min_stock",
        width: 100,
        align: "center",
        render: (value) => value || 0,
      },
      max_stock: {
        title: "Max",
        dataIndex: "max_stock",
        key: "max_stock",
        width: 100,
        align: "center",
        render: (value) => value || 0,
      },
      image: {
        title: "Ảnh",
        dataIndex: "image",
        key: "image",
        width: 100,
        align: "center",
        render: (value, record) =>
          value ? (
            <Image
              src={value}
              alt={record.name}
              width={50}
              height={50}
              style={{ objectFit: "cover", borderRadius: "8px" }}
              preview={{ mask: <EyeOutlined /> }}
            />
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      createdAt: {
        title: "Ngày tạo",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 120,
        render: (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "-"),
      },
      updatedAt: {
        title: "Cập nhật",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 120,
        render: (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "-"),
      },
    };

    const columns = visibleColumns.map((key) => columnConfigs[key]).filter(Boolean);

    columns.push({
      title: "Thao tác",
      key: "action",
      width: 120,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Tooltip title="Chỉnh sửa">
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
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
      style={{ width: "100%", maxHeight: isMobile ? "70vh" : 400, overflowY: "auto" }}
      styles={{ body: { padding: 16 } }}
    >
      <Text strong style={{ fontSize: 14 }}>
        Chọn cột hiển thị
      </Text>
      <Divider style={{ margin: "8px 0" }} />
      <Checkbox.Group value={visibleColumns} onChange={toggleColumn} style={{ width: "100%" }}>
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {allColumns.map((col) => (
            <Checkbox key={col.key} value={col.key}>
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

  if (!storeId) {
    return (
      <Layout>
        {contextHolder}
        <Card style={{ margin: 24, borderRadius: 16 }}>
          <Title level={2}>Danh sách sản phẩm</Title>
          <Card style={{ background: "#FFF9C4", border: "none", marginTop: 16 }}>
            <Text strong>⚠️ Không tìm thấy cửa hàng hiện hành.</Text>
          </Card>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {contextHolder}

      <div style={{ padding: isMobile ? 12 : 24, background: "#ffffff", minHeight: "100vh" }}>
        <Card style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <Title
              level={2}
              style={{
                margin: 0,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontSize: isMobile ? 24 : 32,
                fontWeight: 700,
              }}
            >
              📦 Quản lý Sản phẩm
            </Title>
            {!isMobile && (
              <Text type="secondary">Quản lý danh mục sản phẩm - giá bán, tồn kho và thông tin chi tiết</Text>
            )}
          </div>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={12} md={6}>
              <Card
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: 12,
                }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <Statistic
                  title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Tổng Sản phẩm</span>}
                  value={filteredProducts.length}
                  prefix={<AppstoreOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                  valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 18 : 24 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                style={{
                  background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  border: "none",
                  borderRadius: 12,
                }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <Statistic
                  title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Đang kinh doanh</span>}
                  value={activeProducts}
                  prefix={<CheckCircleOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                  valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 18 : 24 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                style={{
                  background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  border: "none",
                  borderRadius: 12,
                }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <Statistic
                  title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Tồn kho</span>}
                  value={totalStock}
                  prefix={<StockOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                  valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 18 : 24 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Tooltip title="Công thức tính: 'Tồn kho' x 'Giá bán'">
                <Card
                  style={{
                    background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                  styles={{ body: { padding: isMobile ? 12 : 24 } }}
                >
                  <Statistic
                    title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Giá trị</span>}
                    value={totalValue}
                    prefix={<DollarOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                    suffix="₫"
                    valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 14 : 18 }}
                  />
                </Card>
              </Tooltip>
            </Col>
          </Row>

          {!isMobile && <Divider />}

          <Space
            direction={isMobile ? "vertical" : "horizontal"}
            style={{ marginBottom: 24, width: "100%", justifyContent: "space-between" }}
            size={16}
          >
            <AutoComplete
              value={searchValue}
              options={searchOptions}
              onChange={(value) => setSearchValue(value)}
              onSelect={(value) => setSearchValue(value)}
              style={{ width: isMobile ? "100%" : 400 }}
              size="large"
              placeholder={isMobile ? "Tìm kiếm..." : "Tìm kiếm sản phẩm..."}
              allowClear
              onClear={() => setSearchValue("")}
            >
              <Input
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                suffix={
                  searchValue && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {filteredProducts.length} kết quả
                    </Text>
                  )
                }
              />
            </AutoComplete>

            <Space size={12} wrap>
              <Button size="large" icon={<ReloadOutlined />} onClick={handleRefresh}>
                {!isMobile && "Làm mới"}
              </Button>

              {isMobile ? (
                <Button size="large" icon={<MenuOutlined />} onClick={() => setDrawerVisible(true)}>
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

              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                }}
              >
                {isMobile ? "+" : "Thêm sản phẩm"}
              </Button>
            </Space>
          </Space>

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
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} sản phẩm`,
              pageSizeOptions: ["5", "10", "20", "50", "100"],
            }}
            onChange={handleTableChange}
            scroll={{ x: "max-content" }}
            size={isMobile ? "small" : "middle"}
            rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
            locale={{
              emptyText: (
                <div style={{ padding: isMobile ? "24px 0" : "48px 0" }}>
                  <ShoppingOutlined style={{ fontSize: isMobile ? 32 : 48, color: "#d9d9d9" }} />
                  <div style={{ marginTop: 16, color: "#999" }}>
                    {searchValue ? `Không tìm thấy sản phẩm nào với từ khóa "${searchValue}"` : "Không có sản phẩm"}
                  </div>
                </div>
              ),
            }}
          />
        </Card>

        <Drawer
          title="Chọn cột hiển thị"
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
              <span>{modalProduct ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}</span>
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
          height: 14px;
        }
        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar-track {
          background: #f5f5f5;
          border-radius: 10px;
        }
        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          border: 3px solid #f5f5f5;
        }
      `}</style>

      <style jsx global>{`
        .ant-notification-notice {
          border-radius: 12px !important;
        }
      `}</style>
    </Layout>
  );
}
