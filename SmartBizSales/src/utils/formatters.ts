// src/utils/formatters.ts

/**
 * Định dạng số tiền VND
 * @param value - Giá trị cần định dạng
 * @returns Chuỗi đã định dạng theo VND
 */
export const formatVND = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null) return "₫0";

    try {
        const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : Number(value);

        // Kiểm tra nếu không phải số hợp lệ
        if (isNaN(num)) return "₫0";

        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(num);
    } catch (error) {
        console.error("Error formatting VND:", error);
        return "₫0";
    }
};

/**
 * Định dạng số với dấu phân cách
 * @param value - Giá trị cần định dạng
 * @param decimals - Số chữ số thập phân
 * @returns Chuỗi đã định dạng
 */
export const formatNumber = (
    value: number | string | undefined | null,
    decimals: number = 0
): string => {
    if (value === undefined || value === null) return "0";

    try {
        const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]/g, "")) : Number(value);

        // Kiểm tra nếu không phải số hợp lệ
        if (isNaN(num)) return "0";

        return new Intl.NumberFormat("vi-VN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(num);
    } catch (error) {
        console.error("Error formatting number:", error);
        return "0";
    }
};

/**
 * Định dạng phần trăm
 * @param value - Giá trị cần định dạng (0-100)
 * @param decimals - Số chữ số thập phân
 * @returns Chuỗi đã định dạng với ký hiệu %
 */
export const formatPercent = (
    value: number | string | undefined | null,
    decimals: number = 1
): string => {
    if (value === undefined || value === null) return "0%";

    try {
        const num = typeof value === "string" ? parseFloat(value) : Number(value);

        if (isNaN(num)) return "0%";

        return `${formatNumber(num, decimals)}%`;
    } catch (error) {
        console.error("Error formatting percent:", error);
        return "0%";
    }
};

/**
 * Định dạng ngày tháng
 * @param date - Ngày cần định dạng
 * @param format - Định dạng (default: DD/MM/YYYY)
 * @returns Chuỗi ngày đã định dạng
 */
export const formatDate = (
    date: Date | string | number | undefined | null,
    format: string = "DD/MM/YYYY"
): string => {
    if (!date) return "";

    try {
        const dayjs = require("dayjs");
        return dayjs(date).format(format);
    } catch (error) {
        console.error("Error formatting date:", error);
        return String(date);
    }
};

/**
 * Định dạng ngày tháng với giờ
 * @param date - Ngày cần định dạng
 * @returns Chuỗi ngày giờ đã định dạng
 */
export const formatDateTime = (
    date: Date | string | number | undefined | null
): string => {
    return formatDate(date, "DD/MM/YYYY HH:mm");
};

/**
 * Rút gọn số lớn (K, M, B)
 * @param value - Giá trị cần rút gọn
 * @returns Chuỗi đã rút gọn
 */
export const formatCompactNumber = (
    value: number | string | undefined | null
): string => {
    if (value === undefined || value === null) return "0";

    try {
        const num = typeof value === "string" ? parseFloat(value) : Number(value);

        if (isNaN(num)) return "0";

        const formatter = new Intl.NumberFormat("en", {
            notation: "compact",
            compactDisplay: "short",
        });

        return formatter.format(num);
    } catch (error) {
        console.error("Error formatting compact number:", error);
        return String(value);
    }
};

/**
 * Đọc số tiền bằng chữ tiếng Việt
 * @param value - Giá trị cần đọc
 * @returns Chuỗi bằng chữ tiếng Việt
 */
export const readVietnameseNumber = (
    value: number | string | undefined | null
): string => {
    if (value === undefined || value === null) return "không";

    try {
        const num = Math.round(
            typeof value === "string" ? parseFloat(value) : Number(value)
        );

        if (isNaN(num)) return "không";
        if (num === 0) return "không";

        const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ", "tỷ tỷ"];
        const ones = [
            "",
            "một",
            "hai",
            "ba",
            "bốn",
            "năm",
            "sáu",
            "bảy",
            "tám",
            "chín",
        ];
        const tens = [
            "",
            "mười",
            "hai mươi",
            "ba mươi",
            "bốn mươi",
            "năm mươi",
            "sáu mươi",
            "bảy mươi",
            "tám mươi",
            "chín mươi",
        ];

        let result = "";
        let numStr = num.toString();

        // Thêm số 0 cho đủ bộ 3 chữ số
        while (numStr.length % 3 !== 0) {
            numStr = "0" + numStr;
        }

        const groupCount = numStr.length / 3;

        for (let i = 0; i < groupCount; i++) {
            const group = numStr.substr(i * 3, 3);
            const groupNum = parseInt(group, 10);

            if (groupNum > 0) {
                const hundred = Math.floor(groupNum / 100);
                const ten = Math.floor((groupNum % 100) / 10);
                const one = groupNum % 10;

                let groupText = "";

                if (hundred > 0) {
                    groupText += ones[hundred] + " trăm ";
                }

                if (ten > 0) {
                    if (ten === 1) {
                        groupText += "mười ";
                    } else {
                        groupText += tens[ten] + " ";
                    }
                }

                if (one > 0) {
                    if (ten > 0 && one === 5) {
                        groupText += "lăm ";
                    } else if (ten === 0 && hundred > 0 && one === 1) {
                        groupText += "linh một ";
                    } else {
                        groupText += ones[one] + " ";
                    }
                }

                const unitIndex = groupCount - i - 1;
                groupText += units[unitIndex] + " ";

                result += groupText;
            }
        }

        return result.trim() + " đồng";
    } catch (error) {
        console.error("Error reading Vietnamese number:", error);
        return formatVND(value);
    }
};

/**
 * Định dạng số điện thoại
 * @param phone - Số điện thoại
 * @returns Số điện thoại đã định dạng
 */
export const formatPhone = (phone: string | undefined | null): string => {
    if (!phone) return "";

    const cleaned = phone.replace(/\D/g, "");

    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
    } else if (cleaned.length === 11) {
        return cleaned.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3");
    }

    return phone;
};

/**
 * Định dạng mã số thuế
 * @param taxCode - Mã số thuế
 * @returns Mã số thuế đã định dạng
 */
export const formatTaxCode = (taxCode: string | undefined | null): string => {
    if (!taxCode) return "";

    const cleaned = taxCode.replace(/\D/g, "");

    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
    } else if (cleaned.length === 13) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{4})/, "$1 $2 $3 $4");
    }

    return taxCode;
};

/**
 * Định dạng địa chỉ email
 * @param email - Email
 * @returns Email đã định dạng (viết thường)
 */
export const formatEmail = (email: string | undefined | null): string => {
    if (!email) return "";
    return email.trim().toLowerCase();
};

/**
 * Giới hạn độ dài chuỗi
 * @param text - Chuỗi cần giới hạn
 * @param maxLength - Độ dài tối đa
 * @returns Chuỗi đã giới hạn
 */
export const truncateText = (
    text: string | undefined | null,
    maxLength: number = 50
): string => {
    if (!text) return "";

    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength - 3) + "...";
};

export default {
    formatVND,
    formatNumber,
    formatPercent,
    formatDate,
    formatDateTime,
    formatCompactNumber,
    readVietnameseNumber,
    formatPhone,
    formatTaxCode,
    formatEmail,
    truncateText,
};