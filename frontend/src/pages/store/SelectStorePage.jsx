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
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import StoreFormModal from "../../components/store/StoreFormModal";
import StoreDetailModal from "../../components/store/StoreDetailModal";
import {
  selectStore,
  createStore,
  updateStore,
  deleteStore,
  getStoresByManager,
  getStoreById,
} from "../../api/storeApi";

const { Content } = Layout;
const { Title, Text } = Typography;

export default function SelectStorePage() {
  const [api, contextHolder] = notification.useNotification();
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12); // Increased from 6 to 12
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
      const res = await getStoresByManager();
      const list = (res && (res.stores || res.data || res)) || [];
      const arr = Array.isArray(list) ? list : list.stores || [];
      const activeList = arr.filter((s) => !s?.deleted);
      setStores(activeList);
      setFilteredStores(activeList);
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

  useEffect(() => {
    if (!search) {
      setFilteredStores(stores);
      setCurrentPage(1);
      return;
    }
    const q = search.trim().toLowerCase();
    const filtered = stores.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.address || "").toLowerCase().includes(q) ||
        (s.phone || "").includes(q) ||
        (s.tags || []).join(" ").toLowerCase().includes(q)
    );
    setFilteredStores(filtered);
    setCurrentPage(1);
  }, [search, stores]);

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
      .slice(0, 6);

    return matches.map((store) => ({
      value: store.name,
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
          <ShopOutlined style={{ color: "#52c41a", fontSize: 16 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{store.name}</div>
            <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {store.address || "Chưa có địa chỉ"}
            </Text>
          </div>
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

      navigate(`/dashboard/${store._id}`);
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
      tags: (storeForm.tagsCsv || "").split(",").map((t) => t.trim()).filter(Boolean),
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
          placement: "topRight",
        });
      } else {
        await createStore(final);
        api.success({
          message: "✅ Tạo mới thành công!",
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
        description: e?.response?.data?.message,
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
        placement: "topRight",
      });
    } finally {
      setBusy(false);
    }
  };

  const paginatedStores = filteredStores.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {contextHolder}
      <Content style={{ padding: isMobile ? "16px" : "24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto" }}>
          {/* Compact Top Bar */}
          <Card
            style={{
              marginBottom: 20,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            styles={{ body: { padding: isMobile ? "16px" : "20px" } }}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Space size={12}>
                  <UserOutlined style={{ fontSize: 24, color: "#52c41a" }} />
                  <div>
                    <Title level={5} style={{ margin: 0, fontSize: isMobile ? 16 : 18 }}>
                      {user?.fullname || "Quản lý"}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Chọn cửa hàng để bắt đầu
                    </Text>
                  </div>
                </Space>
              </Col>

              <Col xs={12} sm={6} md={4}>
                <Statistic
                  title="Tổng cửa hàng"
                  value={stores.length}
                  prefix={<ShopOutlined />}
                  valueStyle={{ fontSize: isMobile ? 20 : 24, color: "#52c41a" }}
                />
              </Col>

              <Col xs={12} sm={6} md={4}>
                <Statistic
                  title="Kết quả"
                  value={filteredStores.length}
                  prefix={<SearchOutlined />}
                  valueStyle={{ fontSize: isMobile ? 20 : 24, color: "#1890ff" }}
                />
              </Col>

              <Col xs={24} md={8}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                  block
                  size="large"
                  style={{
                    background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    height: 44,
                  }}
                >
                  Thêm cửa hàng
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Search Bar */}
          <Card
            style={{
              marginBottom: 20,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
            styles={{ body: { padding: isMobile ? "12px" : "16px" } }}
          >
            <AutoComplete
              value={search}
              options={searchOptions}
              onChange={(value) => setSearch(value)}
              onSelect={(value) => setSearch(value)}
              style={{ width: "100%" }}
              placeholder={isMobile ? "🔍 Tìm kiếm..." : "🔍 Tìm kiếm cửa hàng theo tên, địa chỉ, số điện thoại..."}
              allowClear
              popupMatchSelectWidth={isMobile ? true : 400}
            >
              <Input
                size="large"
                prefix={<SearchOutlined style={{ color: "#52c41a", fontSize: 18 }} />}
                suffix={
                  filteredStores.length !== stores.length && (
                    <Badge count={filteredStores.length} style={{ backgroundColor: "#52c41a" }} />
                  )
                }
                style={{
                  borderRadius: 8,
                  height: 44,
                }}
              />
            </AutoComplete>
          </Card>

          {/* Store Grid - Compact */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Spin size="large" />
            </div>
          ) : filteredStores.length === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: "center", padding: "40px 20px" }}>
              <Empty
                description={
                  <Space direction="vertical" size={12}>
                    <Text type="secondary">{search ? "Không tìm thấy cửa hàng" : "Chưa có cửa hàng"}</Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                      Thêm cửa hàng
                    </Button>
                  </Space>
                }
              />
            </Card>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {paginatedStores.map((store) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={store._id}>
                    <Card
                      hoverable
                      style={{
                        borderRadius: 12,
                        overflow: "hidden",
                        height: "100%",
                        border: "1px solid #e8e8e8",
                      }}
                      styles={{ body: { padding: 0 } }}
                      className="store-card-compact"
                    >
                      {/* Compact Image */}
                      <div
                        style={{
                          height: 140,
                          background: store.imageUrl
                            ? `url(${store.imageUrl}) center/cover`
                            : "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                          position: "relative",
                        }}
                      >
                        {!store.imageUrl && (
                          <ShopOutlined
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 48,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          />
                        )}
                        <Badge
                          status="success"
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "rgba(255,255,255,0.95)",
                            borderRadius: 12,
                            padding: "4px 10px",
                          }}
                        />
                      </div>

                      {/* Compact Info */}
                      <div style={{ padding: 16 }}>
                        <Space direction="vertical" size={10} style={{ width: "100%" }}>
                          <Title level={5} ellipsis style={{ margin: 0, fontSize: 15, color: "#1890ff" }}>
                            {store.name}
                          </Title>

                          <Space size={6} align="start" style={{ width: "100%" }}>
                            <EnvironmentOutlined style={{ color: "#52c41a", fontSize: 14, marginTop: 2 }} />
                            <Text ellipsis={{ rows: 1 }} type="secondary" style={{ fontSize: 12, flex: 1 }}>
                              {store.address || "N/A"}
                            </Text>
                          </Space>

                          {store.phone && (
                            <Space size={6}>
                              <PhoneOutlined style={{ color: "#faad14", fontSize: 14 }} />
                              <Text style={{ fontSize: 12, fontWeight: 500 }}>{store.phone}</Text>
                            </Space>
                          )}

                          {store.tags && store.tags.length > 0 && (
                            <Space size={4} wrap>
                              {store.tags.slice(0, 2).map((tag, idx) => (
                                <Tag key={idx} color="green" style={{ fontSize: 11, padding: "0 6px", margin: 0 }}>
                                  {tag}
                                </Tag>
                              ))}
                              {store.tags.length > 2 && <Tag style={{ fontSize: 11, padding: "0 6px" }}>+{store.tags.length - 2}</Tag>}
                            </Space>
                          )}

                          {/* Compact Actions */}
                          <Space size={6} style={{ width: "100%", marginTop: 4 }}>
                            <Button
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              onClick={() => handleSelect(store)}
                              loading={busy}
                              size="small"
                              style={{
                                flex: 1,
                                background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                                border: "none",
                                borderRadius: 6,
                                fontWeight: 600,
                                height: 32,
                                fontSize: 12,
                              }}
                            >
                              Chọn
                            </Button>
                            <Button
                              icon={<EyeOutlined />}
                              onClick={() => handleDetail(store._id)}
                              size="small"
                              style={{ borderRadius: 6, height: 32 }}
                            />
                            <Button
                              icon={<EditOutlined />}
                              onClick={() => handleEdit(store)}
                              size="small"
                              style={{ borderRadius: 6, height: 32 }}
                            />
                          </Space>
                        </Space>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* Compact Pagination */}
              {filteredStores.length > pageSize && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                  <Pagination
                    current={currentPage}
                    total={filteredStores.length}
                    pageSize={pageSize}
                    onChange={setCurrentPage}
                    showSizeChanger={false}
                    simple={isMobile}
                    size="small"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Content>

      <StoreFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        form={storeForm}
        setForm={setStoreForm}
        onSave={handleSave}
        busy={busy}
        title={editingStore ? "Sửa cửa hàng" : "Thêm cửa hàng"}
      />

      <StoreDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        store={selectedStore}
        onEdit={(s) => handleEdit(s)}
        onSelect={(s) => handleSelect(s)}
        onDelete={(id) => handleDelete(id)}
      />

      <style jsx global>{`
        .store-card-compact:hover {
          box-shadow: 0 8px 24px rgba(82, 196, 26, 0.2) !important;
          transform: translateY(-4px);
          border-color: #52c41a !important;
        }
      `}</style>
    </Layout>
  );
}
