// src/components/product/ProductFormModal.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Product, ProductStatus, ProductGroupRef } from "../../type/product";
import { Supplier } from "../../type/supplier";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

interface ProductFormModalProps {
  product?: Product | null;
  open?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface ProductGroup {
  _id: string;
  name: string;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  open = true,
  onClose,
  onSaved,
}) => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    cost_price: "",
    price: "",
    stock_quantity: "",
    min_stock: "",
    max_stock: "",
    unit: "",
    status: "Đang kinh doanh" as ProductStatus,
    supplier_id: "",
    group_id: "",
    tax_rate: "0",
    origin: "",
    brand: "",
    warranty_period: "",
    image: "",
    description: "",
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // State cho dropdown
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showTaxDropdown, setShowTaxDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // ================= FETCH DATA =================
  useEffect(() => {
    const fetchData = async () => {
      if (!storeId || !open) return;

      try {
        // Fetch suppliers
        const suppliersRes = await apiClient.get<{ suppliers: Supplier[] }>(
          `/suppliers/stores/${storeId}`
        );
        setSuppliers(suppliersRes.data.suppliers || []);

        // Fetch product groups
        const groupsRes = await apiClient.get<{
          productGroups: ProductGroupRef[];
        }>(`/product-groups/store/${storeId}`);
        setGroups(
          (groupsRes.data.productGroups || []).map((group) => ({
            ...group,
            _id: group._id.toString(),
            name: group.name || "",
          }))
        );
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        Alert.alert(
          "Lỗi",
          "Không thể tải danh sách nhà cung cấp và nhóm sản phẩm"
        );
      }
    };

    fetchData();
  }, [storeId, open]);

  // ================= INIT FORM =================
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        cost_price: product.cost_price?.toString() || "",
        price: product.price?.toString() || "",
        stock_quantity: product.stock_quantity?.toString() || "",
        min_stock: product.min_stock?.toString() || "",
        max_stock: product.max_stock?.toString() || "",
        unit: product.unit || "",
        status: product.status || "Đang kinh doanh",
        supplier_id: product.supplier?._id || "",
        group_id: product.group?._id?.toString() || "",
        tax_rate: (product as any).tax_rate?.toString() || "0",
        origin: (product as any).origin || "",
        brand: (product as any).brand || "",
        warranty_period: (product as any).warranty_period || "",
        image: product.image?.url || "",
        description: product.description || "",
      });
    } else {
      // Reset form khi tạo mới
      setFormData({
        name: "",
        sku: "",
        cost_price: "",
        price: "",
        stock_quantity: "",
        min_stock: "",
        max_stock: "",
        unit: "",
        status: "Đang kinh doanh",
        supplier_id: "",
        group_id: "",
        tax_rate: "0",
        origin: "",
        brand: "",
        warranty_period: "",
        image: "",
        description: "",
      });
    }
    setShowOptional(false);
  }, [product, open]);

  // ================= HANDLE SCROLL =================
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
    setShowScrollHint(!isCloseToBottom);
  };

  // ================= VALIDATION =================
  const validateForm = (): boolean => {
    // Validation cho min_stock và max_stock (áp dụng cả 2 mode)
    if (formData.min_stock && Number(formData.min_stock) < 0) {
      Alert.alert("Lỗi", "Tồn kho tối thiểu không được âm");
      return false;
    }

    if (formData.max_stock && Number(formData.max_stock) < 0) {
      Alert.alert("Lỗi", "Tồn kho tối đa không được âm");
      return false;
    }

    if (
      formData.min_stock &&
      formData.max_stock &&
      Number(formData.max_stock) <= Number(formData.min_stock)
    ) {
      Alert.alert("Lỗi", "Tồn kho tối đa phải lớn hơn tồn kho tối thiểu");
      return false;
    }

    // Khi EDIT - chỉ cần validate min/max stock (đã xong ở trên)
    if (product) {
      return true;
    }

    // Khi TẠO MỚI - validate thêm các trường bắt buộc
    if (!formData.name.trim()) {
      Alert.alert("Lỗi", "Tên sản phẩm không được để trống");
      return false;
    }

    if (!formData.cost_price || Number(formData.cost_price) < 0) {
      Alert.alert("Lỗi", "Giá vốn không hợp lệ");
      return false;
    }

    if (!formData.price || Number(formData.price) < 0) {
      Alert.alert("Lỗi", "Giá bán không hợp lệ");
      return false;
    }

    if (!formData.stock_quantity || Number(formData.stock_quantity) < 0) {
      Alert.alert("Lỗi", "Số lượng tồn kho không hợp lệ");
      return false;
    }

    if (!formData.supplier_id) {
      Alert.alert("Lỗi", "Vui lòng chọn nhà cung cấp");
      return false;
    }

    return true;
  };

  // ================= HANDLE SAVE =================
  const handleSave = async () => {
    if (!storeId) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng trước khi thêm sản phẩm");
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      let payload: any = {};

      if (product?._id) {
        // ===== EDIT MODE: Chỉ gửi các trường được phép sửa =====
        payload = {
          // Các trường cho phép sửa khi edit
          status: formData.status,
          unit: formData.unit.trim() || undefined,
          group_id: formData.group_id || undefined,
          min_stock: formData.min_stock.trim() ? Number(formData.min_stock) : undefined,
          max_stock: formData.max_stock.trim() ? Number(formData.max_stock) : undefined,
          // Thông tin pháp lý & bảo hành
          tax_rate: formData.tax_rate ? Number(formData.tax_rate) : 0,
          origin: formData.origin.trim() || "",
          brand: formData.brand.trim() || "",
          warranty_period: formData.warranty_period.trim() || "",
          // Mô tả & hình ảnh
          description: formData.description.trim() || "",
          image: formData.image.trim() || undefined,
        };
        // Lọc bỏ các field undefined
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      } else {
        // ===== CREATE MODE: Gửi đầy đủ các trường =====
        payload = {
          name: formData.name.trim(),
          cost_price: Number(formData.cost_price),
          price: Number(formData.price),
          stock_quantity: Number(formData.stock_quantity),
          status: formData.status,
          supplier_id: formData.supplier_id,
          store_id: storeId,
        };

        // Thêm các trường optional nếu có giá trị
        if (formData.sku.trim()) payload.sku = formData.sku.trim();
        if (formData.unit.trim()) payload.unit = formData.unit.trim();
        if (formData.group_id) payload.group_id = formData.group_id;
        if (formData.tax_rate) payload.tax_rate = Number(formData.tax_rate);
        if (formData.origin.trim()) payload.origin = formData.origin.trim();
        if (formData.brand.trim()) payload.brand = formData.brand.trim();
        if (formData.warranty_period.trim()) payload.warranty_period = formData.warranty_period.trim();
        if (formData.image.trim()) payload.image = formData.image.trim();
        if (formData.description.trim()) payload.description = formData.description.trim();
        if (formData.min_stock.trim()) payload.min_stock = Number(formData.min_stock);
        if (formData.max_stock.trim()) payload.max_stock = Number(formData.max_stock);
      }

      console.log("Saving product:", {
        isEdit: !!product?._id,
        productId: product?._id,
        data: payload,
      });

      if (product?._id) {
        await apiClient.put(`/products/${product._id}`, payload);
        Alert.alert("Thành công", "Đã cập nhật sản phẩm thành công");
      } else {
        await apiClient.post(`/products/store/${storeId}`, payload);
        Alert.alert("Thành công", "Đã thêm sản phẩm mới thành công");
      }

      onSaved?.();
      handleClose();
    } catch (error: any) {
      console.error("Lỗi khi lưu sản phẩm:", error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể lưu sản phẩm. Vui lòng thử lại.";

      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setShowSupplierDropdown(false);
      setShowGroupDropdown(false);
      setShowStatusDropdown(false);
      onClose();
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find((s) => s._id === supplierId);
    return supplier?.name || "-- Chọn nhà cung cấp --";
  };

  const getGroupName = (groupId: string) => {
    const group = groups.find((g) => g._id === groupId);
    return group?.name || "-- Chọn nhóm sản phẩm --";
  };

  // Render Dropdown Modal
  const renderDropdownModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: Array<{ _id: string; name: string }>,
    selectedValue: string,
    onSelect: (id: string) => void,
    emptyMessage: string
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.dropdownBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.dropdownContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.dropdownList}>
            {options.length === 0 ? (
              <Text style={styles.emptyMessage}>{emptyMessage}</Text>
            ) : (
              options.map((option) => (
                <TouchableOpacity
                  key={option._id}
                  style={[
                    styles.dropdownItem,
                    selectedValue === option._id && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    onSelect(option._id);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedValue === option._id &&
                        styles.dropdownItemTextSelected,
                    ]}
                  >
                    {option.name}
                  </Text>
                  {selectedValue === option._id && (
                    <Ionicons name="checkmark" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {product ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {/* Thông tin cơ bản - Hiển thị cả 2 mode, disable khi edit */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {product ? "Thông tin sản phẩm (không thể sửa)" : "Thông tin bắt buộc"}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Tên sản phẩm {!product && <Text style={styles.required}>*</Text>}
                  </Text>
                  <TextInput
                    style={[styles.input, product && styles.inputDisabled]}
                    placeholder="Nhập tên sản phẩm..."
                    placeholderTextColor="#999"
                    value={formData.name}
                    onChangeText={(text) => handleChange("name", text)}
                    editable={!loading && !product}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfInput]}>
                    <Text style={styles.label}>
                      Giá vốn (VND) {!product && <Text style={styles.required}>*</Text>}
                    </Text>
                    <TextInput
                      style={[styles.input, product && styles.inputDisabled]}
                      placeholder="0"
                      placeholderTextColor="#999"
                      value={formData.cost_price}
                      onChangeText={(text) =>
                        handleChange("cost_price", text.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      editable={!loading && !product}
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfInput]}>
                    <Text style={styles.label}>
                      Giá bán (VND) {!product && <Text style={styles.required}>*</Text>}
                    </Text>
                    <TextInput
                      style={[styles.input, product && styles.inputDisabled]}
                      placeholder="0"
                      placeholderTextColor="#999"
                      value={formData.price}
                      onChangeText={(text) =>
                        handleChange("price", text.replace(/[^0-9]/g, ""))
                      }
                      keyboardType="numeric"
                      editable={!loading && !product}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Số lượng tồn kho {!product && <Text style={styles.required}>*</Text>}
                  </Text>
                  <TextInput
                    style={[styles.input, product && styles.inputDisabled]}
                    placeholder="0"
                    placeholderTextColor="#999"
                    value={formData.stock_quantity}
                    onChangeText={(text) =>
                      handleChange(
                        "stock_quantity",
                        text.replace(/[^0-9]/g, "")
                      )
                    }
                    keyboardType="numeric"
                    editable={!loading && !product}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Nhà cung cấp {!product && <Text style={styles.required}>*</Text>}
                  </Text>
                  <TouchableOpacity
                    style={[styles.dropdown, product && styles.inputDisabled]}
                    onPress={() => !product && setShowSupplierDropdown(true)}
                    disabled={loading || !!product}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !formData.supplier_id && styles.dropdownPlaceholder,
                      ]}
                    >
                      {getSupplierName(formData.supplier_id)}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={product ? "#ccc" : "#666"} />
                  </TouchableOpacity>
                  {!product && suppliers.length === 0 && (
                    <Text style={styles.hintText}>
                      Chưa có nhà cung cấp. Vui lòng tạo nhà cung cấp trước.
                    </Text>
                  )}
                </View>
              </View>

              {/* Thông tin tùy chọn / Thông tin có thể chỉnh sửa */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.optionalHeader}
                  onPress={() => setShowOptional(!showOptional)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showOptional ? "chevron-up" : "chevron-down"}
                    size={24}
                    color="#16a34a"
                  />
                  <Text style={styles.optionalTitle}>
                    {product ? "Thông tin có thể chỉnh sửa" : "Thông tin tùy chọn"}
                  </Text>
                </TouchableOpacity>

                {(showOptional || product) && (
                  <View style={styles.optionalContent}>
                    {/* SKU - hiển thị nhưng disable khi edit */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Mã SKU</Text>
                      <TextInput
                        style={[styles.input, product && styles.inputDisabled]}
                        placeholder="Nhập mã SKU..."
                        placeholderTextColor="#999"
                        value={formData.sku}
                        onChangeText={(text) => handleChange("sku", text)}
                        editable={!loading && !product}
                      />
                    </View>

                    {/* Đơn vị tính & Nhóm - CHO PHÉP SỬA */}
                    <View style={styles.row}>
                      <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.label}>Đơn vị tính</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="cái, hộp, kg..."
                          placeholderTextColor="#999"
                          value={formData.unit}
                          onChangeText={(text) => handleChange("unit", text)}
                          editable={!loading}
                        />
                      </View>

                      <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.label}>Nhóm sản phẩm</Text>
                        <TouchableOpacity
                          style={styles.dropdown}
                          onPress={() => setShowGroupDropdown(true)}
                          disabled={loading}
                        >
                          <Text
                            style={[
                              styles.dropdownText,
                              !formData.group_id && styles.dropdownPlaceholder,
                            ]}
                          >
                            {getGroupName(formData.group_id)}
                          </Text>
                          <Ionicons
                            name="chevron-down"
                            size={20}
                            color="#666"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* TRẠNG THÁI - hiển thị ở cả 2 chế độ */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Trạng thái</Text>
                      <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() => setShowStatusDropdown(true)}
                        disabled={loading}
                      >
                        <Text style={styles.dropdownText}>
                          {formData.status}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>

                    {/* Thuế GTGT */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Thuế GTGT</Text>
                      <TouchableOpacity
                        style={styles.dropdown}
                        onPress={() => setShowTaxDropdown(true)}
                        disabled={loading}
                      >
                        <Text style={styles.dropdownText}>
                          {formData.tax_rate === "-1" ? "KCT" : `${formData.tax_rate}%`}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                      </TouchableOpacity>
                    </View>

                    {/* Xuất xứ & Thương hiệu */}
                    <View style={styles.row}>
                      <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.label}>Xuất xứ</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="VD: Việt Nam"
                          placeholderTextColor="#999"
                          value={formData.origin}
                          onChangeText={(text) => handleChange("origin", text)}
                          editable={!loading}
                        />
                      </View>
                      <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.label}>Thương hiệu</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="VD: Sony"
                          placeholderTextColor="#999"
                          value={formData.brand}
                          onChangeText={(text) => handleChange("brand", text)}
                          editable={!loading}
                        />
                      </View>
                    </View>

                    {/* Bảo hành */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Bảo hành</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="VD: 12 tháng"
                        placeholderTextColor="#999"
                        value={formData.warranty_period}
                        onChangeText={(text) => handleChange("warranty_period", text)}
                        editable={!loading}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Hình ảnh (URL)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="https://example.com/image.jpg"
                        placeholderTextColor="#999"
                        value={formData.image}
                        onChangeText={(text) => handleChange("image", text)}
                        editable={!loading}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Mô tả</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Nhập mô tả sản phẩm..."
                        placeholderTextColor="#999"
                        value={formData.description}
                        onChangeText={(text) =>
                          handleChange("description", text)
                        }
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!loading}
                      />
                    </View>

                    {/* Tồn kho min/max - CHO PHÉP SỬA */}
                    <View style={styles.row}>
                      <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.label}>Tồn kho tối thiểu</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={formData.min_stock}
                          onChangeText={(text) =>
                            handleChange(
                              "min_stock",
                              text.replace(/[^0-9]/g, "")
                            )
                          }
                          keyboardType="numeric"
                          editable={!loading}
                        />
                      </View>

                      <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.label}>Tồn kho tối đa</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={formData.max_stock}
                          onChangeText={(text) =>
                            handleChange(
                              "max_stock",
                              text.replace(/[^0-9]/g, "")
                            )
                          }
                          keyboardType="numeric"
                          editable={!loading}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Scroll hint */}
              {showScrollHint && (
                <View style={styles.scrollHint}>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                  <Text style={styles.scrollHintText}>Nội dung phía dưới</Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>
                  Hủy bỏ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  loading && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={loading || (!product && !formData.supplier_id)}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={product ? "refresh" : "add-circle"}
                      size={20}
                      color="#fff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.buttonText}>
                      {product ? "Lưu thay đổi" : "Tạo sản phẩm"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Dropdown Modals */}
      {renderDropdownModal(
        showSupplierDropdown,
        () => setShowSupplierDropdown(false),
        "Chọn nhà cung cấp",
        suppliers,
        formData.supplier_id,
        (supplierId) => handleChange("supplier_id", supplierId),
        "Chưa có nhà cung cấp nào"
      )}

      {renderDropdownModal(
        showGroupDropdown,
        () => setShowGroupDropdown(false),
        "Chọn nhóm sản phẩm",
        groups,
        formData.group_id,
        (groupId) => handleChange("group_id", groupId),
        "Chưa có nhóm sản phẩm nào"
      )}

      {renderDropdownModal(
        showTaxDropdown,
        () => setShowTaxDropdown(false),
        "Chọn mức thuế GTGT",
        [
          { _id: "-1", name: "KCT (Không chịu thuế)" },
          { _id: "0", name: "0% (Không kê khai)" },
          { _id: "5", name: "5%" },
          { _id: "8", name: "8%" },
          { _id: "10", name: "10%" },
        ],
        formData.tax_rate,
        (taxRate) => handleChange("tax_rate", taxRate),
        "Không có mức thuế nào"
      )}

      {renderDropdownModal(
        showStatusDropdown,
        () => setShowStatusDropdown(false),
        "Chọn trạng thái",
        [
          { _id: "Đang kinh doanh", name: "Đang kinh doanh" },
          { _id: "Ngừng kinh doanh", name: "Ngừng kinh doanh" },
          { _id: "Ngừng bán", name: "Ngừng bán" },
        ],
        formData.status,
        (status) => handleChange("status", status),
        "Không có trạng thái nào"
      )}
    </Modal>
  );
};

export default ProductFormModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#16a34a",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    padding: 20,
    maxHeight: 500,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#16a34a",
  },
  optionalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  optionalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16a34a",
    marginLeft: 8,
  },
  optionalContent: {
    marginTop: 16,
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#dc2626",
  },
  input: {
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
  },
  dropdownText: {
    fontSize: 16,
    color: "#333",
  },
  dropdownPlaceholder: {
    color: "#999",
  },
  hintText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    fontStyle: "italic",
  },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  scrollHintText: {
    fontSize: 14,
    color: "#666",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#666",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#16a34a",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: "#86efac",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  buttonIcon: {
    marginRight: 8,
  },
  // Dropdown Modal Styles
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dropdownContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "60%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemSelected: {
    backgroundColor: "#f0f9f0",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: "#16a34a",
    fontWeight: "600",
  },
  emptyMessage: {
    padding: 20,
    textAlign: "center",
    color: "#666",
    fontSize: 16,
  },
  // Style cho input bị disabled
  inputDisabled: {
    backgroundColor: "#f5f5f5",
    color: "#999",
  },
});
