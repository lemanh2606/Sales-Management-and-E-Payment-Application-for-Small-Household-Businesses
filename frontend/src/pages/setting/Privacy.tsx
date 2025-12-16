// src/pages/Privacy.tsx
import React from "react";
import { Card, Typography, Divider, Space, Tag } from "antd";
import { FileProtectOutlined, SafetyCertificateOutlined, LockOutlined } from "@ant-design/icons";
import Layout from "../../components/Layout";

const { Title, Paragraph, Text } = Typography;

const Privacy: React.FC = () => {
  return (
    <Layout>
      <div>
        <Card>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Title level={1} style={{ margin: 0, color: "#1a1a1a" }}>
              <FileProtectOutlined style={{ marginRight: 12, color: "#1890ff" }} />
              Chính sách quyền riêng tư
            </Title>
            <Title level={2} type="secondary" style={{ margin: "8px 0 0", fontWeight: 500 }}>
              Chính sách bảo vệ dữ liệu cá nhân
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Cập nhật lần cuối: <strong>12/11/2025</strong>
            </Text>
          </div>

          <Divider />

          {/* Định nghĩa */}
          <section style={{ marginBottom: 32 }}>
            <Title level={3}>
              <LockOutlined style={{ marginRight: 8, color: "#52c41a" }} />
              Định nghĩa
            </Title>
            <Paragraph>
              <Text strong>"Dữ liệu cá nhân"</Text>: là thông tin dưới dạng ký hiệu, chữ viết, chữ số, hình ảnh, âm
              thanh hoặc dạng tương tự trên môi trường điện tử gắn liền với một con người cụ thể hoặc giúp xác định một
              con người cụ thể và được quy định cụ thể tại <Text strong>Mục 2</Text> của Chính sách bảo vệ dữ liệu cá
              nhân này.
            </Paragraph>
            <Paragraph>
              <Text strong>“Chủ Thể Dữ Liệu Cá Nhân”</Text>: là cá nhân được Dữ Liệu Cá Nhân phản ánh, bao gồm tất cả
              các khách hàng cá nhân đang sử dụng sản phẩm, dịch vụ của <Tag color="blue">SmartRetail</Tag>, người lao động của
              SmartRetail, cổ đông và/hoặc các cá nhân khác có phát sinh quan hệ pháp lý với SmartRetail.
            </Paragraph>
          </section>

          <Divider />

          {/* Mục 1 */}
          <section style={{ marginBottom: 32 }}>
            <Title level={3}>
              <SafetyCertificateOutlined style={{ marginRight: 8, color: "#fa8c16" }} />
              1. Chính sách bảo vệ dữ liệu cá nhân
            </Title>

            <Space direction="vertical" size="middle" style={{ display: "block" }}>
              <Paragraph>
                <Text type="secondary">•</Text> Chính sách bảo vệ dữ liệu cá nhân này là một phần{" "}
                <Text strong>không thể tách rời</Text> và cần được đọc, hiểu thống nhất với các hợp đồng, thỏa thuận,
                điều khoản, điều kiện và các văn kiện khác được xác lập giữa Chủ Thể Dữ Liệu Cá Nhân và SmartRetail.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> Chính sách bảo vệ dữ liệu cá nhân này có thể được{" "}
                <Text strong>SmartRetail cập nhật, sửa đổi, bổ sung hoặc thay thế</Text> trong từng thời kỳ và được SmartRetail đăng
                tải trên trang thông tin điện tử chính thức của SmartRetail (<Text underline>SmartRetail.vn</Text>) và/hoặc thông báo
                đến Chủ Thể Dữ Liệu Cá Nhân thông qua các phương tiện phù hợp khác của SmartRetail.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> Chính sách bảo vệ dữ liệu cá nhân này được giải thích theo các chính
                sách của SmartRetail liên quan tới bảo vệ Dữ Liệu Cá Nhân. Bằng việc{" "}
                <Text strong>đăng ký sử dụng, sử dụng các sản phẩm, dịch vụ của SmartRetail</Text>, xác lập các thỏa thuận
                và/hoặc cho phép SmartRetail xử lý Dữ Liệu Cá Nhân, Chủ Thể Dữ Liệu Cá Nhân{" "}
                <Text strong>chấp nhận toàn bộ và không kèm theo bất kỳ điều kiện nào</Text> đối với các quy định được
                đề cập tại Chính sách bảo vệ dữ liệu cá nhân này và các thay đổi (nếu có) trong từng thời kỳ.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> Khi cung cấp Dữ Liệu Cá Nhân của một bên thứ ba là cá nhân khác cho
                SmartRetail, Chủ Thể Dữ Liệu Cá Nhân <Text strong>cam đoan, bảo đảm và chịu trách nhiệm</Text> rằng đã cung cấp
                thông tin đầy đủ và có được <Text strong>sự đồng ý/chấp thuận hợp pháp</Text> của bên thứ ba đó để SmartRetail
                xử lý các Dữ Liệu Cá Nhân cho các mục đích được nêu tại Chính sách này.
              </Paragraph>
            </Space>
          </section>

          <Divider />

          {/* Mục 2 */}
          <section>
            <Title level={3}>
              <SafetyCertificateOutlined style={{ marginRight: 8, color: "#722ed1" }} />
              2. Cam kết của SmartRetail
            </Title>

            <Space direction="vertical" size="middle" style={{ display: "block" }}>
              <Paragraph>
                <Text type="secondary">•</Text> SmartRetail xử lý và bảo vệ Dữ Liệu Cá Nhân{" "}
                <Text strong>phù hợp với quy định của pháp luật Việt Nam</Text>; tuân thủ đầy đủ theo Chính sách bảo vệ
                dữ liệu cá nhân này và các hợp đồng, thỏa thuận, văn kiện khác xác lập với Chủ Thể Dữ Liệu Cá Nhân.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> SmartRetail thu thập Dữ Liệu Cá Nhân với{" "}
                <Text strong>mục đích cụ thể, rõ ràng, hợp pháp</Text>, trong phạm vi các mục đích đã nêu tại Chính sách
                này và phù hợp với quy định của pháp luật Việt Nam.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> SmartRetail luôn áp dụng và cập nhật các{" "}
                <Text strong>biện pháp kỹ thuật phù hợp</Text> với quy định của pháp luật Việt Nam nhằm đảm bảo{" "}
                <Text strong>tính an toàn dữ liệu</Text> của Dữ Liệu Cá Nhân, bao gồm cả việc các biện pháp bảo vệ khỏi
                sự truy cập trái phép hoặc trái pháp luật và/hoặc sự phá hủy, mất, thiệt hại cho Dữ Liệu Cá Nhân.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> SmartRetail lưu trữ Dữ Liệu Cá Nhân một cách{" "}
                <Text strong>thích hợp và trong phạm vi cần thiết</Text> nhằm mục đích xử lý phù hợp với quy định của
                pháp luật Việt Nam.
              </Paragraph>

              <Paragraph>
                <Text type="secondary">•</Text> Ngoài các nguyên tắc nêu trên, SmartRetail{" "}
                <Text strong>cam kết tuân thủ các quy định pháp luật về bảo vệ dữ liệu từng thời kỳ</Text>.
              </Paragraph>
            </Space>
          </section>

          {/* Footer */}
          <Divider />
          <div style={{ textAlign: "center", padding: "16px 0", color: "#8c8c8c" }}>
            <Text type="secondary">
              © {new Date().getFullYear()} <strong>SmartRetail</strong>. Tất cả các quyền được bảo lưu.
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              Mọi thắc mắc vui lòng liên hệ: <Text underline>support@SmartRetail.vn</Text>
            </Text>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Privacy;
