---
description: Hướng dẫn tạo Development Build cho Push Notifications
---

# 📱 Tạo Development Build để sử dụng đầy đủ Push Notifications

> **Lưu ý quan trọng**: Từ SDK 53, Expo Go không còn hỗ trợ remote push notifications. Để có đầy đủ chức năng thông báo, bạn cần tạo Development Build.

---

## 📋 Yêu cầu trước khi bắt đầu

- ✅ Node.js >= 18
- ✅ EAS CLI đã cài (`npm install -g eas-cli`)
- ✅ Tài khoản Expo (đăng ký tại https://expo.dev)
- ✅ (Android) USB Debugging enabled trên thiết bị hoặc Android Studio với emulator
- ✅ (iOS) Xcode, Apple Developer Account (cho device thật, simulator miễn phí)

---

## 🚀 CÁC BƯỚC THỰC HIỆN

### Bước 1: Đăng nhập EAS

```bash
cd SmartBizSales
npx eas login
```

Nhập email và password tài khoản Expo của bạn.

// turbo

### Bước 2: Kiểm tra cấu hình project

```bash
npx eas whoami
```

Kiểm tra xem đã đăng nhập đúng tài khoản chưa.

// turbo

### Bước 3: Đảm bảo dependencies đã cài đủ

```bash
npm install
```

### Bước 4: Build cho Android (APK)

// turbo

```bash
npx eas build --profile development --platform android --non-interactive
```

**Quá trình build sẽ:**

1. Upload source code lên EAS Build servers
2. Build APK trên cloud (mất khoảng 10-20 phút)
3. Cung cấp link download APK khi hoàn thành

### Bước 5: Download và cài đặt APK

Sau khi build xong, bạn sẽ nhận được link download APK. Cài đặt APK lên thiết bị Android.

**Cách cài đặt:**

1. Download file APK từ link EAS cung cấp
2. Mở file APK trên thiết bị Android
3. Cho phép "Install from unknown sources" nếu được hỏi
4. Hoàn tất cài đặt

### Bước 6: Chạy ứng dụng với Development Build

```bash
npx expo start --dev-client
```

Quét QR code bằng ứng dụng vừa cài đặt (không phải Expo Go).

---

## 🔄 BUILD LOCAL (Tùy chọn - Không cần internet)

Nếu bạn có Android Studio đã cài đặt:

```bash
npx expo run:android
```

Lệnh này sẽ:

1. Tạo thư mục `android/` nếu chưa có
2. Build APK trực tiếp trên máy của bạn
3. Tự động cài đặt lên thiết bị/emulator đang kết nối

---

## 📝 CẤU HÌNH ĐÃ THIẾT LẬP

### app.json

- ✅ `expo-notifications` plugin với icon và color
- ✅ Android permissions: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`
- ✅ iOS infoPlist: `UIBackgroundModes: remote-notification`
- ✅ Project ID: `6e2bd929-0701-48c9-899d-49778be8e9e0`

### eas.json

- ✅ `development` profile với APK output
- ✅ Environment variable: `EXPO_PUBLIC_API_URL`
- ✅ Development client enabled

---

## ✅ SAU KHI BUILD THÀNH CÔNG

Push notifications sẽ hoạt động đầy đủ:

| Chức năng                     | Expo Go | Dev Build |
| ----------------------------- | ------- | --------- |
| In-app Toast                  | ✅      | ✅        |
| Real-time WebSocket           | ✅      | ✅        |
| Local Notifications           | ✅      | ✅        |
| **Remote Push Notifications** | ❌      | ✅        |
| Background Notifications      | ❌      | ✅        |
| Badge Count                   | Hạn chế | ✅        |

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi: "Cannot find Expo project"

```bash
npx expo prebuild --clean
```

### Lỗi: "EAS CLI not found"

```bash
npm install -g eas-cli
```

### Lỗi: "Build failed - Gradle error"

```bash
cd android
./gradlew clean
cd ..
npx eas build --profile development --platform android --clear-cache
```

### Lỗi: "Invalid push token"

Đảm bảo đã cấu hình đúng `projectId` trong `app.json`:

```json
"extra": {
  "eas": {
    "projectId": "YOUR_PROJECT_ID"
  }
}
```

---

## 📱 TEST PUSH NOTIFICATIONS

Sau khi cài Development Build:

1. Mở app và đăng nhập
2. Kiểm tra logs hiển thị `✅ Expo Push Token: ExponentPushToken[xxx]`
3. Push token sẽ hoạt động đầy đủ với remote push

### Test bằng Expo Push Tool

1. Truy cập: https://expo.dev/notifications
2. Nhập Push Token từ logs
3. Gửi test notification
4. Notification sẽ hiển thị dù app đang ở background!

---

## 🔄 CẬP NHẬT CODE SAU KHI BUILD

Khi bạn thay đổi code JavaScript/TypeScript:

- **KHÔNG cần build lại** - chỉ cần chạy `npx expo start --dev-client`

Khi bạn thêm native modules mới hoặc thay đổi `app.json`:

- **CẦN build lại** Development Build
