// src/pages/customer/CustomerListPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import Layout from "../../components/Layout";
import CustomerSearchBar from "../../components/customer/CustomerSearchBar";
import CustomerForm from "../../components/customer/CustomerForm";
import Modal from "react-modal";
import { MdAdd, MdRefresh, MdEdit, MdDelete } from "react-icons/md";
import Button from "../../components/Button";
import toast from "react-hot-toast";
import {
    searchCustomers,
    softDeleteCustomer,
    getCustomersByStore,
} from "../../api/customerApi";

export default function CustomerListPage() {
    const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
    const storeId = storeObj._id || storeObj.id || null;

    const [searchTerm, setSearchTerm] = useState("");
    const [customers, setCustomers] = useState([]); // current page customers
    const [loading, setLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalCustomer, setModalCustomer] = useState(null);

    // server-side pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10); // will map to API limit
    const [totalItems, setTotalItems] = useState(0);

    // fetch customers for store (server-side page + optional query)
    const fetchByStore = useCallback(
        async ({ sId, page = 1, limit = 10, query = "" } = {}) => {
            if (!sId) {
                setCustomers([]);
                setTotalItems(0);
                return;
            }
            try {
                setLoading(true);
                const res = await getCustomersByStore(sId, { page, limit, query });
                // expected res: { message, page, limit, total, count, customers }
                const list = Array.isArray(res) ? res : res?.customers ?? [];
                setCustomers(Array.isArray(list) ? list : []);
                setTotalItems(res?.total ?? (Array.isArray(list) ? list.length : 0));
                setCurrentPage(res?.page ? Number(res.page) : page);
                setItemsPerPage(res?.limit ? Number(res.limit) : limit);
            } catch (err) {
                console.error("getCustomersByStore error:", err);
                toast.error("Không thể tải danh sách khách hàng của cửa hàng");
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // initial load on mount / when storeId changes
    useEffect(() => {
        // reset to first page when store changes
        setCurrentPage(1);
        fetchByStore({ sId: storeId, page: 1, limit: itemsPerPage, query: "" });
    }, [storeId, fetchByStore, itemsPerPage]);

    // Debounced search: call server search (via same endpoint with query)
    useEffect(() => {
        const t = setTimeout(() => {
            setCurrentPage(1);
            fetchByStore({ sId: storeId, page: 1, limit: itemsPerPage, query: searchTerm.trim() });
        }, 350);
        return () => clearTimeout(t);
    }, [searchTerm, storeId, fetchByStore, itemsPerPage]);

    // handlers for modal
    const openCreate = () => {
        setModalCustomer(null);
        setIsModalOpen(true);
    };
    const openEdit = (c) => {
        setModalCustomer(c);
        setIsModalOpen(true);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setModalCustomer(null);
    };

    // onSuccess receives created/updated customer from form
    const onFormSuccess = (savedCustomer) => {
        // After create/update, refresh current page to reflect server state
        fetchByStore({ sId: storeId, page: currentPage, limit: itemsPerPage, query: searchTerm.trim() });
        closeModal();
    };

    const handleSoftDelete = async (id) => {
        if (!window.confirm("Bạn có chắc muốn xóa khách hàng này?")) return;
        try {
            setLoading(true);
            await softDeleteCustomer(id);
            toast.success("Xóa thành công");
            // After delete, refetch current page (server may return fewer items)
            fetchByStore({ sId: storeId, page: currentPage, limit: itemsPerPage, query: searchTerm.trim() });
        } catch (err) {
            console.error("delete error:", err);
            const message = err?.response?.data?.message || "Lỗi server khi xóa";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // Refresh handler
    const handleRefresh = async () => {
        await fetchByStore({ sId: storeId, page: currentPage, limit: itemsPerPage, query: searchTerm.trim() });
        toast.success("Đã làm mới danh sách");
    };

    // pagination controls (server-side)
    const totalPages = Math.max(1, Math.ceil((totalItems || 0) / itemsPerPage));
    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        fetchByStore({ sId: storeId, page, limit: itemsPerPage, query: searchTerm.trim() });
    };

    // If storeId not set, show friendly message
    if (!storeId) {
        return (
            <Layout>
                <div className="p-6 mx-auto bg-white">
                    <h1 className="text-2xl font-semibold mb-4">Danh sách Khách hàng</h1>
                    <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <p className="text-yellow-800">
                            Không tìm thấy cửa hàng hiện hành. Vui lòng chọn cửa hàng trước khi xem danh sách khách hàng.
                        </p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6 mx-auto bg-white">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Danh sách Khách hàng</h1>
                        <p className="text-sm text-gray-500 mt-1">Quản lý khách hàng — tên &amp; số điện thoại là chính</p>
                    </div>

                    <div className="flex gap-3 items-center">
                        <Button onClick={handleRefresh} className="flex items-center gap-2 border px-4 py-2 rounded-xl bg-white hover:bg-gray-50">
                            <MdRefresh /> Làm mới
                        </Button>

                        <Button onClick={openCreate} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl">
                            <MdAdd size={20} /> Thêm
                        </Button>
                    </div>
                </div>

                <CustomerSearchBar value={searchTerm} onChange={setSearchTerm} />

                {/* Table */}
                {loading ? (
                    <p className="text-center mt-10 text-gray-400 animate-pulse text-lg">⏳ Đang tải...</p>
                ) : customers.length === 0 ? (
                    <p className="mt-10 text-center text-gray-400 italic text-lg">Không có khách hàng</p>
                ) : (
                    <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 bg-white mt-4">
                        <table className="min-w-full text-gray-700">
                            <thead className="bg-gray-50 uppercase text-sm font-medium">
                                <tr>
                                    <th className="py-4 px-6 text-left">#</th>
                                    <th className="py-4 px-6 text-left">Tên</th>
                                    <th className="py-4 px-6 text-left">Số điện thoại</th>
                                    <th className="py-4 px-6 text-left">Địa chỉ</th>
                                    <th className="py-4 px-6 text-left">Ghi chú</th>
                                    <th className="py-4 px-6 text-left">Tổng chi tiêu</th>
                                    <th className="py-4 px-6 text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c, i) => (
                                    <tr
                                        key={c._id}
                                        className={`transition-transform duration-200 hover:scale-[1.01] hover:shadow-sm ${i % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}`}
                                    >
                                        <td className="py-4 px-6">{(currentPage - 1) * itemsPerPage + i + 1}</td>
                                        <td className="py-4 px-6 font-medium text-gray-900">{c.name}</td>
                                        <td className="py-4 px-6">{c.phone}</td>
                                        <td className="py-4 px-6">{c.address || "-"}</td>
                                        <td className="py-4 px-6">{c.note || "-"}</td>
                                        <td className="py-4 px-6">
                                            {(() => {
                                                // always coerce to number safely, fallback 0
                                                const v = c?.totalSpent ?? "0";
                                                // if it's object like { $numberDecimal: "123.45" } try to extract, else parseFloat
                                                const str = typeof v === "object" && v?.$numberDecimal ? v.$numberDecimal : String(v);
                                                const num = parseFloat(str.replace(/,/g, "")) || 0;
                                                // format with locale and no decimals for VND
                                                return num.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + "₫";
                                            })()}
                                        </td>

                                        <td className="py-4 px-6 flex justify-center items-center gap-3">
                                            <button
                                                onClick={() => openEdit(c)}
                                                title="Cập nhật"
                                                className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-white rounded-md transition"
                                            >
                                                <MdEdit /> Cập nhật
                                            </button>

                                            <button
                                                onClick={() => handleSoftDelete(c._id)}
                                                title="Xóa"
                                                className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-md transition border border-red-200"
                                            >
                                                <MdDelete /> Xóa
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-wrap justify-center mt-6 gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
                        >
                            ← Trước
                        </button>

                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => handlePageChange(i + 1)}
                                className={`px-4 py-2 border rounded-lg ${currentPage === i + 1 ? "bg-green-600 text-white" : "hover:bg-gray-100"} transition`}
                            >
                                {i + 1}
                            </button>
                        ))}

                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100 transition"
                        >
                            Sau →
                        </button>
                    </div>
                )}

                <Modal
                    isOpen={isModalOpen}
                    onRequestClose={closeModal}
                    ariaHideApp={false}
                    className="bg-white rounded-2xl p-6 w-full max-w-3xl mx-auto mt-20 shadow-2xl overflow-auto max-h-[90vh]"
                    overlayClassName="fixed inset-0 bg-[#070505e1] bg-opacity-40 flex justify-center items-start"
                >
                    <CustomerForm customer={modalCustomer} onSuccess={onFormSuccess} onCancel={closeModal} />
                </Modal>
            </div>
        </Layout>
    );
}
