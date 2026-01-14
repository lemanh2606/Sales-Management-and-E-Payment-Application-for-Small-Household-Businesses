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
  message,
  Divider,
  Cascader,
  Tooltip,
  Spin,
  Popover,
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
  AimOutlined,
  DownOutlined,
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
}) {
  const [form] = Form.useForm();
  const [localTags, setLocalTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingCoords, setFetchingCoords] = useState(false);

  // Scroll enhancements
  const modalBodyRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // VN administrative cascader
  const [vnOptions, setVnOptions] = useState([]);
  const [vnLoading, setVnLoading] = useState(false);
  const [cascaderValue, setCascaderValue] = useState(undefined);
  const [cascaderVisible, setCascaderVisible] = useState(false);

  // 👉 SỬA LỖI: Thêm state riêng cho address để force re-render
  const [addressValue, setAddressValue] = useState("");

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
      console.log("✅ Loaded VN options:", options.length, "provinces");
      setVnOptions(options);
    } catch (e) {
      console.error("❌ Load provinces error:", e);
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

    console.log("📋 Form data from DB:", normalized);

    // 👉 SỬA LỖI: Set address value riêng
    const initialAddress = normalized.address || "";
    setAddressValue(initialAddress);

    form.setFieldsValue({
      name: normalized.name || "",
      address: initialAddress,
      phone: normalized.phone || "",
      description: normalized.description || "",
      imageUrl: normalized.imageUrl || "",
      openTime: normalized.openingHours.open ? dayjs(normalized.openingHours.open, "HH:mm") : null,
      closeTime: normalized.openingHours.close ? dayjs(normalized.openingHours.close, "HH:mm") : null,
      lat: normalized.location.lat,
      lng: normalized.location.lng,
    });

    setLocalTags(normalized.tags);
    setImagePreviewError(false);
    setCascaderValue(undefined);
    setCascaderVisible(false);

    setTimeout(() => calcScrollHint(), 0);
    setTimeout(() => calcScrollHint(), 100);
    setTimeout(() => calcScrollHint(), 300);
  }, [open, formData, form]);

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

  // ========== 👇 XỬ LÝ CASCADER → GHI VÀO ADDRESS 👇 ==========
  const onVnAreaChange = async (values, selectedOptions) => {
    console.log("🔄 Cascader onChange:", values, selectedOptions);

    // CHỈ XỬ LÝ KHI CHỌN ĐỦ 3 CẤP
    if (!values || values.length < 3) {
      console.log("⚠️ Chưa chọn đủ 3 cấp, length:", values?.length);
      setCascaderValue(values);
      return;
    }

    const province = selectedOptions?.[0]?.label || "";
    const district = selectedOptions?.[1]?.label || "";
    const ward = selectedOptions?.[2]?.label || "";

    console.log("✅ Đã chọn đủ 3 cấp:", { province, district, ward });

    // Lấy địa chỉ hiện tại từ state (không phải form)
    const currentAddress = addressValue;
    const detailPart = extractDetailFromAddress(currentAddress);

    // Ghép địa chỉ mới
    const newAddress = [detailPart, ward, district, province]
      .filter(Boolean)
      .map((s) => s.trim())
      .join(", ");

    console.log("📍 Địa chỉ mới:", newAddress);
    console.log("📍 Địa chỉ cũ:", currentAddress);
    console.log("📍 Phần số nhà:", detailPart);

    // 👉 SỬA LỖI: Update cả state VÀ form
    setAddressValue(newAddress);
    form.setFieldsValue({ address: newAddress });

    // Reset cascader và đóng popover
    setCascaderValue(undefined);
    setCascaderVisible(false);

    // Tự động lấy tọa độ
    try {
      const geo = await fetchLatLngFromAddress(newAddress);
      if (geo && geo.lat && geo.lng) {
        form.setFieldsValue({
          lat: geo.lat,
          lng: geo.lng,
        });
        message.success("✅ Đã cập nhật địa chỉ và tọa độ");
      } else {
        message.success("✅ Đã cập nhật địa chỉ");
      }
    } catch (e) {
      console.warn("Không lấy được tọa độ tự động", e);
      message.success("✅ Đã cập nhật địa chỉ");
    }
  };

  const extractDetailFromAddress = (address) => {
    if (!address) return "";

    const parts = address.split(",").map((s) => s.trim());
    const firstPart = parts[0] || "";
    const adminKeywords = ["phường", "xã", "quận", "huyện", "thành phố", "tỉnh", "ward", "district"];

    const hasAdminKeyword = adminKeywords.some((keyword) =>
      firstPart.toLowerCase().includes(keyword)
    );

    return hasAdminKeyword ? "" : firstPart;
  };
  // ========== 👆 END 👆 ==========

  // ========== 👇 HÀM LẤY TỌA ĐỘ 👇 ==========
  const handleFetchCoordinates = async () => {
    const address = addressValue || form.getFieldValue("address");

    if (!address || address.trim().length < 5) {
      message.warning("Vui lòng nhập địa chỉ trước khi lấy tọa độ");
      return;
    }

    setFetchingCoords(true);
    try {
      const geo = await fetchLatLngFromAddress(address);

      if (geo && geo.lat && geo.lng) {
        form.setFieldsValue({
          lat: geo.lat,
          lng: geo.lng,
        });
        message.success(`Đã lấy tọa độ: ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`);
      } else {
        message.warning("Không tìm thấy tọa độ cho địa chỉ này");
      }
    } catch (error) {
      console.error("Error fetching coordinates:", error);
      message.error("Không thể lấy tọa độ. Vui lòng thử lại");
    } finally {
      setFetchingCoords(false);
    }
  };
  // ========== 👆 END 👆 ==========

  // Open Google Maps directions
  const openDirections = () => {
    const address = addressValue || form.getFieldValue("address");
    const values = form.getFieldsValue();
    let url;
    if (values.lat != null && values.lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${values.lat},${values.lng}`)}`;
    } else if (address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    } else {
      url = "https://www.google.com/maps";
    }
    window.open(url, "_blank");
  };

  // Form submission
  const handleFinish = async (values) => {
    console.log("💾 Submitting form values:", values);

    const normalized = {
      name: values.name,
      address: addressValue || values.address, // 👈 Ưu tiên addressValue
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

  // ========== 👇 CASCADER POPOVER CONTENT 👇 ==========
  const cascaderContent = (
    <div style={{ width: 400 }}>
      <Cascader
        value={cascaderValue}
        options={vnOptions}
        placeholder="Chọn Tỉnh/Thành → Quận/Huyện → Phường/Xã"
        onChange={onVnAreaChange}
        changeOnSelect={false}
        showSearch={{
          filter: (inputValue, path) =>
            path.some((option) =>
              (option.label || "").toLowerCase().includes(inputValue.toLowerCase())
            ),
        }}
        style={{ width: "100%" }}
        size="large"
        loading={vnLoading}
        notFoundContent={
          vnLoading ? (
            <Spin size="small" />
          ) : (
            <div style={{ padding: 12, textAlign: "center", color: "#999" }}>
              {vnOptions.length === 0 ? "Đang tải dữ liệu..." : "Không tìm thấy"}
            </div>
          )
        }
        disabled={vnLoading || vnOptions.length === 0}
        expandTrigger="hover"
      />
      <div style={{ marginTop: 8, fontSize: 12, color: "#999", textAlign: "center" }}>
        💡 Chọn đủ Tỉnh → Quận → Phường để tự động điền
      </div>
    </div>
  );
  // ========== 👆 END POPOVER 👆 ==========

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
      destroyOnHidden
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

                {/* ========== 👇 ĐỊA CHỈ VỚI NÚT CHỌN KHU VỰC (CONTROLLED) 👇 ========== */}
                <Form.Item
                  label={
                    <Space>
                      <EnvironmentOutlined style={{ color: "#1890ff" }} />
                      <span style={{ fontWeight: 600 }}>Địa chỉ cửa hàng</span>
                    </Space>
                  }
                  name="address"
                  rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
                >
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      size="large"
                      placeholder="Nhập địa chỉ hoặc chọn từ danh sách..."
                      prefix={<EnvironmentOutlined style={{ color: "#1890ff" }} />}
                      style={{ flex: 1, borderRadius: "8px 0 0 8px" }}
                      value={addressValue} // 👈 Controlled value
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setAddressValue(newValue);
                        form.setFieldsValue({ address: newValue });
                      }}
                    />
                    <Popover
                      content={cascaderContent}
                      title={
                        <Space>
                          <GlobalOutlined style={{ color: "#13c2c2" }} />
                          <span>Chọn khu vực</span>
                        </Space>
                      }
                      trigger="click"
                      open={cascaderVisible}
                      onOpenChange={setCascaderVisible}
                      placement="bottomRight"
                      overlayStyle={{ width: 420 }}
                    >
                      <Tooltip title="Chọn khu vực từ danh sách">
                        <Button
                          size="large"
                          type="default"
                          icon={<DownOutlined />}
                          style={{
                            borderRadius: "0 8px 8px 0",
                            borderLeft: "none",
                          }}
                        >
                          Chọn KV
                        </Button>
                      </Tooltip>
                    </Popover>
                  </Space.Compact>
                </Form.Item>
                {/* ========== 👆 END ĐỊA CHỈ 👆 ========== */}

                {/* ========== 👇 TỌA ĐỘ VỚI NÚT LẤY TỌA ĐỘ 👇 ========== */}
                <Row gutter={12}>
                  <Col span={10}>
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
                  <Col span={10}>
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
                  <Col span={4}>
                    <Form.Item label=" ">
                      <Tooltip title="Lấy tọa độ từ địa chỉ">
                        <Button
                          type="primary"
                          icon={<AimOutlined />}
                          size="large"
                          loading={fetchingCoords}
                          onClick={handleFetchCoordinates}
                          style={{
                            width: "100%",
                            height: 40,
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)",
                            border: "none",
                          }}
                        />
                      </Tooltip>
                    </Form.Item>
                  </Col>
                </Row>
                {/* ========== 👆 END TỌA ĐỘ 👆 ========== */}

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

      {/* Scroll hint button */}
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
        div[ref]::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }

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
