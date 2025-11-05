// src/pages/setting/FileManager.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Upload,
  Button,
  Table,
  Space,
  Typography,
  Spin,
  Alert,
  Modal,
  Input,
  Select,
  Tag,
  Checkbox,
  Image,
  message,
  Popconfirm,
  Tooltip,
  Empty,
} from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileOutlined,
  FolderOutlined,
  CodeOutlined,
  SearchOutlined,
  FileMarkdownOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

const { Dragger } = Upload;
const { Text, Title } = Typography;
const { Option } = Select;

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterExtension, setFilterExtension] = useState("all");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }; 

  // đặt màu cho icon file mặc định vì ko preview được document
  const getFileIcon = (type, extension) => {
    if (type.includes("image")) return <FileImageOutlined style={{ color: "#1890ff", fontSize: 32 }} />;
    if (type.includes("video") || type.includes("audio"))
      return <FileTextOutlined style={{ color: "#722ed1", fontSize: 32 }} />;
    if (extension === "pdf") return <FilePdfOutlined style={{ color: "#ff4d4f", fontSize: 32 }} />;
    if (["xls", "xlsx", "csv"].includes(extension))
      return <FileExcelOutlined style={{ color: "#52c41a", fontSize: 32 }} />;
    if (["doc", "docx"].includes(extension)) return <FileTextOutlined style={{ color: "#52c41a", fontSize: 32 }} />;
    if (["txt", "md"].includes(extension)) return <FileMarkdownOutlined style={{ color: "#13c2c2", fontSize: 32 }} />;
    if (["js", "ts", "json", "html", "css", "jsx", "tsx"].includes(extension))
      return <CodeOutlined style={{ color: "#eb2f96", fontSize: 32 }} />;
    if (["zip", "rar", "7z"].includes(extension)) return <FileOutlined style={{ color: "#faad14", fontSize: 32 }} />;
    return <FileOutlined style={{ color: "#8c8c8c", fontSize: 32 }} />;
  };

  // FETCH FILES
  const fetchFiles = async () => {
    if (!currentStore?._id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/files/store/${currentStore._id}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      setFiles(res.data.data || res.data || []);
      setFilteredFiles(res.data.data || res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tải file");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentStore._id]);
  //đặt lại phân trang khi danh sách lọc thay đổi
  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [filteredFiles]);

  // REALTIME FILTER
  useEffect(() => {
    let result = files;
    // Tìm theo tên + tag
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(lower));
    }
    // Lọc loại
    if (filterCategory !== "all") {
      result = result.filter((f) => f.category === filterCategory);
    }
    // Lọc đuôi
    if (filterExtension !== "all") {
      result = result.filter((f) => f.extension === filterExtension);
    }

    setFilteredFiles(result);
  }, [searchText, filterCategory, filterExtension, files]);

  // Chuyển tiếng Việt có dấu sang không dấu
  const removeVietnameseTones = (str) => {
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // bỏ dấu
    str = str.replace(/đ/g, "d").replace(/Đ/g, "D");
    return str;
  };

  // Tạo slug file
  const slugifyFileName = (fileName) => {
    const lastDot = fileName.lastIndexOf(".");
    const name = fileName.substring(0, lastDot);
    const ext = fileName.substring(lastDot); // giữ đuôi file
    const clean = removeVietnameseTones(name)
      .replace(/\s+/g, "-") // thay khoảng trắng thành -
      .replace(/[^a-zA-Z0-9-_]/g, "") // bỏ ký tự đặc biệt
      .replace(/-+/g, "-"); // loại bỏ nhiều dấu -
    return clean + ext;
  };

  // UPLOAD PROPS
  const uploadProps = {
    name: "file",
    multiple: true,
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true);
      const formData = new FormData();
      const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
      if (!currentStore?._id) {
        message.error("Chưa chọn cửa hàng!");
        onError("Missing storeId");
        setUploading(false);
        return;
      }
      formData.append("file", file, slugifyFileName(file.name)); //để ko lỗi tên tiếng việt
      formData.append("storeId", currentStore._id);

      try {
        const token = localStorage.getItem("token");
        const res = await axios.post(`http://localhost:9999/api/files/upload?storeId=${currentStore._id}`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        console.log("Upload response:", res.data);
        // 🪄 Cập nhật danh sách ngay lập tức:
        if (res.data?.file) {
          setFiles((prev) => [res.data.file, ...prev]);
          setFilteredFiles((prev) => [res.data.file, ...prev]);
        }
        message.success(`${file.name} uploaded!`);
        fetchFiles();
        onSuccess(res.data);
      } catch (err) {
        const backendMsg = err?.response?.data?.message;
        if (backendMsg) {
          // Nếu backend trả message, show lên bằng SweetAlert đẹp hơn
          Swal.fire({
            icon: "error",
            title: "Không thể upload file!",
            text: backendMsg,
            confirmButtonText: "Đã hiểu",
          });
        } else {
          // fallback nếu lỗi không từ backend
          message.error(`${file.name} upload failed!`);
        }
        onError(err);
      } finally {
        setUploading(false);
      }
    },
  };

  // SELECT ALL
  const selectAll = () => {
    setSelectedKeys(filteredFiles.map((f) => f._id));
  };

  const deselectAll = () => {
    setSelectedKeys([]);
  };

  // Xoá các lựa chọn tick checkbox
  const deleteSelected = async () => {
    if (selectedKeys.length === 0) {
      message.warning("Chưa chọn file nào để xoá!");
      return;
    }

    const result = await Swal.fire({
      title: `Bạn có chắc muốn xóa ${selectedKeys.length} file đã chọn?`,
      text: "Lưu ý hành động này không thể hoàn tác!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Xoá file",
      cancelButtonText: "Không phải bây giờ",
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        await Promise.all(
          selectedKeys.map((id) =>
            axios.delete(`http://localhost:9999/api/files/${id}?storeId=${currentStore._id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          )
        );
        await Swal.fire("Đã xóa!", "Các file đã được xoá thành công.", "success");
        fetchFiles();
        setSelectedKeys([]);
      } catch (err) {
        console.error("❌ Lỗi xoá hàng loạt:", err);
        Swal.fire("Lỗi!", "Không thể xoá file, thử lại sau.", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  // DOWNLOAD FILE Về
  // DOWNLOAD FILE về, luôn ép trình duyệt tải xuống (kể cả ảnh/video/pdf)
  const downloadFile = async (url, name) => {
    try {
      const response = await axios.get(url, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      // cleanup
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Lỗi tải file:", err);
      message.error("Không thể tải file!");
    }
  };

  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedKeys.length === filteredFiles.length && filteredFiles.length > 0}
          onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
        />
      ),
      key: "select",
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedKeys.includes(record._id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedKeys([...selectedKeys, record._id]);
            } else {
              setSelectedKeys(selectedKeys.filter((k) => k !== record._id));
            }
          }}
        />
      ),
    },
    {
      title: "File",
      key: "preview",
      width: 100,
      render: (_, record) => (
        <div style={{ position: "relative", display: "inline-block" }}>
          {record.type.includes("image") ? (
            <Image src={record.url} width={50} height={50} style={{ objectFit: "cover", borderRadius: 8 }} />
          ) : (
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 8,
                background: "linear-gradient(135deg, #e0e0e0, #fafafa)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {getFileIcon(record.type, record.extension)}
            </div>
          )}
          <span
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              background: "#1890ff",
              color: "#fff",
              fontSize: 10,
              padding: "1px 4px",
              borderRadius: 4,
            }}
          >
            {record.extension.toUpperCase()}
          </span>
        </div>
      ),
    },
    {
      title: "Tên file",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong ellipsis={{ tooltip: record.originalName }}>
            {record.name}
          </Text>
          <Text style={{ fontSize: 13, color: "#4a4848ff" }}>
            {formatBytes(record.size)} • {record.extension.toUpperCase()}
          </Text>
        </Space>
      ),
    },
    {
      title: "Loại file",
      dataIndex: "category",
      key: "category",
      width: 150,
      render: (cat) => {
        const mapVN = {
          image: "Ảnh",
          video: "Video",
          document: "Tài liệu",
          other: "Khác",
        };
        return (
          <Tag
            color={cat === "image" ? "blue" : cat === "document" ? "green" : "purple"}
            style={{ fontSize: 14, padding: "4px 10px", borderRadius: 6 }}
          >
            {mapVN[cat] || cat} {/* fallback nếu có category lạ */}
          </Tag>
        );
      },
    },
    {
      title: "Upload bởi",
      key: "uploader",
      width: 190,
      render: (_, record) => (
        <Text type="secondary">
          <Text style={{ fontSize: 17, color: "blue" }}>{record.uploadedBy?.username || "Manager"}</Text>
          <br />
          <Text style={{ fontSize: 13 }}>{dayjs(record.createdAt).format("DD/MM/YYYY HH:mm")}</Text>
        </Text>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem">
            <Button size="small" icon={<EyeOutlined />} onClick={() => window.open(record.url, "_blank")} />
          </Tooltip>
          <Tooltip title="Tải xuống">
            <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadFile(record.url, record.name)} />
          </Tooltip>
          <Popconfirm
            title="Xóa file này?"
            onConfirm={async () => {
              try {
                const token = localStorage.getItem("token");
                await axios.delete(`http://localhost:9999/api/files/${record._id}?storeId=${currentStore._id}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                message.success("Xóa thành công!");
                fetchFiles();
              } catch (err) {
                message.error("Lỗi xóa!");
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <div>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* HEADER */}
          <Card>
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Title level={2} style={{ margin: 1, color: "#1890ff" }}>
                  {currentStore.name || "Đang tải..."}
                </Title>
                <Text strong>
                  <FolderOutlined /> Quản Lý File
                </Text>
              </Col>
              <Col span={16} style={{ textAlign: "right" }}>
                <Space>
                  <Input
                    placeholder="Tìm kiếm tên file không dấu, ngăn cách bởi dấu ' - '"
                    prefix={<SearchOutlined />}
                    allowClear
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 380 }}
                  />
                  <Select placeholder="Lọc loại file" style={{ width: 140 }} onChange={setFilterCategory} allowClear>
                    <Option value="image">Hình ảnh</Option>
                    <Option value="document">Tài liệu</Option>
                    <Option value="video">Video</Option>
                    <Option value="other">Khác</Option>
                  </Select>
                  <Select placeholder="Lọc đuôi file" style={{ width: 140 }} onChange={setFilterExtension} allowClear>
                    <Option value="jpg">JPG</Option>
                    <Option value="png">PNG</Option>
                    <Option value="pdf">PDF</Option>
                    <Option value="docx">DOCX</Option>
                  </Select>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Khu vực tải file, thả file  */}
          <Card>
            <Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: "#1890ff" }} />
              </p>
              <p className="ant-upload-text">Kéo, thả file vào đây hoặc nhấn để upload</p>
              <p className="ant-upload-hint">Hỗ trợ nhiều file: hình ảnh, PDF, video...</p>
            </Dragger>
          </Card>

          {/* Phần TOOLBAR nếu tick vào checkbox */}
          {selectedKeys.length > 0 && (
            <Card style={{ background: "#fff1f0" }}>
              <Space>
                <Text strong>
                  Đã chọn <Tag color="red">{selectedKeys.length}</Tag> file
                </Text>
                <Button danger icon={<DeleteOutlined />} onClick={deleteSelected}>
                  Xóa lựa chọn
                </Button>
                <Button onClick={deselectAll}>Bỏ chọn</Button>
              </Space>
            </Card>
          )}

          {loading && <Spin tip="Đang tải file..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon />}

          {/* Danh sách các File đã tải lên */}
          <Card
            title={
              <>
                Danh sách các File đã tải lên.&nbsp;
                <span
                  style={{
                    backgroundColor: "#e6f7ff",
                    color: "#1890ff",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    border: "1px solid #91d5ff",
                    fontWeight: 600,
                  }}
                >
                  Tổng có: {filteredFiles.length} file
                </span>
              </>
            }
          >
            {filteredFiles.length === 0 ? (
              <Empty description="Chưa có file nào. Hãy upload ngay!" />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredFiles}
                rowKey="_id"
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                  onChange: (page, pageSize) => {
                    setPagination({ current: page, pageSize });
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
                        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> file
                      </div>
                    </div>
                  ),
                }}
                scroll={{ x: 1000 }}
              />
            )}
          </Card>
        </Space>
      </div>
    </Layout>
  );
};

export default FileManager;
