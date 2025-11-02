// utils/excelExport.js
const ExcelJS = require("exceljs");

/**
 * Convert Decimal128 hoặc bất kỳ giá trị nào sang number
 * @param {any} value - Giá trị cần convert (có thể là Decimal128, string, number)
 * @param {number} defaultValue - Giá trị mặc định nếu conversion thất bại
 * @returns {number} Số đã được convert
 */
const toNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  // Nếu là Decimal128 (có thuộc tính $numberDecimal hoặc method toString)
  if (value && typeof value === "object" && value.toString) {
    const numValue = Number(value.toString());
    return isNaN(numValue) ? defaultValue : numValue;
  }

  // Nếu đã là number
  if (typeof value === "number") {
    return isNaN(value) ? defaultValue : value;
  }

  // Nếu là string, convert sang number
  if (typeof value === "string") {
    const numValue = Number(value);
    return isNaN(numValue) ? defaultValue : numValue;
  }

  return defaultValue;
};

/**
 * Convert Date sang string format YYYY-MM-DD
 * @param {Date|string} date - Đối tượng Date hoặc string
 * @returns {string} String format YYYY-MM-DD hoặc empty string
 */
const toDateString = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch (error) {
    return "";
  }
};

/**
 * Tạo workbook Excel với style mặc định
 * @param {string} sheetName - Tên của worksheet
 * @param {Array} columns - Mảng các cột định nghĩa
 *   Ví dụ: [{ header: "Tên", key: "name", width: 30 }]
 * @returns {Object} { workbook, worksheet }
 */
const createWorkbook = (sheetName, columns) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Set columns
  worksheet.columns = columns;

  // Style cho header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  // Set border cho header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  return { workbook, worksheet };
};

/**
 * Gửi workbook về client dưới dạng file Excel
 * @param {Object} res - Express response object
 * @param {Object} workbook - ExcelJS workbook
 * @param {string} filename - Tên file (không cần đuôi .xlsx)
 */
const sendWorkbook = async (res, workbook, filename) => {
  try {
    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}_${new Date().getTime()}.xlsx`
    );

    // Ghi workbook vào response stream
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Lỗi sendWorkbook:", error);
    if (!res.headersSent) {
      throw error;
    }
  }
};

/**
 * Apply style cho một dòng dữ liệu
 * @param {Object} row - ExcelJS row object
 * @param {Object} options - Style options
 */
const styleDataRow = (row, options = {}) => {
  const {
    fontSize = 11,
    alignment = { vertical: "middle", horizontal: "left" },
    border = true,
  } = options;

  row.font = { size: fontSize };
  row.alignment = alignment;

  if (border) {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }
};

/**
 * Hàm wrapper để export data với error handling
 * @param {Function} exportLogic - Hàm chứa logic export
 * @returns {Function} Express middleware
 */
const withExportErrorHandler = (exportLogic) => {
  return async (req, res) => {
    try {
      await exportLogic(req, res);
    } catch (error) {
      console.error("Lỗi export:", error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Lỗi khi export dữ liệu",
          error: error.message,
        });
      }
    }
  };
};

/**
 * Format số thành currency (VNĐ)
 * @param {number} value - Giá trị số
 * @returns {string} String đã format
 */
const formatCurrency = (value) => {
  if (!value && value !== 0) return "0";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

/**
 * Format số thành string với dấu phẩy ngăn cách hàng nghìn
 * @param {number} value - Giá trị số
 * @returns {string} String đã format
 */
const formatNumber = (value) => {
  if (!value && value !== 0) return "0";
  return new Intl.NumberFormat("vi-VN").format(value);
};

module.exports = {
  toNumber,
  toDateString,
  createWorkbook,
  sendWorkbook,
  styleDataRow,
  withExportErrorHandler,
  formatCurrency,
  formatNumber,
};
