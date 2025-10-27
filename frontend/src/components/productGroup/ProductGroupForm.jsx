import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import Button from "../Button";
import { createProductGroup, updateProductGroup } from "../../api/productGroupApi";

export default function ProductGroupForm({ storeId, group, onSuccess, onCancel }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const formContainerRef = useRef();

    useEffect(() => {
        if (group) {
            setName(group.name || "");
            setDescription(group.description || "");
        }
    }, [group]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Tên nhóm sản phẩm là bắt buộc");

        try {
            setLoading(true);
            if (group) {
                await updateProductGroup(group._id, { name, description });
                toast.success("Cập nhật nhóm sản phẩm thành công");
            } else {
                await createProductGroup(storeId, { name, description });
                toast.success("Tạo nhóm sản phẩm thành công");
            }
            onSuccess && onSuccess();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex justify-center items-start pt-20 z-50">
            {/* Nền đen trong suốt */}
            <div
                className="absolute inset-0 bg-[#000000ab] bg-opacity-10"
                onClick={onCancel}
            ></div>

            <div
                ref={formContainerRef}
                className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl z-50"
            >
                <h2 className="text-xl font-bold mb-4">{group ? "Chỉnh sửa nhóm sản phẩm" : "Tạo nhóm sản phẩm mới"}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-1 font-semibold">Tên nhóm</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 outline-none focus:ring-2 focus:ring-green-400 transition"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-semibold">Mô tả</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 outline-none focus:ring-2 focus:ring-green-400 transition"
                            rows={3}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <Button type="button" variant="outline" onClick={onCancel} className="px-4 py-2 rounded-xl">
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? "Đang xử lý..." : group ? "Lưu thay đổi" : "Tạo nhóm"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
