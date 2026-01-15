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
  PlusOutlined,
  ArrowLeftOutlined
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
      const uniqueSupplierIds = [...new Set(selectedRows.map(it => it.supplier_id).filter(Boolean))];

      if (uniqueSupplierIds.length === 1) {
          const supId = uniqueSupplierIds[0];
          const representativeItem = selectedRows.find(it => it.supplier_id === supId);
          
          if (representativeItem) {
              const currentSupId = form.getFieldValue("supplier_id");
              if (currentSupId !== supId) {
                const contactPerson = representativeItem.supplier_contact || representativeItem.contact_person || "";
                const partnerName = representativeItem.supplier_name || "";
                const phone = representativeItem.supplier_phone || "";
                
                form.setFieldsValue({ 
                    supplier_id: supId,
                    partner_name: partnerName,
                    partner_phone: phone,
                    receiver_name: contactPerson,
                    receiver_phone: phone
                });
              }
          }
      }
  };

  const handleProcessSelection = (selectedMode: "DISPOSE" | "RETURN") => {
    if (selectedItems.length === 0) {
      message.warning("Vui lòng chọn ít nhất một mặt hàng để xử lý");
      return;
    }
    setMode(selectedMode);
    setIsModalVisible(true);
    
    // Pre-fill defaults
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const initialValues: any = {
      deliverer_name: user.fullname || user.username || "",
      deliverer_phone: user.phone || "",
    };

    if (selectedMode === "DISPOSE") {
        if (!form.getFieldValue("receiver_name")) {
            initialValues.receiver_name = "Hội đồng tiêu hủy";
        }
        initialValues.notes = "Tiêu hủy hàng hết hạn";
    } else {
        initialValues.notes = "Trả hàng hết hạn cho Nhà cung cấp";
    }
    form.setFieldsValue(initialValues);
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const payload = {
        store_id: storeId,
        type: "OUT",// Inventory Voucher Type
        reason: values.notes || (mode === "DISPOSE" ? "Tiêu hủy hàng hết hạn" : "Trả lại hàng hết hạn cho NCC"),
        voucher_date: new Date().toISOString(),
        warehouse_id: values.warehouse_id,
        
        // Partner / Receiver info
        partner_name: values.partner_name, 
        partner_phone: values.partner_phone,
        receiver_name: values.receiver_name,
        receiver_phone: values.receiver_phone,
        deliverer_name: values.deliverer_name,
        deliverer_phone: values.deliverer_phone,
        
        supplier_id: mode === "RETURN" ? values.supplier_id : undefined,

        items: selectedItems.map(item => ({
            product_id: item.product_id || item._id, 
            quantity: item.quantity, // Send as quantity for backend process-expired
            unit_cost: item.import_price || 0,
            batch_no: item.batch_no,
            expiry_date: item.expiry_date,
            description: `Hết hạn ${dayjs(item.expiry_date).format("DD/MM/YYYY")}`
        }))
      };

      // Create Inventory Voucher (using dedicated process-expired endpoint)
      // Corrected URL to match backend mount: /api/stores/:storeId/inventory-vouchers/process-expired
      await axios.post(`${apiUrl}/stores/${storeId}/inventory-vouchers/process-expired`, payload, { headers });
      
      message.success("Đã tạo phiếu xử lý thành công!");
      setIsModalVisible(false);
      fetchExpiringProducts(); 
      setSelectedItems([]);
      form.resetFields();
      
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || "Lỗi khi tạo phiếu");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
      { title: 'Mã SP', dataIndex: 'sku', key: 'sku' },
      { title: 'Tên sản phẩm', dataIndex: 'name', key: 'name' },
      { title: 'Lô SX', dataIndex: 'batch_no', key: 'batch_no' },
      { title: 'Hạn SD', dataIndex: 'expiry_date', key: 'expiry_date', render: (d: any) => d ? dayjs(d).format("DD/MM/YYYY") : "-" },
      { title: 'SL Tồn', dataIndex: 'quantity', key: 'quantity', render: (v: number) => <Text strong>{v}</Text> },
      { title: 'Giá nhập', dataIndex: 'import_price', key: 'import_price', render: (v: number) => v?.toLocaleString() },
      { title: 'Kho', dataIndex: 'warehouse_name', key: 'warehouse_name' },
      { title: 'NCC', dataIndex: 'supplier_name', key: 'supplier_name' },
      { 
        title: 'Trạng thái', 
        key: 'status',
        render: (_: any, r: any) => {
           const days = dayjs(r.expiry_date).diff(dayjs(), 'day');
           return days < 0 ? <Tag color="red">Hết hạn {Math.abs(days)} ngày</Tag> : <Tag color="orange">Còn {days} ngày</Tag>;
        }
      }
  ];

  return (
    <Layout>
       <Card 
          style={{ margin: 16 }}
          title={<Space><ExclamationCircleOutlined style={{color: '#faad14'}} /> <span style={{fontWeight: 700}}>Danh sách hàng hết hạn / cận date (30 ngày)</span></Space>}
          extra={
              <Space>
                  <Button 
                    icon={<ArrowLeftOutlined />} 
                    onClick={() => navigate("/inventory-vouchers")}
                  >
                      Quay lại
                  </Button>
                  <Button 
                    type="primary" 
                    danger 
                    icon={<DeleteOutlined />} 
                    disabled={selectedItems.length === 0}
                    onClick={() => handleProcessSelection("DISPOSE")}
                  >
                      Tiêu hủy ({selectedItems.length})
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<RollbackOutlined />} 
                    className="warning-btn" // custom style if needed, or style inline
                    style={{ background: "#d4b106", borderColor: "#d4b106", color: "#fff" }}
                    disabled={selectedItems.length === 0}
                    onClick={() => handleProcessSelection("RETURN")}
                  >
                      Trả hàng NCC ({selectedItems.length})
                  </Button>
              </Space>
          }
       >
          <Table 
             dataSource={items}
             columns={columns}
             rowKey={(r) => r._id || r.id || Math.random().toString()}
             rowSelection={{
                 type: 'checkbox',
                 onChange: (_, rows) => handleSelectItems(rows),
                 selectedRowKeys: selectedItems.map(i => i._id || i.id)
             }}
             loading={loading}
             pagination={{ pageSize: 10 }}
             scroll={{ x: 1000 }}
          />
       </Card>

       {/* Modal Process */}
       <Modal
          title={mode === "DISPOSE" ? "Tạo Phiếu Tiêu Hủy Hàng Hóa" : "Tạo Phiếu Trả Hàng Nhà Cung Cấp"}
          visible={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          width={800}
          onOk={form.submit}
          confirmLoading={loading}
          okText="Xác nhận xử lý"
          cancelText="Hủy bỏ"
          destroyOnClose
       >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert 
                    message={`Bạn đang chọn: ${selectedItems.length} mặt hàng để ${mode === "DISPOSE" ? "TIÊU HỦY" : "TRẢ LẠI"}`} 
                    description={
                        <ul>
                            {selectedItems.slice(0, 3).map((i, idx) => (
                                <li key={idx}><b>{i.name}</b> - Lô: {i.batch_number} - SL: {i.quantity}</li>
                            ))}
                            {selectedItems.length > 3 && <li>... và {selectedItems.length - 3} mặt hàng khác ...</li>}
                        </ul>
                    }
                    type="info" 
                    showIcon 
                    style={{marginBottom: 16}}
                  />

                   {/* Grid 2 columns matched with closing div at line 186 */}
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <Form.Item 
                        name="warehouse_id" 
                        label={<Space><HomeOutlined /><span>Kho xuất hàng</span></Space>}
                        rules={[{ required: true, message: 'Vui lòng chọn kho' }]}
                      >
                         <Select placeholder="Chọn kho" disabled>
                             {warehouses.map(w => <Option key={w._id} value={w._id}>{w.name}</Option>)}
                         </Select>
                      </Form.Item>
  
                <Form.Item 
                  label={<Space><UserOutlined /><span>{mode === "RETURN" ? "Nhà cung cấp / Đối tác" : "Cơ quan/Bên nhận (nếu có)"}</span></Space>}
                >
                  <Form.Item name="supplier_id" hidden><Input /></Form.Item>
                  {mode === "RETURN" ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item name="partner_name" noStyle>
                        <Select
                          showSearch
                          allowClear
                          placeholder="Chọn hoặc nhập tên nhà cung cấp"
                          optionFilterProp="children"
                          onChange={(val, option: any) => {
                             const sup = suppliers.find(s => s.name === val);
                             if (sup) {
                                 form.setFieldsValue({ 
                                     supplier_id: sup._id,
                                     partner_phone: sup.phone || "",
                                     receiver_name: sup.contact_person || "",
                                     receiver_phone: sup.phone || "" 
                                 });
                             } else {
                                 form.setFieldsValue({ supplier_id: null, partner_phone: "", receiver_name: "", receiver_phone: "" });
                             }
                          }}
                          filterOption={(input, option) =>
                            ((option?.label ?? '') as string).toLowerCase().includes(input.toLowerCase())
                          }
                          options={suppliers.map(s => ({ value: s.name, label: s.name }))}
                        />
                      </Form.Item>
                      <Button icon={<PlusOutlined />} onClick={() => setCreateSupplierModalVisible(true)} />
                    </Space.Compact>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Form.Item name="partner_name" noStyle><Input placeholder="Tên đơn vị tiếp nhận tiêu hủy" /></Form.Item>
                        {/* Hidden phone field for layout consistency in backend if needed, or explicit field */}
                     </div>
                  )}
                </Form.Item>
                {/* Partner/Supplier Phone - visible mostly for RETURN or if user wants to input for DISPOSE */}
                <Form.Item name="partner_phone" label="SĐT Đối tác / NCC">
                    <Input placeholder="Số điện thoại..." />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item 
                  name="deliverer_name" 
                  label="Người lập phiếu / Người giao"
                  rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                >
                  <Input placeholder="Tên người giao" />
                </Form.Item>
                <Form.Item 
                    name="deliverer_phone" 
                    label="SĐT Người giao"
                >
                    <Input placeholder="SĐT người giao" />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item 
                  name="receiver_name" 
                  label="Người nhận / Bên xác nhận"
                  rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                >
                  <Input placeholder="Tên người nhận" />
                </Form.Item>
                <Form.Item 
                    name="receiver_phone" 
                    label="SĐT Người nhận"
                >
                    <Input placeholder="SĐT người nhận" />
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
                            const val = (e.currentTarget as HTMLInputElement).value;
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
     </Layout>
  );
};

export default ProcessExpiredPage;
