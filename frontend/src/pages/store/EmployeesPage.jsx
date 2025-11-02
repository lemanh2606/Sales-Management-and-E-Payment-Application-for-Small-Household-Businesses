import React, { useState, useEffect } from "react";
import { Table, Button, Modal, message } from "antd";
import { useParams } from "react-router-dom";
import EmployeeForm from "../../components/store/EmployeeForm";
import Layout from "../../components/Layout";
import { getEmployeesByStore, createEmployee, updateEmployee } from "../../api/storeApi";

export default function EmployeesPage() {
  const { storeId } = useParams();
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadEmployees = async () => {
    try {
      const res = await getEmployeesByStore(storeId);
      const list = Array.isArray(res) ? res : res?.employees || [];
      setEmployees(list);
    } catch (err) {
      message.error("Không thể tải danh sách nhân viên!");
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [storeId]);

  const handleCreate = () => {
    setMode("create");
    setCurrent(null);
    setOpen(true);
  };

  const handleEdit = (record) => {
    setMode("edit");
    setCurrent(record);
    setOpen(true);
  };

  // const handleSubmit = async (values) => {
  //   setLoading(true);
  //   try {
  //     if (mode === "create") {
  //       await createEmployee(storeId, values);
  //       message.success("Tạo nhân viên thành công!");
  //     } else {
  //       await updateEmployee(storeId, current._id, values);
  //       message.success("Cập nhật nhân viên thành công!");
  //     }
  //     setOpen(false);
  //     loadEmployees();
  //   } catch (err) {
  //     console.error(err);
  //     message.error("Lỗi khi lưu nhân viên!");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      if (mode === "create") {
        await createEmployee(storeId, payload);
        message.success("Tạo nhân viên thành công!");
      } else {
        await updateEmployee(storeId, current._id, payload);
        message.success("Cập nhật nhân viên thành công!");
      }
      setOpen(false);
      loadEmployees();
    } catch (err) {
      console.log(err.response?.data || err);
      message.error("Lỗi khi lưu nhân viên!");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Tên", dataIndex: "fullName", key: "fullName" },
    { title: "Username", key: "username", render: (_, record) => record.user_id?.username || "—" },
    { title: "Email", key: "email", render: (_, record) => record.user_id?.email || "—" },
    { title: "Số điện thoại", key: "phone", render: (_, record) => record.user_id?.phone || "—" },
    { title: "Ca làm việc", dataIndex: "shift", key: "shift" },
    {
      title: "Lương",
      key: "salary",
      render: (_, record) => Number(record.salary ?? 0).toLocaleString(),
    },
    {
      title: "Hoa hồng (%)",
      key: "commission_rate",
      render: (_, record) => Number(record.commission_rate ?? 0).toLocaleString(),
    },
    {
      title: "Hành động",
      render: (_, record) => (
        <Button type="link" onClick={() => handleEdit(record)}>
          Sửa
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Nhân viên cửa hàng</h2>
          <Button type="primary" onClick={handleCreate}>
            + Thêm nhân viên
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={employees}
          rowKey="_id"
          pagination={{
            current: currentPage,
            pageSize,
            total: employees.length,
            showSizeChanger: true,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showTotal: (total, range) => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  fontSize: 14,
                  color: "#555",
                }}
              >
                <div>
                  Đang xem{" "}
                  <span style={{ color: "#1890ff", fontWeight: 600 }}>
                    {range[0]} – {range[1]}
                  </span>{" "}
                  trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> nhân viên
                </div>
              </div>
            ),
          }}
          loading={loading}
          locale={{ emptyText: "Chưa có nhân viên nào" }}
        />

        <Modal
          open={open}
          title={mode === "edit" ? "Cập nhật nhân viên" : "Tạo nhân viên mới"}
          onCancel={() => setOpen(false)}
          footer={null}
          destroyOnClose
        >
          <EmployeeForm mode={mode} initialValues={current} onSubmit={handleSubmit} loading={loading} />
        </Modal>
      </div>
    </Layout>
  );
}
