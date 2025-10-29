// utils/fileImport.js
const ExcelJS = require("exceljs");

/**
 * Chuyển đổi file Excel buffer thành mảng JSON
 * @param {Buffer} buffer - File Excel dạng buffer từ multer memory storage
 * @returns {Array<Object>} Mảng các object, mỗi object là một dòng dữ liệu
 */
const parseExcelToJSON = async (buffer) => {
  // Tạo workbook từ buffer
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  // Lấy sheet đầu tiên (index 0)
  const worksheet = workbook.worksheets[0];
  
  // Đọc dòng đầu tiên (dòng 1) làm header
  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    // Lấy tên cột từ cell, trim khoảng trắng
    // Nếu cell rỗng thì đặt tên mặc định là column_X
    headers[colNumber] = cell.value?.toString().trim() || `column_${colNumber}`;
  });

  const data = [];
  
  // Duyệt qua tất cả các dòng trong sheet
  worksheet.eachRow((row, rowNumber) => {
    // Bỏ qua dòng đầu tiên (header)
    if (rowNumber < 2) return;
    
    const rowData = {};
    let isEmpty = true; // Flag để check xem dòng có rỗng không
    
    // Duyệt qua từng cell trong dòng, bao gồm cả cell rỗng
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        let value = cell.value;
        
        // Xử lý các trường hợp đặc biệt của cell value
        if (value === null || value === undefined) {
          value = ""; // Chuyển null/undefined thành chuỗi rỗng
        } else if (typeof value === "object" && value.result !== undefined) {
          // Cell chứa công thức Excel, lấy kết quả của công thức
          value = value.result;
        } else if (value instanceof Date) {
          // Chuyển Date thành format YYYY-MM-DD
          value = value.toISOString().split("T")[0];
        }
        
        // Gán value vào object với key là tên cột
        rowData[header] = value;
        
        // Nếu có ít nhất 1 cell không rỗng thì đánh dấu dòng không rỗng
        if (value !== "" && value !== null) isEmpty = false;
      }
    });
    
    // Chỉ thêm dòng vào kết quả nếu dòng không rỗng hoàn toàn
    if (!isEmpty) data.push(rowData);
  });

  return data;
};



/**
 * Kiểm tra các trường bắt buộc
 * @param {Object} row - Đối tượng dữ liệu của một dòng
 * @param {Array<string>} requiredFields - Mảng tên các trường bắt buộc
 * @returns {Object} { isValid: boolean, missingFields: Array<string> }
 */
const validateRequiredFields = (row, requiredFields) => {
  const missingFields = [];
  
  // Duyệt qua từng trường bắt buộc
  for (const field of requiredFields) {
    // Kiểm tra trường có tồn tại và không rỗng (sau khi trim)
    if (!row[field] || row[field].toString().trim() === "") {
      missingFields.push(field);
    }
  }
  
  return {
    isValid: missingFields.length === 0, // Hợp lệ khi không có trường nào thiếu
    missingFields, // Danh sách các trường bị thiếu
  };
};

/**
 * Kiểm tra trường số
 * @param {any} value - Giá trị cần kiểm tra
 * @param {Object} options - Tùy chọn validate
 * @param {number} options.min - Giá trị tối thiểu (mặc định: 0)
 * @param {number} options.max - Giá trị tối đa (mặc định: Infinity)
 * @param {boolean} options.allowDecimal - Cho phép số thập phân (mặc định: true)
 * @returns {Object} { isValid: boolean, value: number|null, error: string|null }
 */
const validateNumericField = (value, options = {}) => {
  const { min = 0, max = Infinity, allowDecimal = true } = options;

  // Nếu giá trị rỗng, trả về 0 (hợp lệ)
  if (value === "" || value === null || value === undefined) {
    return { isValid: true, value: 0, error: null };
  }

  // Chuyển đổi sang số
  const numValue = Number(value);

  // Kiểm tra có phải số hợp lệ không
  if (isNaN(numValue)) {
    return { isValid: false, value: null, error: "Không phải là số hợp lệ" };
  }

  // Nếu không cho phép số thập phân, kiểm tra phải là số nguyên
  if (!allowDecimal && !Number.isInteger(numValue)) {
    return { isValid: false, value: null, error: "Phải là số nguyên" };
  }

  // Kiểm tra giá trị tối thiểu
  if (numValue < min) {
    return { isValid: false, value: null, error: `Giá trị phải >= ${min}` };
  }

  // Kiểm tra giá trị tối đa
  if (numValue > max) {
    return { isValid: false, value: null, error: `Giá trị phải <= ${max}` };
  }

  // Tất cả kiểm tra đều pass, trả về kết quả hợp lệ
  return { isValid: true, value: numValue, error: null };
};

/**
 * Làm sạch dữ liệu (xóa khoảng trắng thừa)
 * @param {Object} obj - Object chứa dữ liệu cần làm sạch
 * @returns {Object} Object mới đã được làm sạch
 */
const sanitizeData = (obj) => {
  const sanitized = {};
  
  // Duyệt qua tất cả các thuộc tính của object
  for (const key in obj) {
    let value = obj[key];
    
    // Nếu giá trị là string, trim khoảng trắng đầu cuối
    if (typeof value === "string") {
      value = value.trim();
    }
    
    // Gán vào object mới
    sanitized[key] = value;
  }
  
  return sanitized;
};

module.exports = {
  parseExcelToJSON,
  validateRequiredFields,
  validateNumericField,
  sanitizeData,
};
