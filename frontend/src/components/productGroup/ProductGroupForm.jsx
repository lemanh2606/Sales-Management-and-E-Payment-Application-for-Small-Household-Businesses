import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import Button from "../Button";
import { createProductGroup, updateProductGroup } from "../../api/productGroupApi";

export default function ProductGroupForm({ storeId, group, onSuccess, onCancel }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const formContainerRef = useRef();

  useEffect(() => {
    // Animation khi mở form
    setIsAnimating(true);

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
        toast.success("✅ Cập nhật nhóm sản phẩm thành công");
      } else {
        await createProductGroup(storeId, { name, description });
        toast.success("✅ Tạo nhóm sản phẩm thành công");
      }
      onSuccess && onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onCancel();
    }, 200);
  };

  return (
    <div className="fixed inset-0 flex justify-center items-center z-50 p-4">
      {/* Overlay với animation fade in */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${isAnimating ? "opacity-50" : "opacity-0"}`}
        onClick={handleCancel}
      ></div>

      {/* Form container với animation scale */}
      <div
        ref={formContainerRef}
        className={`relative bg-white rounded-2xl w-full max-w-lg shadow-2xl z-50 transform transition-all duration-300 ${
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Header với gradient background */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl px-6 py-5">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {group ? (
              <>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Chỉnh sửa nhóm sản phẩm
              </>
            ) : (
              <>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Tạo nhóm sản phẩm mới
              </>
            )}
          </h2>
          <p className="text-green-50 text-sm mt-1">{group ? "Cập nhật thông tin nhóm sản phẩm" : "Thêm một nhóm sản phẩm mới vào hệ thống"}</p>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tên nhóm */}
          <div>
            <label className="block mb-2 font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Tên nhóm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-2 border-gray-300 rounded-xl w-full px-4 py-3 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 text-gray-700"
              placeholder="Ví dụ: Đồ uống có cồn"
              required
            />
          </div>

          {/* Mô tả */}
          <div>
            <label className="block mb-2 font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Mô tả
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border-2 border-gray-300 rounded-xl w-full px-4 py-3 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 resize-none text-gray-700"
              rows={4}
              placeholder="Thêm mô tả chi tiết về nhóm sản phẩm này..."
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Hủy
              </span>
            </Button>
            <Button
              type="submit"
              className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all duration-200 flex items-center gap-2 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:scale-105"
              }`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang xử lý...
                </>
              ) : group ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lưu thay đổi
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tạo nhóm
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
