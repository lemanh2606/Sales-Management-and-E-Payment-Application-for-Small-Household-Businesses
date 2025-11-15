import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  message,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { DownloadOutlined, FileExcelOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Layout from "../../components/Layout";
import { exportApi } from "../../api";
import { useAuth } from "../../context/AuthContext";

const { RangePicker } = DatePicker;
const { Title, Paragraph, Text } = Typography;

const ORDER_STATUS_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Đang chờ", value: "pending" },
  { label: "Đã thanh toán", value: "paid" },
  { label: "Đã hoàn", value: "refunded" },
  { label: "Hoàn một phần", value: "partially_refunded" },
];

const PAYMENT_METHOD_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Tiền mặt", value: "cash" },
  { label: "Quét QR", value: "qr" },
];

const filterBadges = {
  date: { color: "blue", label: "Khoảng thời gian" },
  status: { color: "green", label: "Trạng thái" },
  paymentMethod: { color: "purple", label: "Hình thức thanh toán" },
};

const extractFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  if (match) {
    return decodeURIComponent(match[1] || match[2]);
  }
  return fallback;
};

const DataExportPage = () => {
  const { currentStore, user } = useAuth();
  const [options, setOptions] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [form] = Form.useForm();

  const selectedOption = useMemo(() => options.find((opt) => opt.key === selectedKey), [options, selectedKey]);

  useEffect(() => {
    if (!currentStore?._id) return;
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const { data } = await exportApi.getOptions({ storeId: currentStore._id });
        const fetchedOptions = data?.options || [];
        setOptions(fetchedOptions);
        setSelectedKey((prev) => prev ?? fetchedOptions[0]?.key ?? null);
      } catch (error) {
        console.error("Load export options error", error);
        message.error(error.response?.data?.message || "Không tải được danh sách dữ liệu");
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [currentStore?._id]);

  const handleSelect = (key) => {
    setSelectedKey(key);
    form.resetFields();
  };

  const handleDownload = async () => {
    try {
      if (!currentStore?._id) {
        message.warning("Vui lòng chọn cửa hàng trước khi xuất dữ liệu");
        return;
      }
      if (!selectedKey) {
        message.warning("Vui lòng chọn loại dữ liệu muốn xuất");
        return;
      }

      const values = await form.validateFields();
      const params = {
        storeId: currentStore._id,
      };

      if (values.dateRange) {
        params.from = values.dateRange[0].format("YYYY-MM-DD");
        params.to = values.dateRange[1].format("YYYY-MM-DD");
      }
      if (values.status && values.status !== "all") {
        params.status = values.status;
      }
      if (values.paymentMethod && values.paymentMethod !== "all") {
        params.paymentMethod = values.paymentMethod;
      }

      setDownloading(true);
      const response = await exportApi.downloadResource(selectedKey, params);
      const blob = new Blob([response.data], {
        type:
          response.headers?.["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const fallbackName = `${selectedKey}_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
      const filename = extractFilename(response.headers?.["content-disposition"], fallbackName);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(`Đã tải xuống ${filename}`);
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      console.error("Export error", error);
      message.error(error.response?.data?.message || "Xuất dữ liệu thất bại");
    } finally {
      setDownloading(false);
    }
  };

  const renderFilterFields = () => {
    if (!selectedOption) return null;
    return (
      <>
        {selectedOption.filters?.includes("date") && (
          <Form.Item
            label="Khoảng thời gian"
            name="dateRange"
            rules={[{ required: true, message: "Chọn thời gian cần xuất" }]}
          >
            <RangePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>
        )}

        {selectedOption.filters?.includes("status") && (
          <Form.Item label="Trạng thái" name="status" initialValue="all">
            <Select options={ORDER_STATUS_OPTIONS} />
          </Form.Item>
        )}

        {selectedOption.filters?.includes("paymentMethod") && (
          <Form.Item label="Hình thức thanh toán" name="paymentMethod" initialValue="all">
            <Select options={PAYMENT_METHOD_OPTIONS} />
          </Form.Item>
        )}
      </>
    );
  };

  const renderCards = () => {
    if (loadingOptions) {
      return (
        <div className="w-full py-16 flex justify-center">
          <Spin size="large" />
        </div>
      );
    }

    if (!options.length) {
      return <Empty description="Chưa có dữ liệu export cho cửa hàng này" />;
    }

    return (
      <Row gutter={[16, 16]}>
        {options.map((option) => (
          <Col xs={24} sm={12} lg={8} key={option.key}>
            <Card
              hoverable
              onClick={() => handleSelect(option.key)}
              style={{
                height: "100%",
                borderColor: option.key === selectedKey ? "#52c41a" : undefined,
              }}
              bodyStyle={{ minHeight: 160 }}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space size={10}>
                  <FileExcelOutlined style={{ fontSize: 20, color: "#52c41a" }} />
                  <Text strong>{option.label}</Text>
                </Space>
                <Paragraph type="secondary" ellipsis={{ rows: 3 }}>{option.description}</Paragraph>
                <Space size={[8, 8]} wrap>
                  {(option.filters || []).map((filterKey) => (
                    <Tag key={filterKey} color={filterBadges[filterKey]?.color || "default"}>
                      {filterBadges[filterKey]?.label || filterKey}
                    </Tag>
                  ))}
                  {!option.filters?.length && <Tag color="default">Không cần bộ lọc</Tag>}
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-16">
        <Card>
          <Title level={3} style={{ marginBottom: 8 }}>
            Xuất dữ liệu Excel
          </Title>
          <Paragraph type="secondary">
            Tải xuống toàn bộ dữ liệu cửa hàng của bạn dưới định dạng Excel (.xlsx). Chức năng chỉ dành cho quản lý
            để sao lưu hoặc xử lý thêm trong các công cụ phân tích.
          </Paragraph>
          <Alert
            type="info"
            showIcon
            message="Mẹo"
            description="Mỗi lần chỉ chọn một loại dữ liệu để xuất. Bạn có thể lặp lại thao tác để tải các nhóm dữ liệu khác."
          />
        </Card>

        <Card title="Chọn loại dữ liệu" bordered={false} style={{ borderRadius: 16 }}>
          {renderCards()}
        </Card>

        <Card title="Thiết lập bộ lọc" bordered={false} style={{ borderRadius: 16 }}>
          {!currentStore?._id ? (
            <Alert
              type="warning"
              message="Vui lòng chọn cửa hàng"
              description="Chức năng chỉ hoạt động khi bạn đã chọn cửa hàng quản lý."
            />
          ) : !selectedOption ? (
            <Alert type="info" message="Chọn loại dữ liệu ở bước trên để hiển thị bộ lọc" />
          ) : (
            <Form
              layout="vertical"
              form={form}
              initialValues={{ status: "all", paymentMethod: "all" }}
              onFinish={handleDownload}
              className="max-w-2xl"
            >
              {renderFilterFields()}
              <Form.Item>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  size="large"
                  loading={downloading}
                  onClick={handleDownload}
                >
                  Tải file Excel
                </Button>
              </Form.Item>
            </Form>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default DataExportPage;
