// utils/period.js (fix periodToRange: thêm case custom với monthFrom/monthTo, tính đầu/cuối tháng UTC)
//parse theo "YYYY-MM" chứ không phải "MM-YYYY"
function periodToRange(periodType, periodKey, monthFrom, monthTo) {
  let start, end;

  if (periodType === "month") {
    const [year, month] = periodKey.split("-").map(Number); // Parse "2025-10" → year 2025, month 10
    start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)); // Ngày đầu tháng UTC
    end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Ngày cuối tháng UTC + ms 999 inclusive
  } else if (periodType === "quarter") {
    const [yearStr, quarterStr] = periodKey.split("-Q"); // Parse "2025-Q4" → yearStr "2025", quarterStr "4"
    const year = Number(yearStr);
    const q = Number(quarterStr);

    const startMonth = (q - 1) * 3; // Q1 = 0, Q2 = 3, Q3 = 6, Q4 = 9
    start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0)); // Ngày đầu quý UTC
    end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999)); // Ngày cuối quý UTC + ms 999
  } else if (periodType === "year") {
    const year = Number(periodKey); // Parse "2025" → year 2025
    start = new Date(Date.UTC(year, 0, 1, 0, 0, 0)); // 1/1 năm UTC
    end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)); // 31/12 năm UTC + ms 999
  } else if (periodType === "custom") {
    // Custom khoảng tháng từ monthFrom đến monthTo (ví dụ monthFrom="2025-01", monthTo="2025-05")
    const [fromYear, fromMonth] = monthFrom.split("-").map(Number); // Parse monthFrom "2025-01"
    const [toYear, toMonth] = monthTo.split("-").map(Number); // Parse monthTo "2025-05"
    start = new Date(Date.UTC(fromYear, fromMonth - 1, 1, 0, 0, 0)); // Ngày đầu tháng from UTC
    end = new Date(Date.UTC(toYear, toMonth, 0, 23, 59, 59, 999)); // Ngày cuối tháng to UTC + ms 999
  }

  console.log(
    "Debug khoảng thời gian:",
    periodType,
    periodKey,
    "start",
    start.toISOString(),
    "end",
    end.toISOString()
  );

  return { start, end };
}

module.exports = { periodToRange };
