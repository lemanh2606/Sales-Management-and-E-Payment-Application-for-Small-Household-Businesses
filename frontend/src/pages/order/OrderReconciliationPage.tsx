import React, { useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from "antd";
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  SearchOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import Layout from "../../components/Layout";
import orderApi from "../../api/orderApi";
import ModalPrintBill from "./ModalPrintBill";
import type { TablePaginationConfig } from "antd/es/table";

const { Title, Text } = Typography;
const { Dragger } = Upload;

type DecimalValue = number | string | { $numberDecimal?: string } | null | undefined;

interface CustomerInfo {
  name?: string;
  phone?: string;
}

interface EmployeeInfo {
  fullName?: string;
}

interface PaidOrder {
  _id: string;
  totalAmount: DecimalValue;
  paymentMethod: "cash" | "qr";
  updatedAt: string;
  createdAt: string;
  printCount?: number;
  customer?: CustomerInfo;
  employeeId?: EmployeeInfo;
}

interface OrderItemDetail {
  _id: string;
  quantity: number;
  priceAtTime: DecimalValue;
  subtotal: DecimalValue;
  productName?: string;
  productSku?: string;
}

interface OrderDetail extends PaidOrder {
  items?: OrderItemDetail[];
  storeId?: { name?: string };
}

interface PrintPreviewData {
  orderId: string;
  createdAt?: string;
  printCount?: number;
  paymentMethod?: PaidOrder["paymentMethod"];
  totalAmount: number;
  employeeName?: string;
  customerName?: string;
  customerPhone?: string;
  cart: {
    name: string;
    quantity: number;
    unit: string;
    subtotal: string;
    sku?: string;
    priceAtTime?: string;
    price: number;
  }[];
}

interface ValidationCheck {
  field: string;
  label: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

interface ValidationResult {
  message: string;
  summary: {
    totalChecks: number;
    mismatched: number;
    status: string;
    textPreview: string;
  };
  checks: ValidationCheck[];
}

const formatCurrency = (value: DecimalValue) => {
  if (value == null) return "0đ";
  if (typeof value === "number") return value.toLocaleString("vi-VN") + "đ";
  if (typeof value === "string") return Number(value).toLocaleString("vi-VN") + "đ";
  if (typeof value === "object" && value.$numberDecimal) {
    return Number(value.$numberDecimal).toLocaleString("vi-VN") + "đ";
  }
  return "0đ";
};

const decimalToNumber = (value: DecimalValue) => {
  if (value == null) return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object" && value.$numberDecimal) {
    const parsed = Number(value.$numberDecimal);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const OrderReconciliationPage: React.FC = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id;

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<PaidOrder[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState<PrintPreviewData | null>(null);
  const [pendingPrintOrderId, setPendingPrintOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "qr">("all");
  const [printFilter, setPrintFilter] = useState<"all" | "printed" | "notPrinted">("all");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 20 });

  const loadOrders = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await orderApi.getPaidNotPrintedOrders({ storeId });
      setOrders(res.orders || []);
      setTablePagination((prev) => ({ ...prev, current: 1 }));
    } catch (err: any) {
      message.error(err.response?.data?.message || "Không thể tải danh sách đối soát");
    } finally {
      setLoading(false);
    }
  };

  const mapItemsToCart = (items: OrderItemDetail[] = []) =>
    items.map((item) => {
      const price = decimalToNumber(item.priceAtTime);
      const subtotal = decimalToNumber(item.subtotal);
      return {
        name: item.productName || "Sản phẩm",
        quantity: item.quantity,
        unit: "cái",
        subtotal: subtotal.toString(),
        sku: item.productSku,
        priceAtTime: price.toString(),
        price,
      };
    });

  const handlePreviewPrint = async (order: PaidOrder) => {
    if (!storeId) {
      message.warning("Vui lòng chọn cửa hàng trước khi in hóa đơn");
      return;
    }
    if (previewingId) return;
    setPreviewingId(order._id);
    try {
      const res = await orderApi.getOrderById(order._id, { storeId });
      const detail: OrderDetail | undefined = res.order;
      if (!detail) throw new Error("Không tìm thấy dữ liệu hóa đơn");

      setPrintPreview({
        orderId: detail._id,
        createdAt: detail.createdAt,
        printCount: detail.printCount,
        paymentMethod: detail.paymentMethod,
        totalAmount: decimalToNumber(detail.totalAmount),
        employeeName: detail.employeeId?.fullName,
        customerName: detail.customer?.name,
        customerPhone: detail.customer?.phone,
        cart: mapItemsToCart(detail.items),
      });
      setPendingPrintOrderId(detail._id);
      setPrintModalOpen(true);
    } catch (err: any) {
      message.error(err.response?.data?.message || err.message || "Không thể tải hóa đơn");
    } finally {
      setPreviewingId(null);
    }
  };

  const resetPrintModal = () => {
    setPrintModalOpen(false);
    setPrintPreview(null);
    setPendingPrintOrderId(null);
  };

  const handleConfirmPrint = async () => {
    if (!pendingPrintOrderId || printingId) return;
    try {
      setPrintingId(pendingPrintOrderId);
      await orderApi.printBill(pendingPrintOrderId, { storeId });
      message.success("In hóa đơn thành công");
      resetPrintModal();
      loadOrders();
    } catch (err: any) {
      message.error(err.response?.data?.message || "In hóa đơn thất bại");
    } finally {
      setPrintingId(null);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    setTablePagination((prev) => ({ ...prev, current: 1 }));
  }, [searchTerm, paymentFilter, printFilter, dateRange]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesPayment = paymentFilter === "all" ? true : order.paymentMethod === paymentFilter;

      const matchesPrint =
        printFilter === "all"
          ? true
          : printFilter === "printed"
          ? (order.printCount ?? 0) > 0
          : (order.printCount ?? 0) === 0;

      let matchesDate = true;
      if (dateRange[0] && dateRange[1]) {
        const updatedAt = dayjs(order.updatedAt);
        matchesDate = updatedAt.isAfter(dateRange[0].startOf("day")) && updatedAt.isBefore(dateRange[1].endOf("day"));
      }

      if (!normalizedSearch) {
        return matchesPayment && matchesPrint && matchesDate;
      }

      const orderId = order._id?.toLowerCase() || "";
      const orderIdShort = orderId.slice(-8);
      const customerName = order.customer?.name?.toLowerCase() || "";
      const customerPhone = order.customer?.phone?.toLowerCase() || "";
      const employeeName = order.employeeId?.fullName?.toLowerCase() || "";

      const matchesSearch =
        orderId.includes(normalizedSearch) ||
        orderIdShort.includes(normalizedSearch) ||
        customerName.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch) ||
        employeeName.includes(normalizedSearch);

      return matchesPayment && matchesPrint && matchesDate && matchesSearch;
    });
  }, [orders, paymentFilter, printFilter, searchTerm, dateRange]);

  useEffect(() => {
    setTablePagination((prev) => {
      const totalPages = Math.max(1, Math.ceil(filteredOrders.length / prev.pageSize));
      if (prev.current <= totalPages) return prev;
      return { ...prev, current: totalPages };
    });
  }, [filteredOrders.length]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setTablePagination({
      current: pagination.current || 1,
      pageSize: pagination.pageSize || tablePagination.pageSize,
    });
  };

  const totalFiltered = filteredOrders.length;
  const pageSize = tablePagination.pageSize;
  const totalPages = totalFiltered === 0 ? 1 : Math.ceil(totalFiltered / pageSize);
  const safeCurrentPage = totalFiltered === 0 ? 1 : Math.min(tablePagination.current, totalPages);

  const handleOpenModal = (order: PaidOrder) => {
    setSelectedOrder(order);
    setModalOpen(true);
    setFileList([]);
    setValidationResult(null);
  };

  const uploadProps: UploadProps = {
    multiple: false,
    accept: ".pdf",
    fileList,
    beforeUpload: (file) => {
      const isPdf =
        file.type === "application/pdf" || (file.name && file.name.toLowerCase().endsWith(".pdf"));
      if (!isPdf) {
        message.error("Chỉ chấp nhận file PDF");
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onChange: (info) => {
      const latest = info.fileList.slice(-1);
      setFileList(latest);
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  const handleValidate = async () => {
    if (!selectedOrder) return;
    const invoiceFile = fileList[0]?.originFileObj;
    if (!invoiceFile) {
      message.warning("Vui lòng chọn file PDF hóa đơn trước khi đối soát");
      return;
    }

    setValidating(true);
    try {
      const res = await orderApi.verifyInvoiceWithPdf({
        orderId: selectedOrder._id,
        storeId,
        file: invoiceFile,
      });
      setValidationResult(res);
      message.success(res.message || "Đối soát thành công");
    } catch (err: any) {
      message.error(err.response?.data?.message || "Đối soát thất bại");
    } finally {
      setValidating(false);
    }
  };

  const columns = [
    {
      title: "Mã hóa đơn",
      dataIndex: "_id",
      key: "code",
      render: (value: string, record: PaidOrder) => (
        <Tooltip title={value}>
          <Text code copyable={{ text: record._id }}>{value.slice(-8)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      render: (_: unknown, record: PaidOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.customer?.name || "Khách vãng lai"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.customer?.phone || "—"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Nhân viên",
      dataIndex: ["employeeId", "fullName"],
      key: "employee",
      render: (value: string) => value || "—",
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      key: "total",
      render: (val: DecimalValue) => (
        <Text strong style={{ color: "#1677ff" }}>
          {formatCurrency(val)}
        </Text>
      ),
    },
    {
      title: "Thanh toán",
      dataIndex: "paymentMethod",
      key: "method",
      render: (method: PaidOrder["paymentMethod"]) => (
        <Tag color={method === "cash" ? "green" : "blue"}>
          {method === "cash" ? "Tiền mặt" : "QR Code"}
        </Tag>
      ),
    },
    {
      title: "Số lần in",
      dataIndex: "printCount",
      key: "printCount",
      render: (count?: number) => (
        <Tag color={count && count > 0 ? "blue" : "default"}>{count ?? 0} lần</Tag>
      ),
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Hành động",
      key: "actions",
      render: (_: unknown, record: PaidOrder) => (
        <Space>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => handlePreviewPrint(record)}
            loading={previewingId === record._id || printingId === record._id}
          >
            In hóa đơn
          </Button>
          <Button type="primary" icon={<FileProtectOutlined />} onClick={() => handleOpenModal(record)}>
            Đối soát
          </Button>
        </Space>
      ),
    },
  ];

  const modalFooter = (
    <Space style={{ width: "100%", justifyContent: "space-between" }}>
      <Button onClick={() => setModalOpen(false)}>Đóng</Button>
      <div style={{ display: "flex", gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={() => setValidationResult(null)}>
          Reset
        </Button>
        <Button
          type="primary"
          icon={<FileSearchOutlined />}
          loading={validating}
          onClick={handleValidate}
          disabled={fileList.length === 0}
        >
          Đối soát ngay
        </Button>
      </div>
    </Space>
  );

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Space style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              Đối soát hóa đơn & đơn đặt hàng
            </Title>
            <Text type="secondary">
              Soát lại toàn bộ hóa đơn đã thanh toán (kể cả đã in) và đối chiếu file PDF tải lên.
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadOrders} disabled={loading}>
            Làm mới
          </Button>
        </Space>

        <Card
          title="Hóa đơn đã thanh toán"
          extra={<Tag color="gold">Bao gồm cả hóa đơn đã in – dùng phân trang để xem toàn bộ</Tag>}
          bodyStyle={{ paddingTop: 0 }}
        >
          <Space direction="horizontal" style={{ width: "100%", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <Input
              placeholder="Tìm mã đơn, tên khách, SĐT..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              size="large"
              style={{ flex: 1, minWidth: 320 }}
            />
            <DatePicker.RangePicker
              style={{ flex: 1, minWidth: 320 }}
              size="large"
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              value={dateRange[0] || dateRange[1] ? (dateRange as [Dayjs | null, Dayjs | null]) : undefined}
              onChange={(dates) =>
                setDateRange(
                  dates ? (dates as [Dayjs | null, Dayjs | null]) : [null, null]
                )
              }
              allowClear
            />
            <Select
              value={paymentFilter}
              onChange={(value: "all" | "cash" | "qr") => setPaymentFilter(value)}
              size="large"
              style={{ width: 200 }}
              options={[
                { label: "Tất cả phương thức", value: "all" },
                { label: "Tiền mặt", value: "cash" },
                { label: "QR Code", value: "qr" },
              ]}
            />
            <Select
              value={printFilter}
              onChange={(value: "all" | "printed" | "notPrinted") => setPrintFilter(value)}
              size="large"
              style={{ width: 200 }}
              options={[
                { label: "Tất cả trạng thái in", value: "all" },
                { label: "Đã in", value: "printed" },
                { label: "Chưa in", value: "notPrinted" },
              ]}
            />
          </Space>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Spin size="large" tip="Đang tải danh sách..." />
            </div>
          ) : filteredOrders.length === 0 ? (
            <Empty description="Không còn hóa đơn cần đối soát" style={{ padding: "40px 0" }} />
          ) : (
              <Table
                rowKey="_id"
                columns={columns}
                dataSource={filteredOrders}
                pagination={{
                  current: safeCurrentPage,
                  pageSize: tablePagination.pageSize,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                  total: totalFiltered,
                  showTotal: (total: number, range: [number, number]) => (
                    <div>
                      Đang xem{" "}
                      <span style={{ color: "#1890ff", fontWeight: 600 }}>
                        {range[0]} – {range[1]}
                      </span>{" "}
                      trên tổng số{" "}
                      <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> đơn hàng
                    </div>
                  ),
                }}
                scroll={{ x: true }}
                onChange={(pagination) => handleTableChange(pagination as TablePaginationConfig)}
              />
          )}
        </Card>
      </div>

      <Modal
        title="Đối soát hóa đơn PDF"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={modalFooter}
        width={720}
        destroyOnClose
      >
        {selectedOrder && (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Mã hóa đơn" span={2}>
                <Text code>{selectedOrder._id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {selectedOrder.customer?.name || "Khách vãng lai"}
              </Descriptions.Item>
              <Descriptions.Item label="SĐT">
                {selectedOrder.customer?.phone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng tiền" span={2}>
                {formatCurrency(selectedOrder.totalAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="Thanh toán">
                {selectedOrder.paymentMethod === "cash" ? "Tiền mặt" : "QR Code"}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">
                {dayjs(selectedOrder.updatedAt).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
            </Descriptions>

            <Card type="inner" title="Tải file PDF"> 
              <Dragger {...uploadProps} style={{ padding: 16 }}>
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file hóa đơn (PDF)</p>
                <p className="ant-upload-hint">Hệ thống sẽ kiểm tra mã đơn, tổng tiền, phương thức và thông tin khách hàng.</p>
              </Dragger>
            </Card>

            {validationResult && (
              <Card type="inner" title="Kết quả đối soát" style={{ borderColor: validationResult.summary.mismatched ? "#ffa940" : "#95de64" }}>
                <Alert
                  type={validationResult.summary.mismatched ? "warning" : "success"}
                  message={validationResult.message}
                  description={`Tổng số hạng mục kiểm tra: ${validationResult.summary.totalChecks}. Lệch: ${validationResult.summary.mismatched}.`}
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <List
                  dataSource={validationResult.checks}
                  renderItem={(item) => (
                    <List.Item>
                      <Space align="start" size="middle">
                        {item.match ? (
                          <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 20 }} />
                        ) : (
                          <CloseCircleTwoTone twoToneColor="#ff4d4f" style={{ fontSize: 20 }} />
                        )}
                        <div>
                          <Text strong>{item.label}</Text>
                          <div>
                            <Text type="secondary">Hệ thống: {item.expected ?? "—"}</Text>
                          </div>
                          <div>
                            <Text type="secondary">PDF: {item.actual ?? "Không tìm thấy"}</Text>
                          </div>
                        </div>
                      </Space>
                    </List.Item>
                  )}
                />

                {validationResult.summary.textPreview && (
                  <Card size="small" style={{ marginTop: 16, background: "#fafafa" }}>
                    <Text type="secondary">Trích nội dung PDF (30 dòng đầu):</Text>
                    <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{validationResult.summary.textPreview}</pre>
                  </Card>
                )}
              </Card>
            )}
          </Space>
        )}
      </Modal>

      <ModalPrintBill
        open={printModalOpen}
        onCancel={resetPrintModal}
        onPrint={handleConfirmPrint}
        cart={printPreview?.cart || []}
        totalAmount={printPreview?.totalAmount || 0}
        storeName={currentStore?.name || "Cửa hàng"}
        address={currentStore?.address || ""}
        employeeName={printPreview?.employeeName}
        customerName={printPreview?.customerName}
        customerPhone={printPreview?.customerPhone}
        paymentMethod={printPreview?.paymentMethod}
        orderId={printPreview?.orderId}
        createdAt={printPreview?.createdAt}
        printCount={printPreview?.printCount}
      />
    </Layout>
  );
};

export default OrderReconciliationPage;
