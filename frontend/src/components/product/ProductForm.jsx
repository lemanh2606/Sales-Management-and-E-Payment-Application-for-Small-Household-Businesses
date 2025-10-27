import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { getSuppliers } from "../../api/supplierApi";
import { getProductGroupsByStore } from "../../api/productGroupApi";
import { createProduct, updateProduct } from "../../api/productApi";
import Button from "../Button";
import { MdExpandMore, MdExpandLess } from "react-icons/md";

export default function ProductForm({ storeId, product = null, onSuccess, onCancel }) {
    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        cost_price: "",
        price: "",
        stock_quantity: "",
        min_stock: "",
        max_stock: "",
        unit: "",
        status: "Đang kinh doanh",
        supplier_id: "",
        group_id: "",
        image: "",
        description: "",
    });

    const [suppliers, setSuppliers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showOptional, setShowOptional] = useState(false);
    const [showScrollHint, setShowScrollHint] = useState(true);

    const formContainerRef = useRef();

    // Load nhà cung cấp & nhóm sản phẩm
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const data = await getSuppliers(storeId);
                setSuppliers(data?.suppliers || []);
            } catch {
                toast.error("Không thể tải danh sách nhà cung cấp");
            }
        };
        const fetchGroups = async () => {
            try {
                const data = await getProductGroupsByStore(storeId);
                setGroups(data?.productGroups || []);
            } catch {
                toast.error("Không thể tải danh sách nhóm sản phẩm");
            }
        };
        fetchSuppliers();
        fetchGroups();
    }, [storeId]);

    // Load product nếu edit
    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || "",
                sku: product.sku || "",
                cost_price: product.cost_price || "",
                price: product.price || "",
                stock_quantity: product.stock_quantity || "",
                min_stock: product.min_stock || "",
                max_stock: product.max_stock || "",
                unit: product.unit || "",
                status: product.status || "Đang kinh doanh",
                supplier_id: product.supplier?._id || "",
                group_id: product.group?._id || "", // <-- fix ở đây
                image: product.image || "",
                description: product.description || "",
            });
        }
    }, [product]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = { ...formData };
            if (!payload.supplier_id) delete payload.supplier_id;
            if (!payload.group_id) delete payload.group_id;

            if (product) {
                await updateProduct(product._id, payload);
                toast.success("Cập nhật sản phẩm thành công!");
            } else {
                await createProduct(storeId, payload);
                toast.success("Tạo sản phẩm thành công!");
            }
            onSuccess && onSuccess();
        } catch (err) {
            console.error(" Lỗi updateProduct:", err);
            toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
        } finally {
            setLoading(false);
        }
    };

    const handleScroll = () => {
        const container = formContainerRef.current;
        if (!container) return;
        const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 5;
        setShowScrollHint(!atBottom);
    };

    const handleFocus = () => setShowScrollHint(false);

    return (
        <div className="fixed inset-0 flex justify-center items-center bg-opacity-90 z-50">
            <div
                ref={formContainerRef}
                onScroll={handleScroll}
                className="relative w-full max-w-3xl bg-white rounded-2xl overflow-auto max-h-[90vh] p-6 scrollbar-none shadow-2xl"
            >
                <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
                    {product ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Bắt buộc */}
                    <div>
                        <label className="block font-semibold mb-1">Tên sản phẩm *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-semibold mb-1">Giá vốn *</label>
                            <input
                                type="number"
                                name="cost_price"
                                value={formData.cost_price}
                                onChange={handleChange}
                                required
                                className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block font-semibold mb-1">Giá bán *</label>
                            <input
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                required
                                className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1">Số lượng tồn kho *</label>
                        <input
                            type="number"
                            name="stock_quantity"
                            value={formData.stock_quantity}
                            onChange={handleChange}
                            required
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block font-semibold mb-1">Nhà cung cấp *</label>
                        <select
                            name="supplier_id"
                            value={formData.supplier_id || ""}
                            onChange={handleChange}
                            required
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                        >
                            <option value="">-- Chọn nhà cung cấp --</option>
                            {suppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Thông tin tùy chọn */}
                    <div className="mt-2 border-t pt-4">
                        <button
                            type="button"
                            className="flex items-center gap-2 text-green-600 font-semibold mb-4"
                            onClick={() => setShowOptional(!showOptional)}
                        >
                            {showOptional ? <MdExpandLess size={24} /> : <MdExpandMore size={24} />}
                            Thông tin tùy chọn
                        </button>

                        {showOptional && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block font-semibold mb-1">SKU</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={formData.sku}
                                        onChange={handleChange}
                                        className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block font-semibold mb-1">Đơn vị tính</label>
                                        <input
                                            type="text"
                                            name="unit"
                                            value={formData.unit}
                                            onChange={handleChange}
                                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold mb-1">Nhóm sản phẩm *</label>
                                        <select
                                            name="group_id"
                                            value={formData.group_id || ""}
                                            onChange={handleChange}
                                            required
                                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                                        >
                                            <option value="">-- Chọn nhóm sản phẩm --</option>
                                            {groups.map((g) => (
                                                <option key={g._id} value={g._id}>
                                                    {g.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold mb-1">Hình ảnh (URL)</label>
                                    <input
                                        type="text"
                                        name="image"
                                        value={formData.image}
                                        onChange={handleChange}
                                        className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold mb-1">Mô tả</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold mb-1">Trạng thái</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                                    >
                                        <option value="Đang kinh doanh">Đang kinh doanh</option>
                                        <option value="Ngừng kinh doanh">Ngừng kinh doanh</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Hủy
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Đang xử lý..." : product ? "Lưu thay đổi" : "Tạo sản phẩm"}
                        </Button>
                    </div>
                </form>

                {/* Scroll hint */}
                {showScrollHint && (
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-gray-500 text-sm animate-bounce">
                        <MdExpandMore size={20} /> Nội dung phía dưới
                    </div>
                )}

                <style>{`
          .scrollbar-none::-webkit-scrollbar { display: none; }
          .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
            </div>
        </div>
    );
}
