import React, { useEffect, useState } from "react";
import { getStores, selectStore } from "../api/userApi";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SelectStorePage() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const { setCurrentStore } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const res = await getStores();
                if (mounted) setStores(res.stores || res);
            } catch (e) {
                setErr(e?.response?.data?.message || "Không lấy được danh sách cửa hàng");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, []);

    const handleSelect = async (store) => {
        try {
            await selectStore(store._id);
            // update context localStorage
            setCurrentStore(store);
            // redirect to dashboard
            navigate("/dashboard");
        } catch (e) {
            setErr(e?.response?.data?.message || "Không thể chọn cửa hàng");
        }
    };

    if (loading) return <div className="p-6">Đang tải danh sách cửa hàng...</div>;

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-2xl p-8 bg-white rounded-3xl shadow-xl border-t-4 border-green-500">
                <h2 className="text-2xl font-bold mb-4 text-green-600">Chọn cửa hàng để vào Dashboard</h2>
                {err && <p className="text-red-500 mb-3">{err}</p>}
                {stores.length === 0 ? (
                    <p>Không có cửa hàng nào. Vui lòng tạo cửa hàng trước.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stores.map((s) => (
                            <div key={s._id} className="p-4 border rounded-lg flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold">{s.name}</h3>
                                    <p className="text-sm text-gray-500">{s.address}</p>
                                    <p className="text-sm text-gray-500">SĐT: {s.phone}</p>
                                </div>
                                <div className="mt-4">
                                    <Button onClick={() => handleSelect(s)} className="w-full">Chọn cửa hàng</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
