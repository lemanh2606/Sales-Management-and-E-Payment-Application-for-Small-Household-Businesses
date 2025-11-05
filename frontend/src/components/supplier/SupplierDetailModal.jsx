import React, { useEffect, useState } from "react";
import { getSupplierById } from "../../api/supplierApi";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose } from "react-icons/md";
import { Loader } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function SupplierDetailModal({ supplierId, open, onOpenChange }) {
  const { token } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(false);
  const getStatusColor = (status) => {
    if (!status) return "text-gray-500";

    const normalized = status.toLowerCase().trim();

    if (normalized === "đang hoạt động") return "text-green-600 font-bold";
    if (normalized === "ngừng hoạt động") return "text-red-600 font-bold";

    return "text-gray-500";
  };

  useEffect(() => {
    if (!open || !supplierId) return;

    const fetchSupplier = async () => {
      setLoading(true);
      try {
        const data = await getSupplierById(supplierId);
        setSupplier(data.supplier);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [supplierId, open, token]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 140 }}
            className="relative w-11/12 sm:w-3/4 lg:w-1/2 p-6 rounded-2xl bg-white shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 transition-transform hover:scale-125"
              onClick={() => onOpenChange(false)}
            >
              <MdClose size={26} />
            </button>

            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Chi tiết nhà cung cấp</h2>

            {loading && (
              <div className="flex justify-center items-center gap-2 text-gray-500">
                <Loader className="animate-spin" /> Đang tải dữ liệu...
              </div>
            )}

            {!loading && supplier && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  ["Tên", supplier.name],
                  ["SĐT", supplier.phone],
                  ["Email", supplier.email],
                  ["Địa chỉ", supplier.address],
                  ["Cửa hàng", supplier.store?.name],
                  ["Trạng thái", <span className={getStatusColor(supplier.status)}>{supplier.status || "-"}</span>],
                  ["Ngày tạo", new Date(supplier.createdAt).toLocaleString()],
                  ["Cập nhật gần nhất", new Date(supplier.updatedAt).toLocaleString()],
                ].map(([label, value], i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-gray-500 font-medium">{label}:</span>
                    <p className="text-gray-800 font-semibold mt-1">{value || "-"}</p>
                  </div>
                ))}
              </div>
            )}

            {!loading && !supplier && (
              <p className="text-gray-500 text-center py-4">Không tìm thấy thông tin nhà cung cấp</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
