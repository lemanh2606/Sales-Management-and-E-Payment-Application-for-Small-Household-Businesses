import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/Dialog";
import Button from "../Button";
import { createSupplier, updateSupplier, getSupplierById } from "../../api/supplierApi";
import toast from "react-hot-toast";

export default function SupplierFormModal({ open, onOpenChange, storeId, supplierId, onSuccess }) {
    const [formLoading, setFormLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        address: "",
        status: "đang hoạt động",
    });

    useEffect(() => {
        if (!supplierId) {
            setFormData({ name: "", phone: "", email: "", address: "", status: "đang hoạt động" });
            return;
        }

        const fetchSupplier = async () => {
            try {
                setFormLoading(true);
                const res = await getSupplierById(supplierId);
                const data = res?.supplier ?? res;
                setFormData({
                    name: data.name || "",
                    phone: data.phone || "",
                    email: data.email || "",
                    address: data.address || "",
                    status: data.status || "đang hoạt động",
                });
            } catch (err) {
                console.error(err);
                toast.error("Không thể tải nhà cung cấp.");
            } finally {
                setFormLoading(false);
            }
        };

        fetchSupplier();
    }, [supplierId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!storeId) return toast.error("Chưa chọn cửa hàng.");
        setFormLoading(true);

        try {
            if (supplierId) {
                await updateSupplier(supplierId, formData);
                toast.success("Cập nhật nhà cung cấp thành công!");
            } else {
                await createSupplier(storeId, formData);
                toast.success("Tạo nhà cung cấp thành công!");
            }
            onOpenChange(false);
            onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(`Đã xảy ra lỗi!: ${err?.response?.data?.message || err?.message}`);
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg rounded-3xl p-6 shadow-2xl bg-white animate-fade-in scale-95 origin-center transition-all duration-300">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-800">
                        {supplierId ? "✏️ Cập nhật nhà cung cấp" : "🧾 Thêm nhà cung cấp mới"}
                    </DialogTitle>
                </DialogHeader>

                <form className="space-y-5 mt-3" onSubmit={handleSubmit}>
                    {["name", "phone", "email", "address"].map((field) => (
                        <div key={field}>
                            <label className="block text-gray-700 mb-1 font-medium capitalize">
                                {field === "name"
                                    ? "Tên nhà cung cấp *"
                                    : field === "phone"
                                        ? "Số điện thoại"
                                        : field === "email"
                                            ? "Email"
                                            : "Địa chỉ"}
                            </label>
                            <input
                                type={field === "email" ? "email" : "text"}
                                name={field}
                                value={formData[field]}
                                onChange={handleChange}
                                required={field === "name"}
                                placeholder={`Nhập ${field}`}
                                className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200"
                            />
                        </div>
                    ))}

                    <div>
                        <label className="block text-gray-700 mb-1 font-medium">Trạng thái</label>
                        <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200"
                        >
                            <option value="đang hoạt động">Đang hoạt động</option>
                            <option value="ngừng hoạt động">Ngừng hoạt động</option>
                        </select>
                    </div>

                    <DialogFooter className="flex justify-end gap-3 mt-4">
                        <Button
                            type="button"
                            className="bg-gray-200 text-gray-700 hover:bg-gray-300 shadow-sm transition-all duration-200"
                            onClick={() => onOpenChange(false)}
                        >
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg transition-all duration-200"
                        >
                            {formLoading ? (supplierId ? "Đang lưu..." : "Đang tạo...") : supplierId ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
