import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import { getSuppliers, deleteSupplier } from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { MdVisibility, MdModeEditOutline, MdDeleteForever } from "react-icons/md";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/Dialog";


export default function SupplierListPage() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: "" });
  const [deleting, setDeleting] = useState(false);

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!storeId || !token) {
        setLoading(false);
        toast.error("Không tìm thấy cửa hàng hoặc bạn chưa đăng nhập.");
        return;
      }

      try {
        setLoading(true);
        const data = await getSuppliers(storeId);
        const list = Array.isArray(data?.suppliers)
          ? data.suppliers
          : Array.isArray(data)
            ? data
            : [];
        setSuppliers(list);
      } catch (err) {
        console.error(err);
        toast.error(err?.message || "Không thể tải danh sách nhà cung cấp.");
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [storeId, token]);

  const openDeleteModal = (id, name) => {
    setDeleteModal({ open: true, id, name });
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteModal.id);
      setSuppliers((prev) => prev.filter((s) => s._id !== deleteModal.id));
      toast.success(` Đã xóa ${deleteModal.name}`);
      setDeleteModal({ open: false, id: null, name: "" });
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Không thể xóa nhà cung cấp.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Danh sách nhà cung cấp
          </h1>
          {storeId && (
            <Link to={`/stores/${storeId}/suppliers/create`}>
              <Button className="bg-green-100 text-green-800 hover:bg-green-200 shadow-md hover:shadow-lg transition-all duration-300 px-5 py-2 rounded-xl font-semibold">
                + Thêm nhà cung cấp
              </Button>
            </Link>
          )}
        </div>

        {loading && <p className="text-center mt-6 text-gray-400 animate-pulse">⏳ Đang tải...</p>}

        {!loading && suppliers.length > 0 && (
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white">
            <table className="min-w-full text-gray-700">
              <thead className="bg-gray-50 uppercase text-sm sm:text-base font-medium">
                <tr>
                  <th className="py-4 px-6 text-left">Tên</th>
                  <th className="py-4 px-6 text-left">SĐT</th>
                  <th className="py-4 px-6 text-left">Email</th>
                  <th className="py-4 px-6 text-left">Địa chỉ</th>
                  <th className="py-4 px-6 text-left">Trạng thái</th>
                  <th className="py-4 px-6 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, i) => (
                  <tr
                    key={s._id}
                    className={`transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg ${i % 2 === 0 ? "bg-white" : "bg-green-50"
                      }`}
                  >
                    <td className="py-4 px-6 font-medium text-gray-900">{s.name}</td>
                    <td className="py-4 px-6">{s.phone || "-"}</td>
                    <td className="py-4 px-6">{s.email || "-"}</td>
                    <td className="py-4 px-6">{s.address || "-"}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`font-semibold ${s.status === "đang hoạt động" ? "text-green-600" : "text-red-500"
                          }`}
                      >
                        {s.status || "-"}
                      </span>
                    </td>
                    <td className="py-4 px-6 flex justify-center items-center gap-4">
                      <Link
                        to={`/stores/${storeId}/suppliers/${s._id}`}
                        className="text-blue-500 hover:text-blue-700 hover:scale-110 transition transform"
                        title="Xem"
                      >
                        <MdVisibility size={22} />
                      </Link>
                      <Link
                        to={`/suppliers/${s._id}/edit`}
                        className="text-yellow-500 hover:text-yellow-700 hover:scale-110 transition transform"
                        title="Sửa"
                      >
                        <MdModeEditOutline size={22} />
                      </Link>
                      <button
                        onClick={() => openDeleteModal(s._id, s.name)}
                        className="text-red-500 hover:text-red-700 hover:scale-110 transition transform"
                        aria-label={`Xóa ${s.name}`}
                      >
                        <MdDeleteForever size={22} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && suppliers.length === 0 && (
          <div className="mt-10 text-center text-gray-400 italic text-lg">
            Không có nhà cung cấp nào
          </div>
        )}

        {/* Modal Confirm Xóa */}
        <Dialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-red-600"> Xác nhận xóa</DialogTitle>
            </DialogHeader>
            <p className="mt-2 text-gray-700">
              Bạn có chắc muốn xóa nhà cung cấp <b>{deleteModal.name}</b>? Hành động này không thể hoàn tác.
            </p>
            <DialogFooter className="mt-4 flex justify-end gap-3">
              <Button
                type="button"
                className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={() => setDeleteModal({ open: false, id: null, name: "" })}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Đang xóa..." : "Xóa ngay"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
