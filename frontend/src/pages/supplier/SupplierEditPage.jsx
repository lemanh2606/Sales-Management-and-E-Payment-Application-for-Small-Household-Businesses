import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

function SupplierEditPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    status: "đang hoạt động",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🧩 Lấy thông tin supplier để điền vào form
  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL || "http://localhost:9999"}/suppliers/${supplierId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setFormData({
          name: res.data.supplier.name || "",
          phone: res.data.supplier.phone || "",
          email: res.data.supplier.email || "",
          address: res.data.supplier.address || "",
          status: res.data.supplier.status || "đang hoạt động",
        });
      } catch (err) {
        console.error("Lỗi tải thông tin nhà cung cấp:", err);
        setError(err.response?.data?.message || "Không thể tải thông tin nhà cung cấp.");
      } finally {
        setLoading(false);
      }
    };

    if (supplierId) fetchSupplier();
  }, [supplierId]);

  // 📝 Cập nhật giá trị form
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 💾 Gửi cập nhật lên server
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${import.meta.env.VITE_API_URL || "http://localhost:9999"}/suppliers/${supplierId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert("✅ Cập nhật thành công!");
      navigate(-1); // quay lại trang trước (danh sách)
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      alert(err.response?.data?.message || "Không thể cập nhật nhà cung cấp.");
    }
  };

  if (loading) return <p className="text-center mt-10">⏳ Đang tải...</p>;
  if (error) return <p className="text-center text-red-600 mt-10">❌ {error}</p>;

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Cập nhật nhà cung cấp</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Tên nhà cung cấp</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="border p-2 w-full rounded"
            required
          />
        </div>
        <div>
          <label className="block font-medium">Số điện thoại</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Địa chỉ</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Trạng thái</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border p-2 w-full rounded"
          >
            <option value="đang hoạt động">Đang hoạt động</option>
            <option value="ngừng hợp tác">Ngừng hợp tác</option>
          </select>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}

export default SupplierEditPage;
    