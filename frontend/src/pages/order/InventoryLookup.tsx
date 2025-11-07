// src/pages/order/InventoryLookup.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, Input, Select, Typography, Spin, Empty, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import debounce from "../../utils/debounce"; // hoặc "@/utils/debounce"

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE = "http://localhost:9999/api";

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  unit: string;
}

const InventoryLookup: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "default">("default");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // LOAD Dữ liệu
  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/products/store/${storeId}`, { headers });
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

  // Tìm kiếm có dùng (debounced)
  const handleSearch = useMemo(
    () =>
      debounce((value: string) => {
        const lower = value.toLowerCase();
        const result = products.filter(
          (p) => p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower)
        );
        setFiltered(result);
      }, 200), // delay ngắn, tối ưu UX
    [products]
  );

  useEffect(() => {
    handleSearch(search);
  }, [search, handleSearch]);

  // FILTER theo số lượng tồn kho
  const handleSort = (order: "asc" | "desc" | "default") => {
    setSortOrder(order);
    if (order === "default") {
      setFiltered(products);
      return;
    }

    const sorted = [...filtered].sort((a, b) =>
      order === "asc" ? a.stock_quantity - b.stock_quantity : b.stock_quantity - a.stock_quantity
    );
    setFiltered(sorted);
  };

  const formatPrice = (price: number) => price.toLocaleString("vi-VN") + "₫";

  // Cột
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
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Mã SKU",
      dataIndex: "sku",
      key: "sku",
      width: 200,
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

  // Phân trang
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
      <div className="flex flex-col sm:flex-row sm:items-center  mb-4 gap-3">
        <Title level={1} className="!mb-0 text-gray-900 dark:text-gray-100">
          Tra cứu tồn kho
        </Title>
        <span className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm duration-200">
          {currentStore?.name}
        </span>
      </div>

      {/* Search + Filter */}
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
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium">Bộ lọc: </span>
          <Select
            size="large"
            value={sortOrder}
            onChange={(v) => handleSort(v as "asc" | "desc" | "default")}
            style={{ width: 220 }}
          >
            <Option value="default">Mặc định</Option>
            <Option value="asc">Tồn kho tăng dần</Option>
            <Option value="desc">Tồn kho giảm dần</Option>
          </Select>
        </div>
      </div>

      <Text className="block mb-4">
        Có tất cả <strong style={{ color: "#1d39c4" }}>{filtered.length}</strong> sản phẩm
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
          scroll={{ x: 600 }}
          locale={{ emptyText: "Không có sản phẩm" }}
          bordered
        />
      )}
    </div>
  );
};

export default InventoryLookup;
