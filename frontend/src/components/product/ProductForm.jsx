import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getSuppliers } from "../../api/supplierApi";
import { createProduct, updateProduct } from "../../api/productApi";
import Button from "../Button";

export default function ProductForm({ storeId, product = null, onSuccess, onCancel }) {
    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        cost_price: "",
        price: "",
        stock_quantity: "",
        unit: "",
        status: "Đang kinh doanh",
        supplier_id: "",
    });
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load dữ liệu product nếu là edit
    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || "",
                sku: product.sku || "",
                cost_price: product.cost_price || "",
                price: product.price || "",
                stock_quantity: product.stock_quantity || "",
                unit: product.unit || "",
                status: product.status || "Đang kinh doanh",
                supplier_id: product.supplier_id || "",
            });
        }
    }, [product]);

    // Lấy danh sách nhà cung cấp
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const data = await getSuppliers(storeId);
                setSuppliers(data?.suppliers || []);
            } catch (err) {
                console.error(err);
                toast.error("Không thể tải danh sách nhà cung cấp");
            }
        };
        fetchSuppliers();
    }, [storeId]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (product) {
                await updateProduct(product._id, formData);
                toast.success("Cập nhật sản phẩm thành công!");
            } else {
                await createProduct(storeId, formData);
                toast.success("Tạo sản phẩm thành công!");
            }
            onSuccess && onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-2xl">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
                {product ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block font-semibold mb-1">Tên sản phẩm</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                    />
                </div>

                <div>
                    <label className="block font-semibold mb-1">Mã SKU</label>
                    <input
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleChange}
                        required
                        className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block font-semibold mb-1">Giá nhập</label>
                        <input
                            type="number"
                            name="cost_price"
                            value={formData.cost_price}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block font-semibold mb-1">Giá bán</label>
                        <input
                            type="number"
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block font-semibold mb-1">Số lượng tồn kho</label>
                        <input
                            type="number"
                            name="stock_quantity"
                            value={formData.stock_quantity}
                            onChange={handleChange}
                            className="border border-gray-300 rounded-xl w-full px-4 py-2 focus:ring-2 focus:ring-green-400 outline-none transition"
                        />
                    </div>
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
                </div>

                <div>
                    <label className="block font-semibold mb-1">Nhà cung cấp</label>
                    <select
                        name="supplier_id"
                        value={formData.supplier_id}
                        onChange={handleChange}
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

                <div className="flex justify-end gap-4 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                        onClick={onCancel}
                    >
                        Hủy
                    </Button>

                    <Button
                        type="submit"
                        className="px-6 py-2 rounded-xl bg-green-600 text-white shadow hover:bg-green-700 transition disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? "Đang xử lý..." : product ? "Lưu thay đổi" : "Tạo sản phẩm"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
