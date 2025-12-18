// src/pages/order/InventoryLookup.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Table, Input, Select, Typography, Spin, Empty, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import axios from "axios";

const { Title, Text } = Typography;
const { Option } = Select;
const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl}`;

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
  cost_price?: number;
  stock_quantity: number;
  unit: string;
  status: string;
  image?: {
    url: string;
  } | null;
}

const InventoryLookup: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "default">("default");
  const [statusFilter, setStatusFilter] = useState<"all" | "Đang kinh doanh" | "Ngừng kinh doanh" | "Ngừng bán">("all");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // LOAD dữ liệu sản phẩm
  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/products/store/${storeId}`, {
        headers,
      });
      const data = res.data.products || [];
      setProducts(data);
      setFiltered(data);
    } catch (err) {
      console.error("Lỗi tải tồn kho:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // FILTER tổng hợp: search + status + sort
  useEffect(() => {
    let result = [...products];

    // 1. Tìm kiếm theo tên hoặc SKU
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower));
    }

    // 2. Lọc theo trạng thái
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // 3. Sắp xếp tồn kho
    if (sortOrder !== "default") {
      result.sort((a, b) => (sortOrder === "asc" ? a.stock_quantity - b.stock_quantity : b.stock_quantity - a.stock_quantity));
    }

    setFiltered(result);
  }, [products, search, statusFilter, sortOrder]);

  const formatPrice = (price: number | undefined) => (price !== undefined ? price.toLocaleString("vi-VN") + "₫" : "-");

  // Các cột bảng
  const columns = [
    {
      title: "STT",
      key: "index",
      width: 70,
      align: "center" as const,
      render: (_: any, __: Product, index: number) => {
        const currentPage = pagination.current || 1;
        const pageSize = pagination.pageSize || 10;
        return (currentPage - 1) * pageSize + index + 1;
      },
    },
    {
      title: "Tên sản phẩm",
      key: "name",
      width: 300,
      render: (record: Product) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={record.image?.url || "/default-product.png"}
            alt={record.name}
            style={{
              width: 50,
              height: 50,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid #f0f0f0",
              background: "#fff",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/default-product.png";
            }}
          />
          <div>
            <Text strong>{record.name}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "Mã SKU",
      dataIndex: "sku",
      key: "sku",
      width: 180,
      render: (sku: string) => <Tag>{sku}</Tag>,
    },
    {
      title: "Giá vốn",
      dataIndex: "cost_price",
      key: "cost_price",
      width: 140,
      align: "right" as const,
      render: (price: number | undefined) => <Text>{formatPrice(price)}</Text>,
    },
    {
      title: "Đơn giá",
      dataIndex: "price",
      key: "price",
      width: 160,
      align: "right" as const,
      sorter: (a: Product, b: Product) => a.price - b.price,
      render: (price: number) => (
        <Text strong style={{ color: "#1d39c4" }}>
          {formatPrice(price)}
        </Text>
      ),
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      key: "unit",
      width: 100,
      align: "center" as const,
      render: (unit: string) => <Tag color="blue">{unit}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      align: "center" as const,
      render: (status: string) => <Tag color={status === "Đang kinh doanh" ? "green" : "volcano"}>{status}</Tag>,
    },
    {
      title: "Tồn kho",
      dataIndex: "stock_quantity",
      key: "stock_quantity",
      width: 120,
      align: "center" as const,
      render: (stock: number) => <Tag color={stock === 0 ? "red" : stock <= 10 ? "orange" : "green"}>{stock}</Tag>,
    },
  ];

  if (!storeId) {
    return (
      <div className="p-6">
        <Title level={4}>Tra cứu tồn kho</Title>
        <Empty description="Chưa chọn cửa hàng" />
      </div>
    );
  }

  const paginationConfig = {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => (
      <div>
        Đang xem{" "}
        <span style={{ color: "#1890ff", fontWeight: 600 }}>
          {range[0]} – {range[1]}
        </span>{" "}
        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản phẩm
      </div>
    ),
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center mb-4 gap-3">
        <Title level={1} className="!mb-0 text-gray-900 dark:text-gray-100">
          Tra cứu tồn kho
        </Title>
        <span className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm">{currentStore?.name}</span>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        {/* Ô tìm kiếm */}
        <Input
          size="large"
          placeholder="Tìm tên sản phẩm hoặc mã SKU..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 700, flex: 1 }}
        />

        {/* Bộ lọc */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-lg font-medium whitespace-nowrap">Bộ lọc:</span>

          {/* Lọc trạng thái */}
          <Select size="large" value={statusFilter} onChange={(v) => setStatusFilter(v as any)} style={{ width: 200 }}>
            <Option value="all">Tất cả trạng thái</Option>
            <Option value="Đang kinh doanh">Đang kinh doanh</Option>
            <Option value="Ngừng kinh doanh">Ngừng kinh doanh</Option>
            <Option value="Ngừng bán">Ngừng bán</Option>
          </Select>

          {/* Sắp xếp tồn kho */}
          <Select size="large" value={sortOrder} onChange={(v) => setSortOrder(v as "asc" | "desc" | "default")} style={{ width: 220 }}>
            <Option value="default">Tồn kho mặc định</Option>
            <Option value="asc">Tồn kho tăng dần</Option>
            <Option value="desc">Tồn kho giảm dần</Option>
          </Select>
        </div>
      </div>

      <Text className="block mb-4">
        Có tất cả{" "}
        <Tag color="blue" style={{ fontWeight: 600 }}>
          {filtered.length}
        </Tag>
        sản phẩm
      </Text>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spin size="large" />
        </div>
      ) : (
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="_id"
          pagination={{
            ...paginationConfig,
            current: pagination.current,
            pageSize: pagination.pageSize,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: "Không có sản phẩm" }}
        />
      )}
    </div>
  );
};

export default InventoryLookup;
