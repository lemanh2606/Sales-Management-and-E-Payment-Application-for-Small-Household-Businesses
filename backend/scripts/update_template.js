const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const templatePath = path.resolve(__dirname, "../templates/product_template.xlsx");

// Kiểm tra xem file có tồn tại không, nếu không thì tạo mới
if (!fs.existsSync(templatePath)) {
    console.error("Template file missing, creating new one...");
    // ... create logic if needed, or error out
    // But wait, user said "read file... fix it". Let's assume it exists or we make a new one.
}

try {
    let workbook;
    if (fs.existsSync(templatePath)) {
        workbook = XLSX.readFile(templatePath);
    } else {
        workbook = XLSX.utils.book_new();
    }

    // Lấy sheet đầu tiên hoặc tạo mới
    let worksheet;
    const sheetName = workbook.SheetNames[0] || "Products";
    if (workbook.SheetNames.length > 0) {
        worksheet = workbook.Sheets[sheetName];
    } else {
        worksheet = XLSX.utils.aoa_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // Đọc headers hiện tại (giả sử ở dòng 1)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
    // Chúng ta sẽ ghi đè headers để đảm bảo đúng format

    const headers = [
        "Tên sản phẩm",
        "Mã SKU",
        "Giá bán",
        "Giá vốn",
        "Tồn kho",
        "Đơn vị",
        "Nhà cung cấp",
        "Số lô",        // <--- NEW
        "Hạn sử dụng",  // <--- NEW
        "Số chứng từ",
        "Ngày chứng từ",
    ];

    // Ghi header vào dòng 1
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });

    // Ghi sample row vào dòng 2 (để user hiểu format)
    const sampleData = [
        "Coca Cola Lon 330ml",
        "SP000001",
        10000,
        8000,
        100,
        "Lon",
        "Công ty CocaCola",
        "L01",           // Số lô
        "2026-12-31",   // Hạn dùng
        "NK001",
        "2025-01-01"
    ];
    XLSX.utils.sheet_add_aoa(worksheet, [sampleData], { origin: "A2" });

    // Định dạng độ rộng cột cho dễ nhìn
    const wscols = [
        { wch: 25 }, // Tên
        { wch: 15 }, // SKU
        { wch: 12 }, // Giá bán
        { wch: 12 }, // Giá vốn
        { wch: 10 }, // Tồn
        { wch: 10 }, // Đơn vị
        { wch: 20 }, // Nhà cung cấp
        { wch: 15 }, // Số lô
        { wch: 15 }, // Hạn sử dụng
        { wch: 15 }, // Số chứng từ
        { wch: 15 }, // Ngày chứng từ
    ];
    worksheet["!cols"] = wscols;

    // Ghi lại file
    XLSX.writeFile(workbook, templatePath);
    console.log("Updated product_template.xlsx successfully with new headers and sample data.");

} catch (error) {
    console.error("Error updating template:", error);
}
