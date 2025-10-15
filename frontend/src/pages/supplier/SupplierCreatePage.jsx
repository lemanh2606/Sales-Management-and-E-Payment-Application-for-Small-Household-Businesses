import React, { useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";

const SupplierCreatePage = () => {
  const { storeId } = useParams(); // 👈 Lấy storeId từ URL
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    status: "đang hoạt động",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Cập nhật dữ liệu form
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Gửi API tạo nhà cung cấp
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `http://localhost:9999/api/suppliers/stores/${storeId}`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setMessage("✅ Tạo nhà cung cấp thành công!");
      setTimeout(() => {
        navigate(`/stores/${storeId}/suppliers`);
      }, 1000);
    } catch (error) {
      console.error("❌ Lỗi tạo supplier:", error);
      setMessage(error.response?.data?.message || "Đã xảy ra lỗi khi tạo nhà cung cấp");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🧾 Thêm nhà cung cấp mới</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Tên nhà cung cấp *</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="w-full border p-2 rounded"
            placeholder="VD: Công ty TNHH ABC"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Số điện thoại</label>
          <input
            type="text"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            placeholder="VD: 0909123456"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            placeholder="VD: lienhe@abc.com"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Địa chỉ</label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            className="w-full border p-2 rounded"
            placeholder="VD: 123 Nguyễn Trãi, Hà Nội"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Trạng thái</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          >
            <option value="đang hoạt động">Đang hoạt động</option>
            <option value="ngừng hoạt động">Ngừng hoạt động</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Đang tạo..." : "Tạo nhà cung cấp"}
        </button>
      </form>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
};

export default SupplierCreatePage;
