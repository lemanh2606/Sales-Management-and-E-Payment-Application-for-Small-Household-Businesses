// utils/taxPdfGenerator.js
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

function formatCurrency(value) {
  if (!value) return "0";
  const num =
    typeof value === "object"
      ? value.$numberDecimal || value.toString()
      : value;
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(num) || 0);
}

function getCategoryName(code) {
  const map = {
    goods_distribution: "Phân phối, cung cấp hàng hóa",
    service_construction: "Dịch vụ, xây dựng không bao thầu NVL",
    manufacturing_transport: "Sản xuất, vận tải, dịch vụ có gắn hàng hóa",
    other_business: "Hoạt động kinh doanh khác",
  };
  return map[code] || code;
}

function getPeriodTypeLabel(type) {
  const map = {
    month: "Tháng",
    quarter: "Quý",
    year: "Năm",
    custom: "Tùy chỉnh",
  };
  return map[type] || type;
}

async function generateTaxDeclarationPDF(declaration, res) {
  try {
    const templatePath = path.join(
      __dirname,
      "../templates/taxDeclarationTemplate.html"
    );
    let html = fs.readFileSync(templatePath, "utf8");

    const info = declaration.taxpayerInfo || {};
    const today = new Date();

    const categories = declaration.revenueByCategory || [];
    let rowsHtml = "";
    if (!categories.length) {
      rowsHtml = `<tr>
        <td>1</td>
        <td>Tổng doanh thu</td>
        <td>${formatCurrency(declaration.declaredRevenue)}</td>
        <td>${formatCurrency(declaration.taxAmounts?.total || 0)}</td>
      </tr>`;
    } else {
      rowsHtml = categories
        .map(
          (c, idx) => `<tr>
            <td>${idx + 1}</td>
            <td>${getCategoryName(c.category)}</td>
            <td>${formatCurrency(c.revenue)}</td>
            <td>${formatCurrency(c.gtgtTax || 0)}</td>
          </tr>`
        )
        .join("");
    }

    html = html
      .replace(/{{periodKey}}/g, declaration.periodKey || "")
      .replace(
        /{{periodTypeLabel}}/g,
        getPeriodTypeLabel(declaration.periodType)
      )
      .replace(/{{firstTimeText}}/g, declaration.isFirstTime ? "☑" : "☐")
      .replace(/{{supplementNumber}}/g, declaration.supplementNumber || "...")
      .replace(/{{name}}/g, info.name || ".................................")
      .replace(
        /{{storeName}}/g,
        info.storeName || "................................."
      )
      .replace(
        /{{bankAccount}}/g,
        info.bankAccount || "................................."
      )
      .replace(
        /{{taxCode}}/g,
        info.taxCode || "................................."
      )
      .replace(
        /{{businessSector}}/g,
        info.businessSector || "................................."
      )
      .replace(/{{businessArea}}/g, info.businessArea || "...")
      .replace(/{{employeeCount}}/g, info.employeeCount || "...")
      .replace(/{{fromHour}}/g, info.workingHours?.from || "...")
      .replace(/{{toHour}}/g, info.workingHours?.to || "...")
      .replace(
        /{{businessAddress}}/g,
        info.businessAddress?.full || "................................."
      )
      .replace(/{{phone}}/g, info.phone || "...")
      .replace(/{{email}}/g, info.email || "...")
      .replace(/{{rowsHtml}}/g, rowsHtml)
      .replace(/{{totalRevenue}}/g, formatCurrency(declaration.declaredRevenue))
      .replace(
        /{{totalTax}}/g,
        formatCurrency(declaration.taxAmounts?.total || 0)
      )
      .replace(/{{day}}/g, String(today.getDate()).padStart(2, "0"))
      .replace(/{{month}}/g, String(today.getMonth() + 1).padStart(2, "0"))
      .replace(/{{year}}/g, String(today.getFullYear()));

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=to-khai-thue-${declaration.periodKey}-v${declaration.version}.pdf`
    );
    res.end(pdfBuffer);
  } catch (err) {
    console.error("Lỗi tạo PDF Puppeteer:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Lỗi tạo PDF",
      });
    }
  }
}

module.exports = { generateTaxDeclarationPDF };
