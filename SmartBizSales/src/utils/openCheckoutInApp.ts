// src/utils/openCheckoutInApp.ts
import * as WebBrowser from "expo-web-browser";

export async function openCheckoutInApp(checkoutUrl: string, redirectUrl: string) {
    // redirectUrl là deep link của app, ví dụ: posapp://subscription/success
    // Khi trang thanh toán redirect về redirectUrl, session sẽ kết thúc. [web:1216]
    return WebBrowser.openAuthSessionAsync(checkoutUrl, redirectUrl);
}
