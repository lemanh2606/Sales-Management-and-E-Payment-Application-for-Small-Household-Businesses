// src/pages/SelectStorePage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

import Header from "../../components/store/Header";
import StoreList from "../../components/store/StoreList";
import StoreFormModal from "../../components/store/StoreFormModal";
import StoreDetailModal from "../../components/store/StoreDetailModal";
import Button from "../../components/Button";

import {
  selectStore,
  createStore,
  updateStore,
  deleteStore,
  getStoresByManager,
  getStoreById,
} from "../../api/storeApi";

export default function SelectStorePage() {
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editingStore, setEditingStore] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [storeForm, setStoreForm] = useState({
    name: "",
    address: "",
    phone: "",
    description: "",
    imageUrl: "",
    tagsCsv: "",
    // keep nested objects to match backend:
    openingHours: {
      open: "",
      close: ""
    },
    location: {
      lat: null,
      lng: null
    }
  });


  const { setCurrentStore } = useAuth();
  const navigate = useNavigate();

  const loadStores = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getStoresByManager();
      const list = (res && (res.stores || res.data || res)) || [];
      const arr = Array.isArray(list) ? list : list.stores || [];
      const activeList = arr.filter((s) => !s?.deleted);
      setStores(activeList);
      setFilteredStores(activeList);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || "Không lấy được danh sách cửa hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!search) {
      setFilteredStores(stores);
      return;
    }
    const q = search.trim().toLowerCase();
    setFilteredStores(
      stores.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q) ||
          (s.tags || []).join(" ").toLowerCase().includes(q)
      )
    );
  }, [search, stores]);

  const handleSelect = async (store) => {
    try {
      setBusy(true);

      // Gọi API selectStore (backend trả về full store object)
      // selectStore helper có thể trả shapes khác nhau -> normalize
      const res = await selectStore(store._id);

      // Lấy store từ nhiều shape có thể xảy ra
      let returnedStore =
        (res && (res.store || res.data?.store || res.data)) ||
        // axios wrapper có thể trả res.data trực tiếp
        (res && res._id ? res : null) ||
        store;

      // nếu vẫn null, fallback store từ list
      if (!returnedStore) returnedStore = store;

      // --- Backup cửa hàng cũ (nếu có) ---
      try {
        const prev = localStorage.getItem("currentStore");
        if (prev) {
          // lưu bản cũ vào previousStore (ghi đè)
          localStorage.setItem("previousStore", prev);
        }
      } catch (e) {
        console.warn("Không thể backup previousStore:", e);
      }

      // --- Lưu currentStore mới vào localStorage ---
      try {
        localStorage.setItem("currentStore", JSON.stringify(returnedStore));
      } catch (e) {
        console.warn("Lưu currentStore vào localStorage thất bại:", e);
      }

      // --- Cập nhật context / auth nếu có hàm setCurrentStore ---
      try {
        if (typeof setCurrentStore === "function") {
          // thử gọi với object trước; nếu hàm của bạn chờ id thì thử pass id
          // (vì project bạn có nhiều biến thể)
          try {
            // Một số impl setCurrentStore có thể là async và mong storeId,
            // nên không cần await bắt buộc ở đây, nhưng dùng await để chặn nav nếu cần.
            await setCurrentStore(returnedStore);
          } catch (errInner) {
            // fallback: thử truyền id nếu object không hợp
            try {
              await setCurrentStore(returnedStore._id || returnedStore.id);
            } catch (err2) {
              console.warn("setCurrentStore failed with both object and id", errInner, err2);
            }
          }
        }
      } catch (e) {
        console.warn("Không thể cập nhật context hiện tại:", e);
      }

      // navigate tới dashboard
      navigate("/dashboard");
    } catch (e) {
      console.error("select store error", e);
      setErr(e?.response?.data?.message || e?.message || "Không thể chọn cửa hàng");
    } finally {
      setBusy(false);
    }
  };


  // --- handleAdd: open modal with clean nested shape ---
  const handleAdd = () => {
    setEditingStore(null);
    setStoreForm({
      name: "",
      address: "",
      phone: "",
      description: "",
      imageUrl: "",
      tagsCsv: "",
      openingHours: { open: "", close: "" },
      location: { lat: null, lng: null },
    });
    setShowModal(true);
  };

  // --- handleEdit: populate nested fields from existing store ---
  const handleEdit = (store) => {
    setEditingStore(store);
    setStoreForm({
      name: store.name || "",
      address: store.address || "",
      phone: store.phone || "",
      description: store.description || "",
      imageUrl: store.imageUrl || "",
      tagsCsv: Array.isArray(store.tags) ? store.tags.join(", ") : (store.tags || ""),
      // normalize openingHours & location into nested object (safe)
      openingHours: {
        open: store.openingHours?.open ?? "",
        close: store.openingHours?.close ?? "",
      },
      location: {
        lat: store.location?.lat != null ? Number(store.location.lat) : null,
        lng: store.location?.lng != null ? Number(store.location.lng) : null,
      },
    });
    setShowModal(true);
  };

  // --- handleSave: accept optional payload from modal, otherwise build from storeForm ---
  const handleSave = async (payloadFromModal) => {
    // prefer payload passed from modal (StoreFormModal normalizes and passes it)
    const final = payloadFromModal || {
      name: storeForm.name,
      address: storeForm.address,
      phone: storeForm.phone,
      description: storeForm.description,
      imageUrl: storeForm.imageUrl,
      tags: typeof storeForm.tags === "string" && !Array.isArray(storeForm.tags)
        ? (storeForm.tagsCsv || "").split(",").map(t => t.trim()).filter(Boolean)
        : (Array.isArray(storeForm.tags) ? storeForm.tags : (storeForm.tagsCsv || "").split(",").map(t => t.trim()).filter(Boolean)),
      openingHours: {
        open: storeForm.openingHours?.open ?? (storeForm.openingOpen || ""),
        close: storeForm.openingHours?.close ?? (storeForm.openingClose || ""),
      },
      location: {
        lat: storeForm.location?.lat != null ? Number(storeForm.location.lat) : null,
        lng: storeForm.location?.lng != null ? Number(storeForm.location.lng) : null,
      }
    };

    setErr("");
    if (!final.name || !final.address) {
      setErr("Vui lòng nhập tên và địa chỉ cửa hàng");
      return;
    }

    try {
      setBusy(true);
      if (editingStore) {
        await updateStore(editingStore._id, final);
      } else {
        await createStore(final);
      }
      setShowModal(false);
      setEditingStore(null);
      await loadStores();
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || "Lỗi khi lưu cửa hàng");
    } finally {
      setBusy(false);
    }
  };

  const handleDetail = async (storeId) => {
    setSelectedStore(null);
    try {
      setBusy(true);
      const res = await getStoreById(storeId);
      const detail = (res && (res.store || res.data || res)) || null;
      setSelectedStore(detail);
      setShowDetailModal(true);
    } catch (e) {
      console.warn(e);
      const cached = stores.find((s) => s._id === storeId) || null;
      setSelectedStore(cached);
      setShowDetailModal(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (storeId) => {
    const ok = window.confirm("Bạn có chắc muốn xóa cửa hàng này? (xóa mềm)");
    if (!ok) return;
    try {
      setBusy(true);
      await deleteStore(storeId);
      setShowDetailModal(false);
      await loadStores();
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || "Lỗi khi xóa cửa hàng");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-green-50 to-white text-gray-800">
      <Header search={search} setSearch={setSearch} onAdd={handleAdd} />

      {/* Full-bleed main area */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 pb-24">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Optional left info column can be collapsed on smaller screens */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-20 self-start">
            <div className="rounded-2xl p-6 bg-gradient-to-br from-green-600 to-green-500 text-white shadow-2xl">
              <h2 className="text-2xl font-bold">Xin chào, Quản lý!</h2>
              <p className="mt-2 text-sm text-green-100/90">
                Chọn một cửa hàng để bắt đầu theo dõi doanh thu, tồn kho, và báo cáo.
              </p>
            </div>
          </aside>

          <section className="col-span-1 lg:col-span-9">
            {err && <div className="mb-4 text-center text-sm text-red-600">{err}</div>}

            <StoreList
              stores={filteredStores}
              isLoading={loading}
              onSelect={handleSelect}
              onEdit={handleEdit}
              onDetail={handleDetail}
              onAdd={handleAdd}
              itemsPerPage={4} // enforce 2x2
            />
          </section>
        </div>
      </main>

      <StoreFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        form={storeForm}
        setForm={setStoreForm}
        onSave={handleSave}
        busy={busy}
        title={editingStore ? "Sửa cửa hàng" : "Thêm cửa hàng"}
      />

      <StoreDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        store={selectedStore}
        onEdit={(s) => handleEdit(s)}
        onSelect={(s) => handleSelect(s)}
        onDelete={(id) => handleDelete(id)}
      />
    </div>
  );
}
