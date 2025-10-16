import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "react-modal";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import { MdModeEditOutline, MdAdd } from "react-icons/md";
import { getProductsByStore } from "../../api/productApi";
import ProductForm from "../../components/product/ProductForm"; // import form mới

export default function ProductListPage() {
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState(null); // null => create, có data => edit

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchProducts = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await getProductsByStore(storeId);
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
  }, [storeId]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

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

  return (
    <Layout>
      <div className="p-6 mx-auto  bg-white ">
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

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:ring-2 focus:ring-green-400 outline-none transition-all duration-200"
          />
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-center mt-10 text-gray-400 animate-pulse text-lg">⏳ Đang tải...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="mt-10 text-center text-gray-400 italic text-lg">Không có sản phẩm nào</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white">
            <table className="min-w-full text-gray-700">
              <thead className="bg-gray-50 uppercase text-sm sm:text-base font-medium">
                <tr>
                  <th className="py-4 px-6 text-left">Tên sản phẩm</th>
                  <th className="py-4 px-6 text-left">SKU</th>
                  <th className="py-4 px-6 text-left">Giá bán</th>
                  <th className="py-4 px-6 text-left">Tồn kho</th>
                  <th className="py-4 px-6 text-left">Trạng thái</th>
                  <th className="py-4 px-6 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {currentProducts.map((product, i) => (
                  <tr key={product._id} className={`transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg ${i % 2 === 0 ? "bg-white" : "bg-green-50"}`}>
                    <td className="py-4 px-6 font-medium text-gray-900">{product.name}</td>
                    <td className="py-4 px-6">{product.sku || "-"}</td>
                    <td className="py-4 px-6 text-right">{product.price?.toLocaleString()}₫</td>
                    <td className="py-4 px-6 text-center">{product.stock_quantity}</td>
                    <td className="py-4 px-6">
                      <span className={product.status === "Đang kinh doanh" ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                        {product.status}
                      </span>
                    </td>
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
              onClick={() => handlePageChange(currentPage - 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
            >
              ← Trước
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`px-4 py-2 border rounded-lg ${currentPage === i + 1 ? "bg-green-600 text-white" : "hover:bg-gray-100"} transition`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
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
