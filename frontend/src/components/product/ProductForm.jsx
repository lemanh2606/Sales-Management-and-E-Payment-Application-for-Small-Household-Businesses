// src/components/product/ProductForm.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, InputNumber, Select, Button, Space, Row, Col, Divider, Collapse, message, Card } from "antd";
import {
  SaveOutlined,
  CloseOutlined,
  ShoppingOutlined,
  DollarOutlined,
  StockOutlined,
  AppstoreOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { getSuppliers } from "../../api/supplierApi";
import { getProductGroupsByStore } from "../../api/productGroupApi";
import { createProduct, updateProduct } from "../../api/productApi";
import Swal from "sweetalert2";

const { TextArea } = Input;
const { Panel } = Collapse;

export default function ProductForm({ storeId, product = null, onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [groups, setGroups] = useState([]);

  // Load suppliers & groups
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersData, groupsData] = await Promise.all([
          getSuppliers(storeId),
          getProductGroupsByStore(storeId),
        ]);
        setSuppliers(suppliersData?.suppliers || []);
        setGroups(groupsData?.productGroups || []);
      } catch (err) {
        Swal.fire({
          title: "❌ Lỗi!",
          text: "không thể tải dữ liệu",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#ff4d4f",
          timer: 2000,
        });
      }
    };
    fetchData();
  }, [storeId]);

  // Load product data if editing
  useEffect(() => {
    if (product) {
      form.setFieldsValue({
        name: product.name || "",
        sku: product.sku || "",
        cost_price: product.cost_price || "",
        price: product.price || "",
        stock_quantity: product.stock_quantity || "",
        min_stock: product.min_stock || "",
        max_stock: product.max_stock || "",
        unit: product.unit || "",
        status: product.status || "Đang kinh doanh",
        supplier_id: product.supplier?._id || "",
        group_id: product.group?._id || "",
        image: product.image || "",
        description: product.description || "",
      });
    } else {
      form.resetFields();
    }
  }, [product, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = { ...values };
      if (!payload.supplier_id) delete payload.supplier_id;
      if (!payload.group_id) delete payload.group_id;

      if (product) {
        await updateProduct(product._id, payload);
        Swal.fire({
          title: "🎉 Thành công!",
          text: "Cập nhật sản phẩm thành công!",
          icon: "success",
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
      } else {
        await createProduct(storeId, payload);
        Swal.fire({
          title: "🎉 Thành công!",
          text: "Tạo sản phẩm thành công!",
          icon: "success",
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
      }
      onSuccess && onSuccess();
    } catch (err) {
      console.error("Lỗi:", err);
      Swal.fire({
        title: "❌ Lỗi!",
        text: err?.response?.data?.message || "Có lỗi xảy ra",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
        {/* Required Fields Section */}
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
              <span style={{ fontWeight: 600, fontSize: "16px", color: "#262626" }}>Thông tin bắt buộc</span>
            </Space>
          </div>

          <Row gutter={16}>
            {/* Product Name */}
            <Col xs={24}>
              <Form.Item
                name="name"
                label={<span style={{ fontWeight: 600 }}>Tên sản phẩm</span>}
                rules={[
                  { required: true, message: "Vui lòng nhập tên sản phẩm!" },
                  { max: 200, message: "Tên không được quá 200 ký tự!" },
                ]}
              >
                <Input
                  prefix={<ShoppingOutlined style={{ color: "#1890ff" }} />}
                  placeholder="Nhập tên sản phẩm"
                  autoFocus
                  style={{ borderRadius: "8px" }}
                />
              </Form.Item>
            </Col>

            {/* Cost Price & Selling Price */}
            <Col xs={24} md={12}>
              <Form.Item
                name="cost_price"
                label={<span style={{ fontWeight: 600 }}>Giá vốn (₫)</span>}
                rules={[
                  { required: true, message: "Vui lòng nhập giá vốn!" },
                  { type: "number", min: 0, message: "Giá vốn phải >= 0!" },
                ]}
              >
                <InputNumber
                  prefix={<DollarOutlined style={{ color: "#52c41a" }} />}
                  placeholder="Nhập giá vốn"
                  style={{ width: "100%", borderRadius: "8px" }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="price"
                label={<span style={{ fontWeight: 600 }}>Giá bán (₫)</span>}
                rules={[
                  { required: true, message: "Vui lòng nhập giá bán!" },
                  { type: "number", min: 0, message: "Giá bán phải >= 0!" },
                ]}
              >
                <InputNumber
                  prefix={<DollarOutlined style={{ color: "#faad14" }} />}
                  placeholder="Nhập giá bán"
                  style={{ width: "100%", borderRadius: "8px" }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                />
              </Form.Item>
            </Col>

            {/* Stock Quantity */}
            <Col xs={24} md={12}>
              <Form.Item
                name="stock_quantity"
                label={<span style={{ fontWeight: 600 }}>Số lượng tồn kho</span>}
                rules={[
                  { required: true, message: "Vui lòng nhập số lượng!" },
                  { type: "number", min: 0, message: "Số lượng phải >= 0!" },
                ]}
              >
                <InputNumber
                  prefix={<StockOutlined style={{ color: "#722ed1" }} />}
                  placeholder="Nhập số lượng"
                  style={{ width: "100%", borderRadius: "8px" }}
                />
              </Form.Item>
            </Col>

            {/* Supplier */}
            <Col xs={24} md={12}>
              <Form.Item
                name="supplier_id"
                label={<span style={{ fontWeight: 600 }}>Nhà cung cấp</span>}
                rules={[{ required: true, message: "Vui lòng chọn nhà cung cấp!" }]}
              >
                <Select
                  placeholder="-- Chọn nhà cung cấp --"
                  style={{ borderRadius: "8px" }}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                  options={suppliers.map((s) => ({
                    value: s._id,
                    label: s.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Optional Fields - Collapsible */}
        <Collapse
          bordered={false}
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
                <span style={{ fontWeight: 600, fontSize: "15px" }}>Thông tin tùy chọn</span>
              </Space>
            }
            key="1"
          >
            <Row gutter={16}>
              {/* SKU */}
              <Col xs={24} md={12}>
                <Form.Item name="sku" label={<span style={{ fontWeight: 600 }}>SKU</span>}>
                  <Input placeholder="Mã SKU" style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              {/* Unit */}
              <Col xs={24} md={12}>
                <Form.Item name="unit" label={<span style={{ fontWeight: 600 }}>Đơn vị tính</span>}>
                  <Input placeholder="VD: cái, hộp, kg..." style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              {/* Product Group */}
              <Col xs={24} md={12}>
                <Form.Item
                  name="group_id"
                  label={<span style={{ fontWeight: 600 }}>Nhóm sản phẩm</span>}
                  rules={[{ required: true, message: "Vui lòng chọn nhóm!" }]}
                >
                  <Select
                    placeholder="-- Chọn nhóm sản phẩm --"
                    style={{ borderRadius: "8px" }}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                    options={groups.map((g) => ({
                      value: g._id,
                      label: g.name,
                    }))}
                  />
                </Form.Item>
              </Col>

              {/* Status */}
              <Col xs={24} md={12}>
                <Form.Item
                  name="status"
                  label={<span style={{ fontWeight: 600 }}>Trạng thái</span>}
                  initialValue="Đang kinh doanh"
                >
                  <Select
                    style={{ borderRadius: "8px" }}
                    options={[
                      { value: "Đang kinh doanh", label: "✅ Đang kinh doanh" },
                      { value: "Ngừng kinh doanh", label: "⛔ Ngừng kinh doanh" },
                    ]}
                  />
                </Form.Item>
              </Col>

              {/* Min Stock & Max Stock */}
              <Col xs={24} md={12}>
                <Form.Item name="min_stock" label={<span style={{ fontWeight: 600 }}>Tồn tối thiểu</span>}>
                  <InputNumber
                    placeholder="Số lượng tối thiểu"
                    style={{ width: "100%", borderRadius: "8px" }}
                    min={0}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="max_stock" label={<span style={{ fontWeight: 600 }}>Tồn tối đa</span>}>
                  <InputNumber placeholder="Số lượng tối đa" style={{ width: "100%", borderRadius: "8px" }} min={0} />
                </Form.Item>
              </Col>

              {/* Image URL */}
              <Col xs={24}>
                <Form.Item
                  name="image"
                  label={<span style={{ fontWeight: 600 }}>Hình ảnh (URL)</span>}
                  rules={[{ type: "url", message: "URL không hợp lệ!" }]}
                >
                  <Input placeholder="https://example.com/image.jpg" style={{ borderRadius: "8px" }} />
                </Form.Item>
              </Col>

              {/* Description */}
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

        {/* Action Buttons */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }} size="middle">
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={onCancel}
              disabled={loading}
              style={{
                borderRadius: "8px",
                fontWeight: 500,
              }}
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

      {/* Global Style - Apply to Modal Body */}
      <style jsx global>{`
        /* Custom scrollbar cho Modal body */
        .ant-modal-body {
          /* Webkit browsers (Chrome, Safari, Edge) */
        }

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

        /* Firefox */
        .ant-modal-body {
          scrollbar-width: thin;
          scrollbar-color: #667eea #f0f0f0;
        }

        /* Option: Hide scrollbar completely */
        /*
        .ant-modal-body::-webkit-scrollbar {
          display: none;
        }
        
        .ant-modal-body {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        */
      `}</style>
    </>
  );
}
