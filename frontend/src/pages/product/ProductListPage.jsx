import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { MdModeEditOutline, MdAdd, MdViewColumn } from "react-icons/md";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import { getProductsByStore } from "../../api/productApi";
import ProductForm from "../../components/product/ProductForm";
import Modal from "react-modal";

export default function ProductListPage() {
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // 👉 FIX: Load visibleColumns từ localStorage, fallback default
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("productVisibleColumns");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure status always included if default
        if (!parsed.includes("status")) parsed.push("status");
        return parsed;
      }
    } catch (err) {
      console.warn("Lỗi load visibleColumns:", err);
    }
    return allColumns.filter(col => col.default).map(col => col.key);
  });

  const fetchProducts = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await getProductsByStore(storeId, { 
        page: currentPage, 
        limit: itemsPerPage,
        search: searchTerm || undefined
      });
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchProducts();
  }, [storeId, currentPage, searchTerm]);

  const currentProducts = products;

  const toggleColumn = (key) => {
    setVisibleColumns(prev => {
      const newVisible = prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key];
      // 👉 FIX: Luôn giữ status nếu toggle off (optional, hoặc remove nếu muốn toggle được)
      if (!newVisible.includes("status") && allColumns.find(col => col.key === "status")?.default) {
        newVisible.push("status");
      }
      // 👉 FIX: Save to localStorage sau toggle
      localStorage.setItem("productVisibleColumns", JSON.stringify(newVisible));
      return newVisible;
    });
  };

  const openCreateModal = () => {
    setModalProduct(null);
    setIsModalOpen(true);
  };
  const openEditModal = (product) => {
    setModalProduct(product);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setModalProduct(null);
  };
  const onFormSuccess = () => {
    fetchProducts();
    closeModal();
  };

  // Dropdown cho cột
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setColumnDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 👉 FIX: Dynamic columns excluding status/actions, status always right if visible, actions last
  const dynamicColumns = allColumns.filter(col => visibleColumns.includes(col.key) && col.key !== "status" && col.key !== "name" && col.key !== "sku" && col.key !== "price" && col.key !== "stock_quantity");

  const renderColumnHeader = (col) => <th key={col.key} className="py-3 px-2 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[80px] max-w-[120px] w-[8%]">{col.label}</th>; // 👉 FIX: Giảm max-w, w-[8%] để fit 14+ columns

  const renderColumnCell = (product, col) => {
    const value = product[col.key];
    switch (col.key) {
      case "name":
        return <td key={col.key} className="py-3 px-2 font-medium text-gray-900 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value || "-"}</td>;
      case "sku":
        return <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">{value || "-"}</td>;
      case "price":
        return <td key={col.key} className="py-3 px-2 text-left border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value ? `${value.toLocaleString()}₫` : "-"}</td>;
      case "stock_quantity":
        return <td key={col.key} className="py-3 px-2 text-left border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">{value || 0}</td>;
      case "cost_price":
        return <td key={col.key} className="py-3 px-2 text-left border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value ? `${value.toLocaleString()}₫` : "-"}</td>;
      case "supplier":
        return <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value?.name || "-"}</td>;
      case "group":
        return <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value?.name || "-"}</td>;
      case "unit":
        return <td key={col.key} className="py-3 px-2 text-left border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">{value || "-"}</td>;
      case "min_stock":
        return <td key={col.key} className="py-3 px-2 text-left border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">{value || 0}</td>;
      case "max_stock":
        return <td key={col.key} className="py-3 px-2 text-left border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">{value || 0}</td>;
      case "image":
        return (
          <td key={col.key} className="py-3 px-2 border-b border-gray-100 text-left min-w-[80px] max-w-[120px] w-[8%]">
            {value ? <img src={value} alt={product.name} className="w-8 h-8 object-cover rounded" /> : "-"}
          </td>
        );
      case "createdAt":
        return <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value ? new Date(value).toLocaleDateString('vi-VN') : "-"}</td>;
      case "updatedAt":
        return <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%] truncate">{value ? new Date(value).toLocaleDateString('vi-VN') : "-"}</td>;
      case "status":
        return (
          <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">
            <span className={value === "Đang kinh doanh" ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
              {value || "Chưa xác định"}
            </span>
          </td>
        );
      default:
        return <td key={col.key} className="py-3 px-2 border-b border-gray-100 min-w-[80px] max-w-[120px] w-[8%]">{"-"}</td>;
    }
  };

  return (
    <Layout>
      <div className="p-6 mx-auto bg-white rounded-2xl transition-all duration-300">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Danh sách sản phẩm</h1>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-green-500 text-white px-5 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <MdAdd size={22} /> Thêm sản phẩm
          </Button>
        </div>

        {/* Search + Column Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:ring-2 focus:ring-green-400 outline-none transition-all duration-200"
          />

          <div className="relative" ref={dropdownRef}>
            <Button
              onClick={() => setColumnDropdownOpen(!columnDropdownOpen)}
              className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-300 transition-all"
            >
              <MdViewColumn size={20} /> Cài đặt các cột để hiển thị
            </Button>

            {columnDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
                {allColumns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-sm hover:bg-gray-100 p-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-center mt-10 text-gray-400 animate-pulse text-lg">⏳ Đang tải...</p>
        ) : currentProducts.length === 0 ? (
          <p className="mt-10 text-center text-gray-400 italic text-lg">Không có sản phẩm nào</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white transition-all duration-300 max-w-full">
            <table className="min-w-full text-gray-700 table-fixed">
              <thead className="bg-gray-50 uppercase text-sm sm:text-base font-medium">
                <tr>
                  {/* 👉 FIX: Default columns (name, sku, price, stock_quantity) always first */}
                  {allColumns.filter(col => ["name", "sku", "price", "stock_quantity"].includes(col.key)).map(renderColumnHeader)}
                  {/* 👉 FIX: Dynamic columns (newly added) before status */}
                  {dynamicColumns.map(renderColumnHeader)}
                  {/* 👉 FIX: Status and Actions always right */}
                  {visibleColumns.includes("status") && renderColumnHeader(allColumns.find(col => col.key === "status"))}
                  <th className="py-3 px-2 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[80px] max-w-[80px] w-[8%]">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {currentProducts.map((product, i) => (
                  <tr
                    key={product._id}
                    className={`transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg ${i % 2 === 0 ? "bg-white" : "bg-green-50"}`}
                  >
                    {/* 👉 FIX: Default columns first */}
                    {allColumns.filter(col => ["name", "sku", "price", "stock_quantity"].includes(col.key)).map(col => renderColumnCell(product, col))}
                    {/* 👉 FIX: Dynamic columns before status */}
                    {dynamicColumns.map(col => renderColumnCell(product, col))}
                    {/* 👉 FIX: Status and Actions always right */}
                    {visibleColumns.includes("status") && renderColumnCell(product, allColumns.find(col => col.key === "status"))}
                    <td className="py-3 px-2 flex justify-center items-center gap-2 border-b border-gray-100 min-w-[80px] max-w-[80px] w-[8%]">
                      <button 
                        onClick={() => openEditModal(product)} 
                        className="text-yellow-500 hover:text-yellow-700 hover:scale-110 transition transform" 
                        title="Sửa"
                      >
                        <MdModeEditOutline size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {products.length >= itemsPerPage && (
          <div className="flex flex-wrap justify-center mt-6 gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
            >
              ← Trước
            </button>
            {[...Array(Math.ceil(products.length / itemsPerPage))].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-4 py-2 border rounded-lg ${currentPage === i + 1 ? "bg-green-600 text-white" : "hover:bg-gray-100"} transition`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={currentPage === Math.ceil(products.length / itemsPerPage)}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
            >
              Sau →
            </button>
          </div>
        )}

        <Modal
          isOpen={isModalOpen}
          onRequestClose={closeModal}
          ariaHideApp={false}
          className="bg-white rounded-2xl p-6 w-full max-w-3xl mx-auto mt-20 shadow-2xl overflow-auto max-h-[90vh]"
          overlayClassName="fixed inset-0 bg-[#070505e1] bg-opacity-40 flex justify-center items-start"
        >
          <ProductForm
            storeId={storeId}
            product={modalProduct}
            onSuccess={onFormSuccess}
            onCancel={closeModal}
          />
        </Modal>
      </div>
    </Layout>
  );
}