import React, { useState, useEffect } from "react";
import { 
  Card, Table, Button, Tag, Space, Typography, Modal, 
  Form, Input, Select, Divider, message, Badge, Tooltip, AutoComplete, Alert
} from "antd";
import { 
  DeleteOutlined, 
  RollbackOutlined, 
  ExclamationCircleOutlined,
  MedicineBoxOutlined,
  UserOutlined,
  HomeOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ProcessExpiredPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [createSupplierModalVisible, setCreateSupplierModalVisible] = useState(false);
  const [mode, setMode] = useState<"DISPOSE" | "RETURN">("DISPOSE");
  const [form] = Form.useForm();

  const apiUrl = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem("token");
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id;
  const headers = { Authorization: `Bearer ${token}` };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${apiUrl}/warehouses/${storeId}`, { headers });
      setWarehouses(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách kho", err);
    }
  };

  const fetchSuppliers = async () => {
      try {
        const res = await axios.get(`${apiUrl}/suppliers/store/${storeId}?limit=100`, { headers });
        setSuppliers(res.data.data?.suppliers || res.data.data || []);
      } catch (err) {
        console.error("Lỗi tải danh sách NCC", err);
      }
  };

  const fetchExpiringProducts = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${apiUrl}/products/expiring?storeId=${storeId}&days=30`, { headers });
        setItems(res.data.data || []);
      } catch (err) {
        // Silent error or message
         message.error("Không thể tải danh sách hàng hết hạn");
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchExpiringProducts();
    fetchWarehouses();
    fetchSuppliers();
  }, [storeId]);
  // ...

  // Update warehouse and supplier selection when items change
  const handleSelectItems = (selectedRows: any[]) => {
      setSelectedItems(selectedRows);
      
      // 1. Auto-detect warehouse
      const uniqueWarehouses = [...new Set(selectedRows.map(it => it.warehouse_id).filter(Boolean))];
      if (uniqueWarehouses.length === 1) {
          form.setFieldsValue({ warehouse_id: uniqueWarehouses[0] });
      } else if (uniqueWarehouses.length === 0 && warehouses.length > 0) {
          if (!form.getFieldValue('warehouse_id')) {
             form.setFieldsValue({ warehouse_id: warehouses[0]._id });
          }
      }

      // 2. Auto-detect Supplier (Partner)
      // Debug: console.log("Selected Rows for Supplier Detect:", selectedRows);
      const uniqueSupplierIds = [...new Set(selectedRows.map(it => it.supplier_id).filter(Boolean))];

      if (uniqueSupplierIds.length === 1) {
          const supId = uniqueSupplierIds[0];
          // Use data directly from the item (it is now populated from backend)
          // Find the first item that has this supplier_id to get details
          const representativeItem = selectedRows.find(it => it.supplier_id === supId);
          
          if (representativeItem) {
              const currentSupId = form.getFieldValue("supplier_id");
              if (currentSupId !== supId) {
                form.setFieldsValue({ 
                    supplier_id: supId,
                    partner_name: representativeItem.supplier_name,
                    receiver_name: representativeItem.supplier_contact || representativeItem.supplier_name || ""
                });
                // Optional: message.success(`Đã chọn NCC: ${representativeItem.supplier_name}`);
              }
          }
      } else if (uniqueSupplierIds.length === 0) {
          // No common supplier detected (maybe items have no supplier)
          // Do not clear if user manually entered?
          // form.setFieldsValue({ supplier_id: null, partner_name: "" });
      } else {
         // Mixed suppliers
         // message.warning("Các items thuộc nhiều NCC khác nhau.");
      }
  };

  const handleProcessSelection = (selectedMode: "DISPOSE" | "RETURN") => {
    if (selectedItems.length === 0) {
      message.warning("Vui lòng chọn ít nhất một mặt hàng để xử lý");
      return;
    }
    setMode(selectedMode);
    setIsModalVisible(true);
    
    // Pre-fill some defaults
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const initialValues: any = {
      deliverer_name: user.fullname || "",
    };

    if (selectedMode === "DISPOSE") {
        initialValues.receiver_name = "Hội đồng tiêu hủy";
    } else {
        // Mode RETURN
        // Check if we already have a receiver set from auto-detect (handleSelectItems)
        const currentRec = form.getFieldValue("receiver_name");
        // If empty, try to set from current partner if possible (though handleSelectItems should have done it)
        if(!currentRec) {
             // Fallback default
             initialValues.receiver_name = ""; 
        }
    }
    form.setFieldsValue(initialValues);
  };

  const handleSubmit = async (values: any) => {
      // Form content acts as confirmation. Direct submit.
      setLoading(true);
      try {
        const payload = {
          mode,
          warehouse_id: values.warehouse_id,
          notes: values.notes,
          partner_name: values.partner_name,
          deliverer_name: values.deliverer_name,
          receiver_name: values.receiver_name,
          items: selectedItems.map(it => ({
            product_id: it._id,
            batch_no: it.batch_no,
            quantity: it.quantity,
            note: values.notes
          })),
          supplier_id: values.supplier_id // Include supplier ID
        };

        const res = await axios.post(`${apiUrl}/stores/${storeId}/inventory-vouchers/process-expired`, payload, { headers });
        
        // Show success and close
        Swal.fire({
          icon: 'success',
          title: 'Thành công',
          text: res.data.message || (mode === "DISPOSE" ? 'Hàng hóa đã được lập phiếu tiêu hủy và trừ kho.' : 'Hàng hóa đã được lập phiếu trả hàng và trừ kho.'),
          timer: 2000,
          showConfirmButton: false
        });

        // Refresh data
        fetchExpiringProducts();
        setSelectedItems([]);
        setIsModalVisible(false);
        form.resetFields();
      } catch (err: any) {
        console.error("Submit Error:", err);
        message.error(err.response?.data?.message || err.message || "Lỗi xử lý hàng hóa");
      } finally {
        setLoading(false);
      }
  };

  const onFinishFailed = (errorInfo: any) => {
      console.log('Failed:', errorInfo);
      message.error("Vui lòng điền đầy đủ các trường bắt buộc (*)");
  };

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>SKU: {record.sku}</Text>
        </Space>
      ),
    },
    {
      title: "Lô hàng",
      dataIndex: "batch_no",
      key: "batch_no",
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Hạn sử dụng",
      dataIndex: "expiry_date",
      key: "expiry_date",
      render: (date: string) => {
        const isExpired = dayjs(date).isBefore(dayjs());
        return (
          <Text delete={isExpired} style={{ color: isExpired ? "#f5222d" : "#faad14", fontWeight: 600 }}>
            {dayjs(date).format("DD/MM/YYYY")}
          </Text>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "expired" ? "error" : "warning"}>
          {status === "expired" ? "ĐÃ HẾT HẠN" : "SẮP HẾT HẠN"}
        </Tag>
      ),
    },
    {
      title: "Nhà cung cấp",
      dataIndex: "supplier_name",
      key: "supplier_name",
      render: (text: string) => <Text type="secondary" style={{fontSize: 12}}>{text || "-"}</Text>,
    },
    {
      title: "Số lượng tồn",
      dataIndex: "quantity",
      key: "quantity",
      align: 'right' as const,
      render: (qty: number) => <Text strong>{qty}</Text>,
    }
  ];

  return (
    <Layout>
      <div style={{ padding: "0 24px" }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Xử lý hàng hết hạn / sắp hết hạn</Title>
            <Paragraph type="secondary">
              Theo quy định, hàng hóa hết hạn cần được tách biệt và lập biên bản tiêu hủy hoặc trả lại nhà cung cấp để đảm bảo an toàn vệ sinh và chất lượng.
            </Paragraph>
          </div>
          <Button icon={<RollbackOutlined />} onClick={() => navigate(-1)}>Quay lại</Button>
        </div>

        <Space style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            danger 
            icon={<DeleteOutlined />} 
            disabled={selectedItems.length === 0}
            onClick={() => handleProcessSelection("DISPOSE")}
          >
            Lập phiếu Tiêu hủy ({selectedItems.length})
          </Button>
          <Button 
            type="primary" 
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            icon={<RollbackOutlined />} 
            disabled={selectedItems.length === 0}
            onClick={() => handleProcessSelection("RETURN")}
          >
            Lập phiếu Trả hàng ({selectedItems.length})
          </Button>
        </Space>
        <Card>
          <Table
            rowSelection={{
              type: 'checkbox',
              onChange: (_, selectedRows) => handleSelectItems(selectedRows),
            }}
            columns={columns}
            dataSource={items}
            loading={loading}
            rowKey={(record) => `${record._id}-${record.batch_no}`}
            pagination={{ pageSize: 15 }}
            locale={{ emptyText: "Không phát hiện hàng hết hạn nào cần xử lý." }}
          />
        </Card>

        {/* Modal Lập phiếu chuyên nghiệp */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {mode === "DISPOSE" ? <MedicineBoxOutlined style={{ color: '#f5222d' }} /> : <RollbackOutlined style={{ color: '#52c41a' }} />}
              <span>{mode === "DISPOSE" ? "Nghiệp vụ Tiêu hủy hàng hết hạn" : "Nghiệp vụ Trả hàng hết hạn"}</span>
            </div>
          }
          visible={isModalVisible}
          onOk={() => form.submit()}
          onCancel={() => setIsModalVisible(false)}
          width={700}
          confirmLoading={loading}
          okText={mode === "DISPOSE" ? "Xác nhận Tiêu hủy" : "Xác nhận Trả hàng"}
          cancelText="Hủy"
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit} onFinishFailed={onFinishFailed}>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 20 }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                 <Text strong>Danh sách items xử lý:</Text>
                 <Tag color={mode === "DISPOSE" ? "red" : "green"}>
                    {mode === "DISPOSE" ? "Tổng giá trị hủy: " : "Tổng giá trị trả: "}
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedItems.reduce((acc, it) => acc + ((it.cost_price || 0) * it.quantity), 0))}
                 </Tag>
              </div>
              <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8 }}>
                {selectedItems.map((it, idx) => {
                  const whName = warehouses.find(w => w._id === it.warehouse_id)?.name || "Kho không xác định";
                  return (
                    <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{it.name} <Text type="secondary" style={{ fontSize: 11 }}>(Lô: {it.batch_no} - {whName})</Text></Text>
                      <Text strong>SL: {it.quantity}</Text>
                    </div>
                  );
                })}
              </div>
              {/* Warning for mixed warehouses */}
              {(() => {
                const uniqueWarehouses = [...new Set(selectedItems.map(it => it.warehouse_id).filter(Boolean))];
                if (uniqueWarehouses.length > 1) {
                  return <Alert type="error" showIcon message="Cảnh báo: Các mục đã chọn thuộc nhiều kho khác nhau. Vui lòng xử lý từng kho riêng biệt." style={{ marginTop: 10 }} />;
                }
                return null;
              })()}
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item 
                  name="warehouse_id" 
                  label={<Space><HomeOutlined /><span>Kho xuất</span></Space>}
                  rules={[{ required: true, message: 'Vui lòng chọn kho' }]}
                >
                  <Select placeholder="Chọn kho hàng" disabled={selectedItems.length > 0}>
                    {warehouses.map(w => <Option key={w._id} value={w._id}>{w.name}</Option>)}
                  </Select>
                </Form.Item>

                <Form.Item name="supplier_id" hidden><Input /></Form.Item>
                <Form.Item 
                  name="partner_name" 
                  label={<Space><UserOutlined /><span>{mode === "RETURN" ? "Nhà cung cấp / Đối tác" : "Cơ quan/Bên nhận (nếu có)"}</span></Space>}
                >
                  {mode === "RETURN" ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Select
                        showSearch
                        allowClear
                        placeholder="Chọn hoặc nhập tên nhà cung cấp"
                        optionFilterProp="children"
                        onChange={(val, option: any) => {
                           // Find supplier by name (value) or stick to ID if we used ID.
                           // Current Options: value=s.name, label=s.name. 
                           // If we want to link structure, better use value=s.id but user might want custom name.
                           // Current implement: value = s.name.
                           // Reverse match:
                           const sup = suppliers.find(s => s.name === val);
                           if (sup) {
                               form.setFieldsValue({ 
                                   supplier_id: sup._id,
                                   receiver_name: sup.contact_person || sup.name
                               });
                           } else {
                               // Custom name or cleared
                               form.setFieldsValue({ supplier_id: null });
                           }
                        }}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={suppliers.map(s => ({ value: s.name, label: s.name }))}
                      />
                      <Button icon={<PlusOutlined />} onClick={() => setCreateSupplierModalVisible(true)} />
                    </Space.Compact>
                  ) : (
                    <Input placeholder="Tên đơn vị tiếp nhận tiêu hủy" />
                  )}
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item 
                  name="deliverer_name" 
                  label="Người lập phiếu / Người giao"
                  rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item 
                  name="receiver_name" 
                  label="Người nhận / Bên xác nhận"
                  rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                >
                  <Input />
                </Form.Item>
              </div>

              <Form.Item 
                name="notes" 
                label="Ghi chú nội dung xử lý (lý do cụ thể)"
              >
                <TextArea rows={3} placeholder="Ví dụ: Tiêu hủy do vi khuẩn xâm nhập, Trả hàng cho NCC ABC theo thỏa thuận bảo hành..." />
              </Form.Item>
            </Space>

            <Divider style={{ margin: '12px 0' }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" italic style={{ fontSize: 12 }}>
                * Phiếu này sẽ được ghi sổ tự động và cập nhật tồn kho tức thời. Vui lòng kiểm tra kỹ trước khi bấm xác nhận.
              </Text>
            </div>
          </Form>
        </Modal>

        {/* Create Supplier Modal */}
            <Modal
              title="Thêm nhanh Nhà cung cấp"
              visible={createSupplierModalVisible}
              onCancel={() => setCreateSupplierModalVisible(false)}
              footer={null}
            >
               <div style={{ padding: 20 }}>
                   <p style={{marginBottom: 10}}>Nhập tên nhà cung cấp mới:</p>
                   <Space.Compact style={{ width: '100%' }}>
                       <Input 
                            id="newSupplierName" 
                            placeholder="Tên nhà cung cấp..." 
                            onPressEnter={(e) => {
                                const val = (e.target as HTMLInputElement).value;
                                if(val) {
                                    setSuppliers(prev => [...prev, { _id: `new-${Date.now()}`, name: val }]);
                                    form.setFieldsValue({ partner_name: val });
                                    setCreateSupplierModalVisible(false);
                                    message.success(`Đã thêm: ${val}`);
                                }
                            }}
                       />
                       <Button type="primary" onClick={() => {
                            const input = document.getElementById('newSupplierName') as HTMLInputElement;
                            const val = input?.value;
                            if(val) {
                                setSuppliers(prev => [...prev, { _id: `new-${Date.now()}`, name: val }]);
                                form.setFieldsValue({ partner_name: val });
                                setCreateSupplierModalVisible(false);
                                message.success(`Đã thêm: ${val}`);
                            } else {
                                message.warning("Vui lòng nhập tên");
                            }
                       }}>Thêm</Button>
                   </Space.Compact>
                   <Divider />
                   <Text type="secondary" style={{fontSize: 12}}>
                       * Nhà cung cấp này sẽ được thêm tạm thời vào danh sách để xử lý phiếu.
                   </Text>
               </div>
            </Modal>
      </div>
    </Layout>
  );
};

export default ProcessExpiredPage;
