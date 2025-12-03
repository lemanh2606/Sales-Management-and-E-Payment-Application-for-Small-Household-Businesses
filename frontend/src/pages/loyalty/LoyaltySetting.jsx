// src/pages/loyalty/LoyaltySetting.jsx
import React, { useState, useEffect } from "react";
import { Form, InputNumber, Switch, Button, Card, Alert, Spin } from "antd";
import { SaveOutlined, InfoCircleOutlined } from "@ant-design/icons";
import axios from "axios";
import Swal from "sweetalert2"; // 👈 Thêm: Import sweetalert2 cho toast đẹp (npm i sweetalert2 nếu chưa)
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";

export default function LoyaltySetting() {
  const { token, currentStore } = useAuth(); // 👈 Lấy token và storeId từ context (giả sử có currentStore)
  const [isActive, setIsActive] = useState(false); // 👈 Trạng thái bật/tắt
  const [config, setConfig] = useState(null); // 👉 FIX: State để lưu config từ API (dynamic, không static default)
  const [loading, setLoading] = useState(true); // 👈 Loading khi fetch config
  const [saving, setSaving] = useState(false); // 👈 Loading khi save
  const [error, setError] = useState(null); // 👈 Lỗi nếu có

  const storeId = currentStore?._id; // 👈 StoreId từ context (nếu null thì báo lỗi)
  const apiUrl = import.meta.env.VITE_API_URL;

  // 👈 Defaults nếu chưa có config (theo schema, nhưng set isActive=false như yêu cầu)
  const defaultConfig = {
    pointsPerVND: 1 / 20000, // 20.000 VNĐ = 1 điểm
    vndPerPoint: 100, // 1 điểm = 100 VNĐ
    minOrderValue: 0,
    isActive: false, // 👈 Mặc định tắt theo yêu cầu
  };

  // 👈 Fetch config khi component mount
  useEffect(() => {
    if (!storeId || !token) {
      setError("Thiếu thông tin cửa hàng hoặc chưa đăng nhập");
      setLoading(false);
      return;
    }

    fetchConfig();
  }, [storeId, token]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null); // Clear error trước fetch
      const response = await axios.get(`${apiUrl}/loyaltys/config/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const apiConfig = response.data.config || defaultConfig; // 👉 FIX: Lưu config từ API
      setConfig(apiConfig);
      setIsActive(apiConfig.isActive);
      console.log("Lấy config tích điểm thành công cho cửa hàng:", storeId, apiConfig);
    } catch (err) {
      console.error("Lỗi lấy config tích điểm:", err.response?.data?.message || err.message);
      if (err.response?.status === 404) {
        // Catch 404 "Chưa setup..." → Alert info thân thiện, ko red "Lỗi"
        setError(null); // Clear error để ko hiển thị red Alert
        Swal.fire({
          title: "Hệ thống tích điểm",
          text: "Chưa cấu hình hệ thống tích điểm cho cửa hàng. Hãy thiết lập để bắt đầu tích điểm cho khách hàng!",
          icon: "info", // Icon info xanh
          confirmButtonText: "OK",
          timer: 5000, // Tự đóng sau 5s
          toast: true, // Toast style đẹp
          position: "top-end", // Vị trí góc phải trên
        });
        // Set defaultConfig để form sẵn sàng setup
        setConfig(defaultConfig); // 👉 FIX: Set config = default cho 404
        setIsActive(defaultConfig.isActive);
      } else {
        // Lỗi khác (500, 403...) → setError red Alert
        setError(err.response?.data?.message || "Lỗi lấy cấu hình");
        setConfig(defaultConfig); // 👉 FIX: Fallback default nếu lỗi
        setIsActive(defaultConfig.isActive);
      }
    } finally {
      setLoading(false);
    }
  };

  // 👈 Xử lý toggle switch (fix: gửi POST save isActive false/true khi toggle, refresh form)
  const handleToggle = async (checked) => {
    setIsActive(checked);
    setSaving(true); // Loading khi save
    try {
      const payload = { isActive: checked }; // Chỉ gửi isActive
      const response = await axios.post(`${apiUrl}/loyaltys/config/${storeId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Toggle isActive thành công:", response.data.config.isActive);
      // 👉 FIX: Refresh config sau toggle để sync data (nếu BE trả config full)
      if (response.data.config) setConfig(response.data.config);
      Swal.fire({
        title: "Cập nhật trạng thái",
        text: checked ? "Hệ thống tích điểm đã được bật!" : "Hệ thống tích điểm đã được tắt!",
        icon: "success", // Icon success xanh
        confirmButtonText: "OK",
        timer: 3000, // Tự đóng sau 3s
      });
    } catch (err) {
      console.error("Lỗi toggle isActive:", err.response?.data?.message || err.message);
      // Revert state nếu save fail
      setIsActive(!checked);
      Swal.fire({
        title: "Lỗi cập nhật",
        text: err.response?.data?.message || "Không thể cập nhật trạng thái tích điểm",
        icon: "error", // Icon error đỏ
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // 👈 Xử lý submit form
  const onFinish = async (values) => {
    if (!isActive) {
      console.log("Hệ thống tích điểm đã tắt, không cần lưu");
      return;
    }

    // 👈 Validate FE trước khi gửi
    if (values.pointsPerVND <= 0) {
      setError("Tỉ lệ tích điểm phải lớn hơn 0");
      return;
    }
    if (values.minOrderValue < 0) {
      setError("Giá trị đơn tối thiểu phải lớn hơn hoặc bằng 0");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...values,
        isActive: true, // 👈 Luôn active khi submit
      };
      const response = await axios.post(`${apiUrl}/loyaltys/config/${storeId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Lưu config tích điểm thành công:", response.data.config);
      //
      Swal.fire({
        title: "Cấu hình tích điểm",
        text: "Cấu hình đã được lưu thành công!",
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000, // Tự đóng sau 3s
      });
      // 👉 FIX: Refresh config từ BE để form sync giá trị mới
      if (response.data.config) {
        setConfig(response.data.config);
      } else {
        fetchConfig(); // Fallback nếu BE không trả config full
      }
    } catch (err) {
      console.error("Lỗi lưu config tích điểm:", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Lỗi lưu cấu hình");
      Swal.fire({
        title: "Lỗi lưu cấu hình",
        text: err.response?.data?.message || "Không thể lưu cấu hình tích điểm",
        icon: "error",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!storeId) {
    return <Alert message="Lỗi" description="Chưa chọn cửa hàng. Vui lòng chọn cửa hàng trước." type="error" />;
  }

  return (
    <Layout>
      <Card
        title={
          <div className="flex items-center gap-3">
            <SaveOutlined className="text-green-600 text-xl" />
            <span className="text-3xl font-bold text-gray-800">Cấu Hình Hệ Thống Tích Điểm</span>
          </div>
        }
        style={{ border: 0 }}
      >
        {loading ? (
          <Spin spinning size="large" tip="Đang tải dữ liệu...">
            {/* Wrap placeholder div (nested mode) - tip hiện bên dưới spin */}
            <div className="flex justify-center items-center h-48">
              <div className="text-center p-4">
                {" "}
                {/* Không cần text ở đây, chỉ để nested */}
              </div>
            </div>
          </Spin>
        ) : (
          <>
            {/* 👈 Bật/tắt hệ thống */}
            <div className="mb-6 p-4 bg-white rounded-xl shadow-md border border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">Bật/Tắt Hệ Thống Tích Điểm</h3>
                  <p className="text-sm text-gray-600">
                    Khi <span className="font-medium text-green-600">bật</span>, khách hàng sẽ tự động tích điểm theo
                    đơn hàng.
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onChange={handleToggle}
                  checkedChildren="Bật"
                  unCheckedChildren="Tắt"
                  className="w-16 h-8 bg-gradient-to-r from-gray-300 to-gray-400 checked:from-green-400 checked:to-green-600 shadow-lg"
                  loading={saving}
                />
              </div>
            </div>

            {/* 👈 Thông báo lỗi */}
            {error && (
              <Alert
                message="Lỗi"
                description={error}
                type="error"
                showIcon
                className="mb-6"
                closable
                onClose={() => setError(null)}
              />
            )}

            {/* 👉 FIX: Render Form khi isActive, truyền config dynamic */}
            {isActive && !loading && config && (
              <FormComponent
                formData={config} // 👉 FIX: Truyền config từ state (API hoặc default)
                storeId={storeId}
                token={token}
                onFinish={onFinish}
                saving={saving}
                setError={setError}
              />
            )}

            {!isActive && !loading && (
              <Alert
                message="Hệ thống tích điểm đang tắt"
                description="⚠️ Hệ thống đang tắt — bật công tắc ở trên để kích hoạt. Khi tắt, khách hàng sẽ không được cộng điểm."
                type="info"
                showIcon
                className="mt-4"
              />
            )}
          </>
        )}
      </Card>
    </Layout>
  );
}

// 👉 FIX: Sub-component Form (giữ nguyên, nhưng formData giờ dynamic)
function FormComponent({ formData, storeId, token, onFinish, saving, setError }) {
  const [form] = Form.useForm(); // Init useForm() ở đây - chỉ khi Form render

  // 👉 FIX: useEffect để setFieldsValue từ formData dynamic (API config)
  useEffect(() => {
    if (formData) {
      form.setFieldsValue({
        pointsPerVND: formData.pointsPerVND,
        vndPerPoint: formData.vndPerPoint,
        minOrderValue: formData.minOrderValue,
      });
    }
  }, [form, formData]); // Deps: formData thay đổi → re-set fields

  return (
    <Form
      key={storeId} // Key để re-mount nếu storeId thay đổi
      form={form}
      name="loyalty-form"
      onFinish={onFinish}
      layout="vertical"
      className="space-y-4"
    >
      <Card
        title={
          <div className="flex items-center gap-2">
            <InfoCircleOutlined className="text-blue-600" />
            <span className="font-semibold">Cài Đặt Chi Tiết</span>
          </div>
        }
        className="shadow-lg border-0 rounded-xl bg-white"
      >
        {/* 👇 Input rộng + format dấu chấm kiểu Việt Nam */}
        <Form.Item
          name="pointsPerVND"
          label={
            <span className="font-medium text-gray-700">
              Tỉ lệ tích điểm <span className="text-red-500">*</span> (VD: 1/20000 = 0,00005 = 20.000 VNĐ = 1 điểm)
            </span>
          }
          rules={[
            { required: true, message: "Vui lòng nhập tỉ lệ tích điểm" },
            { type: "number", min: 0.000001, message: "Phải lớn hơn 0" },
          ]}
          tooltip="Số tiền này tương ứng 1 điểm. Ví dụ nhập 20.000 thì đơn 200.000 được 10 điểm."
        >
          <InputNumber
            min={0.000001}
            max={1}
            step={0.000001}
            precision={6}
            placeholder="Nhập tỉ lệ (VD: 0.00005 cho 20.000 = 1đ)"
            className="!w-full !py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
          />
        </Form.Item>

        <Form.Item
          name="vndPerPoint"
          label={
            <span className="font-medium text-gray-700">
              Giá trị 1 điểm <span className="text-red-500">*</span> (VD: 100 VNĐ)
            </span>
          }
          rules={[
            { required: true, message: "Vui lòng nhập giá trị điểm" },
            { type: "number", min: 0, message: "Phải lớn hơn hoặc bằng 0" },
          ]}
          tooltip="Mỗi điểm khách dùng sẽ giảm số tiền tương ứng"
        >
          <InputNumber
            min={0}
            step={10}
            placeholder="Nhập giá trị (VD: 100)"
            suffix=" VNĐ"
            className="!w-full !py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
            formatter={(value) => (value ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")}
            parser={(value) => value.replace(/\./g, "")}
          />
        </Form.Item>

        <Form.Item
          name="minOrderValue"
          label={
            <span className="font-medium text-gray-700">
              Đơn hàng tối thiểu <span className="text-red-500">*</span> để được tích điểm (VD: 50.000 VNĐ)
            </span>
          }
          rules={[
            { required: true, message: "Vui lòng nhập giá trị" },
            { type: "number", min: 0, message: "Phải lớn hơn hoặc bằng 0" },
          ]}
          tooltip="Đơn hàng dưới mức này sẽ không được tích điểm"
        >
          <InputNumber
            min={0}
            step={1000}
            placeholder="Nhập số tiền (VD: 50.000)"
            suffix=" VNĐ"
            className="!w-full !py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
            formatter={(value) => (value ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")}
            parser={(value) => value.replace(/\./g, "")}
          />
        </Form.Item>
      </Card>

      <div className="flex justify-end pt-4">
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          size="large"
          loading={saving}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-8 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 min-w-[120px]"
        >
          Lưu Cấu Hình
        </Button>
      </div>
    </Form>
  );
}
