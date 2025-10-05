import React from "react";

export default function InputField({ label, type = "text", name, value, onChange, placeholder }) {
    return (
        <div className="mb-4">
            {label && <label className="block mb-1 font-medium text-sm">{label}</label>}
            <input
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 transition"
            />
        </div>
    );
}
