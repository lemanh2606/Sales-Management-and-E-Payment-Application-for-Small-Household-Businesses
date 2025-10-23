// src/components/StoreFormModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

/**
 * StoreFormModal
 * - Normalizes nested objects openingHours & location when modal opens
 * - Uses functional updates to setForm so nested fields are not lost
 * - Calls onSave(payload) if parent expects payload, otherwise calls onSave()
 *
 * Props:
 * - open, onClose, form, setForm, onSave, busy, title, fetchAddressSuggestions
 */
export default function StoreFormModal({
  open,
  onClose,
  form = {},
  setForm,
  onSave,
  busy,
  title = "Cửa hàng",
  fetchAddressSuggestions,
}) {
  const [localTags, setLocalTags] = useState(
    form?.tagsCsv
      ? form.tagsCsv
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : Array.isArray(form?.tags)
      ? form.tags
      : []
  );
  const [addrQuery, setAddrQuery] = useState(form?.address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const debounceRef = useRef(null);
  const panelRef = useRef(null);

  // When modal opens ensure form has nested defaults so controlled inputs show values
  useEffect(() => {
    if (!open) return;
    setForm((prev) => {
      const p = prev || {};
      const updates = {};

      // openingHours default
      if (!p.openingHours || typeof p.openingHours !== "object") {
        updates.openingHours = { open: "", close: "" };
      } else {
        updates.openingHours = {
          open: p.openingHours.open ?? "",
          close: p.openingHours.close ?? "",
        };
      }

      // location default
      if (!p.location || typeof p.location !== "object") {
        updates.location = { lat: null, lng: null };
      } else {
        updates.location = {
          lat: p.location.lat ?? null,
          lng: p.location.lng ?? null,
        };
      }

      // tagsCsv sync
      if (!("tagsCsv" in p)) {
        if (Array.isArray(p.tags)) updates.tagsCsv = p.tags.join(", ");
        else updates.tagsCsv = p.tagsCsv || "";
      }

      // tags array sync
      if (!("tags" in p) && updates.tagsCsv !== undefined) {
        updates.tags = updates.tagsCsv
          ? updates.tagsCsv
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
      }

      // only merge if we created something new (prevent unnecessary set)
      if (Object.keys(updates).length === 0) return p;
      return { ...p, ...updates };
    });
    // run only when modal opens/closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // lock body scroll while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  useEffect(() => {
    setLocalTags(
      form?.tagsCsv
        ? form.tagsCsv
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(form?.tags)
        ? form.tags
        : []
    );
  }, [form?.tagsCsv, form?.tags]);

  useEffect(() => setAddrQuery(form?.address || ""), [form?.address]);

  // address suggestions (debounced) - optional
  useEffect(() => {
    if (!fetchAddressSuggestions) {
      setSuggestions([]);
      return;
    }
    if (!addrQuery || addrQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchAddressSuggestions(addrQuery.trim());
        setSuggestions(Array.isArray(res) ? res : []);
        setShowSuggestions(true);
      } catch (err) {
        console.warn(err);
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addrQuery, fetchAddressSuggestions]);

  // file helpers
  const readFileAsDataURL = (file) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });

  const handleFileUpload = async (file) => {
    if (!file) return;
    const maxMB = 8;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`File quá lớn (tối đa ${maxMB}MB)`);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      setImagePreviewError(false);
      setForm((prev) => ({ ...(prev || {}), imageUrl: dataUrl }));
    } catch (err) {
      console.error(err);
      toast.error("Không đọc được file ảnh");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) await handleFileUpload(f);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const addTag = (tag) => {
    const t = String(tag || "").trim();
    if (!t) return;
    setLocalTags((prev) => {
      if ((prev || []).includes(t)) return prev;
      const next = [...(prev || []), t];
      setForm((prevF) => ({ ...(prevF || {}), tagsCsv: next.join(", "), tags: next }));
      return next;
    });
  };

  const removeTag = (tag) => {
    setLocalTags((prev) => {
      const next = (prev || []).filter((p) => p !== tag);
      setForm((prevF) => ({ ...(prevF || {}), tagsCsv: next.join(", "), tags: next }));
      return next;
    });
  };

  const onAddrSelect = (sug) => {
    const addressText = sug.address || sug.text || sug.place_name || sug.description || sug;
    setForm((prev) => ({
      ...(prev || {}),
      address: addressText,
      location: {
        ...(prev?.location || {}),
        lat: sug.lat != null ? Number(sug.lat) : prev?.location?.lat ?? null,
        lng: sug.lng != null ? Number(sug.lng) : prev?.location?.lng ?? null,
      },
    }));
    setAddrQuery(addressText);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const openDirections = () => {
    const loc = form?.location;
    let url;
    if (loc && loc.lat != null && loc.lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${loc.lat},${loc.lng}`)}`;
    } else if (form?.address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`;
    } else url = "https://www.google.com/maps";
    window.open(url, "_blank");
  };

  const validateBeforeSave = (payload) => {
    if (!payload?.name || !String(payload.name).trim()) return "Tên cửa hàng bắt buộc";
    if (!payload?.address || !String(payload.address).trim()) return "Địa chỉ bắt buộc";
    if (payload?.phone && !/^[0-9+\s()-]{6,20}$/.test(payload.phone)) return "Số điện thoại không hợp lệ";
    return null;
  };

  // build normalized payload and call onSave
  const handleSave = async () => {
    // ensure we read latest 'form' from prop
    const normalized = {
      ...form,
      // normalize tags
      tags: Array.isArray(form?.tags)
        ? form.tags.filter(Boolean)
        : Array.isArray(localTags)
        ? localTags
        : typeof form?.tagsCsv === "string"
        ? form.tagsCsv
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      tagsCsv: Array.isArray(form?.tags)
        ? form.tags.join(", ")
        : Array.isArray(localTags)
        ? localTags.join(", ")
        : form?.tagsCsv || "",
      // normalize openingHours to strings
      openingHours: {
        open: form?.openingHours?.open != null ? String(form.openingHours.open) : "",
        close: form?.openingHours?.close != null ? String(form.openingHours.close) : "",
      },
      // normalize location: numeric or null
      location: {
        lat: form?.location?.lat !== "" && form?.location?.lat != null ? Number(form.location.lat) : null,
        lng: form?.location?.lng !== "" && form?.location?.lng != null ? Number(form.location.lng) : null,
      },
      imageUrl: form?.imageUrl || "",
    };

    console.log("normalized payload", form.openingHours);
    const v = validateBeforeSave(normalized);
    if (v) {
      toast.error(v);
      return;
    }

    // push normalized back to parent's state so UI reflects
    setForm((prev) => ({ ...(prev || {}), ...normalized }));

    try {
      if (typeof onSave === "function") {
        // if onSave expects a payload param (length >= 1) pass normalized,
        // otherwise call onSave() (parent will read its own state)
        const maybe = onSave.length >= 1 ? onSave(normalized) : onSave();
        if (maybe && typeof maybe.then === "function") await maybe;
      }
    } catch (err) {
      console.error("save error", err);
      toast.error(err?.message || "Lỗi khi lưu cửa hàng");
    }
  };

  const clearImage = () => {
    setForm((prev) => ({ ...(prev || {}), imageUrl: "" }));
    setImagePreviewError(false);
  };

  const imageSrc = form?.imageUrl || "";
  const showImagePreview = !!imageSrc && !imagePreviewError;

  const hiddenScrollbarCss = `
    .storeform-scroll::-webkit-scrollbar { display: none; }
    .storeform-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  `;

  if (!open) return null;

  return (
    <>
      <style>{hiddenScrollbarCss}</style>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        <motion.div
          ref={panelRef}
          className="relative z-10 w-full max-w-4xl rounded-3xl bg-white shadow-2xl"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          style={{ maxHeight: "calc(100vh - 64px)", overflow: "auto" }}
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 p-6 storeform-scroll overflow-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{title}</h3>
                  <p className="text-sm text-gray-500 mt-1">Điền thông tin cửa hàng</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              {/* Name */}
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Tên cửa hàng</label>
                <input
                  value={form?.name || ""}
                  onChange={(e) => setForm((prev) => ({ ...(prev || {}), name: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                />
              </div>

              {/* Address + directions */}
              <div className="mt-4 relative">
                <label className="text-sm text-gray-600 block mb-1">Địa chỉ</label>
                <div className="flex gap-2">
                  <input
                    value={addrQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddrQuery(v);
                      setForm((prev) => ({ ...(prev || {}), address: v }));
                    }}
                    onFocus={() => {
                      if (suggestions.length) setShowSuggestions(true);
                    }}
                    placeholder="Nhập địa chỉ"
                    className="flex-1 p-3 rounded-xl border border-gray-200 bg-white"
                  />
                  <button
                    onClick={openDirections}
                    className="px-4 py-2 rounded-xl bg-green-600 text-white cursor-pointer"
                  >
                    Chỉ đường
                  </button>
                </div>

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 mt-2 z-40 bg-white border rounded max-h-52 overflow-auto">
                    {suggestions.map((s, idx) => (
                      <li
                        key={s.id ?? idx}
                        onClick={() => onAddrSelect(s)}
                        className="p-2 hover:bg-gray-50 cursor-pointer"
                      >
                        {s.text || s.address || s.place_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Lat / Lng */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Vĩ độ</label>
                  <input
                    value={form?.location?.lat ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const lat = v === "" ? null : Number(v);
                      setForm((prev) => ({
                        ...(prev || {}),
                        location: { ...(prev?.location || {}), lat: Number.isFinite(lat) ? lat : null },
                      }));
                    }}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                    placeholder="10.775..."
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Kinh độ</label>
                  <input
                    value={form?.location?.lng ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const lng = v === "" ? null : Number(v);
                      setForm((prev) => ({
                        ...(prev || {}),
                        location: { ...(prev?.location || {}), lng: Number.isFinite(lng) ? lng : null },
                      }));
                    }}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                    placeholder="106.700..."
                  />
                </div>
              </div>

              {/* Phone, Description, Tags */}
              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Số điện thoại</label>
                <input
                  value={form?.phone || ""}
                  onChange={(e) => setForm((prev) => ({ ...(prev || {}), phone: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                />
              </div>

              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Mô tả</label>
                <textarea
                  value={form?.description || ""}
                  onChange={(e) => setForm((prev) => ({ ...(prev || {}), description: e.target.value }))}
                  rows={4}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                />
              </div>

              <div className="mt-4">
                <label className="text-sm text-gray-600 block mb-1">Tags</label>
                <div className="flex gap-2">
                  <input
                    id="tag-input-field"
                    placeholder="Nhập tag và nhấn Enter"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTagFromInput(e.target);
                      }
                    }}
                    className="flex-1 p-3 rounded-xl border border-gray-200 bg-white"
                  />
                  <button
                    onClick={() => addTagFromInput(document.getElementById("tag-input-field"))}
                    className="px-4 py-2 rounded-xl bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    Thêm
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {localTags.map((t, i) => (
                    <div key={i} className="px-3 py-1 bg-gray-100 rounded-full flex items-center gap-2">
                      <span>{t}</span>
                      <button onClick={() => removeTag(t)}>×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opening hours */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Giờ mở</label>
                  <input
                    type="time"
                    value={form?.openingHours?.open ?? ""}
                    onChange={(e) => {
                      console.log("openingHours.open changed ->", e.target.value);
                      setForm((f) => ({
                        ...f,
                        openingHours: { ...f.openingHours, open: e.target.value },
                      }));
                    }}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Giờ đóng</label>
                  <input
                    type="time"
                    value={form?.openingHours?.close ?? ""}
                    onChange={(e) => {
                      console.log("openingHours.close changed ->", e.target.value);
                      setForm((prev) => ({
                        ...(prev || {}),
                        openingHours: { ...(prev?.openingHours || {}), close: e.target.value },
                      }));
                    }}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy || uploading}
                  className="px-6 py-2 rounded-xl bg-green-600 text-white cursor-pointer"
                >
                  {busy || uploading ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>

            <div
              className={`w-full md:w-80 p-6 border-l border-gray-100 ${dragOver ? "bg-green-50" : "bg-white"}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <div>
                <h4 className="text-sm font-semibold">Ảnh cửa hàng</h4>
                <p className="text-xs text-gray-500">Kéo thả hoặc chọn file / dán URL</p>
              </div>
              <div className="w-full h-44 rounded-xl bg-gray-50 border border-dashed flex items-center justify-center overflow-hidden mt-3">
                {showImagePreview ? (
                  <img
                    src={imageSrc}
                    alt="preview"
                    className="w-full h-full object-cover"
                    onError={() => setImagePreviewError(true)}
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <div className="text-3xl">📷</div>
                    <div className="text-sm mt-2">{uploading ? "Đang tải..." : "Không có ảnh"}</div>
                  </div>
                )}
              </div>

              <label className="block mt-3">
                <input
                  id="store-image-file-input"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await handleFileUpload(f);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => document.getElementById("store-image-file-input")?.click()}
                    className="flex-1 px-4 py-2 rounded-xl bg-white border hover:bg-blue-200 transition-colors duration-200 cursor-pointer"
                  >
                    Chọn file
                  </button>
                  <button
                    onClick={clearImage}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-200 transition-colors duration-200 cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </label>

              <div className="mt-3">
                <label className="text-xs text-gray-500">Hoặc dán URL</label>
                <input
                  value={form?.imageUrl || ""}
                  onChange={(e) => setForm((prev) => ({ ...(prev || {}), imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full mt-1 p-2 rounded-xl border border-gray-200"
                />
              </div>
              <div className="mt-auto text-xs text-blue-500">Định dạng: JPG, PNG. Tối đa 8MB.</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );

  // helper
  function addTagFromInput(el) {
    if (!el) return;
    const v = String(el.value || "").trim();
    if (!v) return;
    const parts = v
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    setLocalTags((prev) => {
      const next = Array.from(new Set([...(prev || []), ...parts]));
      setForm((prevForm) => ({ ...(prevForm || {}), tagsCsv: next.join(", "), tags: next }));
      el.value = "";
      el.focus();
      return next;
    });
  }
}
