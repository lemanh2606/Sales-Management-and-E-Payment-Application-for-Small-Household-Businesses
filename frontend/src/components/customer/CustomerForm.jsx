// src/components/customer/CustomerForm.jsx
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { MdSave, MdClose, MdPerson, MdPhone, MdLocationOn, MdNote } from "react-icons/md";
import { createCustomer, updateCustomer } from "../../api/customerApi";

/**
 * CustomerForm hỗ trợ create + update
 * Props:
 *  - customer: object | null (null => create)
 *  - onSuccess: fn(createdOrUpdatedCustomer) => parent refresh/close modal
 *  - onCancel: fn()
 */

export default function CustomerForm({ customer, onSuccess, onCancel }) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (customer) {
            setName(customer.name || "");
            setPhone(customer.phone || "");
            setAddress(customer.address || "");
            setNote(customer.note || "");
        } else {
            setName("");
            setPhone("");
            setAddress("");
            setNote("");
        }
        setErrors({});
    }, [customer]);

    const validate = () => {
        const e = {};
        if (!name.trim()) e.name = "Tên không được để trống";
        if (!phone || !/^[0-9 +()-]{9,20}$/.test(phone.trim())) e.phone = "Số điện thoại không hợp lệ";
        if (address && address.length > 300) e.address = "Địa chỉ quá dài (tối đa 300 ký tự)";
        if (note && note.length > 2000) e.note = "Ghi chú quá dài (tối đa 2000 ký tự)";
        return e;
    };

    const handleSave = async () => {
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length > 0) {
            toast.error("Vui lòng sửa thông tin trước khi lưu");
            return;
        }

        try {
            setSaving(true);

            if (customer && customer._id) {
                // Update flow
                const res = await updateCustomer(customer._id, {
                    name: name.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    note: note.trim(),
                });
                // backend trả { message, customer } theo controller mới
                const updated = res?.customer ?? res;
                toast.success("Cập nhật khách hàng thành công");
                onSuccess?.(updated);
            } else {
                // Create flow
                const res = await createCustomer({
                    name: name.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    note: note.trim(),
                });
                const created = res?.customer ?? res;
                toast.success("Tạo khách hàng thành công");
                onSuccess?.(created);
            }
        } catch (err) {
            console.error("Customer save error:", err);
            const message = err?.response?.data?.message || "Lỗi server khi lưu khách hàng";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28 }}
            className="w-full"
        >
            <div className="bg-gradient-to-br from-white to-emerald-50/50 rounded-2xl shadow-2xl border border-gray-100 p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-2xl font-extrabold text-gray-900">
                            {customer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Điền thông tin khách hàng để lưu vào hệ thống</p>
                    </div>

                    <button
                        onClick={onCancel}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 transition text-gray-700"
                        aria-label="Hủy"
                        title="Hủy"
                    >
                        <MdClose /> Đóng
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name */}
                    <label className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600">
                            <MdPerson size={20} />
                        </div>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder=" "
                            className={`w-full pl-11 pr-3 py-3 rounded-lg border ${errors.name ? "border-red-400" : "border-gray-200"} bg-white focus:ring-2 focus:ring-emerald-200 outline-none`}
                        />
                        <span className="absolute left-11 -top-2 text-xs text-gray-500 bg-white px-1">Tên</span>
                        {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                    </label>

                    {/* Phone */}
                    <label className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600">
                            <MdPhone size={20} />
                        </div>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder=" "
                            className={`w-full pl-11 pr-3 py-3 rounded-lg border ${errors.phone ? "border-red-400" : "border-gray-200"} bg-white focus:ring-2 focus:ring-emerald-200 outline-none`}
                        />
                        <span className="absolute left-11 -top-2 text-xs text-gray-500 bg-white px-1">Số điện thoại</span>
                        <p className="text-xs text-gray-400 mt-1">Ví dụ: 0971079629 hoặc +84 97 107 9629</p>
                        {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                    </label>

                    {/* Address */}
                    <label className="relative group md:col-span-2">
                        <div className="absolute left-3 top-4 text-emerald-600">
                            <MdLocationOn size={20} />
                        </div>
                        <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder=" "
                            className={`w-full pl-11 pr-3 py-3 rounded-lg border ${errors.address ? "border-red-400" : "border-gray-200"} bg-white focus:ring-2 focus:ring-emerald-200 outline-none`}
                        />
                        <span className="absolute left-11 -top-2 text-xs text-gray-500 bg-white px-1">Địa chỉ</span>
                        {errors.address && <p className="text-sm text-red-500 mt-1">{errors.address}</p>}
                    </label>

                    {/* Note */}
                    <label className="relative group md:col-span-2">
                        <div className="absolute left-3 top-3 text-emerald-600">
                            <MdNote size={18} />
                        </div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder=" "
                            className="w-full pl-11 pr-3 py-3 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-emerald-200 outline-none min-h-[88px]"
                        />
                        <span className="absolute left-11 -top-2 text-xs text-gray-500 bg-white px-1">Ghi chú</span>
                        <p className="text-xs text-gray-400 mt-1">Ghi chú nội bộ, ví dụ: loại khách VIP, kênh liên hệ...</p>
                        {errors.note && <p className="text-sm text-red-500 mt-1">{errors.note}</p>}
                    </label>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                        disabled={saving}
                    >
                        Hủy
                    </button>

                    <button
                        onClick={handleSave}
                        className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg shadow-md text-white ${saving ? "bg-emerald-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"}`}
                        disabled={saving}
                    >
                        {saving ? (
                            <svg className="w-5 h-5 animate-spin" viewBox="3 3 18 18">
                                <path className="opacity-25" d="M12 3C7.03 3 3 7.03 3 12"></path>
                                <path d="M21 12A9 9 0 1 1 12 3" className="opacity-75"></path>
                            </svg>
                        ) : (
                            <MdSave size={18} />
                        )}
                        {customer && customer._id ? (saving ? " Đang lưu..." : " Lưu thay đổi") : (saving ? " Đang tạo..." : " Tạo khách hàng")}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
