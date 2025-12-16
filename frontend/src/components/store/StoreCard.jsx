import React from "react";
import { FiCheck, FiEdit, FiInfo } from "react-icons/fi";
import { motion } from "framer-motion";

/**
 * Full-info Store Card (click anywhere to select)
 */
export default function StoreCard({
    store = {},
    onSelect = () => { },
    onEdit = () => { },
    onDetail = () => { },
}) {
    const initials = (name = "") =>
        String(name)
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() || "")
            .join("");

    const name = store.name || "Cửa hàng";
    const address = store.address || "-";
    const phone = store.phone || "-";
    const tags = Array.isArray(store.tags) ? store.tags : [];

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            whileHover={{ scale: 1.01 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm transition duration-150 cursor-pointer"
            onClick={() => onSelect(store)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(store); } }}
            aria-label={`Chọn cửa hàng ${name}`}
        >
            <div className="p-4 md:p-5 grid grid-cols-[84px_1fr_72px] gap-4 items-start">
                {/* IMAGE / INITIALS */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                    {store.imageUrl ? (
                        <img
                            src={store.imageUrl}
                            alt={name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-white text-green-700 font-bold text-lg">
                            {initials(name)}
                        </div>
                    )}
                </div>

                {/* MAIN CONTENT */}
                <div className="min-w-0">
                    <h3 className="text-lg md:text-xl font-bold text-gray-800 leading-snug break-words">{name}</h3>

                    <div className="mt-1 text-sm text-gray-600 leading-relaxed break-words">
                        <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-400">Địa chỉ</span>
                            <span className="font-medium text-gray-700">{address}</span>
                        </div>

                        <div className="mt-1 flex items-start gap-2">
                            <span className="text-xs text-gray-400">SĐT</span>
                            <span className="font-medium text-gray-700">{phone}</span>
                        </div>
                    </div>

                    {/* description */}
                    {store.description ? (
                        <div className="mt-3">
                            <div className="text-sm text-gray-600 font-semibold">Mô tả:</div>
                            <div className="mt-1 text-sm text-gray-700 bg-gray-50 p-2 rounded max-h-36 overflow-auto break-words">
                                {store.description}
                            </div>
                        </div>
                    ) : null}

                    {/* tags */}
                    {tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {tags.map((t, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ACTIONS - stopPropagation so card click not triggered */}
                <div className="flex flex-col items-end gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(store); }}
                        title="Vào Dashboard"
                        className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow"
                        aria-label={`Vào Dashboard ${name}`}
                    >
                        <FiCheck size={18} />
                    </button>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(store); }}
                            title="Sửa"
                            className="w-12 h-10 md:w-14 md:h-10 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-white flex items-center justify-center"
                            aria-label={`Sửa ${name}`}
                        >
                            <FiEdit size={16} />
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onDetail(store._id); }}
                            title="Chi tiết"
                            className="w-12 h-10 md:w-14 md:h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
                            aria-label={`Chi tiết ${name}`}
                        >
                            <FiInfo size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.article>
    );
}
