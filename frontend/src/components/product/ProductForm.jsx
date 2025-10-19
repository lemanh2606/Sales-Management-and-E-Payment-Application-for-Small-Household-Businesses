// src/components/ProductForm.jsx
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
        min_stock: "",
        max_stock: "",
        unit: "",
        status: "Đang kinh doanh",
        supplier_id: "",
        group_id: "",
        description: "",
    });
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || "",
                sku: product.sku || "",
                cost_price: product.cost_price ? String(product.cost_price) : "",
                price: product.price ? String(product.price) : "",
                stock_quantity: product.stock_quantity != null ? String(product.stock_quantity) : "",
                min_stock: product.min_stock != null ? String(product.min_stock) : "",
                max_stock: product.max_stock != null ? String(product.max_stock) : "",
                unit: product.unit || "",
                status: product.status || "Đang kinh doanh",
                supplier_id: product.supplier_id ? String(product.supplier_id) : "",
                group_id: product.group_id ? String(product.group_id) : "",
                description: product.description || "",
            });

            if (product.image && product.image.url) {
                setImagePreview(product.image.url);
            } else {
                setImagePreview(null);
            }
            setImageFile(null);
        } else {
            setFormData({
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
                description: "",
            });
            setImageFile(null);
            setImagePreview(null);
        }
    }, [product]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const data = await getSuppliers(storeId);
                setSuppliers(data?.suppliers || []);
            } catch (err) {
                console.error(err);
                toast.error("Không thể tải nhà cung cấp");
            }
        };
        if (storeId) fetchSuppliers();
    }, [storeId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const buildFormData = () => {
        const fd = new FormData();
        // Theo model: name, description, sku, price, cost_price, stock_quantity, min_stock, max_stock, unit, status, supplier_id, group_id
        fd.append("name", formData.name);
        if (formData.description) fd.append("description", formData.description);
        fd.append("sku", formData.sku || "");
        if (formData.price !== "") fd.append("price", String(formData.price));
        if (formData.cost_price !== "") fd.append("cost_price", String(formData.cost_price));
        if (formData.stock_quantity !== "") fd.append("stock_quantity", String(formData.stock_quantity));
        if (formData.min_stock !== "") fd.append("min_stock", String(formData.min_stock));
        if (formData.max_stock !== "") fd.append("max_stock", String(formData.max_stock));
        if (formData.unit) fd.append("unit", formData.unit);
        if (formData.status) fd.append("status", formData.status);
        if (formData.supplier_id) fd.append("supplier_id", formData.supplier_id);
        if (formData.group_id) fd.append("group_id", formData.group_id);

        if (imageFile) {
            fd.append("image", imageFile); // matching uploadProductImage.single('image')
        }
        return fd;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // validation
        if (!formData.name || !formData.sku) {
            toast.error("Vui lòng điền tên và SKU");
            return;
        }
        setLoading(true);
        try {
            const fd = buildFormData();
            if (product && product._id) {
                await updateProduct(product._id, fd);
                toast.success("Cập nhật sản phẩm thành công");
            } else {
                await createProduct(storeId, fd);
                toast.success("Tạo sản phẩm thành công");
            }
            onSuccess && onSuccess();
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.message || err?.message || "Có lỗi xảy ra";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow">
            <h2 className="text-2xl font-bold mb-6">{product ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* name */}
                <div>
                    <label className="block font-medium mb-1">Tên sản phẩm</label>
                    <input name="name" value={formData.name} onChange={handleChange} required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                </div>

                {/* sku */}
                <div>
                    <label className="block font-medium mb-1">SKU</label>
                    <input name="sku" value={formData.sku} onChange={handleChange} required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                </div>

                {/* price/cost */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block font-medium mb-1">Giá bán (price)</label>
                        <input name="price" value={formData.price} onChange={handleChange} type="number" step="0.01"
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Giá nhập (cost_price)</label>
                        <input name="cost_price" value={formData.cost_price} onChange={handleChange} type="number" step="0.01"
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                    </div>
                </div>

                {/* stock, min/max */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block font-medium mb-1">Tồn (stock_quantity)</label>
                        <input name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} type="number"
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Min (min_stock)</label>
                        <input name="min_stock" value={formData.min_stock} onChange={handleChange} type="number"
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Max (max_stock)</label>
                        <input name="max_stock" value={formData.max_stock} onChange={handleChange} type="number"
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                    </div>
                </div>

                {/* unit */}
                <div>
                    <label className="block font-medium mb-1">Đơn vị (unit)</label>
                    <input name="unit" value={formData.unit} onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                </div>

                {/* supplier & group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block font-medium mb-1">Nhà cung cấp (supplier)</label>
                        <select name="supplier_id" value={formData.supplier_id} onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400">
                            <option value="">-- Chọn --</option>
                            {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block font-medium mb-1">Nhóm (group_id)</label>
                        <input name="group_id" value={formData.group_id} onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                    </div>
                </div>

                {/* description */}
                <div>
                    <label className="block font-medium mb-1">Mô tả</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} rows={3}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400" />
                </div>

                {/* status */}
                <div>
                    <label className="block font-medium mb-1">Trạng thái</label>
                    <select name="status" value={formData.status} onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-400">
                        <option value="Đang kinh doanh">Đang kinh doanh</option>
                        <option value="Ngừng kinh doanh">Ngừng kinh doanh</option>
                        <option value="Ngừng bán">Ngừng bán</option>
                    </select>
                </div>

                {/* image */}
                <div>
                    <label className="block font-medium mb-1">Ảnh (image)</label>
                    <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" onChange={handleImageChange}
                            className="text-sm text-slate-600" />
                        {imagePreview && <img src={imagePreview} alt="preview" className="w-20 h-20 object-cover rounded" />}
                    </div>
                </div>

                {/* actions */}
                <div className="flex justify-end gap-3 mt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>Hủy</Button>
                    <Button type="submit" className="bg-green-600 text-white" disabled={loading}>
                        {loading ? "Đang xử lý..." : (product ? "Lưu thay đổi" : "Tạo sản phẩm")}
                    </Button>
                </div>
            </form>
        </div>
    );
}
