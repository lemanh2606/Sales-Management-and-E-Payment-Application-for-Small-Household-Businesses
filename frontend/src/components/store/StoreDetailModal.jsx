// src/components/StoreDetailModal.jsx
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * Safe Store Detail Modal
 * - centered, responsive, never hides behind top bar
 * - pressing Sửa will close modal then call onEdit(store)
 *
 * Props:
 * - open, onClose, store, onEdit, onSelect, onDelete
 */
export default function StoreDetailModal({
    open,
    onClose,
    store,
    onEdit,
    onSelect,
    onDelete,
}) {
    const overlayRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        const onKey = (e) => {
            if (e.key === "Escape") onClose && onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open || !store) return null;

    const safeText = (v) => (v === undefined || v === null ? "-" : String(v));
    const getOwnerLabel = (owner) => {
        if (!owner) return "-";
        if (typeof owner === "string") return owner;
        if (owner.name) return owner.name;
        if (owner.email) return owner.email;
        if (owner._id) return String(owner._id).slice(0, 8);
        return "-";
    };

    const fmtTime = (v) => {
        if (v === undefined || v === null || v === "") return "--";
        try {
            const s = String(v).trim();
            if (s.includes(":")) {
                const parts = s.split(":").map((p) => p.padStart(2, "0"));
                return `${parts[0].padStart(2, "0")}:${(parts[1] || "00").slice(0, 2)}`;
            }
            if (/^\d{1,2}$/.test(s)) {
                const hh = s.padStart(2, "0");
                return `${hh}:00`;
            }
            if (/^\d{3,4}$/.test(s)) {
                const padded = s.padStart(4, "0");
                const hh = padded.slice(0, padded.length - 2);
                const mm = padded.slice(-2);
                return `${hh.padStart(2, "0")}:${mm}`;
            }
            return s;
        } catch {
            return String(v);
        }
    };

    const imageSrc = store.imageUrl || "";
    const imgStyle = { maxWidth: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8 };

    const handleEditClick = () => {
        // Close modal first for smoothness, then call onEdit
        try {
            onClose && onClose();
            // slight delay so exit animation can play
            setTimeout(() => {
                try {
                    onEdit && onEdit(store);
                } catch (err) {
                    console.error("onEdit error", err);
                }
            }, 140);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <motion.div
            key="detail-overlay"
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-modal="true"
            role="dialog"
        >
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={() => onClose && onClose()}
                aria-hidden="true"
            />

            {/* modal panel: centered, constrained height, scrollable inside */}
            <motion.div
                className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                style={{ maxHeight: "calc(100vh - 96px)", overflow: "auto" }}
            >
                <div className="p-5 md:p-6">
                    <div className="flex items-start gap-4">
                        {/* image / initials */}
                        {imageSrc ? (
                            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100">
                                <img
                                    src={imageSrc}
                                    alt={safeText(store.name)}
                                    style={imgStyle}
                                    loading="lazy"
                                    onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-700 font-semibold text-lg">
                                {String(store.name || "-")
                                    .split(" ")
                                    .slice(0, 2)
                                    .map((p) => p[0]?.toUpperCase() || "")
                                    .join("")}
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-semibold text-gray-800">{safeText(store.name)}</h3>
                            <p className="text-sm text-gray-500 mt-1">{safeText(store.address)}</p>
                            <div className="mt-1 text-xs text-gray-500">ID: {safeText(store._id)}</div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-700">
                        <div>
                            <strong>Số điện thoại:</strong> {safeText(store.phone || "-")}
                        </div>

                        <div>
                            <strong>Owner:</strong> {getOwnerLabel(store.owner_id)}
                        </div>

                        {store.createdAt && (
                            <div>
                                <strong>Ngày tạo:</strong>{" "}
                                {new Date(store.createdAt).toLocaleString ? new Date(store.createdAt).toLocaleString() : String(store.createdAt)}
                            </div>
                        )}

                        <div>
                            <strong>Trạng thái:</strong> {store.deleted ? "Đã xóa (deleted=true)" : "Hoạt động"}
                        </div>

                        <div>
                            <strong>Giờ hoạt động:</strong>{" "}
                            {store.openingHours ? `${fmtTime(store.openingHours.open)} — ${fmtTime(store.openingHours.close)}` : "--"}
                        </div>

                        <div>
                            <strong>Toạ độ:</strong>{" "}
                            {store.location && (store.location.lat !== null || store.location.lng !== null)
                                ? `${safeText(store.location.lat)} , ${safeText(store.location.lng)}`
                                : "--"}
                        </div>

                        {Array.isArray(store.tags) && store.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {store.tags.map((t, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-gray-100">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        )}

                        {store.description && (
                            <div className="mt-2">
                                <strong>Mô tả:</strong>
                                <div className="mt-1 text-sm text-gray-600 max-h-40 overflow-auto p-2 bg-gray-50 rounded">{safeText(store.description)}</div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button onClick={() => onClose && onClose()} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
                            Đóng
                        </button>

                        <button onClick={handleEditClick} className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-white">
                            Sửa
                        </button>

                        <button
                            onClick={() => {
                                try {
                                    onSelect && onSelect(store);
                                } catch (err) {
                                    console.error("onSelect handler error", err);
                                }
                            }}
                            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                        >
                            Vào Dashboard
                        </button>

                        <button
                            onClick={() => {
                                try {
                                    onDelete && onDelete(store._id);
                                } catch (err) {
                                    console.error("onDelete handler error", err);
                                }
                            }}
                            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
                        >
                            Xóa (mềm)
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
