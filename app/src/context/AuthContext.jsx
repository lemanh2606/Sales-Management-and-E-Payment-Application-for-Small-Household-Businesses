import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient, userApi } from "../api/index"; // Đảm bảo đường dẫn này đúng
import { ensureStore } from "../api/storeApi"; // Đảm bảo đường dẫn này đúng

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 1. Thay thế useNavigate bằng useNavigation
  const navigation = useNavigation();

  // 2. State phải khởi tạo là null, vì AsyncStorage là BẤT ĐỒNG BỘ
  const [loading, setLoading] = useState(true); // Dùng state này để biết khi nào app sẵn sàng
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentStore, setCurrentStore] = useState(null);

  // 3. (Hàm mới) Hàm persist dùng AsyncStorage (bất đồng bộ)
  const persist = useCallback(async (u, t, store) => {
    try {
      const tasks = [];
      if (u) tasks.push(AsyncStorage.setItem("user", JSON.stringify(u)));
      else tasks.push(AsyncStorage.removeItem("user"));

      if (t) tasks.push(AsyncStorage.setItem("token", t));
      else tasks.push(AsyncStorage.removeItem("token"));

      if (store)
        tasks.push(AsyncStorage.setItem("currentStore", JSON.stringify(store)));
      else tasks.push(AsyncStorage.removeItem("currentStore"));

      await Promise.all(tasks);
    } catch (e) {
      console.error("Lỗi khi lưu trữ (persist) auth state:", e);
    }
  }, []);

  // 4. (Hàm mới) Hàm logout dùng AsyncStorage
  // Dùng useCallback để ổn định hàm này cho useEffect (interceptor)
  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    setCurrentStore(null);
    await persist(null, null, null); // Xóa khỏi AsyncStorage

    // 5. Điều hướng về màn hình Auth (ví dụ: 'AuthStack')
    // Dùng navigation.reset để xóa lịch sử điều hướng (không cho back lại)
    navigation.reset({
      index: 0,
      routes: [{ name: "Auth" }], // 'Auth' là tên Stack Auth của bạn
    });
  }, [navigation, persist]);

  // 6. (Đã sửa) Logic khởi tạo app: đọc từ AsyncStorage
  useEffect(() => {
    const bootstrapAsync = async () => {
      let storedToken = null;
      let storedUser = null;
      let storedStore = null;
      try {
        // Đọc đồng thời 3 key
        const [tokenRes, userRes, storeRes] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("currentStore"),
        ]);

        storedToken = tokenRes;
        if (userRes) storedUser = JSON.parse(userRes);
        if (storeRes) storedStore = JSON.parse(storeRes);

        if (storedToken && storedUser) {
          setUser(storedUser);
          setToken(storedToken);
          if (storedStore) setCurrentStore(storedStore);
        }
      } catch (e) {
        console.error("Lỗi khi khôi phục auth state:", e);
        // Nếu lỗi, đảm bảo đăng xuất
        await logout();
      } finally {
        // Báo cho app biết đã tải xong, có thể render UI
        setLoading(false);
      }
    };

    bootstrapAsync();
  }, [logout]);

  // 7. (Đã sửa) Logic Interceptor (Refresh Token)
  useEffect(() => {
    // Interceptor để tự động refresh token khi hết hạn (401)
    // Logic này rất tốt và có thể giữ lại, chỉ cần sửa persist/logout
    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response &&
          error.response.status === 401 &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;
          try {
            const data = await userApi.refreshToken();
            setToken(data.token);
            // Phải 'await' hàm persist
            await persist(user, data.token, currentStore);

            // Cập nhật header cho request *này*
            // (apiClient.js đã có interceptor cho các request *sau*)
            originalRequest.headers["Authorization"] = `Bearer ${data.token}`;
            return apiClient(originalRequest);
          } catch (e) {
            console.error("Refresh token thất bại:", e);
            await logout(); // Phải 'await' hàm logout
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      // Gỡ interceptor khi component unmount
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [user, currentStore, persist, logout]); // Thêm persist, logout vào dependency

  // 8. (Đã sửa) Hàm Login
  // Hàm này nhận data từ LoginScreen và điều hướng
  const login = async (userData, tokenData) => {
    console.log("👉 LOGIN START: role=", userData?.role);
    // Không cần setLoading(true) vì LoginScreen sẽ tự xử lý
    // setLoading(true);

    try {
      setUser(userData);
      setToken(tokenData);

      const initialStore =
        userData?.role === "STAFF" && currentStore ? currentStore : null;
      await persist(userData, tokenData, initialStore); // Phải 'await'

      let resolvedStore = null;
      let hasMultipleStores = false;
      try {
        const res = await ensureStore();
        console.log("👉 ensureStore RESULT:", res);
        resolvedStore =
          res?.store ||
          res?.currentStore ||
          (res?.stores && res.stores[0]) ||
          null;
        hasMultipleStores =
          res?.stores && Array.isArray(res.stores) && res.stores.length > 1;

        if (resolvedStore) {
          setCurrentStore(resolvedStore);
          await persist(userData, tokenData, resolvedStore); // await
        }
      } catch (err) {
        console.warn("ensureStore lỗi (bỏ qua):", err);
      }

      // 9. Điều hướng trong React Native
      // Giả sử bạn có 3 màn hình: 'App', 'SelectStore', 'Auth'

      // Điều hướng tới App Stack chính (ví dụ: 'AppStack')
      // navigation.reset xóa sạch stack cũ và đặt 'AppStack' làm root
      const resetToAction = (routeName) =>
        navigation.reset({
          index: 0,
          routes: [{ name: routeName }],
        });

      if (userData?.role === "STAFF") {
        console.log("👉 STAFF: Điều hướng tới AppStack");
        resetToAction("AppStack"); // Tên Stack App chính của bạn
        return;
      }

      if (userData?.role === "MANAGER") {
        if (hasMultipleStores) {
          console.log("👉 MANAGER: Nhiều store -> SelectStore");
          // Tới 'SelectStore' (nằm trong AppStack hoặc AuthStack)
          navigation.navigate("SelectStore");
          return;
        }
        if (resolvedStore) {
          console.log("👉 MANAGER: Có store -> AppStack");
          resetToAction("AppStack");
        } else {
          console.log("👉 MANAGER: Không có store -> SelectStore");
          navigation.navigate("SelectStore");
        }
        return;
      }

      // Mặc định
      console.log("👉 DEFAULT: Điều hướng tới AppStack");
      resetToAction("AppStack");
    } catch (error) {
      console.error("Login thất bại:", error);
      await logout(); // Rollback nếu lỗi
    } finally {
      // Không cần setLoading(false) ở đây
      // setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        currentStore,
        setCurrentStore,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
