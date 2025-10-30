// backend/controllers/financialController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product"); // để tính giá trị tồn kho

/*
  BÁO CÁO TÀI CHÍNH (Financial Summary)
  Gồm các chỉ số tài chính cốt lõi của doanh nghiệp trong kỳ (tháng/quý/năm...)

  1️⃣ Tổng doanh thu (Revenue)
      - Tổng tất cả totalAmount của Order (status = 'paid') trong kỳ
  2️⃣ Thuế GTGT phải nộp (VAT)
      - Tổng tất cả vatAmount trong Order (isVATInvoice = true)
  3️⃣ Chi phí nhập hàng (COGS - Cost of Goods Sold)
      - Nếu có model PurchaseOrder thì tính thật
      - Nếu chưa có, có thể mock = 60% doanh thu để ước lượng
  4️⃣ Lợi nhuận gộp (Gross Profit)
      - = Doanh thu - Chi phí nhập hàng
  5️⃣ Chi phí vận hành (Operating Cost)
      - Tiền thuê, lương, điện nước... (mock hoặc từ bảng riêng trên FE)
      - Nếu chưa có dữ liệu thật, có thể giả định = 10% doanh thu
  6️⃣ Lợi nhuận ròng (Net Profit)
      - = Lợi nhuận gộp - Chi phí vận hành - Thuế
  7️⃣ Giá trị hàng tồn kho (Stock Value)
      - = Tổng (stock_quantity * price) trong Product collection
      - Giúp biết tổng tài sản hàng hóa đang “găm” trong kho
  8️⃣ Xuất báo cáo PDF/CSV cho tất cả các chỉ số trên
      - Export PDF/CSV
*/
