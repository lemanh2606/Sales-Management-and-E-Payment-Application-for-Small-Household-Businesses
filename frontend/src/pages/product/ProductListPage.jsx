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

  const [visibleColumns, setVisibleColumns] = useState(
    allColumns.filter(col => col.default).map(col => col.key)
  );

  const fetchProducts = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await getProductsByStore(storeId, { page: currentPage, limit: itemsPerPage });
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [storeId, currentPage]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const toggleColumn = (key) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
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

  return (
    <Layout>
      <div className="p-6 mx-auto bg-white rounded-2xl  transition-all duration-300">
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
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:ring-2 focus:ring-green-400 outline-none transition-all duration-200"
          />

          <div className="relative" ref={dropdownRef}>
            <Button
              onClick={() => setColumnDropdownOpen(!columnDropdownOpen)}
              className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-300 transition-all"
            >
              <MdViewColumn size={20} /> Cột hiển thị
            </Button>

            {columnDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 flex flex-col gap-2 max-h-72 overflow-auto scroll-hidden">
                {allColumns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-sm hover:bg-gray-100 p-1 rounded">
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
        ) : filteredProducts.length === 0 ? (
          <p className="mt-10 text-center text-gray-400 italic text-lg">Không có sản phẩm nào</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white transition-all duration-300 scroll-hidden">
            <table className="min-w-full text-gray-700">
              <thead className="bg-gray-50 uppercase text-sm sm:text-base font-medium">
                <tr>
                  {allColumns.filter(col => visibleColumns.includes(col.key)).map(col => (
                    <th key={col.key} className="py-4 px-6 text-left">{col.label}</th>
                  ))}
                  <th className="py-4 px-6 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {currentProducts.map((product, i) => (
                  <tr
                    key={product._id}
                    className={`transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg ${i % 2 === 0 ? "bg-white" : "bg-green-50"}`}
                  >
                    {visibleColumns.includes("name") && <td className="py-4 px-6 font-medium text-gray-900">{product.name}</td>}
                    {visibleColumns.includes("sku") && <td className="py-4 px-6">{product.sku || "-"}</td>}
                    {visibleColumns.includes("price") && <td className="py-4 px-6 text-right">{product.price?.toLocaleString()}₫</td>}
                    {visibleColumns.includes("cost_price") && <td className="py-4 px-6 text-right">{product.cost_price?.toLocaleString()}₫</td>}
                    {visibleColumns.includes("stock_quantity") && <td className="py-4 px-6 text-center">{product.stock_quantity}</td>}
                    {visibleColumns.includes("min_stock") && <td className="py-4 px-6 text-center">{product.min_stock}</td>}
                    {visibleColumns.includes("max_stock") && <td className="py-4 px-6 text-center">{product.max_stock}</td>}
                    {visibleColumns.includes("unit") && <td className="py-4 px-6 text-center">{product.unit}</td>}
                    {visibleColumns.includes("status") && (
                      <td className="py-4 px-6">
                        <span className={product.status === "Đang kinh doanh" ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                          {product.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes("supplier") && <td className="py-4 px-6">{product.supplier?.name || "-"}</td>}
                    {visibleColumns.includes("group") && <td className="py-4 px-6">{product.group?.name || "-"}</td>}
                    {visibleColumns.includes("image") && (
                      <td className="py-4 px-6">
                        {product.image ? <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded" /> : "-"}
                      </td>
                    )}
                    {visibleColumns.includes("createdAt") && <td className="py-4 px-6">{new Date(product.createdAt).toLocaleDateString()}</td>}
                    {visibleColumns.includes("updatedAt") && <td className="py-4 px-6">{new Date(product.updatedAt).toLocaleDateString()}</td>}

                    <td className="py-4 px-6 flex justify-center items-center gap-4">
                      <button onClick={() => openEditModal(product)} className="text-yellow-500 hover:text-yellow-700 hover:scale-110 transition transform" title="Sửa">
                        <MdModeEditOutline size={22} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-wrap justify-center mt-6 gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
            >
              ← Trước
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-4 py-2 border rounded-lg ${currentPage === i + 1 ? "bg-green-600 text-white" : "hover:bg-gray-100"} transition`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
            >
              Sau →
            </button>
          </div>
        )}

        {/* Modal Create/Edit */}
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
