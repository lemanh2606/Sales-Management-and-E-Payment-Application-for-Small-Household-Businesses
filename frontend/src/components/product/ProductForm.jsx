import React, { useState, useEffect, useMemo } from "react";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Row,
  Col,
  Divider,
  Collapse,
  Upload,
  message,
  Card,
} from "antd";
import {
  SaveOutlined,
  CloseOutlined,
  ShoppingOutlined,
  DollarOutlined,
  StockOutlined,
  AppstoreOutlined,
  CaretRightOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import ImgCrop from "antd-img-crop";
import { getSuppliers } from "../../api/supplierApi";
import { getProductGroupsByStore } from "../../api/productGroupApi";
import { getWarehouses } from "../../api/warehouseApi";
import { createProduct, updateProduct } from "../../api/productApi";
import Swal from "sweetalert2";

const { TextArea } = Input;
const { Panel } = Collapse;

export default function ProductForm({ storeId, product = null, onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [suppliers, setSuppliers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [fileList, setFileList] = useState([]);

  // Helper: chuẩn hoá id về string (hỗ trợ object populate hoặc string)
  const toId = (v) => {
    if (!v) return undefined;
    if (typeof v === "string") return v;
    if (typeof v === "object") return v._id?.toString?.() || v.id?.toString?.();
    return undefined;
  };

  // Load suppliers & groups & warehouses
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersData, groupsData, warehousesData] = await Promise.all([
          getSuppliers(storeId),
          getProductGroupsByStore(storeId),
          getWarehouses(storeId),
        ]);

        setSuppliers(suppliersData?.suppliers || []);
        setGroups(groupsData?.productGroups || []);
        setWarehouses(warehousesData?.warehouses || []);
      } catch (err) {
        Swal.fire({
          title: " Lỗi!",
          text: "Không thể tải dữ liệu",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#ff4d4f",
          timer: 2000,
        });
      }
    };

    if (storeId) fetchData();
  }, [storeId]);

  // ✅ SUPPLIER OPTIONS
  const supplierOptions = useMemo(() => {
    const base = (suppliers || []).map((s) => ({ value: s._id, label: s.name }));
    const currentId = toId(product?.supplier_id || product?.supplier || product?.supplierid);

    if (product && currentId) {
      const exists = base.some((o) => String(o.value) === String(currentId));
      if (!exists) {
        const label = product?.supplier_id?.name || product?.supplier?.name || "Nhà cung cấp hiện tại";
        base.unshift({ value: currentId, label });
      }
    }
    return base;
  }, [suppliers, product]);

  // ✅ GROUP OPTIONS
  const groupOptions = useMemo(() => {
    const base = (groups || []).map((g) => ({ value: g._id, label: g.name }));
    const currentId = toId(product?.group_id || product?.group || product?.groupid);

    if (product && currentId) {
      const exists = base.some((o) => String(o.value) === String(currentId));
      if (!exists) {
        const label = product?.group_id?.name || product?.group?.name || "Nhóm sản phẩm hiện tại";
        base.unshift({ value: currentId, label });
      }
    }
    return base;
  }, [groups, product]);

  // ✅ WAREHOUSE OPTIONS - SỬA ĐÚNG FIELD
  const warehouseOptions = useMemo(() => {
    const base = (warehouses || []).map((w) => ({ value: w._id, label: w.name }));

    // ✅ Đọc đúng field từ backend (ưu tiên schema + alias)
    const currentId = toId(
      product?.default_warehouse_id ||
      product?.warehouse_id ||
      product?.default_warehouse?._id ||
      product?.warehouse?._id ||
      product?.warehouseId
    );

    if (product && currentId) {
      const exists = base.some((o) => String(o.value) === String(currentId));
      if (!exists) {
        const label =
          product?.default_warehouse?.name ||
          product?.default_warehouse_id?.name ||
          product?.warehouse?.name ||
          product?.default_warehouse_name ||
          product?.warehouse_name ||
          "Kho hiện tại";
        base.unshift({ value: currentId, label });
      }
    }
    return base;
  }, [warehouses, product]);

  // Load product data if editing
  useEffect(() => {
    if (product) {
      const hasImageUrl = !!product?.image?.url;

      const defaultImage = hasImageUrl
        ? [
          {
            uid: "-1",
            name: product.image.publicid || product.image.public_id || "image",
            status: "done",
            url: product.image.url,
          },
        ]
        : [];

      setFileList(defaultImage);

      // ✅ Lấy đúng id cho các select
      const supplierValue = toId(product?.supplier_id || product?.supplier || product?.supplierid);
      const groupValue = toId(product?.group_id || product?.group || product?.groupid);
      const warehouseValue = toId(
        product?.default_warehouse_id ||
        product?.warehouse_id ||
        product?.default_warehouse?._id ||
        product?.warehouse?._id ||
        product?.warehouseId
      );

      form.setFieldsValue({
        name: product.name || "",
        sku: product.sku || "",
        cost_price: product.cost_price ?? undefined,
        price: product.price ?? undefined,
        stock_quantity: product.stock_quantity ?? undefined,
        min_stock: product.min_stock ?? undefined,
        max_stock: product.max_stock ?? undefined,
        unit: product.unit || undefined,
        status: product.status || "Đang kinh doanh",

        // ✅ SỬA: dùng đúng field schema
        supplier_id: supplierValue || undefined,
        group_id: groupValue || undefined,
        default_warehouse_id: warehouseValue || undefined, // ✅ ĐÚNG

        // Legal fields
        tax_rate: product.tax_rate ?? 0,
        origin: product.origin || "",
        brand: product.brand || "",
        warranty_period: product.warranty_period || "",

        image: defaultImage,
        description: product.description || "",
      });
    } else {
      form.resetFields();
      setFileList([]);
    }
  }, [product, form]);

  const handleSubmit = async (values) => {
    const formData = new FormData();

    // Append tất cả field (trừ image)
    Object.keys(values || {}).forEach((key) => {
      if (key === "image") return;

      const v = values[key];
      if (v === undefined || v === null) return;

      formData.append(key, v);
    });

    // Append file ảnh (chỉ khi user chọn file mới)
    const fileObj = values?.image?.[0]?.originFileObj;
    if (fileObj instanceof File) {
      formData.append("image", fileObj);
    }

    // Nếu đang sửa và người dùng xóa ảnh -> báo backend
    if (product && Array.isArray(values?.image) && values.image.length === 0) {
      formData.append("removeImage", "true");
    }

    setLoading(true);
    try {
      if (product) {
        await updateProduct(product._id, storeId, formData);
      } else {
        await createProduct(storeId, formData);
      }

      Swal.fire({
        title: "Thành công!",
        text: product
          ? `Cập nhật sản phẩm "${product.name}" thành công!`
          : `Tạo sản phẩm "${values.name}" thành công!`,
        icon: "success",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: true,
      });

      onSuccess?.();
    } catch (err) {
      console.error("Lỗi:", err);
      Swal.fire({
        title: "Lỗi!",
        text: err?.response?.data?.message || "Có lỗi xảy ra",
        icon: "error",
        confirmButtonColor: "#ff4d4f",
      });
    } finally {
      setLoading(false);
    }
  };

  // Chuẩn antd Form + Upload: trả về fileList nguyên gốc
  const normFile = (e) => {
    if (Array.isArray(e)) return e;
    return e?.fileList || [];
  };

  const isEditMode = !!product;

  return (
    <>
      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
        {/* ===== PHẦN THÔNG TIN CƠ BẢN ===== */}
        <Card
          bordered={false}
          style={{
            marginBottom: "20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            borderRadius: "8px",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <Space>
              <ShoppingOutlined style={{ color: "#1890ff", fontSize: "18px" }} />
              <span style={{ fontWeight: 600, fontSize: "16px", color: "#262626" }}>
                {isEditMode ? "Thông tin sản phẩm" : "Thông tin bắt buộc"}
              </span>
              {isEditMode && (
                <span style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>
                  (Một số trường không thể chỉnh sửa)
                </span>
              )}
            </Space>
          </div>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="name"
                label={<span style={{ fontWeight: 600 }}>Tên sản phẩm</span>}
                rules={!isEditMode ? [
                  { required: true, message: "Vui lòng nhập tên sản phẩm!" },
                  { max: 200, message: "Tên không được quá 200 ký tự!" },
                ] : []}
              >
                <Input
                  prefix={<ShoppingOutlined style={{ color: "#1890ff" }} />}
                  placeholder="Nhập tên sản phẩm"
                  autoFocus={!isEditMode}
                  style={{ borderRadius: "8px" }}
                  disabled={isEditMode}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="cost_price"
                label={<span style={{ fontWeight: 600 }}>Giá vốn (₫)</span>}
                rules={!isEditMode ? [
                  { required: true, message: "Vui lòng nhập giá vốn!" },
                  { type: "number", min: 0, message: "Giá vốn phải >= 0!" },
                ] : []}
              >
                <InputNumber
                  prefix={<DollarOutlined style={{ color: "#52c41a" }} />}
                  placeholder="Nhập giá vốn"
                  style={{ width: "100%", borderRadius: "8px" }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                  disabled={isEditMode}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="price"
                label={<span style={{ fontWeight: 600 }}>Giá bán (₫)</span>}
                rules={!isEditMode ? [
                  { required: true, message: "Vui lòng nhập giá bán!" },
                  { type: "number", min: 0, message: "Giá bán phải >= 0!" },
                ] : []}
              >
                <InputNumber
                  prefix={<DollarOutlined style={{ color: "#faad14" }} />}
                  placeholder="Nhập giá bán"
                  style={{ width: "100%", borderRadius: "8px" }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                  disabled={isEditMode}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="stock_quantity"
                label={<span style={{ fontWeight: 600 }}>Số lượng tồn kho</span>}
                rules={!isEditMode ? [
                  { required: true, message: "Vui lòng nhập số lượng!" },
                  { type: "number", min: 0, message: "Số lượng phải >= 0!" },
                ] : []}
              >
                <InputNumber
                  prefix={<StockOutlined style={{ color: "#722ed1" }} />}
                  placeholder="Nhập số lượng"
                  style={{ width: "100%", borderRadius: "8px" }}
                  disabled={isEditMode}
                />
              </Form.Item>
            </Col>

            {/* KHO */}
            <Col xs={24} md={12}>
              <Form.Item
                name="default_warehouse_id"
                label={<span style={{ fontWeight: 600 }}>Kho mặc định</span>}
                rules={!isEditMode ? [{ required: true, message: "Vui lòng chọn kho!" }] : []}
              >
                <Select
                  placeholder="-- Chọn kho mặc định --"
                  style={{ borderRadius: "8px" }}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  options={warehouseOptions}
                  disabled={isEditMode}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="supplier_id"
                label={<span style={{ fontWeight: 600 }}>Nhà cung cấp</span>}
                rules={!isEditMode ? [{ required: true, message: "Vui lòng chọn nhà cung cấp!" }] : []}
              >
                <Select
                  placeholder="-- Chọn nhà cung cấp --"
                  style={{ borderRadius: "8px" }}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                  options={supplierOptions}
                  disabled={isEditMode}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ===== PHẦN THÔNG TIN TÙY CHỌN / CÓ THỂ CHỈNH SỬA ===== */}
        <Collapse
          bordered={false}
          defaultActiveKey={isEditMode ? ["1"] : []}
          expandIcon={({ isActive }) => (
            <CaretRightOutlined rotate={isActive ? 90 : 0} style={{ fontSize: "16px", color: "#1890ff" }} />
          )}
          style={{
            background: "#ffffff",
            borderRadius: "8px",
            marginBottom: "20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <Panel
            header={
              <Space>
                <AppstoreOutlined style={{ color: "#1890ff", fontSize: "16px" }} />
                <span style={{ fontWeight: 600, fontSize: "15px" }}>
                  {isEditMode ? "Thông tin có thể chỉnh sửa" : "Thông tin tùy chọn"}
                </span>
              </Space>
            }
            key="1"
          >
            <Row gutter={16}>
              {/* SKU - Disable khi edit */}
              <Col xs={24} md={12}>
                <Form.Item name="sku" label={<span style={{ fontWeight: 600 }}>SKU</span>}>
                  <Input 
                    placeholder="Mã SKU" 
                    style={{ borderRadius: "8px" }} 
                    disabled={isEditMode}
                  />
                </Form.Item>
              </Col>

              {/* Đơn vị tính - CHO PHÉP SỬA */}
              <Col xs={24} md={12}>
                <Form.Item name="unit" label={<span style={{ fontWeight: 600 }}>Đơn vị tính</span>}>
                  <Input placeholder="VD: cái, hộp, kg..." style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              {/* Nhóm sản phẩm - CHO PHÉP SỬA */}
              <Col xs={24} md={12}>
                <Form.Item
                  name="group_id"
                  label={<span style={{ fontWeight: 600 }}>Nhóm sản phẩm</span>}
                  rules={!isEditMode ? [{ required: true, message: "Vui lòng chọn nhóm!" }] : []}
                >
                  <Select
                    placeholder="-- Chọn nhóm sản phẩm --"
                    style={{ borderRadius: "8px" }}
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    options={groupOptions}
                  />
                </Form.Item>
              </Col>

              {/* TRẠNG THÁI - CHO PHÉP SỬA */}
              <Col xs={24} md={12}>
                <Form.Item name="status" label={<span style={{ fontWeight: 600 }}>Trạng thái</span>}>
                  <Select
                    style={{ borderRadius: "8px" }}
                    options={[
                      { value: "Đang kinh doanh", label: "✅ Đang kinh doanh" },
                      { value: "Ngừng kinh doanh", label: "⛔ Ngừng kinh doanh" },
                    ]}
                  />
                </Form.Item>
              </Col>

              {/* Tồn min/max - CHO PHÉP SỬA */}
              <Col xs={24} md={12}>
                <Form.Item name="min_stock" label={<span style={{ fontWeight: 600 }}>Tồn tối thiểu</span>}>
                  <InputNumber placeholder="Số lượng tối thiểu" style={{ width: "100%", borderRadius: "8px" }} min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="max_stock" label={<span style={{ fontWeight: 600 }}>Tồn tối đa</span>}>
                  <InputNumber placeholder="Số lượng tối đa" style={{ width: "100%", borderRadius: "8px" }} min={0} />
                </Form.Item>
              </Col>

              {/* ===== THÔNG TIN PHÁP LÝ & BẢO HÀNH - HIỂN THỊ Ở CẢ 2 CHẾ ĐỘ ===== */}
              <Divider dashed style={{ margin: "10px 0", borderColor: "#e8e8e8" }} orientation="left" plain>
                <span style={{ fontSize: 13, color: "#888" }}>Thông tin pháp lý & Bảo hành</span>
              </Divider>

              <Col xs={24} md={12}>
                <Form.Item name="tax_rate" label={<span style={{ fontWeight: 600 }}>Thuế GTGT (%)</span>} initialValue={0}>
                  <Select
                    style={{ borderRadius: "8px" }}
                    options={[
                      { value: -1, label: "KCT (Không chịu thuế)" },
                      { value: 0, label: "0% (Hoặc không kê khai)" },
                      { value: 5, label: "5%" },
                      { value: 8, label: "8%" },
                      { value: 10, label: "10%" },
                    ]}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="origin" label={<span style={{ fontWeight: 600 }}>Xuất xứ (Nước SX)</span>}>
                  <Input placeholder="VD: Việt Nam, Trung Quốc, Nhật Bản..." style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="brand" label={<span style={{ fontWeight: 600 }}>Thương hiệu</span>}>
                  <Input placeholder="VD: Sony, Samsung, Vinamilk..." style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="warranty_period" label={<span style={{ fontWeight: 600 }}>Bảo hành</span>}>
                  <Input placeholder="VD: 12 tháng, 2 năm..." style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              {/* ===== HÌNH ẢNH - HIỂN THỊ Ở CẢ 2 CHẾ ĐỘ ===== */}
              <Col xs={24}>
                <Form.Item
                  label={<span style={{ fontWeight: 600 }}>Hình ảnh sản phẩm</span>}
                  name="image"
                  valuePropName="fileList"
                  getValueFromEvent={normFile}
                  extra="Kéo thả hoặc click để upload (tối đa 5MB, JPG/PNG)"
                >
                  <ImgCrop rotationSlider quality={0.8}>
                    <Upload.Dragger
                      listType="picture-card"
                      fileList={fileList}
                      onChange={({ fileList: newList }) => {
                        setFileList(newList);
                        form.setFieldsValue({ image: newList });
                      }}
                      beforeUpload={(file) => {
                        const isValid = ["image/jpeg", "image/png"].includes(file.type);
                        if (!isValid) {
                          message.error("Chỉ chấp nhận file JPG/PNG!");
                          return Upload.LIST_IGNORE;
                        }
                        if (file.size / 1024 / 1024 > 5) {
                          message.error("Ảnh phải nhỏ hơn 5MB!");
                          return Upload.LIST_IGNORE;
                        }
                        return false;
                      }}
                      onPreview={async (file) => {
                        let src = file.url;
                        if (!src && file.originFileObj instanceof File) {
                          src = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(file.originFileObj);
                            reader.onload = () => resolve(reader.result);
                          });
                        }
                        if (!src) return;
                        const image = new Image();
                        image.src = src;
                        const imgWindow = window.open(src);
                        imgWindow?.document.write(image.outerHTML);
                      }}
                      style={{ borderRadius: "8px" }}
                    >
                      <div>
                        <InboxOutlined style={{ fontSize: 48, color: "#1890ff" }} />
                        <p className="ant-upload-text">Kéo & thả ảnh vào đây</p>
                        <p className="ant-upload-hint">hoặc click để chọn file</p>
                      </div>
                    </Upload.Dragger>
                  </ImgCrop>
                </Form.Item>
              </Col>

              {/* ===== MÔ TẢ - HIỂN THỊ Ở CẢ 2 CHẾ ĐỘ ===== */}
              <Col xs={24}>
                <Form.Item name="description" label={<span style={{ fontWeight: 600 }}>Mô tả</span>}>
                  <TextArea
                    placeholder="Nhập mô tả sản phẩm (tùy chọn)"
                    rows={4}
                    showCount
                    maxLength={1000}
                    style={{ borderRadius: "8px", resize: "none" }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Panel>
        </Collapse>

        <Divider style={{ margin: "20px 0" }} />

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }} size="middle">
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={onCancel}
              disabled={loading}
              style={{ borderRadius: "8px", fontWeight: 500 }}
            >
              Hủy
            </Button>

            <Button
              type="primary"
              size="large"
              icon={!loading && <SaveOutlined />}
              htmlType="submit"
              loading={loading}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                minWidth: "180px",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
              }}
            >
              {product ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <style>{`
        .ant-modal-body::-webkit-scrollbar {
          width: 8px;
        }
        .ant-modal-body::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-radius: 10px;
        }
        .ant-modal-body::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          transition: all 0.3s ease;
        }
        .ant-modal-body::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #5568d3 0%, #6a4190 100%);
        }
        .ant-modal-body {
          scrollbar-width: thin;
          scrollbar-color: #667eea #f0f0f0;
        }
      `}</style>
    </>
  );
}
