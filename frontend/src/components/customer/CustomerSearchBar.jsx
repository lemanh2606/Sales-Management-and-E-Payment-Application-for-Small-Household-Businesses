import React from 'react';


export default function CustomerSearchBar({ value, onChange }) {
    return (
        <div className="mb-6">
            <input
                type="text"
                placeholder="Tìm theo tên hoặc số điện thoại..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:ring-2 focus:ring-green-400 outline-none transition-all"
            />
        </div>
    );
}