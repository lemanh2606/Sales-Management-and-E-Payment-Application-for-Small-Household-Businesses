import React from 'react';
import { MdModeEditOutline } from 'react-icons/md';


export default function CustomerRow({ customer, index, onEdit, onDelete }) {
    return (
        <tr className={`transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg ${index % 2 === 0 ? 'bg-white' : 'bg-green-50'}`}>
            <td className="py-4 px-6 font-medium text-gray-900">{customer.name}</td>
            <td className="py-4 px-6">{customer.phone || '-'}</td>
            <td className="py-4 px-6">{customer.address || '-'}</td>
            <td className="py-4 px-6">{customer.note || '-'}</td>
            <td className="py-4 px-6 flex justify-center items-center gap-4">
                <button onClick={() => onEdit(customer)} className="text-yellow-500 hover:text-yellow-700" title="Sửa"><MdModeEditOutline size={20} /></button>
                <button onClick={() => onDelete(customer._id)} className="text-red-500 hover:text-red-700">Xóa</button>
            </td>
        </tr>
    );
}