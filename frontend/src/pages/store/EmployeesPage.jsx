// src/pages/store/EmployeesPage.jsx
import React, { useState, useEffect } from "react";
import { Table, Button, Modal, message, Input, Tabs, Popconfirm, Space, Typography } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";
import axios from "axios";
import EmployeeForm from "../../components/store/EmployeeForm"; // Giữ nguyên form cũ của bạn
import Layout from "../../components/Layout";

const { TabPane } = Tabs;
const { Search } = Input;

const API_BASE = "http://localhost:9999/api";

export default function EmployeesPage() {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  const [activeEmployees, setActiveEmployees] = useState([]);
  const [deletedEmployees, setDeletedEmployees] = useState([]);
  const [filteredActive, setFilteredActive] = useState([]);
  const [filteredDeleted, setFilteredDeleted] = useState([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tabKey, setTabKey] = useState("active");
  const [searchText, setSearchText] = useState("");
  const [loadedTabs, setLoadedTabs] = useState({ active: false, deleted: false });

  const token = localStorage.getItem("token"); // Token cho auth
  const headers = { Authorization: `Bearer ${token}` };

  const loadEmployees = async (deleted = false, forceReload = false) => {
    // 👉 nếu không force reload thì giữ cơ chế cũ
    if (!forceReload && loadedTabs[deleted ? "deleted" : "active"]) return;

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/stores/${currentStore._id}/employees?deleted=${deleted}`, { headers });
      const list = res.data.employees || [];
      if (deleted) {
        setDeletedEmployees(list);
        setFilteredDeleted(list);
      } else {
        setActiveEmployees(list);
        setFilteredActive(list);
      }
      setLoadedTabs((prev) => ({ ...prev, [deleted ? "deleted" : "active"]: true }));
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: `Không thể tải danh sách nhân viên ${deleted ? "đã xóa" : "đang làm"}!`,
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentStore._id) {
      loadEmployees(false); // Load active đầu tiên
    } else {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không tìm thấy storeId! Vui lòng chọn cửa hàng.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    }
  }, [currentStore._id]);

  const handleTabChange = (key) => {
    setTabKey(key);
    setSearchText(""); // Reset search khi đổi tab
    if (key === "deleted") {
      loadEmployees(true); // Load deleted khi click tab
    }
  };

  const handleSearch = (value) => {
    const text = value.toLowerCase();
    setSearchText(text);
    if (tabKey === "active") {
      setFilteredActive(
        activeEmployees.filter(
          (emp) =>
            emp.fullName?.toLowerCase().includes(text) ||
            emp.user_id?.username?.toLowerCase().includes(text) ||
            emp.user_id?.email?.toLowerCase().includes(text)
        )
      );
    } else {
      setFilteredDeleted(
        deletedEmployees.filter(
          (emp) =>
            emp.fullName?.toLowerCase().includes(text) ||
            emp.user_id?.username?.toLowerCase().includes(text) ||
            emp.user_id?.email?.toLowerCase().includes(text)
        )
      );
    }
  };

  const handleCreate = () => {
    setMode("create");
    setCurrent({});
    setOpen(true);
  };

  const handleEdit = (record) => {
    setMode("edit");
    setCurrent(record);
    setOpen(true);
  };

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      if (mode === "create") {
        await axios.post(`${API_BASE}/stores/${currentStore._id}/employees`, payload, { headers });
        Swal.fire({
          title: "🎉 Thành công!",
          text: `Tạo nhân viên thành công`,
          icon: "success",
          timer: 2000,
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
        await loadEmployees(false, true); // Reload active
      } else {
        await axios.put(`${API_BASE}/stores/${currentStore._id}/employees/${current._id}`, payload, { headers });
        Swal.fire({
          title: "🎉 Thành công!",
          text: `Cập nhật nhân viên thành công`,
          icon: "success",
          timer: 2000,
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
        await loadEmployees(tabKey === "active" ? false : true, true); // Reload tab hiện tại
      }
      await loadEmployees();
      setOpen(false);
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi khi lưu nhân viên.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
      console.error(err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleSoftDelete = async (id) => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/stores/${currentStore._id}/employees/${id}/soft`, { headers });
      Swal.fire({
        title: "🎉 Thành công!",
        text: `Xoá nhân viên thành công`,
        icon: "success",
        timer: 2000,
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
      await loadEmployees(false, true); // reload lại tab active
      if (loadedTabs.deleted) await loadEmployees(true, true); // reload deleted nếu đã mở
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi khi xoá.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    setLoading(true);
    try {
      await axios.put(`${API_BASE}/stores/${currentStore._id}/employees/${id}/restore`, {}, { headers });
      Swal.fire({
        title: "🎉 Thành công!",
        text: `Khôi phuch nhân viên thành công `,
        icon: "success",
        timer: 2000,
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
      await loadEmployees(true, true); // 👉 reload deleted
      if (loadedTabs.active) await loadEmployees(false, true); // reload active
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi khi khôi phục lại.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const getColumns = (isDeleted = false) => [
    {
      title: "Tên",
      dataIndex: "fullName",
      key: "fullName",
      width: 230,
    },
    { title: "Username", key: "username", width: 210, render: (_, record) => record.user_id?.username || "—" },
    { title: "Email", key: "email", width: 250, render: (_, record) => record.user_id?.email || "—" },
    {
      title: "Số điện thoại",
      key: "phone",
      width: 140,
      render: (_, record) => {
        const phone = record.user_id?.phone || "";

        // Hàm format số kiểu 4-3-3
        const formatPhone = (num) => {
          const cleaned = num.replace(/\D/g, ""); // bỏ ký tự lạ
          if (cleaned.length === 10) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
          }
          return num; // fallback nếu không đủ 10 số
        };

        return (
          <Space>
            {phone ? (
              <Typography.Text code style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "0.5px" }}>
                {formatPhone(phone)}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: "15px" }}>
                —
              </Typography.Text>
            )}
          </Space>
        );
      },
    },
    { title: "Ca làm việc", dataIndex: "shift", key: "shift" },
    {
      title: "Lương",
      key: "salary",
      render: (_, record) => Number(record.salary ?? 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" }),
      sorter: (a, b) => (a.salary ?? 0) - (b.salary ?? 0),
    },
    {
      title: "Hoa hồng (%)",
      key: "commission_rate",
      render: (_, record) => Number(record.commission_rate ?? 0),
      sorter: (a, b) => (a.commission_rate ?? 0) - (b.commission_rate ?? 0),
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            type="default"
            size="small"
            onClick={() => handleEdit(record)}
            style={{
              borderColor: "#1890ff",
              color: "#1890ff",
              fontWeight: 500,
              borderRadius: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6f4ff")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Sửa
          </Button>

          {isDeleted ? (
            <Popconfirm
              title="Khôi phục nhân viên này?"
              onConfirm={() => handleRestore(record._id)}
              okText="Có"
              cancelText="Không"
            >
              <Button
                type="default"
                size="small"
                style={{
                  borderColor: "#52c41a",
                  color: "#52c41a",
                  fontWeight: 500,
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f6ffed")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Khôi phục
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Xóa mềm nhân viên này?"
              onConfirm={() => handleSoftDelete(record._id)}
              okText="Có"
              cancelText="Không"
            >
              <Button
                type="default"
                size="small"
                style={{
                  borderColor: "#ff4d4f",
                  color: "#ff4d4f",
                  fontWeight: 500,
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fff1f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Xóa
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-800">Quản lý nhân viên cửa hàng</h2>
            <span
              className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm
                 hover:bg-[#bae0ff] hover:scale-105 transition-all duration-200"
            >
              {currentStore?.name}
            </span>
          </div>

          <Button type="primary" size="large" onClick={handleCreate} className="bg-blue-500 hover:bg-blue-600">
            + Tạo nhân viên mới
          </Button>
        </div>

        <div className="mb-4">
          <Search
            placeholder="Tìm kiếm theo tên, username hoặc email..."
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            enterButton
            allowClear
            size="large"
            className="w-full max-w-md"
          />
        </div>

        <Tabs
          activeKey={tabKey}
          onChange={handleTabChange}
          animated
          items={[
            {
              key: "active",
              label: "Nhân viên đang làm",
              children: (
                <Table
                  columns={getColumns(false)}
                  dataSource={filteredActive}
                  rowKey="_id"
                  pagination={{
                    position: ["bottomRight"], // 👉 cho thanh phân trang nằm bên phải
                    showSizeChanger: true,
                    responsive: true,
                    showTotal: (total, range) => (
                      <div>
                        Đang xem{" "}
                        <span style={{ color: "#1890ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> nhân viên
                      </div>
                    ),
                  }}
                  loading={loading && tabKey === "active"}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: "Chưa có nhân viên đang làm việc" }}
                />
              ),
            },
            {
              key: "deleted",
              label: "Nhân viên đã xóa",
              children: (
                <Table
                  columns={getColumns(true)}
                  dataSource={filteredDeleted}
                  rowKey="_id"
                  pagination={{
                    position: ["bottomRight"], // 👉 cho thanh phân trang nằm bên phải
                    showSizeChanger: true,
                    responsive: true,
                    showTotal: (total, range) => (
                      <div>
                        Đang xem{" "}
                        <span style={{ color: "#1890ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> nhân viên
                      </div>
                    ),
                  }}
                  loading={loading && tabKey === "deleted"}
                  scroll={{ x: "max-content" }}
                  locale={{ emptyText: "Chưa có nhân viên bị xóa" }}
                />
              ),
            },
          ]}
        />

        <Modal
          open={open}
          title={mode === "edit" ? "Cập nhật nhân viên" : "Tạo nhân viên mới"}
          onCancel={() => setOpen(false)}
          footer={null}
          destroyOnHidden
          width={600}
        >
          <EmployeeForm mode={mode} initialValues={current} onSubmit={handleSubmit} loading={loading} />
        </Modal>
      </div>
    </Layout>
  );
}
