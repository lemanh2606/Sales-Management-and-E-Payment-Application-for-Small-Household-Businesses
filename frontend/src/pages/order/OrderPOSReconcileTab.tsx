import React, { useMemo, useState } from "react";
import { Alert, Button, Card, List, Space, Tag, Typography, Upload, message } from "antd";
import { UploadOutlined, SafetyCertificateOutlined, InfoCircleOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import orderApi from "../../api/orderApi";

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

interface ReconcileCheck {
  field: string;
  label: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

interface ReconcileResult {
  message: string;
  summary?: {
    totalChecks?: number;
    mismatched?: number;
    status?: string;
    textPreview?: string;
  };
  checks: ReconcileCheck[];
}

const formatValue = (field: string, value: string | number | null) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (field === "totalAmount") {
      return value.toLocaleString("vi-VN") + "đ";
    }
    return value.toLocaleString("vi-VN");
  }
  return value;
};

const statusToAlert = (status?: string): "success" | "warning" | "info" => {
  if (status === "aligned") return "success";
  if (status === "diverged") return "warning";
  return "info";
};

const OrderPOSReconcileTab: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStore = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("currentStore") || "{}");
    } catch (err) {
      console.warn("Invalid currentStore", err);
      return {};
    }
  }, []);
  const storeId = currentStore?._id;

  const beforeUpload: UploadProps["beforeUpload"] = async (file) => {
    if (!storeId) {
      message.warning("Vui lòng chọn cửa hàng trước khi đối soát");
      return Upload.LIST_IGNORE;
    }
    if (file.type !== "application/pdf") {
      message.warning("Chỉ hỗ trợ file PDF");
      return Upload.LIST_IGNORE;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    const pending: UploadFile = { ...file, status: "uploading" } as UploadFile;
    setFileList([pending]);

    try {
      const data = (await orderApi.verifyInvoiceAuto({ storeId, file })) as ReconcileResult;
      setResult(data);
      message.success(data?.message || "Đối soát thành công");
      setFileList([{ ...pending, status: "done" }]);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message || err?.message || "Không thể đối soát hóa đơn";
      setError(apiMessage);
      if (err?.response?.data?.summary && err?.response?.data?.checks) {
        setResult({
          message: apiMessage,
          summary: err.response.data.summary,
          checks: err.response.data.checks,
        });
      } else {
        setResult(null);
      }
      message.error(apiMessage);
      setFileList([{ ...pending, status: "error" }]);
    } finally {
      setLoading(false);
    }

    return Upload.LIST_IGNORE;
  };

  const handleRemove: UploadProps["onRemove"] = () => {
    if (loading) return false;
    setFileList([]);
    setResult(null);
    setError(null);
    return true;
  };

  const summaryDescription = result?.summary
    ? `Đã kiểm tra ${result.summary.totalChecks ?? 0} tiêu chí, lệch ${result.summary.mismatched ?? 0}.`
    : undefined;

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "linear-gradient(135deg, #e6f7ff 0%, #f9f0ff 100%)",
      }}
    >
      <Card
        style={{ width: "100%", maxWidth: 960, borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}
        bodyStyle={{ padding: 32 }}
      >
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <Space align="center" size={16}>
            <SafetyCertificateOutlined style={{ fontSize: 36, color: "#52c41a" }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Đối soát hóa đơn ngay tại quầy POS
              </Title>
              <Paragraph style={{ marginBottom: 0, color: "#595959" }}>
                Tải file PDF hóa đơn để hệ thống tự nhận diện mã đơn, kiểm tra tổng tiền, khách hàng và phương thức
                thanh toán.
              </Paragraph>
            </div>
          </Space>

          <Alert
            type="info"
            showIcon
            message="Mẹo"
            description="Nếu file PDF không chứa mã hóa đơn hợp lệ, bạn sẽ nhận được cảnh báo để kiểm tra lại chứng từ."
          />

          <Dragger
            multiple={false}
            accept="application/pdf"
            beforeUpload={beforeUpload}
            onRemove={handleRemove}
            fileList={fileList}
            disabled={loading}
            showUploadList={{ showRemoveIcon: true }}
            style={{ borderRadius: 16 }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: "#1677ff" }} />
            </p>
            <p className="ant-upload-text">Kéo thả hoặc bấm để chọn file PDF hóa đơn</p>
            <p className="ant-upload-hint">Dung lượng tối đa 20MB. Hệ thống sẽ đối chiếu tự động ngay sau khi tải lên.</p>
          </Dragger>

          {error && <Alert type="error" showIcon message={error} />}

          {result && (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert
                type={statusToAlert(result.summary?.status)}
                showIcon
                message={result.message}
                description={summaryDescription}
              />

              <List
                size="small"
                dataSource={result.checks || []}
                locale={{ emptyText: "Không có tiêu chí được kiểm tra" }}
                renderItem={(item) => (
                  <List.Item key={item.field}
                    actions={[<Tag color={item.match ? "green" : "red"}>{item.match ? "Khớp" : "Lệch"}</Tag>]}
                  >
                    <List.Item.Meta
                      title={<Text strong>{item.label}</Text>}
                      description={
                        <div>
                          <div>
                            <Text type="secondary">Hệ thống:&nbsp;</Text>
                            <Text strong>{formatValue(item.field, item.expected)}</Text>
                          </div>
                          <div>
                            <Text type="secondary">PDF:&nbsp;</Text>
                            <Text strong>{formatValue(item.field, item.actual)}</Text>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />

              {result.summary?.textPreview && (
                <Card
                  size="small"
                  type="inner"
                  title={
                    <Space>
                      <InfoCircleOutlined />
                      <span>Trích đoạn PDF</span>
                    </Space>
                  }
                  style={{ borderRadius: 12 }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.summary.textPreview}</pre>
                </Card>
              )}
            </Space>
          )}

          <Button
            type="link"
            disabled={loading}
            onClick={() => {
              setFileList([]);
              setResult(null);
              setError(null);
            }}
            style={{ alignSelf: "flex-start" }}
          >
            Làm mới phiên đối soát
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default OrderPOSReconcileTab;
