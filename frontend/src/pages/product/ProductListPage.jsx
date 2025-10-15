import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import Modal from "react-modal"; // cài bằng: npm install react-modal


function ProductListPage() {
  const { storeId } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal sửa sản phẩm
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedProduct, setSelectedProduct] = useState(null);
const [editData, setEditData] = useState({
  name: "",
  price: "",
  stock_quantity: "",
  status: "",
});


  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const token = localStorage.getItem("token");


  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/products/store/${storeId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setProducts(res.data.products || []);
      } catch (err) {
        setError(err.response?.data?.message || "Lỗi khi tải danh sách sản phẩm");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [storeId]);

  // Lọc theo tên sản phẩm
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tính toán phân trang
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };


  const openEditModal = (product) => {
  setSelectedProduct(product);
  setEditData({
    name: product.name,
    price: product.price,
    stock_quantity: product.stock_quantity,
    status: product.status,
  });
  setIsModalOpen(true);
};

const closeModal = () => {
  setIsModalOpen(false);
  setSelectedProduct(null);
};

const handleSaveEdit = async () => {
  try {
    await axios.put(
      `${import.meta.env.VITE_API_URL}/products/${selectedProduct._id}`,
      editData,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    // Cập nhật lại danh sách
    setProducts((prev) =>
      prev.map((p) =>
        p._id === selectedProduct._id ? { ...p, ...editData } : p
      )
    );
    closeModal();
  } catch (error) {
    alert(error.response?.data?.message || "Lỗi khi cập nhật sản phẩm");
  }
};



  if (loading) return <div className="p-6 text-center">Đang tải dữ liệu...</div>;
  if (error) return <div className="p-6 text-red-600 text-center">{error}</div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Danh sách sản phẩm</h1>
        <Link to={`/stores/${storeId}/products/create`}>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            + Tạo sản phẩm mới
          </button>
        </Link>
      </div>

      {/* Ô tìm kiếm */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Tìm kiếm sản phẩm..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1); // reset page
          }}
          className="border rounded-lg px-3 py-2 w-full md:w-1/3"
        />
      </div>

      {/* Bảng hiển thị sản phẩm */}
      {filteredProducts.length === 0 ? (
        <p>Không có sản phẩm nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg shadow-md">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border-b text-left">Tên sản phẩm</th>
                <th className="py-2 px-4 border-b">SKU</th>
                <th className="py-2 px-4 border-b">Giá bán</th>
                <th className="py-2 px-4 border-b">Tồn kho</th>
                <th className="py-2 px-4 border-b">Trạng thái</th>
                <th className="py-2 px-4 border-b text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {currentProducts.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{product.name}</td>
                  <td className="py-2 px-4 border-b text-gray-600">{product.sku}</td>
                  <td className="py-2 px-4 border-b text-right">
                    {product.price.toLocaleString()}₫
                  </td>
                  <td className="py-2 px-4 border-b text-center">{product.stock_quantity}</td>
                  <td className="py-2 px-4 border-b text-center">
                    <span
                      className={`${
                        product.status === "Đang kinh doanh"
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b text-center space-x-2">
                    <Link to={`/products/${product._id}`}>
                      <button className="border border-gray-300 px-3 py-1 rounded hover:bg-gray-100">
                        Chi tiết
                      </button>
                    </Link>
                    <button
  onClick={() => openEditModal(product)}
  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
>
  Sửa
</button>

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6 space-x-2">
          <button
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ← Trước
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => handlePageChange(i + 1)}
              className={`px-3 py-1 border rounded ${
                currentPage === i + 1
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Sau →
          </button>
        </div>
      )}
      <Modal
  isOpen={isModalOpen}
  onRequestClose={closeModal}
  ariaHideApp={false}
  className="bg-white rounded-xl p-6 w-full max-w-md mx-auto mt-20 shadow-lg"
  overlayClassName="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-start"
>
  <h2 className="text-xl font-semibold mb-4">Chỉnh sửa sản phẩm</h2>
  <div className="space-y-3">
    <div>
      <label className="block text-sm font-medium">Tên sản phẩm</label>
      <input
        type="text"
        value={editData.name}
        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
        className="border rounded w-full p-2"
      />
    </div>
    <div>
      <label className="block text-sm font-medium">Giá bán</label>
      <input
        type="number"
        value={editData.price}
        onChange={(e) => setEditData({ ...editData, price: e.target.value })}
        className="border rounded w-full p-2"
      />
    </div>
    <div>
      <label className="block text-sm font-medium">Tồn kho</label>
      <input
        type="number"
        value={editData.stock_quantity}
        onChange={(e) =>
          setEditData({ ...editData, stock_quantity: e.target.value })
        }
        className="border rounded w-full p-2"
      />
    </div>
    <div>
      <label className="block text-sm font-medium">Trạng thái</label>
      <select
        value={editData.status}
        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
        className="border rounded w-full p-2"
      >
        <option value="Đang kinh doanh">Đang kinh doanh</option>
        <option value="Ngừng kinh doanh">Ngừng kinh doanh</option>
      </select>
    </div>
  </div>

  <div className="flex justify-end mt-6 space-x-2">
    <button
      onClick={closeModal}
      className="border px-4 py-2 rounded hover:bg-gray-100"
    >
      Hủy
    </button>
    <button
      onClick={handleSaveEdit}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    >
      Lưu thay đổi
    </button>
  </div>
</Modal>

    </div>
  );
}

export default ProductListPage;
