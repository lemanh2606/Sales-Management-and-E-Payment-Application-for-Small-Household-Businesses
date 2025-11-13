// src/components/store/StoreFormModal.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  Upload,
  Space,
  Tag,
  Row,
  Col,
  Card,
  TimePicker,
  InputNumber,
  AutoComplete,
  message,
  Divider,
  Cascader,
  Tooltip,
  Spin,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  ShopOutlined,
  ClockCircleOutlined,
  TagsOutlined,
  GlobalOutlined,
  CameraOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { fetchProvinces, buildCascaderOptionsNested } from "../../utils/vnProvinces";
import { fetchLatLngFromAddress } from "../../utils/geocodeNominatim";

const { TextArea } = Input;

export default function StoreFormModal({
  open,
  onClose,
  form: formData = {},
  setForm,
  onSave,
  busy,
  title = "Cửa hàng",
  fetchAddressSuggestions,
}) {
  const [form] = Form.useForm();
  const [localTags, setLocalTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [addrQuery, setAddrQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef(null);

  // Scroll enhancements
  const modalBodyRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // VN administrative cascader
  const [vnOptions, setVnOptions] = useState([]);
  const [vnLoading, setVnLoading] = useState(false);
  const [vnAdmin, setVnAdmin] = useState({
    province: "",
    district: "",
    ward: "",
  });

  // Load VN provinces on mount
  useEffect(() => {
    if (!open) return;
    loadVnProvinces();
  }, [open]);

  const loadVnProvinces = async () => {
    setVnLoading(true);
    try {
      const data = await fetchProvinces(2);
      const options = buildCascaderOptionsNested(data);
      setVnOptions(options);
    } catch (e) {
      console.error(e);
      message.error("Không tải được danh sách tỉnh/thành");
    } finally {
      setVnLoading(false);
    }
  };

  // Initialize form values when modal opens
  useEffect(() => {
    if (!open) return;

    const normalized = {
      ...formData,
      openingHours: formData.openingHours || { open: "", close: "" },
      location: formData.location || { lat: null, lng: null },
      tags: Array.isArray(formData.tags)
        ? formData.tags
        : formData.tagsCsv
          ? formData.tagsCsv.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
    };

    form.setFieldsValue({
      name: normalized.name || "",
      address: normalized.address || "",
      phone: normalized.phone || "",
      description: normalized.description || "",
      imageUrl: normalized.imageUrl || "",
      openTime: normalized.openingHours.open ? dayjs(normalized.openingHours.open, "HH:mm") : null,
      closeTime: normalized.openingHours.close ? dayjs(normalized.openingHours.close, "HH:mm") : null,
      lat: normalized.location.lat,
      lng: normalized.location.lng,
      vnArea: normalizeToCascader(normalized),
    });

    setLocalTags(normalized.tags);
    setAddrQuery(normalized.address || "");
    setImagePreviewError(false);

    setTimeout(() => calcScrollHint(), 0);
    setTimeout(() => calcScrollHint(), 100);
    setTimeout(() => calcScrollHint(), 300);
  }, [open, formData, form]);

  // Address suggestions with debounce
  useEffect(() => {
    if (!fetchAddressSuggestions || !addrQuery || addrQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchAddressSuggestions(addrQuery.trim());
        const options = (Array.isArray(res) ? res : []).map((s) => ({
          value: s.address || s.text || s.place_name || s.description || s,
          label: s.address || s.text || s.place_name || s.description || s,
          data: s,
        }));
        setSuggestions(options);
      } catch (err) {
        console.warn(err);
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addrQuery, fetchAddressSuggestions]);

  // Scroll hint visibility
  const calcScrollHint = () => {
    const el = modalBodyRef.current;
    if (!el) {
      setShowScrollHint(false);
      return;
    }

    const scrollTop = Math.round(el.scrollTop);
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const scrollableHeight = scrollHeight - clientHeight;

    // Threshold: còn > 20px chưa cuộn hết thì vẫn hiện
    const threshold = 20;
    const needHint = scrollableHeight > threshold && scrollTop < scrollableHeight - threshold;

    setShowScrollHint(needHint);
  };

  const smoothNudgeDown = () => {
    const el = modalBodyRef.current;
    if (!el) return;

    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    const scrollAmount = Math.min(150, remaining);

    el.scrollBy({ top: scrollAmount, behavior: "smooth" });

    // Recalc sau khi scroll xong
    setTimeout(() => calcScrollHint(), 400);
  };

  useEffect(() => {
    const el = modalBodyRef.current;
    if (!el || !open) return;

    const onScroll = () => calcScrollHint();
    const onResize = () => calcScrollHint();

    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);

    const observer = new MutationObserver(() => {
      setTimeout(() => calcScrollHint(), 50);
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [open]);

  // File upload handler
  const handleFileUpload = async (file) => {
    const maxMB = 8;
    if (file.size > maxMB * 1024 * 1024) {
      message.error(`File quá lớn (tối đa ${maxMB}MB)`);
      return false;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        form.setFieldsValue({ imageUrl: dataUrl });
        setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
        setImagePreviewError(false);
        setUploading(false);
      };
      reader.onerror = () => {
        message.error("Không đọc được file ảnh");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      message.error("Lỗi upload ảnh");
      setUploading(false);
    }
    return false;
  };

  // Tag handlers
  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (localTags.includes(tag)) {
      message.warning("Tag đã tồn tại");
      return;
    }
    const newTags = [...localTags, tag];
    setLocalTags(newTags);
    setTagInput("");
    setForm((prev) => ({
      ...prev,
      tags: newTags,
      tagsCsv: newTags.join(", "),
    }));
    setTimeout(() => calcScrollHint(), 50);
  };

  const removeTag = (tagToRemove) => {
    const newTags = localTags.filter((t) => t !== tagToRemove);
    setLocalTags(newTags);
    setForm((prev) => ({
      ...prev,
      tags: newTags,
      tagsCsv: newTags.join(", "),
    }));
    setTimeout(() => calcScrollHint(), 50);
  };

  // Address selection from suggestions
  const onAddrSelect = (value, option) => {
    const sug = option.data;
    form.setFieldsValue({ address: value });
    setAddrQuery(value);
    if (sug && (sug.lat != null || sug.lng != null)) {
      form.setFieldsValue({
        lat: sug.lat,
        lng: sug.lng,
      });
    }
    setSuggestions([]);
  };

  // VN Cascader change
  const onVnAreaChange = async (values, selectedOptions) => {
    if (!values || values.length === 0) return;

    const [provCode, distCode, wardCode] = values;
    const province = selectedOptions?.[0]?.label || "";
    const district = selectedOptions?.[1]?.label || "";
    const wardName = selectedOptions?.[2]?.label || "";

    setVnAdmin({ province, district, ward: wardName });

    const baseAddress = form.getFieldValue("address") || "";
    const adminText = [wardName, district, province].filter(Boolean).join(", ");
    const nextAddress = baseAddress ? `${baseAddress.replace(/\s+,?\s*$/, "")}, ${adminText}` : adminText;

    form.setFieldsValue({ address: nextAddress });
    setAddrQuery(nextAddress);

    try {
      const geo = await fetchLatLngFromAddress(nextAddress);
      if (geo?.lat && geo?.lng) {
        form.setFieldsValue({ lat: geo.lat, lng: geo.lng });
      }
    } catch (e) {
      // ignore
    }
  };

  // Open Google Maps directions
  const openDirections = () => {
    const values = form.getFieldsValue();
    let url;
    if (values.lat != null && values.lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${values.lat},${values.lng}`)}`;
    } else if (values.address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(values.address)}`;
    } else {
      url = "https://www.google.com/maps";
    }
    window.open(url, "_blank");
  };

  // Form submission
  const handleFinish = async (values) => {
    const normalized = {
      name: values.name,
      address: values.address,
      phone: values.phone || "",
      description: values.description || "",
      imageUrl: values.imageUrl || "",
      tags: localTags,
      tagsCsv: localTags.join(", "),
      openingHours: {
        open: values.openTime ? values.openTime.format("HH:mm") : "",
        close: values.closeTime ? values.closeTime.format("HH:mm") : "",
      },
      location: {
        lat: values.lat !== undefined && values.lat !== null && values.lat !== "" ? Number(values.lat) : null,
        lng: values.lng !== undefined && values.lng !== null && values.lng !== "" ? Number(values.lng) : null,
      },
      vnAdmin: {
        province: vnAdmin.province,
        district: vnAdmin.district,
        ward: vnAdmin.ward,
      },
    };

    setForm((prev) => ({ ...prev, ...normalized }));

    try {
      if (typeof onSave === "function") {
        const result = onSave.length >= 1 ? onSave(normalized) : onSave();
        if (result && typeof result.then === "function") await result;
      }
    } catch (err) {
      console.error("save error", err);
      message.error(err?.message || "Lỗi khi lưu cửa hàng");
    }
  };

  const imageSrc = form.getFieldValue("imageUrl") || formData?.imageUrl || "";
  const showImagePreview = !!imageSrc && !imagePreviewError;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <ShopOutlined style={{ color: "#52c41a", fontSize: 24 }} />
          <span style={{ fontSize: 20, fontWeight: 700 }}>{title}</span>
        </Space>
      }
      width={1000}
      footer={null}
      styles={{
        body: {
          maxHeight: "calc(100vh - 200px)",
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          position: "relative",
        },
      }}
      destroyOnClose
      afterOpenChange={(visible) => {
        if (visible) {
          setTimeout(() => calcScrollHint(), 100);
          setTimeout(() => calcScrollHint(), 300);
          setTimeout(() => calcScrollHint(), 500);
        }
      }}
    >
      <div
        ref={modalBodyRef}
        style={{
          maxHeight: "calc(100vh - 200px)",
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Row gutter={24}>
            {/* Left Column */}
            <Col xs={24} md={14}>
              <Card size="small" style={{ background: "#fafafa", border: "none", borderRadius: 12 }}>
                {/* Store Name */}
                <Form.Item
                  label={
                    <Space>
                      <ShopOutlined style={{ color: "#52c41a" }} />
                      <span style={{ fontWeight: 600 }}>Tên cửa hàng</span>
                    </Space>
                  }
                  name="name"
                  rules={[{ required: true, message: "Vui lòng nhập tên cửa hàng" }]}
                >
                  <Input size="large" placeholder="Nhập tên cửa hàng" style={{ borderRadius: 8 }} />
                </Form.Item>

                {/* Việt Nam administrative Cascader */}
                <Form.Item
                  label={
                    <Space>
                      <EnvironmentOutlined style={{ color: "#13c2c2" }} />
                      <span style={{ fontWeight: 600 }}>Khu vực (Tỉnh/Quận/Phường)</span>
                    </Space>
                  }
                  name="vnArea"
                >
                  <Cascader
                    options={vnOptions}
                    placeholder="Chọn Tỉnh/Thành → Quận/Huyện → Phường/Xã"
                    onChange={onVnAreaChange}
                    changeOnSelect
                    showSearch={{
                      filter: (inputValue, path) =>
                        path.some((option) => (option.label || "").toLowerCase().includes(inputValue.toLowerCase())),
                    }}
                    style={{ width: "100%" }}
                    allowClear
                    size="large"
                    loading={vnLoading}
                    notFoundContent={vnLoading ? <Spin size="small" /> : "Không có dữ liệu"}
                  />
                </Form.Item>

                {/* Address with Suggestions */}
                <Form.Item
                  label={
                    <Space>
                      <EnvironmentOutlined style={{ color: "#1890ff" }} />
                      <span style={{ fontWeight: 600 }}>Địa chỉ chi tiết</span>
                    </Space>
                  }
                  name="address"
                  rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
                >
                  <Space.Compact style={{ width: "100%" }} size="large">
                    <AutoComplete
                      value={addrQuery}
                      options={suggestions}
                      onSelect={onAddrSelect}
                      onChange={(value) => {
                        setAddrQuery(value);
                        form.setFieldsValue({ address: value });
                      }}
                      placeholder="Số nhà, đường..."
                      style={{ flex: 1 }}
                      popupMatchSelectWidth={600}
                    >
                      <Input size="large" style={{ borderRadius: "8px 0 0 8px" }} />
                    </AutoComplete>
                    <Button
                      type="primary"
                      icon={<EnvironmentOutlined />}
                      onClick={openDirections}
                      style={{
                        background: "#52c41a",
                        borderColor: "#52c41a",
                        borderRadius: "0 8px 8px 0",
                      }}
                    >
                      Chỉ đường
                    </Button>
                  </Space.Compact>
                </Form.Item>

                {/* Lat/Lng */}
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          <GlobalOutlined style={{ color: "#f5222d" }} />
                          <span style={{ fontWeight: 600 }}>Vĩ độ (Lat)</span>
                        </Space>
                      }
                      name="lat"
                    >
                      <InputNumber
                        size="large"
                        style={{ width: "100%", borderRadius: 8 }}
                        placeholder="10.775..."
                        step={0.000001}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          <GlobalOutlined style={{ color: "#f5222d" }} />
                          <span style={{ fontWeight: 600 }}>Kinh độ (Lng)</span>
                        </Space>
                      }
                      name="lng"
                    >
                      <InputNumber
                        size="large"
                        style={{ width: "100%", borderRadius: 8 }}
                        placeholder="106.700..."
                        step={0.000001}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Phone */}
                <Form.Item
                  label={
                    <Space>
                      <PhoneOutlined style={{ color: "#faad14" }} />
                      <span style={{ fontWeight: 600 }}>Số điện thoại</span>
                    </Space>
                  }
                  name="phone"
                  rules={[
                    {
                      pattern: /^[0-9+\s()-]{6,20}$/,
                      message: "Số điện thoại không hợp lệ",
                    },
                  ]}
                >
                  <Input size="large" placeholder="Nhập số điện thoại" style={{ borderRadius: 8 }} />
                </Form.Item>

                {/* Opening Hours */}
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          <ClockCircleOutlined style={{ color: "#52c41a" }} />
                          <span style={{ fontWeight: 600 }}>Giờ mở cửa</span>
                        </Space>
                      }
                      name="openTime"
                    >
                      <TimePicker
                        size="large"
                        format="HH:mm"
                        style={{ width: "100%", borderRadius: 8 }}
                        placeholder="Chọn giờ mở"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          <ClockCircleOutlined style={{ color: "#52c41a" }} />
                          <span style={{ fontWeight: 600 }}>Giờ đóng cửa</span>
                        </Space>
                      }
                      name="closeTime"
                    >
                      <TimePicker
                        size="large"
                        format="HH:mm"
                        style={{ width: "100%", borderRadius: 8 }}
                        placeholder="Chọn giờ đóng"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Description */}
                <Form.Item label={<span style={{ fontWeight: 600 }}>Mô tả</span>} name="description">
                  <TextArea rows={4} placeholder="Nhập mô tả về cửa hàng" style={{ borderRadius: 8 }} />
                </Form.Item>

                {/* Tags */}
                <Form.Item
                  label={
                    <Space>
                      <TagsOutlined style={{ color: "#52c41a" }} />
                      <span style={{ fontWeight: 600 }}>Tags</span>
                    </Space>
                  }
                >
                  <Space.Compact style={{ width: "100%" }} size="large">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onPressEnter={addTag}
                      placeholder="Nhập tag và nhấn Enter"
                      style={{ borderRadius: "8px 0 0 8px" }}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={addTag}
                      style={{
                        background: "#52c41a",
                        borderColor: "#52c41a",
                        borderRadius: "0 8px 8px 0",
                      }}
                    >
                      Thêm
                    </Button>
                  </Space.Compact>

                  <Space size={[8, 8]} wrap style={{ marginTop: 12 }}>
                    {localTags.map((tag, idx) => (
                      <Tag
                        key={idx}
                        closable
                        onClose={() => removeTag(tag)}
                        color="green"
                        style={{
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: 13,
                        }}
                      >
                        {tag}
                      </Tag>
                    ))}
                  </Space>
                </Form.Item>
              </Card>
            </Col>

            {/* Right Column - Image Upload */}
            <Col xs={24} md={10}>
              <Card
                size="small"
                title={
                  <Space>
                    <CameraOutlined style={{ color: "#1890ff" }} />
                    <span style={{ fontWeight: 600 }}>Ảnh cửa hàng</span>
                  </Space>
                }
                style={{ borderRadius: 12 }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 240,
                    borderRadius: 12,
                    background: "#f5f5f5",
                    border: "2px dashed #d9d9d9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  {showImagePreview ? (
                    <img
                      src={imageSrc}
                      alt="preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={() => setImagePreviewError(true)}
                    />
                  ) : (
                    <div style={{ textAlign: "center", color: "#8c8c8c" }}>
                      <CameraOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                      <div>{uploading ? "Đang tải..." : "Chưa có ảnh"}</div>
                    </div>
                  )}
                </div>

                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Upload accept="image/*" beforeUpload={handleFileUpload} showUploadList={false}>
                    <Button icon={<UploadOutlined />} block size="large" loading={uploading} style={{ borderRadius: 8 }}>
                      Chọn file ảnh
                    </Button>
                  </Upload>

                  <Form.Item name="imageUrl" style={{ margin: 0 }}>
                    <Input
                      placeholder="Hoặc dán URL ảnh"
                      prefix={<CameraOutlined style={{ color: "#8c8c8c" }} />}
                      size="large"
                      style={{ borderRadius: 8 }}
                    />
                  </Form.Item>

                  {imageSrc && (
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      block
                      onClick={() => {
                        form.setFieldsValue({ imageUrl: "" });
                        setForm((prev) => ({ ...prev, imageUrl: "" }));
                        setImagePreviewError(false);
                      }}
                      style={{ borderRadius: 8 }}
                    >
                      Xóa ảnh
                    </Button>
                  )}

                  <div style={{ fontSize: 12, color: "#8c8c8c", textAlign: "center" }}>
                    📌 Định dạng: JPG, PNG. Tối đa 8MB
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Footer Actions */}
          <Divider style={{ margin: "24px 0" }} />
          <Row justify="end" gutter={12}>
            <Col>
              <Button size="large" onClick={onClose} style={{ borderRadius: 8, minWidth: 120 }}>
                Hủy
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={busy || uploading}
                icon={<SaveOutlined />}
                style={{
                  background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                  border: "none",
                  borderRadius: 8,
                  minWidth: 120,
                  fontWeight: 600,
                }}
              >
                Lưu
              </Button>
            </Col>
          </Row>
        </Form>
      </div>

      {/* Nút scroll hint - CỐ ĐỊNH trong viewport modal, không scroll theo */}
      {showScrollHint && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <Tooltip title="Cuộn xuống xem thêm">
            <Button
              type="primary"
              shape="circle"
              icon={<ArrowDownOutlined />}
              onClick={smoothNudgeDown}
              style={{
                width: 48,
                height: 48,
                boxShadow: "0 8px 24px rgba(82, 196, 26, 0.4)",
                background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                border: "none",
                animation: "bounce 1.5s infinite",
                pointerEvents: "auto",
              }}
            />
          </Tooltip>
        </div>
      )}

      <style>{`
        /* Ẩn scrollbar webkit */
        div[ref]::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }

        /* Bounce animation */
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </Modal>
  );
}

// Helper
function normalizeToCascader(formData) {
  const prov = formData?.vnAdmin?.province;
  const dist = formData?.vnAdmin?.district;
  const ward = formData?.vnAdmin?.ward;
  if (prov && dist && ward) return [prov, dist, ward];
  return undefined;
}
