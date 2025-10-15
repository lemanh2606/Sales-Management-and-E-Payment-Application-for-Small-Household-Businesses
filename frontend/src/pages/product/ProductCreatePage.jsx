import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Layout from "../../components/Layout";

function ProductCreatePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    cost_price: "",
    price: "",
    stock_quantity: "",
    unit: "",
    status: "Đang kinh doanh",
    supplier_id: "",
  });

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lấy danh sách nhà cung cấp để hiển thị trong dropdown
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/suppliers/store/${storeId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSuppliers(res.data.suppliers);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSuppliers();
  }, [storeId]);

  // Xử lý nhập liệu
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Submit form tạo sản phẩm
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/products/store/${storeId}`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess("Tạo sản phẩm thành công!");
      setTimeout(() => navigate(`/stores/${storeId}/products`), 1000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Không thể tạo sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Tạo sản phẩm mới</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white shadow-md rounded-xl p-6">
          <div>
            <label className="block font-medium mb-1">Tên sản phẩm</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="border rounded-lg w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Mã SKU</label>
            <input
              type="text"
              name="sku"
              required
              value={formData.sku}
              onChange={handleChange}
              className="border rounded-lg w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Giá nhập</label>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleChange}
                className="border rounded-lg w-full px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Giá bán</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="border rounded-lg w-full px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Số lượng tồn kho</label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleChange}
                className="border rounded-lg w-full px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Đơn vị tính</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="border rounded-lg w-full px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Nhà cung cấp</label>
            <select
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              className="border rounded-lg w-full px-3 py-2"
            >
              <option value="">-- Chọn nhà cung cấp --</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">Trạng thái</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="border rounded-lg w-full px-3 py-2"
            >
              <option value="Đang kinh doanh">Đang kinh doanh</option>
              <option value="Ngừng kinh doanh">Ngừng kinh doanh</option>
            </select>
          </div>

          {error && <p className="text-red-600">{error}</p>}
          {success && <p className="text-green-600">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Đang tạo..." : "Tạo sản phẩm"}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export default ProductCreatePage;
