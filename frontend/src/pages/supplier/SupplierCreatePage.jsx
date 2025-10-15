import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import { createSupplier } from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function SupplierCreatePage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    status: "đang hoạt động",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token || !storeId) {
      toast.error("Bạn chưa đăng nhập hoặc chưa chọn cửa hàng!");
      return;
    }

    setLoading(true);
    try {
      await createSupplier(storeId, formData);
      toast.success(" Tạo nhà cung cấp thành công!");
      setTimeout(() => navigate(`/stores/${storeId}/suppliers`), 800);
    } catch (err) {
      console.error(" Lỗi tạo supplier:", err);
      toast.error(err?.response?.data?.message || err?.message || "Đã xảy ra lỗi khi tạo nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto mt-10 p-8 bg-white rounded-3xl shadow-xl border border-blue-100">
        <h1 className="text-3xl font-bold mb-6 text-[#000000] text-center"> Thêm nhà cung cấp mới</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {["name", "phone", "email", "address"].map((field) => (
            <div key={field}>
              <label className="block mb-1 font-medium text-gray-700 capitalize">
                {field === "name" ? "Tên nhà cung cấp *" :
                  field === "phone" ? "Số điện thoại" :
                    field === "email" ? "Email" : "Địa chỉ"}
              </label>
              <input
                type={field === "email" ? "email" : "text"}
                name={field}
                value={formData[field]}
                onChange={handleChange}
                required={field === "name"}
                placeholder={`Nhập ${field}`}
                className="w-full border border-blue-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition"
              />
            </div>
          ))}

          <div>
            <label className="block mb-1 font-medium text-gray-700">Trạng thái</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full border border-blue-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition"
            >
              <option value="đang hoạt động">Đang hoạt động</option>
              <option value="ngừng hoạt động">Ngừng hoạt động</option>
            </select>
          </div>

          <div className="flex justify-between pt-6">
            <Button
              type="button"
              className="bg-gray-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700 shadow-md transition px-5 py-2 rounded-xl font-medium"
              onClick={() => navigate(-1)}
            >
              Hủy
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg transition px-5 py-2 rounded-xl font-semibold"
            >
              {loading ? "Đang tạo..." : "Tạo nhà cung cấp"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
