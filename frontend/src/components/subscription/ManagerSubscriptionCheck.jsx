// components/subscription/ManagerSubscriptionCheck.jsx
import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { subscriptionApi } from "../../api";

/**
 * Component kiểm tra subscription của Manager
 * Nếu hết hạn -> redirect sang /settings/subscription/pricing
 * Không làm mờ màn hình, chỉ redirect + ẩn menu (xử lý ở Sidebar)
 */
const ManagerSubscriptionCheck = () => {
  const { user, managerSubscriptionExpired, setManagerSubscriptionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.role === "MANAGER") {
      checkManagerSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.role]); // Chỉ phụ thuộc pathname và role

  const checkManagerSubscription = async () => {
    // Chỉ check nếu là MANAGER
    if (user?.role !== "MANAGER") {
      setManagerSubscriptionExpired(false);
      return;
    }

    console.log("🔍 Checking Manager subscription at:", location.pathname);

    // Whitelist: Các trang Manager ĐƯỢC VÀO khi expired
    const allowedPaths = [
      "/settings/subscription",      // Trang subscription (để gia hạn)
      "/settings/activity-log",      // Nhật ký hoạt động
      "/settings/profile",           // Hồ sơ cá nhân
      "/select-store",               // Trang chọn cửa hàng (để Manager có thể chọn store)
      "/login",
      "/register"
    ];

    // Nếu đang ở trang được phép thì không redirect
    if (allowedPaths.some(path => location.pathname.startsWith(path))) {
      console.log("✅ Path in whitelist, skipping check");
      return;
    }

    try {
      const response = await subscriptionApi.getCurrentSubscription();
      const data = response.data || response; // Handle both response formats
      
      console.log("Manager subscription data:", data);
      
      // Check nếu subscription EXPIRED hoặc không còn active
      const isExpired = 
        data.status === "EXPIRED" || 
        (data.status === "TRIAL" && data.trial && !data.trial.is_active);

      if (isExpired) {
        console.log("Manager subscription expired, redirecting to pricing...");
        setManagerSubscriptionExpired(true);
        // Redirect sang trang mua gói với replace để không thêm vào history
        navigate("/settings/subscription/pricing", { replace: true });
      } else {
        setManagerSubscriptionExpired(false);
      }
    } catch (error) {
      console.error("Error checking Manager subscription:", error);
      // Nếu lỗi 403, có thể là expired
      if (error.response?.status === 403) {
        console.log("403 error, Manager subscription expired");
        setManagerSubscriptionExpired(true);
        navigate("/settings/subscription/pricing", { replace: true });
      }
    }
  };

  return null; // Component không render gì
};

export default ManagerSubscriptionCheck;
