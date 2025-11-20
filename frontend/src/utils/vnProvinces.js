// src/utils/vnProvinces.js
const BASE_URL = "https://provinces.open-api.vn/api/v2"; // hoặc proxy của bạn

/**
 * Fetch all provinces with optional depth
 * depth=1: chỉ tỉnh, depth=2: tỉnh + quận + phường
 */
export async function fetchProvinces(depth = 2) {
  const url = `${BASE_URL}/?depth=${depth}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Không thể tải danh sách tỉnh");
  return res.json();
}

/**
 * Fetch province by code with wards
 */
export async function fetchProvinceByCode(code, depth = 2) {
  const url = `${BASE_URL}/p/${code}?depth=${depth}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tìm thấy tỉnh code=${code}`);
  return res.json();
}

/**
 * Build Cascader options from API response
 * Format: [{value, label, children: [{value, label, children: [...]}]}]
 */
export function buildCascaderOptions(provinces) {
  return provinces.map((prov) => ({
    value: prov.code,
    label: prov.name,
    children: (prov.wards || []).map((ward) => ({
      value: ward.code,
      label: ward.name,
      // Nếu API trả về districts nested trong wards thì parse; nếu không thì wards là cấp cuối
      // Với API này, "wards" đã là district + ward merged. Kiểm tra division_type để phân biệt.
      // Để đơn giản, giả sử wards là danh sách quận/huyện, mỗi quận có children là phường/xã.
      // Nếu API depth=2 trả về nested đủ 3 cấp, parse theo cấu trúc thực tế.
    })),
  }));
}

/**
 * Simplified: Assume wards array contains districts, each district has wards.
 * Adjust based on actual API response structure.
 */
export function buildCascaderOptionsNested(data) {
  // Nếu API trả về cấu trúc: province -> districts -> wards, parse như sau:
  return data.map((prov) => {
    // Group wards by district (theo district_code hoặc prefix)
    const districtMap = {};
    (prov.wards || []).forEach((w) => {
      // Ví dụ: nếu ward có district_code, nhóm lại
      const distCode = w.district_code || Math.floor(w.code / 100); // giả sử
      if (!districtMap[distCode]) {
        districtMap[distCode] = {
          value: distCode,
          label: w.district_name || `Quận/Huyện ${distCode}`,
          children: [],
        };
      }
      districtMap[distCode].children.push({
        value: w.code,
        label: w.name,
      });
    });

    return {
      value: prov.code,
      label: prov.name,
      children: Object.values(districtMap),
    };
  });
}
