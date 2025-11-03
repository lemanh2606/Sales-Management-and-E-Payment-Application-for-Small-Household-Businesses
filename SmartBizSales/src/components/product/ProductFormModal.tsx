// src/components/product/ProductFormModal.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import { Product, ProductStatus } from "../../type/product";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

interface ProductFormModalProps {
  product?: Product | null; // null = create, else = edit
  open?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  open = true,
  onClose,
  onSaved,
}) => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;

  const [form, setForm] = useState<Partial<Product>>({
    name: "",
    sku: "",
    price: 0,
    cost_price: 0,
    stock_quantity: 0,
    status: "Đang kinh doanh",
    group_id: undefined,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        price: product.price,
        cost_price: product.cost_price,
        stock_quantity: product.stock_quantity,
        status: product.status,
        group_id: product.group_id,
      });
    }
  }, [product]);

  const handleSave = async () => {
    if (!storeId) {
      Alert.alert("Error", "Vui lòng chọn cửa hàng trước.");
      return;
    }
    if (!form.name || !form.sku) {
      Alert.alert("Lỗi", "Tên và SKU là bắt buộc.");
      return;
    }

    try {
      setLoading(true);
      if (product && product._id) {
        // Update
        await apiClient.put(`/products/${product._id}`, {
          ...form,
          store_id: storeId,
        });
      } else {
        // Create
        await apiClient.post(`/products/store/${storeId}`, {
          ...form,
          store_id: storeId,
        });
      }
      onSaved && onSaved();
      onClose();
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message || "Không lưu được sản phẩm"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isVisible={open} onBackdropPress={onClose}>
      <View style={styles.modalContainer}>
        <ScrollView>
          <Text style={styles.title}>
            {product ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
          </Text>

          <Text>Tên sản phẩm</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(text) =>
              setForm((prev) => ({ ...prev, name: text }))
            }
          />

          <Text>SKU</Text>
          <TextInput
            style={styles.input}
            value={form.sku}
            onChangeText={(text) => setForm((prev) => ({ ...prev, sku: text }))}
          />

          <Text>Giá bán</Text>
          <TextInput
            style={styles.input}
            value={form.price?.toString()}
            onChangeText={(text) =>
              setForm((prev) => ({ ...prev, price: Number(text) }))
            }
            keyboardType="numeric"
          />

          <Text>Giá gốc</Text>
          <TextInput
            style={styles.input}
            value={form.cost_price?.toString()}
            onChangeText={(text) =>
              setForm((prev) => ({ ...prev, cost_price: Number(text) }))
            }
            keyboardType="numeric"
          />

          <Text>Số lượng</Text>
          <TextInput
            style={styles.input}
            value={form.stock_quantity?.toString()}
            onChangeText={(text) =>
              setForm((prev) => ({ ...prev, stock_quantity: Number(text) }))
            }
            keyboardType="numeric"
          />

          <Text>Trạng thái</Text>
          <View style={styles.statusContainer}>
            {["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusButton,
                  form.status === s && styles.statusButtonActive,
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, status: s as ProductStatus }))
                }
              >
                <Text>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* TODO: thêm chọn nhóm sản phẩm nếu muốn */}
          {/* <Text>Nhóm sản phẩm</Text> */}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 20,
            }}
          >
            <TouchableOpacity style={styles.buttonCancel} onPress={onClose}>
              <Text style={{ color: "#fff" }}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonSave} onPress={handleSave}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff" }}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default ProductFormModal;

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    maxHeight: "90%",
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
  statusContainer: { flexDirection: "row", marginVertical: 10 },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    marginRight: 8,
  },
  statusButtonActive: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  buttonCancel: {
    backgroundColor: "#999",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonSave: {
    backgroundColor: "#007bff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
