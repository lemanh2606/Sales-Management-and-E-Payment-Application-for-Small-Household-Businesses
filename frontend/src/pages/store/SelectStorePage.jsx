// src/pages/store/SelectStorePage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Layout,
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Spin,
  Empty,
  Tag,
  Badge,
  notification,
  Pagination,
  AutoComplete,
  Input,
  Statistic,
  Tooltip,
  Segmented,
  Dropdown,
  Menu,
  Divider,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ThunderboltFilled,
  FilterOutlined,
  FireOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  StarFilled,
  UndoOutlined,
} from "@ant-design/icons";
import StoreFormModal from "../../components/store/StoreFormModal";
import StoreDetailModal from "../../components/store/StoreDetailModal";
import { selectStore, createStore, updateStore, deleteStore, getStoresByManager, getStoreById, restoreStore } from "../../api/storeApi";

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

export default function SelectStorePage() {
  const [api, contextHolder] = notification.useNotification();
  const [stores, setStores] = useState([]);
  const [deletedStores, setDeletedStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [storeTab, setStoreTab] = useState("active"); // active | deleted
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  const [storeForm, setStoreForm] = useState({
    name: "",
    address: "",
    phone: "",
    description: "",
    imageUrl: "",
    tagsCsv: "",
    openingHours: { open: "", close: "" },
    location: { lat: null, lng: null },
  });

  const { setCurrentStore, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadStores = async () => {
    setLoading(true);
    try {
      // Lấy cửa hàng active
      const activeRes = await getStoresByManager({ deleted: false });
      const activeList = (activeRes && (activeRes.stores || activeRes.data || activeRes)) || [];
      const activeArr = Array.isArray(activeList) ? activeList : activeList.stores || [];

      // Lấy cửa hàng đã xoá
      const deletedRes = await getStoresByManager({ deleted: true });
      const deletedList = (deletedRes && (deletedRes.stores || deletedRes.data || deletedRes)) || [];
      const deletedArr = Array.isArray(deletedList) ? deletedList : deletedList.stores || [];

      setStores(activeArr);
      setDeletedStores(deletedArr);
      setFilteredStores(activeArr);
    } catch (e) {
      console.error(e);
      api.error({
        message: "❌ Lỗi tải dữ liệu",
        description: e?.response?.data?.message || "Không lấy được danh sách cửa hàng",
        placement: "topRight",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role !== "STAFF") {
      if (typeof setCurrentStore === "function") {
        setCurrentStore(null);
      }
      try {
        localStorage.removeItem("currentStore");
      } catch (e) {
        console.warn("Không thể xóa currentStore", e);
      }
    }
  }, [user, setCurrentStore]);

  useEffect(() => {
    loadStores();
  }, []);

  // Search filter
  useEffect(() => {
    const displayStores = storeTab === "active" ? stores : deletedStores;
    if (!search) {
      setFilteredStores(displayStores);
      setCurrentPage(1);
      return;
    }
    const q = search.trim().toLowerCase();
    const filtered = displayStores.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.address || "").toLowerCase().includes(q) ||
        (s.phone || "").includes(q) ||
        (s.tags || []).join(" ").toLowerCase().includes(q)
    );
    setFilteredStores(filtered);
    setCurrentPage(1);
  }, [search, stores, deletedStores, storeTab]);

  // Suggestions
  const searchOptions = useMemo(() => {
    if (!search.trim()) return [];
    const searchLower = search.toLowerCase().trim();
    const matches = stores
      .filter((store) => {
        const name = (store.name || "").toLowerCase();
        const address = (store.address || "").toLowerCase();
        const phone = (store.phone || "").toLowerCase();
        return name.includes(searchLower) || address.includes(searchLower) || phone.includes(searchLower);
      })
      .slice(0, 8);

    return matches.map((store) => ({
      value: store.name,
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
          <ShopOutlined style={{ color: "#52c41a", fontSize: 16 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{store.name}</div>
            <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {store.address || "Chưa có địa chỉ"}
            </Text>
          </div>
          {store.phone && (
            <Tag color="green" style={{ margin: 0 }}>
              {store.phone}
            </Tag>
          )}
        </div>
      ),
    }));
  }, [search, stores]);

  const handleSelect = async (store) => {
    try {
      setBusy(true);
      const res = await selectStore(store._id);
      let returnedStore = (res && (res.store || res.data?.store || res.data)) || (res && res._id ? res : null) || store;

      try {
        const prev = localStorage.getItem("currentStore");
        if (prev) localStorage.setItem("previousStore", prev);
        localStorage.setItem("currentStore", JSON.stringify(returnedStore));
      } catch (e) {
        console.warn("Lưu store thất bại:", e);
      }

      try {
        if (typeof setCurrentStore === "function") {
          await setCurrentStore(returnedStore);
        }
      } catch (e) {
        console.warn("Không thể cập nhật context:", e);
      }

      api.success({
        message: "✅ Chọn cửa hàng thành công!",
        description: `Đã chọn "${store.name}"`,
        placement: "topRight",
        duration: 2,
      });

      navigate(`/dashboard/${store._id}`, { replace: true });
    } catch (e) {
      console.error(e);
      api.error({
        message: "❌ Lỗi chọn cửa hàng",
        description: e?.response?.data?.message || e?.message,
        placement: "topRight",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () => {
    setEditingStore(null);
    setStoreForm({
      name: "",
      address: "",
      phone: "",
      description: "",
      imageUrl: "",
      tagsCsv: "",
      openingHours: { open: "", close: "" },
      location: { lat: null, lng: null },
    });
    setShowModal(true);
  };

  const handleEdit = (store) => {
    setEditingStore(store);
    setStoreForm({
      name: store.name || "",
      address: store.address || "",
      phone: store.phone || "",
      description: store.description || "",
      imageUrl: store.imageUrl || "",
      tagsCsv: Array.isArray(store.tags) ? store.tags.join(", ") : store.tags || "",
      openingHours: {
        open: store.openingHours?.open ?? "",
        close: store.openingHours?.close ?? "",
      },
      location: {
        lat: store.location?.lat != null ? Number(store.location.lat) : null,
        lng: store.location?.lng != null ? Number(store.location.lng) : null,
      },
    });
    setShowModal(true);
  };

  const handleSave = async (payloadFromModal) => {
    const final = payloadFromModal || {
      name: storeForm.name,
      address: storeForm.address,
      phone: storeForm.phone,
      description: storeForm.description,
      imageUrl: storeForm.imageUrl,
      tags: (storeForm.tagsCsv || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      openingHours: {
        open: storeForm.openingHours?.open ?? "",
        close: storeForm.openingHours?.close ?? "",
      },
      location: {
        lat: storeForm.location?.lat != null ? Number(storeForm.location.lat) : null,
        lng: storeForm.location?.lng != null ? Number(storeForm.location.lng) : null,
      },
    };

    if (!final.name || !final.address) {
      api.warning({
        message: "⚠️ Thiếu thông tin",
        description: "Vui lòng nhập tên và địa chỉ cửa hàng",
        placement: "topRight",
      });
      return;
    }

    try {
      setBusy(true);
      if (editingStore) {
        await updateStore(editingStore._id, final);
        api.success({
          message: "✅ Cập nhật thành công!",
          description: `Đã cập nhật "${final.name}"`,
          placement: "topRight",
        });
      } else {
        await createStore(final);
        api.success({
          message: "✅ Tạo mới thành công!",
          description: `Đã thêm "${final.name}"`,
          placement: "topRight",
        });
      }
      setShowModal(false);
      setEditingStore(null);
      await loadStores();
    } catch (e) {
      console.error(e);
      api.error({
        message: "❌ Lỗi lưu cửa hàng",
        description: e?.response?.data?.message || "Không thể lưu cửa hàng",
        placement: "topRight",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDetail = async (storeId) => {
    setSelectedStore(null);
    try {
      setBusy(true);
      const res = await getStoreById(storeId);
      const detail = (res && (res.store || res.data || res)) || null;
      setSelectedStore(detail);
      setShowDetailModal(true);
    } catch (e) {
      const cached = stores.find((s) => s._id === storeId) || null;
      setSelectedStore(cached);
      setShowDetailModal(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (storeId) => {
    try {
      setBusy(true);
      await deleteStore(storeId);
      setShowDetailModal(false);
      api.success({
        message: "✅ Xóa thành công!",
        placement: "topRight",
      });
      await loadStores();
    } catch (e) {
      api.error({
        message: "❌ Lỗi xóa cửa hàng",
        description: e?.response?.data?.message || "Không thể xóa cửa hàng",
        placement: "topRight",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (storeId) => {
    try {
      setBusy(true);
      await restoreStore(storeId);
      api.success({
        message: "✅ Khôi phục cửa hàng thành công!",
        placement: "topRight",
      });
      setShowDetailModal(false);
      await loadStores();
    } catch (e) {
      api.error({
        message: "❌ Lỗi khôi phục cửa hàng",
        description: e?.response?.data?.message || "Không thể khôi phục cửa hàng",
        placement: "topRight",
      });
    } finally {
      setBusy(false);
    }
  };

  const paginatedStores = filteredStores.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Filter dropdown (demo)
  const filterMenu = (
    <Menu
      items={[
        { key: "all", label: "Tất cả" },
        { key: "hasPhone", label: "Có số điện thoại" },
        { key: "hasAddress", label: "Có địa chỉ" },
      ]}
      onClick={({ key }) => {
        if (key === "all") setFilteredStores(stores);
        if (key === "hasPhone") setFilteredStores(stores.filter((s) => s.phone));
        if (key === "hasAddress") setFilteredStores(stores.filter((s) => s.address));
        setCurrentPage(1);
      }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {contextHolder}
      <Content style={{ padding: isMobile ? "12px" : "32px 48px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Hero Header Section */}
          <div
            style={{
              marginBottom: 32,
              borderRadius: 24,
              background: "linear-gradient(135deg, #3f59cdff 10%, #7dd44e 90%)",
              padding: isMobile ? "32px 20px" : "48px 40px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(102, 126, 234, 0.3)",
            }}
          >
            {/* Decorative Elements */}
            <div
              style={{
                position: "absolute",
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.1)",
                filter: "blur(40px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -30,
                left: -30,
                width: 150,
                height: 150,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.1)",
                filter: "blur(40px)",
              }}
            />

            <Row gutter={[24, 24]} align="middle" style={{ position: "relative", zIndex: 1 }}>
              <Col xs={24} lg={14}>
                <Space direction="vertical" size={12}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: "rgba(255, 255, 255, 0.2)",
                        backdropFilter: "blur(10px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShopOutlined style={{ fontSize: 28, color: "#fff" }} />
                    </div>
                    <div>
                      <Title level={2} style={{ color: "#fff", margin: 0, fontSize: isMobile ? 24 : 32 }}>
                        Cửa Hàng Của Bạn
                      </Title>
                      <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 15 }}>Quản lý và điều hành cửa hàng một cách hiệu quả</Text>
                    </div>
                  </div>
                </Space>
              </Col>

              <Col xs={24} lg={10}>
                <Row gutter={[16, 16]}>
                  <Col xs={12}>
                    <Card
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: 16,
                      }}
                      bodyStyle={{ padding: 20 }}
                    >
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>Tổng Cửa Hàng</span>}
                        value={stores.length}
                        prefix={<FireOutlined style={{ color: "#ffd666" }} />}
                        valueStyle={{ color: "#fff", fontSize: 28, fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={12}>
                    <Card
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: 16,
                      }}
                      bodyStyle={{ padding: 20 }}
                    >
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>Kết Quả Lọc</span>}
                        value={filteredStores.length}
                        prefix={<SearchOutlined style={{ color: "#95de64" }} />}
                        valueStyle={{ color: "#fff", fontSize: 28, fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>

          {/* Control Bar - Modern Search & Filters */}
          <Card
            style={{
              marginBottom: 24,
              borderRadius: 20,
              border: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
            bodyStyle={{ padding: isMobile ? "16px" : "24px" }}
          >
            {/* Tab Navigation */}
            <div style={{ marginBottom: 20, display: "flex", gap: 8, borderBottom: "2px solid #f0f0f0", paddingBottom: 12 }}>
              <Button
                type={storeTab === "active" ? "primary" : "default"}
                onClick={() => {
                  setStoreTab("active");
                  setSearch("");
                  setCurrentPage(1);
                }}
                icon={<ShopOutlined />}
                style={{
                  borderRadius: 10,
                  height: 40,
                  paddingLeft: 16,
                  paddingRight: 16,
                  fontWeight: 600,
                  background: storeTab === "active" ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "#fff",
                  border: storeTab === "active" ? "none" : "1px solid #d9d9d9",
                  color: storeTab === "active" ? "#fff" : "#262626",
                }}
              >
                Cửa Hàng Hoạt Động ({stores.length})
              </Button>
              <Button
                type={storeTab === "deleted" ? "primary" : "default"}
                onClick={() => {
                  setStoreTab("deleted");
                  setSearch("");
                  setCurrentPage(1);
                }}
                icon={<UndoOutlined />}
                style={{
                  borderRadius: 10,
                  height: 40,
                  paddingLeft: 16,
                  paddingRight: 16,
                  fontWeight: 600,
                  background: storeTab === "deleted" ? "linear-gradient(135deg, #fa541c 0%, #ff7a45 100%)" : "#fff",
                  border: storeTab === "deleted" ? "none" : "1px solid #d9d9d9",
                  color: storeTab === "deleted" ? "#fff" : "#262626",
                }}
              >
                Cửa Hàng Đã Xoá ({deletedStores.length})
              </Button>
            </div>

            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} lg={13}>
                <AutoComplete
                  value={search}
                  options={searchOptions}
                  onChange={(value) => setSearch(value)}
                  onSelect={(value) => setSearch(value)}
                  style={{ width: "100%" }}
                  allowClear
                  popupMatchSelectWidth={isMobile ? true : 500}
                >
                  <Input
                    size="large"
                    prefix={
                      <SearchOutlined
                        style={{
                          color: "#667eea",
                          fontSize: 20,
                          marginRight: 8,
                        }}
                      />
                    }
                    suffix={
                      filteredStores.length !== (storeTab === "active" ? stores.length : deletedStores.length) && (
                        <Badge
                          count={filteredStores.length}
                          style={{
                            backgroundColor: "#667eea",
                            boxShadow: "0 2px 8px rgba(102, 126, 234, 0.4)",
                          }}
                        />
                      )
                    }
                    style={{
                      borderRadius: 12,
                      height: 48,
                      border: "2px solid #f0f0f0",
                      transition: "all 0.3s ease",
                    }}
                  />
                </AutoComplete>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <Segmented
                  options={[
                    {
                      label: isMobile ? "Grid" : "Lưới",
                      value: "grid",
                      icon: <AppstoreOutlined />,
                    },
                    {
                      label: isMobile ? "List" : "Danh Sách",
                      value: "list",
                      icon: <UnorderedListOutlined />,
                    },
                  ]}
                  value={viewMode}
                  onChange={setViewMode}
                  block
                  size="large"
                  style={{ height: 48, borderRadius: 12 }}
                />
              </Col>

              <Col xs={24} sm={12} lg={5}>
                <Space.Compact style={{ width: "100%" }} size="large">
                  <Dropdown overlay={filterMenu} trigger={["click"]}>
                    <Button
                      icon={<FilterOutlined />}
                      style={{
                        width: "50%",
                        height: 48,
                        borderRadius: "12px 0 0 12px",
                        fontWeight: 500,
                      }}
                    >
                      Lọc
                    </Button>
                  </Dropdown>
                  <Button
                    icon={<ReloadOutlined />}
                    style={{
                      width: "50%",
                      height: 48,
                      borderRadius: "0 12px 12px 0",
                      fontWeight: 500,
                    }}
                    onClick={loadStores}
                  >
                    Tải Lại
                  </Button>
                </Space.Compact>
              </Col>
            </Row>

            <Divider style={{ margin: "20px 0 16px 0" }} />

            <Row justify="space-between" align="middle">
              <Col>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Hiển thị{" "}
                  <Text strong style={{ color: "#667eea" }}>
                    {paginatedStores.length}
                  </Text>{" "}
                  trong tổng số{" "}
                  <Text strong style={{ color: "#667eea" }}>
                    {filteredStores.length}
                  </Text>{" "}
                  cửa hàng {storeTab === "deleted" ? "đã xoá" : ""}
                </Text>
              </Col>
              {storeTab === "active" && (
                <Col>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    size="large"
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      border: "none",
                      borderRadius: 12,
                      height: 48,
                      paddingLeft: 24,
                      paddingRight: 24,
                      fontWeight: 600,
                      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                    }}
                  >
                    Thêm Cửa Hàng
                  </Button>
                </Col>
              )}
            </Row>
          </Card>

          {/* Content Area */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>
              <Spin size="large" tip={<Text style={{ marginTop: 16, fontSize: 16, color: "#667eea" }}>Đang tải danh sách cửa hàng...</Text>} />
            </div>
          ) : filteredStores.length === 0 ? (
            <Card
              style={{
                borderRadius: 20,
                textAlign: "center",
                padding: "80px 20px",
                border: "2px dashed #d9d9d9",
                background: "#fafafa",
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                imageStyle={{ height: 120 }}
                description={
                  <Space direction="vertical" size={16}>
                    <Title level={3} style={{ margin: 0, color: "#8c8c8c" }}>
                      {search ? "🔍 Không Tìm Thấy Cửa Hàng" : "🏪 Chưa Có Cửa Hàng"}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 15 }}>
                      {search
                        ? "Thử từ khóa khác hoặc xóa bộ lọc để xem tất cả cửa hàng"
                        : "Tạo cửa hàng đầu tiên để bắt đầu quản lý bán hàng của bạn"}
                    </Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAdd}
                      size="large"
                      style={{
                        marginTop: 8,
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        border: "none",
                        borderRadius: 12,
                        height: 48,
                        paddingLeft: 32,
                        paddingRight: 32,
                        fontWeight: 600,
                      }}
                    >
                      Thêm Cửa Hàng Ngay
                    </Button>
                  </Space>
                }
              />
            </Card>
          ) : viewMode === "grid" ? (
            <>
              <Row gutter={[20, 20]}>
                {paginatedStores.map((store) => (
                  <Col xs={24} sm={12} lg={8} xl={6} key={store._id}>
                    <Card
                      hoverable
                      style={{
                        borderRadius: 20,
                        overflow: "hidden",
                        height: "100%",
                        border: "none",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                      bodyStyle={{ padding: 0 }}
                      className="store-card-modern"
                      onClick={() => handleDetail(store._id)}
                    >
                      {/* Cover Image */}
                      <div
                        style={{
                          height: 180,
                          background: store.imageUrl ? `url(${store.imageUrl}) center/cover` : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          position: "relative",
                        }}
                      >
                        {!store.imageUrl && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(0,0,0,0.1)",
                            }}
                          >
                            <ShopOutlined
                              style={{
                                fontSize: 64,
                                color: "rgba(255,255,255,0.4)",
                              }}
                            />
                          </div>
                        )}

                        {/* Overlay Gradient */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 80,
                            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
                          }}
                        />

                        {/* Tags Badge */}
                        {store.tags && store.tags.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 12,
                              left: 12,
                              background: "rgba(255,255,255,0.95)",
                              backdropFilter: "blur(10px)",
                              padding: "6px 12px",
                              borderRadius: 20,
                              fontWeight: 600,
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }}
                          >
                            <StarFilled style={{ color: "#faad14" }} />
                            <span>{store.tags.length} tags</span>
                          </div>
                        )}

                        {/* Active Badge */}
                        <Badge
                          count="Active"
                          style={{
                            backgroundColor: "#52c41a",
                            position: "absolute",
                            top: 12,
                            right: 12,
                            boxShadow: "0 2px 8px rgba(82, 196, 26, 0.4)",
                          }}
                        />
                      </div>

                      {/* Card Content */}
                      <div style={{ padding: 20 }}>
                        <Space direction="vertical" size={12} style={{ width: "100%" }}>
                          {/* Store Name */}
                          <Title
                            level={5}
                            ellipsis={{ rows: 1 }}
                            style={{
                              margin: 0,
                              fontSize: 17,
                              fontWeight: 700,
                              color: "#262626",
                            }}
                          >
                            {store.name}
                          </Title>

                          {/* Address */}
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <EnvironmentOutlined
                              style={{
                                color: "#667eea",
                                fontSize: 16,
                                marginTop: 2,
                                flexShrink: 0,
                              }}
                            />
                            <Text ellipsis={{ rows: 2 }} type="secondary" style={{ fontSize: 13, lineHeight: "1.5" }}>
                              {store.address || "Chưa có địa chỉ"}
                            </Text>
                          </div>

                          {/* Phone */}
                          {store.phone && (
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <PhoneOutlined style={{ color: "#52c41a", fontSize: 15 }} />
                              <Text style={{ fontSize: 13, fontWeight: 500 }}>{store.phone}</Text>
                            </div>
                          )}

                          {/* Tags */}
                          {store.tags && store.tags.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                              {store.tags.slice(0, 3).map((tag, idx) => (
                                <Tag
                                  key={idx}
                                  color="purple"
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 10px",
                                    margin: 0,
                                    borderRadius: 12,
                                    border: "none",
                                  }}
                                >
                                  {tag}
                                </Tag>
                              ))}
                              {store.tags.length > 3 && (
                                <Tag
                                  style={{
                                    fontSize: 11,
                                    padding: "2px 10px",
                                    borderRadius: 12,
                                    background: "#f0f0f0",
                                    border: "none",
                                  }}
                                >
                                  +{store.tags.length - 3}
                                </Tag>
                              )}
                            </div>
                          )}

                          <Divider style={{ margin: "8px 0" }} />

                          {/* Action Buttons */}
                          <Row gutter={8}>
                            <Col span={14}>
                              <Button
                                type="primary"
                                icon={<ThunderboltFilled />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(store);
                                }}
                                loading={busy}
                                disabled={store.deleted}
                                block
                                style={{
                                  background: store.deleted ? "#ccc" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                  border: "none",
                                  borderRadius: 10,
                                  fontWeight: 600,
                                  height: 40,
                                  fontSize: 13,
                                  boxShadow: store.deleted ? "none" : "0 4px 12px rgba(102, 126, 234, 0.3)",
                                  cursor: store.deleted ? "not-allowed" : "pointer",
                                }}
                                title={store.deleted ? "Cửa hàng đã bị xóa, vui lòng khôi phục trước" : "Chọn cửa hàng này"}
                              >
                                Chọn
                              </Button>
                            </Col>
                            <Col span={5}>
                              <Tooltip title="Xem Chi Tiết">
                                <Button
                                  icon={<EyeOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDetail(store._id);
                                  }}
                                  block
                                  style={{
                                    borderRadius: 10,
                                    height: 40,
                                    border: "2px solid #f0f0f0",
                                  }}
                                />
                              </Tooltip>
                            </Col>
                            <Col span={5}>
                              <Tooltip title="Chỉnh Sửa">
                                <Button
                                  icon={<EditOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(store);
                                  }}
                                  block
                                  disabled={store.deleted}
                                  style={{
                                    borderRadius: 10,
                                    height: 40,
                                    border: "2px solid #f0f0f0",
                                    cursor: store.deleted ? "not-allowed" : "pointer",
                                  }}
                                />
                              </Tooltip>
                            </Col>
                          </Row>
                        </Space>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* Pagination */}
              {filteredStores.length > pageSize && (
                <div style={{ textAlign: "center", marginTop: 40 }}>
                  <Pagination
                    current={currentPage}
                    total={filteredStores.length}
                    pageSize={pageSize}
                    onChange={setCurrentPage}
                    showSizeChanger={false}
                    simple={isMobile}
                    style={{
                      display: "inline-block",
                      padding: "12px 24px",
                      background: "#fff",
                      borderRadius: 16,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            // List View Mode
            <>
              <Card
                style={{
                  borderRadius: 20,
                  border: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
                bodyStyle={{ padding: 0 }}
              >
                {paginatedStores.map((store, idx) => (
                  <div
                    key={store._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      padding: isMobile ? "16px" : "20px 24px",
                      borderBottom: idx === paginatedStores.length - 1 ? "none" : "1px solid #f0f0f0",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      background: "#fff",
                    }}
                    className="store-list-item"
                    onClick={() => handleDetail(store._id)}
                  >
                    {/* Store Avatar/Image */}
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 16,
                        background: store.imageUrl ? `url(${store.imageUrl}) center/cover` : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        position: "relative",
                        flexShrink: 0,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    >
                      {!store.imageUrl && (
                        <ShopOutlined
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            fontSize: 32,
                            color: "rgba(255,255,255,0.9)",
                          }}
                        />
                      )}
                    </div>

                    {/* Store Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Title
                        level={5}
                        style={{
                          margin: 0,
                          marginBottom: 8,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#262626",
                        }}
                      >
                        {store.name}
                      </Title>

                      <Space size={16} wrap style={{ fontSize: 13 }}>
                        <Text type="secondary">
                          <EnvironmentOutlined style={{ marginRight: 6, color: "#667eea" }} />
                          {store.address || "Chưa có địa chỉ"}
                        </Text>

                        {store.phone && (
                          <Text type="secondary">
                            <PhoneOutlined style={{ marginRight: 6, color: "#52c41a" }} />
                            {store.phone}
                          </Text>
                        )}

                        {store.tags && store.tags.length > 0 && (
                          <Space size={4} wrap>
                            {store.tags.slice(0, 3).map((tag, i) => (
                              <Tag
                                key={i}
                                color="purple"
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  padding: "2px 10px",
                                  borderRadius: 12,
                                  border: "none",
                                }}
                              >
                                {tag}
                              </Tag>
                            ))}
                            {store.tags.length > 3 && (
                              <Tag
                                style={{
                                  margin: 0,
                                  fontSize: 11,
                                  padding: "2px 10px",
                                  borderRadius: 12,
                                  background: "#f0f0f0",
                                  border: "none",
                                }}
                              >
                                +{store.tags.length - 3}
                              </Tag>
                            )}
                          </Space>
                        )}
                      </Space>
                    </div>

                    {/* Actions */}
                    {!isMobile && (
                      <Space size={8}>
                        <Button
                          type="primary"
                          icon={<ThunderboltFilled />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(store);
                          }}
                          loading={busy}
                          disabled={store.deleted}
                          style={{
                            background: store.deleted ? "#ccc" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            border: "none",
                            borderRadius: 10,
                            fontWeight: 600,
                            height: 40,
                            paddingLeft: 20,
                            paddingRight: 20,
                            boxShadow: store.deleted ? "none" : "0 4px 12px rgba(102, 126, 234, 0.3)",
                            cursor: store.deleted ? "not-allowed" : "pointer",
                          }}
                          title={store.deleted ? "Cửa hàng đã bị xóa, vui lòng khôi phục trước" : ""}
                        >
                          Chọn
                        </Button>
                        <Button
                          icon={<EyeOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDetail(store._id);
                          }}
                          style={{
                            borderRadius: 10,
                            height: 40,
                            border: "2px solid #f0f0f0",
                          }}
                        />
                        <Button
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(store);
                          }}
                          disabled={store.deleted}
                          style={{
                            borderRadius: 10,
                            height: 40,
                            border: "2px solid #f0f0f0",
                            cursor: store.deleted ? "not-allowed" : "pointer",
                          }}
                        />
                      </Space>
                    )}
                  </div>
                ))}
              </Card>

              {/* Pagination */}
              {filteredStores.length > pageSize && (
                <div style={{ textAlign: "center", marginTop: 32 }}>
                  <Pagination
                    current={currentPage}
                    total={filteredStores.length}
                    pageSize={pageSize}
                    onChange={setCurrentPage}
                    showSizeChanger={false}
                    simple={isMobile}
                    style={{
                      display: "inline-block",
                      padding: "12px 24px",
                      background: "#fff",
                      borderRadius: 16,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Content>

      {/* Modals */}
      <StoreFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        form={storeForm}
        setForm={setStoreForm}
        onSave={handleSave}
        busy={busy}
        title={editingStore ? "Sửa Cửa Hàng" : "Thêm Cửa Hàng"}
      />

      <StoreDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        store={selectedStore}
        onEdit={(s) => handleEdit(s)}
        onSelect={(s) => handleSelect(s)}
        onDelete={(id) => handleDelete(id)}
        onRestore={(id) => handleRestore(id)}
      />

      {/* Custom Styles */}
      <style jsx global>{`
        .store-card-modern:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 40px rgba(102, 126, 234, 0.25) !important;
        }

        .store-list-item:hover {
          background: #fafafa !important;
          padding-left: 28px !important;
        }

        .ant-input:focus,
        .ant-input-focused {
          border-color: #667eea !important;
          box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1) !important;
        }

        .ant-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;
        }

        .ant-segmented-item-selected {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: #fff !important;
        }
      `}</style>
    </Layout>
  );
}
