// src/components/store/StoreList.jsx
import React, { useMemo, useState } from "react";
import StoreCard from "./StoreCard";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

/**
 * StoreList (2x2) with simple pagination
 *
 * Props:
 * - stores: array
 * - isLoading: boolean
 * - onSelect, onEdit, onDetail
 * - onAdd (optional) -> used in empty state
 * - itemsPerPage (default 4)
 */
export default function StoreList({
    stores = [],
    isLoading = false,
    onSelect = () => { },
    onEdit = () => { },
    onDetail = () => { },
    onAdd = null,
    itemsPerPage = 4,
}) {
    const [page, setPage] = useState(0);

    const total = Array.isArray(stores) ? stores.length : 0;
    const pageCount = Math.max(1, Math.ceil(total / itemsPerPage));

    const pageStores = useMemo(() => {
        const start = page * itemsPerPage;
        return (stores || []).slice(start, start + itemsPerPage);
    }, [stores, page, itemsPerPage]);

    // Reset page if stores change so we don't show empty page
    React.useEffect(() => {
        if (page > 0 && page >= pageCount) setPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total]);

    if (isLoading) {
        return (
            <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: itemsPerPage }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-56" />
                    ))}
                </div>
            </div>
        );
    }

    if (!stores || stores.length === 0) {
        return (
            <div className="w-full text-center py-12">
                <div className="mx-auto mb-4 w-40 h-40 rounded-full bg-gradient-to-br from-green-100 to-white flex items-center justify-center shadow-inner text-green-600">
                    📍
                </div>
                <h3 className="text-xl font-semibold text-gray-700">Chưa có cửa hàng</h3>
                <p className="text-sm text-gray-500 mt-2">Bạn chưa thêm cửa hàng nào — tạo ngay để bắt đầu.</p>
                <div className="mt-4">
                    {typeof onAdd === "function" ? (
                        <button onClick={onAdd} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow">
                            Thêm cửa hàng
                        </button>
                    ) : (
                        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Làm mới</button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* header: count + pagination */}
            <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                    <div className="text-sm text-gray-500">Kết quả</div>
                    <div className="text-lg font-semibold text-gray-800">{total} cửa hàng</div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">Trang {page + 1}/{pageCount}</div>
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Trang trước"
                        title="Trang trước"
                    >
                        <FiChevronLeft />
                    </button>
                    <button
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={page >= pageCount - 1}
                        className="p-2 rounded-md bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Trang sau"
                        title="Trang sau"
                    >
                        <FiChevronRight />
                    </button>
                </div>
            </div>

            {/* grid 2 columns on md+, 1 column on mobile. Each cell is a large card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pageStores.map((s) => (
                    <StoreCard key={s._id} store={s} onSelect={onSelect} onEdit={onEdit} onDetail={onDetail} />
                ))}
            </div>
        </div>
    );
}
