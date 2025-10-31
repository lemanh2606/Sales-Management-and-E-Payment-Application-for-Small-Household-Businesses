import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdAdd, MdEdit, MdDelete } from "react-icons/md";
import { getProductGroupsByStore, deleteProductGroup } from "../../api/productGroupApi";
import Button from "../../components/Button";
import ProductGroupForm from "../../components/productGroup/ProductGroupForm";
import Layout from "../../components/Layout";

export default function ProductGroupsPage() {
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const fetchGroups = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const res = await getProductGroupsByStore(storeId);
      setGroups(res?.productGroups || []);
    } catch (err) {
      toast.error("Không thể tải danh sách nhóm sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [storeId]);

  const handleCreate = () => {
    setEditingGroup(null);
    setModalOpen(true);
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setModalOpen(true);
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm("Bạn có chắc muốn xóa nhóm sản phẩm này?")) return;
    try {
      await deleteProductGroup(groupId);
      toast.success("Xóa nhóm sản phẩm thành công");
      fetchGroups();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const handleFormSuccess = () => {
    setModalOpen(false);
    fetchGroups();
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quản lý nhóm sản phẩm</h1>
          <Button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-2xl hover:bg-green-700 transition"
          >
            <MdAdd size={22} /> Tạo nhóm mới
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-gray-500 text-center py-10">Đang tải...</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-500 text-center py-10">Chưa có nhóm sản phẩm nào</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group._id}
                className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col justify-between
                 shadow-md hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02]
                 transition-all duration-300 cursor-pointer"
              >
                <div className="space-y-3">
                  {/* Tên nhóm */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Tên nhóm</label>
                    <h2 className="text-xl font-bold text-gray-800 mt-1">{group.name}</h2>
                  </div>

                  {/* Mô tả */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Mô tả</label>
                    <p className="text-sm text-gray-500 mt-1">{group.description || "-"}</p>
                  </div>

                  {/* Số sản phẩm */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase">Số sản phẩm</label>
                    <p className="text-sm text-gray-600 mt-1 font-medium">{group.productCount}</p>
                  </div>
                </div>

                {/* Nút chỉnh sửa/xóa */}
                <div className="flex gap-2 mt-4 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handleEdit(group)}
                    className="p-2 rounded-xl hover:bg-gray-100 transition"
                  >
                    <MdEdit size={20} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(group._id)}
                    className="p-2 rounded-xl text-red-600 hover:bg-red-600 hover:text-white transition-colors duration-200"
                    title="Xóa nhóm"
                  >
                    <MdDelete size={20} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {modalOpen && (
          <div className="absolute inset-0 flex justify-center items-start z-40 pointer-events-none">
            {/* Nền trong suốt chỉ phủ content */}
            <div
              className="absolute top-0 left-0 w-full h-full  bg-opacity-10 pointer-events-auto"
              onClick={() => setModalOpen(false)}
            ></div>

            {/* Form */}
            <div className="relative mt-10 pointer-events-auto">
              <ProductGroupForm
                storeId={storeId}
                group={editingGroup}
                onSuccess={handleFormSuccess}
                onCancel={() => setModalOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
