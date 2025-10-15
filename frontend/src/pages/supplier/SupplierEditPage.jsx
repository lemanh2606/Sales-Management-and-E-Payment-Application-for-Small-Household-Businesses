import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import { getSupplierById, updateSupplier } from "../../api/supplierApi";
import toast from "react-hot-toast";

export default function SupplierEditPage() {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    status: "đang hoạt động",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        setLoading(true);
        const supplier = await getSupplierById(supplierId);
        const data = supplier?.supplier ?? supplier ?? {};
        setFormData({
          name: data.name || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          status: data.status || "đang hoạt động",
        });
      } catch (err) {
        console.error("Lỗi tải thông tin nhà cung cấp:", err);
        toast.error(
          err?.response?.data?.message ||
          err?.message ||
          "Không thể tải thông tin nhà cung cấp."
        );
      } finally {
        setLoading(false);
      }
    };

    if (supplierId) fetchSupplier();
    else {
      toast.error("Không có supplierId trong URL.");
      setLoading(false);
    }
  }, [supplierId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!storeId) {
      toast.error("Chưa chọn cửa hàng.");
      return;
    }

    setSaving(true);
    try {
      await updateSupplier(supplierId, formData);
      toast.success(" Cập nhật nhà cung cấp thành công!");
      setTimeout(() => navigate(`/stores/${storeId}/suppliers`), 700);
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Không thể cập nhật nhà cung cấp."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <p className="text-center mt-10 text-gray-500 animate-pulse">
          ⏳ Đang tải thông tin nhà cung cấp...
        </p>
      </Layout>
    );

  return (
    <Layout>
      <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-3xl shadow-md border border-blue-100">
        <h1 className="text-3xl font-bold mb-6 text-blue-700 text-center ">
          Cập nhật nhà cung cấp
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {["name", "phone", "email", "address"].map((field) => (
            <div key={field}>
              <label className="block mb-1 font-medium text-gray-700 capitalize">
                {field === "name"
                  ? "Tên nhà cung cấp *"
                  : field === "phone"
                    ? "Số điện thoại"
                    : field === "email"
                      ? "Email"
                      : "Địa chỉ"}
              </label>
              <input
                type={field === "email" ? "email" : "text"}
                name={field}
                value={formData[field]}
                onChange={handleChange}
                required={field === "name"}
                placeholder={`Nhập ${field}`}
                className="w-full border border-gray-300 p-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition"
              />
            </div>
          ))}

          <div>
            <label className="block mb-1 font-medium text-gray-700">Trạng thái</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full border border-gray-300 p-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:shadow-md transition"
            >
              <option value="đang hoạt động">Đang hoạt động</option>
              <option value="ngừng hoạt động">Ngừng hoạt động</option>
            </select>
          </div>

          <div className="flex justify-between pt-6">
            <Button
              type="button"
              className="bg-gray-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition font-medium px-5 py-2 rounded-2xl shadow"
              onClick={() => navigate(-1)}
            >
              Hủy
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium px-5 py-2 rounded-2xl shadow-lg transition"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
