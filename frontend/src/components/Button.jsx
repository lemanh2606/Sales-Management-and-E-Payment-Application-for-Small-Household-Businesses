import React from "react";

export default function Button({ children, className = "", ...props }) {
    return (
        <button
            {...props}
            className={`bg-green-500 text-white px-5 py-2 rounded shadow hover:bg-green-600 transition ${className}`}
        >
            {children}
        </button>
    );
}
