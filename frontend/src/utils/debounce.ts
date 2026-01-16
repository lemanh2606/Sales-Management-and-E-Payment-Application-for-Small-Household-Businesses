// src/utils/debounce.ts
import { debounce } from "lodash";

// Kiểu này giúp bạn có autocomplete + type đầy đủ
export default debounce;

// 🧩 1. Lodash là gì?

// lodash là một thư viện tiện ích (utility library) cho JavaScript.
// Nó cung cấp hàng trăm hàm hữu ích để xử lý:

// Mảng (_.map, _.filter, _.uniq, …)

// Chuỗi (_.capitalize, _.trim, …)

// Đối tượng (_.get, _.merge, _.cloneDeep, …)

// Và đặc biệt là các hàm điều khiển tần suất gọi, như _.debounce, _.throttle.

// 👉 Nói đơn giản: Lodash giúp bạn viết code ngắn hơn, ít lỗi hơn, cho các thao tác logic lặp đi lặp lại.

// ⚙️ 2. Cụ thể debounce dùng để làm gì?

// debounce là một kỹ thuật tối ưu hiệu suất, giúp bạn trì hoãn việc thực thi hàm cho đến khi người dùng “dừng thao tác” một chút.

// Ví dụ điển hình:

// Khi người dùng đang gõ vào ô tìm kiếm “Tra cứu tồn kho”,
// bạn không muốn gọi API mỗi lần họ gõ 1 ký tự,
// mà chỉ gọi sau khi họ dừng gõ khoảng 500ms.

// Đó chính là việc dùng debounce.