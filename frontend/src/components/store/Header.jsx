import React from 'react';
import { FiPlus, FiSearch } from 'react-icons/fi';


export default function Header({ search, setSearch, onAdd }) {
    return (
        <header className="w-full sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-700 text-white flex items-center justify-center font-bold">SB</div>
                    <div>
                        <h1 className="text-lg font-extrabold leading-tight">Quản lý cửa hàng</h1>
                        <p className="text-xs text-gray-600">Chọn cửa hàng để vào Dashboard — tối ưu cho mọi màn hình</p>
                    </div>
                </div>


                <div className="flex-1">
                    <div className="relative max-w-2xl mx-auto">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <FiSearch size={18} className="text-gray-400" />
                        </div>
                        <input
                            aria-label="Tìm kiếm cửa hàng"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm theo tên, địa chỉ, điện thoại hoặc tag"
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-300 outline-none bg-white shadow-sm"
                        />
                    </div>
                </div>


                <div className="flex items-center gap-2">
                    <button onClick={onAdd} className="hidden sm:inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow">
                        <FiPlus /> Thêm cửa hàng
                    </button>


                    <button onClick={onAdd} aria-label="Thêm cửa hàng" className="sm:hidden p-3 rounded-full bg-green-600 text-white shadow-lg" title="Thêm cửa hàng">
                        <FiPlus size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
}