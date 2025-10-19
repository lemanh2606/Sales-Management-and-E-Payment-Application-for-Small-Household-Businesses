
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiCheck, FiEdit, FiTrash2 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

import Button from "../../components/Button";
import { selectStore, createStore, updateStore, deleteStore, getStoresByManager } from "../../api/storeApi";




export default function SelectStorePage() {
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editingStore, setEditingStore] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [storeForm, setStoreForm] = useState({ name: "", address: "", phone: "" });
  const [search, setSearch] = useState("");

  const { setCurrentStore } = useAuth();
  const navigate = useNavigate();

  // Load stores from backend
  const loadStores = async () => {
    setLoading(true);
    try {
      const res = await getStoresByManager();
      const list = res.stores || res;
      setStores(list);
      setFilteredStores(list);
    } catch (e) {
      setErr(e?.response?.data?.message || "Không lấy được danh sách cửa hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  // Filter stores based on search
  useEffect(() => {
    if (!search) return setFilteredStores(stores);
    const filtered = stores.filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.address.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
    );
    setFilteredStores(filtered);
  }, [search, stores]);

  // Select a store
  const handleSelect = async (store) => {
    try {
      await selectStore(store._id);
      setCurrentStore(store);
      navigate("/dashboard");
    } catch (e) {
      setErr(e?.response?.data?.message || "Không thể chọn cửa hàng");
    }
  };

  // Save new or edit store
  const handleSaveStore = async () => {
    try {
      if (editingStore) {
        await updateStore(editingStore._id, storeForm);
      } else {
        await createStore(storeForm);
      }
      setShowModal(false);
      setEditingStore(null);
      setStoreForm({ name: "", address: "", phone: "" });
      loadStores();
    } catch (e) {
      setErr(e?.response?.data?.message || "Lỗi khi lưu cửa hàng");
    }
  };

  const handleEditStore = (store) => {
    setEditingStore(store);
    setStoreForm({ name: store.name, address: store.address, phone: store.phone });
    setShowModal(true);
  };

  const handleDeleteStore = async (storeId) => {
    if (!window.confirm("Bạn có chắc muốn xóa cửa hàng này?")) return;
    try {
      await deleteStore(storeId);
      loadStores();
    } catch (e) {
      setErr(e?.response?.data?.message || "Lỗi khi xóa cửa hàng");
    }
  };

  if (loading)
    return (
      <div className="p-6 text-center text-gray-600 text-lg">Đang tải danh sách cửa hàng...</div>
    );

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 bg-gradient-to-b from-green-50 via-white to-green-100">
      <div className="w-full max-w-5xl mt-8 p-8 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border-t-4 border-green-500">
        <h2 className="text-3xl font-bold mb-6 text-green-600 text-center">Chọn cửa hàng</h2>

        {err && <p className="text-red-500 mb-3 text-center">{err}</p>}

        {/* Search + Add */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-6">
          <div className="flex items-center w-full md:w-1/2 bg-gray-100/50 backdrop-blur-sm rounded-xl p-2 shadow-inner">
            <FiSearch className="text-gray-400 mr-2" size={22} />
            <input
              type="text"
              placeholder="Tìm kiếm cửa hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 font-medium"
            />
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1 hover:scale-105"
          >
            <FiPlus size={18} /> Thêm cửa hàng
          </Button>
        </div>

        {/* Store grid */}
        {filteredStores.length === 0 ? (
          <p className="text-center text-gray-500">Không tìm thấy cửa hàng nào.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStores.map((s) => (
              <motion.div
                key={s._id}
                className="p-6 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-green-100 flex flex-col justify-between hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                whileHover={{ scale: 1.04 }}
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1 text-green-700">{s.name}</h3>
                  <p className="text-gray-600 mb-1">{s.address}</p>
                  <p className="text-gray-500 font-medium">SĐT: {s.phone}</p>
                </div>
                <div className="mt-4 flex justify-center sm:justify-start gap-2">
                  <button
                    onClick={() => handleSelect(s)}
                    className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-md flex items-center justify-center"
                    title="Chọn cửa hàng"
                  >
                    <FiCheck size={20} />
                  </button>
                  <button
                    onClick={() => handleEditStore(s)}
                    className="p-2 bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg shadow-md flex items-center justify-center"
                    title="Sửa cửa hàng"
                  >
                    <FiEdit size={20} />
                  </button>
                  <button
                    onClick={() => handleDeleteStore(s._id)}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md flex items-center justify-center"
                    title="Xóa cửa hàng"
                  >
                    <FiTrash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Thêm/Sửa store */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white/95 backdrop-blur-md p-6 rounded-3xl w-full max-w-md shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h3 className="text-2xl font-semibold mb-4 text-green-700">{editingStore ? "Sửa cửa hàng" : "Thêm cửa hàng"}</h3>
              <input
                type="text"
                placeholder="Tên cửa hàng"
                className="w-full mb-3 p-3 border rounded-lg focus:ring-2 focus:ring-green-400 outline-none text-gray-700"
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Địa chỉ"
                className="w-full mb-3 p-3 border rounded-lg focus:ring-2 focus:ring-green-400 outline-none text-gray-700"
                value={storeForm.address}
                onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
              />
              <input
                type="text"
                placeholder="SĐT"
                className="w-full mb-4 p-3 border rounded-lg focus:ring-2 focus:ring-green-400 outline-none text-gray-700"
                value={storeForm.phone}
                onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
              />
              <div className="flex justify-end gap-3">
                <Button onClick={() => setShowModal(false)} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg">
                  Hủy
                </Button>
                <Button onClick={handleSaveStore} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
                  Lưu
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
