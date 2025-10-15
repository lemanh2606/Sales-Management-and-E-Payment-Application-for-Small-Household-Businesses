import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";

function SupplierListPage() {
  const { storeId } = useParams(); // lấy storeId từ URL
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🧩 Lấy danh sách supplier
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem("token"); // token sau khi login
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL || "http://localhost:9999"}/suppliers/stores/${storeId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setSuppliers(res.data.suppliers || []);
      } catch (err) {
        console.error("Lỗi tải danh sách nhà cung cấp:", err);
        setError(
          err.response?.data?.message ||
            "Không thể tải danh sách nhà cung cấp."
        );
      } finally {
        setLoading(false);
      }
    };

    if (storeId) fetchSuppliers();
  }, [storeId]);

  // 🗑️ Hàm xoá supplier
  const handleDelete = async (supplierId, supplierName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhà cung cấp "${supplierName}" không?`)) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${import.meta.env.VITE_API_URL || "http://localhost:9999"}/suppliers/${supplierId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("✅ Xóa thành công!");
      setSuppliers((prev) => prev.filter((s) => s._id !== supplierId));
    } catch (err) {
      console.error("Lỗi xóa nhà cung cấp:", err);
      alert(err.response?.data?.message || "Không thể xóa nhà cung cấp.");
    }
  };

  if (loading)
    return <p className="text-center mt-10">⏳ Đang tải danh sách...</p>;
  if (error)
    return <p className="text-center mt-10 text-red-600">❌ {error}</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Danh sách nhà cung cấp</h1>
        <Link
          to={`/stores/${storeId}/suppliers/create`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Thêm nhà cung cấp
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <p>Chưa có nhà cung cấp nào trong cửa hàng này.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="py-2 px-4 text-left">Tên nhà cung cấp</th>
                <th className="py-2 px-4 text-left">Số điện thoại</th>
                <th className="py-2 px-4 text-left">Email</th>
                <th className="py-2 px-4 text-left">Địa chỉ</th>
                <th className="py-2 px-4 text-left">Trạng thái</th>
                <th className="py-2 px-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s._id} className="border-t hover:bg-gray-50">
                  <td className="py-2 px-4">{s.name}</td>
                  <td className="py-2 px-4">{s.phone || "-"}</td>
                  <td className="py-2 px-4">{s.email || "-"}</td>
                  <td className="py-2 px-4">{s.address || "-"}</td>
                  <td className="py-2 px-4">
                    {s.status === "đang hoạt động" ? (
                      <span className="text-green-600 font-medium">
                        {s.status}
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium">
                        {s.status}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-center space-x-2">
                    <Link
                      to={`/suppliers/${s._id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Xem
                    </Link>
                    <Link
                      to={`/suppliers/${s._id}/edit`}
                      className="text-yellow-600 hover:underline"
                    >
                      Sửa
                    </Link>

                    {/* Xóa — nhìn như Link */}
  <button
    onClick={() => handleDelete(s._id, s.name)}
    className="text-red-600 hover:underline bg-transparent border-none cursor-pointer"
    style={{ padding: 0, font: "inherit" }}
  >
    Xóa
  </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SupplierListPage;
