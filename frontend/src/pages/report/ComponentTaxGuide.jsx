// src/pages/report/TaxGuide.jsx
import React from "react";
import { Row, Col, Card, Typography, Divider } from "antd";

const { Title, Paragraph, Text } = Typography;

export default function ComponentTaxGuide() {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col span={24}>
        <Card
          bordered={false}
          style={{
            background: "#f7f5f5ff",
            borderLeft: "4px solid #1890ff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <Title level={5} style={{ color: "#1890ff" }}>
            Hướng dẫn về thuế đối với hộ kinh doanh, cá nhân kinh doanh
          </Title>

          <Paragraph>
            Căn cứ theo <Text strong>Luật Quản lý thuế 2019</Text>,<Text strong>Thông tư 40/2021/TT-BTC</Text> và các
            văn bản sửa đổi bổ sung đến hiện tại, hộ kinh doanh, cá nhân kinh doanh được xác định nghĩa vụ thuế dựa trên
            doanh thu thực tế.
          </Paragraph>

          <Divider />

          <Paragraph>
            <Text strong>1. Ngưỡng doanh thu miễn thuế:</Text>
            Nếu doanh thu trong năm dương lịch từ <Text strong>500 triệu đồng/năm</Text> trở xuống thì
            <Text strong> không phải nộp</Text> thuế Giá trị gia tăng (GTGT) và thuế Thu nhập cá nhân (TNCN).
          </Paragraph>

          <Paragraph>
            <Text strong>2. Doanh thu tính thuế:</Text> là tổng tiền bán hàng hóa, tiền cung ứng dịch vụ, hoa hồng, phụ
            thu, phụ trội mà hộ kinh doanh được hưởng, không phân biệt đã thu được tiền hay chưa.
          </Paragraph>

          <Paragraph>
            <Text strong>3. Mức thuế theo phương pháp khoán (tỷ lệ trên doanh thu):</Text>
          </Paragraph>

          <ul style={{ marginLeft: 24, marginBottom: 16 }}>
            <li>
              <Text strong>Phân phối, cung cấp hàng hóa:</Text> GTGT <Text code>1%</Text> – TNCN <Text code>0,5%</Text>
            </li>
            <li>
              <Text strong>Dịch vụ, xây dựng không bao thầu nguyên vật liệu:</Text> GTGT <Text code>5%</Text> – TNCN{" "}
              <Text code>2%</Text>
            </li>
            <li>
              <Text strong>Sản xuất, vận tải, dịch vụ có gắn hàng hóa:</Text> GTGT <Text code>3%</Text> – TNCN{" "}
              <Text code>1,5%</Text>
            </li>
            <li>
              <Text strong>Hoạt động cho thuê tài sản (nhà, xe, máy móc...):</Text> GTGT <Text code>5%</Text> – TNCN{" "}
              <Text code>5%</Text>
            </li>
            <li>
              <Text strong>Ngành nghề khác:</Text> áp dụng theo tỷ lệ tương ứng do cơ quan thuế thông báo.
            </li>
          </ul>

          <Divider />

          <Paragraph>
            <Text strong>4. Cách xác định kỳ kê khai thuế:</Text>
            Hộ kinh doanh nộp thuế theo <Text underline>tháng, quý hoặc năm</Text> tùy quy mô và yêu cầu của cơ quan
            thuế. Trường hợp hộ kinh doanh nộp thuế khoán thì chỉ cần kê khai định kỳ hàng năm, trừ khi có thay đổi lớn
            về doanh thu.
          </Paragraph>

          <Paragraph>
            <Text strong>5. Nghĩa vụ khác:</Text>
            <ul style={{ marginLeft: 24 }}>
              <li>Phải có sổ theo dõi doanh thu, hóa đơn (nếu có sử dụng).</li>
              <li>Phải đăng ký mã số thuế cá nhân hoặc hộ kinh doanh.</li>
              <li>Khi tạm ngừng kinh doanh trên 15 ngày phải thông báo với cơ quan thuế.</li>
            </ul>
          </Paragraph>

          <Divider />

          <Paragraph type="secondary">
            <Text italic>
              *Lưu ý:* Các mức tỷ lệ thuế có thể thay đổi theo quy định mới của Bộ Tài chính. Cơ quan thuế sẽ căn cứ
              tình hình thực tế để ấn định hoặc điều chỉnh tỷ lệ thuế phù hợp.
            </Text>
          </Paragraph>
        </Card>
      </Col>
    </Row>
  );
}
