import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import Button from "../../components/Button";
import { getSuppliers, deleteSupplier } from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { MdVisibility, MdModeEditOutline, MdDeleteForever, MdAdd } from "react-icons/md";

import SupplierFormModal from "../../components/supplier/SupplierFormModal";
import ConfirmDeleteModal from "../../components/supplier/ConfirmDeleteModal";

export default function SupplierListPage() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: "" });
  const [deleting, setDeleting] = useState(false);

  const fetchSuppliers = async () => {
    if (!storeId || !token) return;
    try {
      setLoading(true);
      const data = await getSuppliers(storeId);
      setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [storeId, token]);

  const openFormModal = (supplierId = null) => {
    setEditSupplierId(supplierId);
    setFormModalOpen(true);
  };

  const openDelete = (id, name) => setDeleteModal({ open: true, id, name });

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteModal.id);
      setSuppliers(prev => prev.filter(s => s._id !== deleteModal.id));
      toast.success(`Đã xóa ${deleteModal.name}`);
      setDeleteModal({ open: false, id: null, name: "" });
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa nhà cung cấp.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Danh sách nhà cung cấp
          </h1>
          <Button
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
            onClick={() => openFormModal(null)}
          >
            <MdAdd size={20} /> Thêm nhà cung cấp
          </Button>
        </div>

        {loading && (
          <p className="text-center mt-6 text-gray-400 animate-pulse">
            ⏳ Đang tải...
          </p>
        )}

        {!loading && suppliers.length > 0 && (
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white">
            <table className="min-w-full text-gray-700 text-sm sm:text-base">
              <thead className="bg-gray-50 uppercase font-medium text-gray-600">
                <tr>
                  <th className="py-3 px-4 text-left">Tên</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">SĐT</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">Email</th>
                  <th className="py-3 px-4 text-left">Địa chỉ</th>
                  <th className="py-3 px-4 text-left">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, i) => (
                  <tr
                    key={s._id}
                    className={`transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg ${i % 2 === 0 ? "bg-white" : "bg-green-50"
                      }`}
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">{s.name}</td>
                    <td className="py-3 px-4 hidden sm:table-cell">{s.phone || "-"}</td>
                    <td className="py-3 px-4 hidden sm:table-cell">{s.email || "-"}</td>
                    <td className="py-3 px-4">{s.address || "-"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${s.status === "đang hoạt động" ? "text-green-600" : "text-red-500"
                          }`}
                      >
                        {s.status || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex justify-center items-center gap-3">
                      <Link
                        to={`/stores/${storeId}/suppliers/${s._id}`}
                        className="text-blue-500 hover:text-blue-700 hover:scale-110 transition transform"
                        title="Xem"
                      >
                        <MdVisibility size={22} />
                      </Link>
                      <button
                        onClick={() => openFormModal(s._id)}
                        className="text-yellow-500 hover:text-yellow-700 hover:scale-110 transition transform"
                        title="Sửa"
                      >
                        <MdModeEditOutline size={22} />
                      </button>
                      <button
                        onClick={() => openDelete(s._id, s.name)}
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
          <div className="mt-8 text-center text-gray-400 italic text-base sm:text-lg">
            Không có nhà cung cấp nào
          </div>
        )}

        {/* Modal Form */}
        <SupplierFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          storeId={storeId}
          supplierId={editSupplierId}
          onSuccess={fetchSuppliers}
        />

        {/* Modal Confirm Delete */}
        <ConfirmDeleteModal
          open={deleteModal.open}
          onOpenChange={(open) => setDeleteModal(prev => ({ ...prev, open }))}
          itemName={deleteModal.name}
          onConfirm={handleDelete}
          loading={deleting}
        />
      </div>
    </Layout>
  );
}
