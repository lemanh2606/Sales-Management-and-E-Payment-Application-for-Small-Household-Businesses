
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
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Product, ProductStatus } from "../../type/product";
import { Supplier } from "../../type/supplier";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

interface ProductFormModalProps {
  product?: Product | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface ProductGroup {
  _id: string;
  name: string;
}

interface Warehouse {
  _id: string;
  name: string;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  open,
  onClose,
  onSaved,
}) => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;

  // --- FORM STATE ---
  const [formData, setFormData] = useState<any>({
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
    default_warehouse_id: "",
    tax_rate: "0",
    origin: "",
    brand: "",
    warranty_period: "",
    description: "",
  });

  const [image, setImage] = useState<string | null>(null); // URL or Local URI
  const [selectedImageFile, setSelectedImageFile] = useState<any>(null); // File object for upload

  // --- DATA STATE ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  
  // --- DROPDOWNS ---
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showTaxDropdown, setShowTaxDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // --- FETCH DATA ---
  useEffect(() => {
    if (open && storeId) {
      fetchData();
    }
  }, [open, storeId]);

  const fetchData = async () => {
    try {
      const [suppliersRes, groupsRes, warehousesRes] = await Promise.all([
        apiClient.get<{ suppliers: Supplier[] }>(`/suppliers/stores/${storeId}`),
        apiClient.get<{ productGroups: ProductGroup[] }>(`/product-groups/store/${storeId}`),
        apiClient.get<{ warehouses: Warehouse[] }>(`/stores/${storeId}/warehouses`)
      ]);
      setSuppliers(suppliersRes.data.suppliers || []);
      setGroups(groupsRes.data.productGroups || []);
      setWarehouses(warehousesRes.data.warehouses || []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu form:", error);
    }
  };

  // --- INIT FORM ---
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
        group_id: product.group?._id || "",
        default_warehouse_id: product.default_warehouse_id || (product as any).warehouse_id || "", 
        tax_rate: product.tax_rate?.toString() || "0",
        origin: product.origin || "",
        brand: product.brand || "",
        warranty_period: product.warranty_period || "",
        description: product.description || "",
      });
      setImage(product.image?.url || null);
    } else {
      setFormData({
        name: "", sku: "", cost_price: "", price: "", stock_quantity: "",
        min_stock: "", max_stock: "", unit: "", status: "Đang kinh doanh",
        supplier_id: "", group_id: "", default_warehouse_id: "",
        tax_rate: "0", origin: "", brand: "", warranty_period: "", description: ""
      });
      setImage(null);
    }
    setSelectedImageFile(null);
    setShowOptional(!!product); // Expand optional by default if editing
  }, [product, open]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        let asset = result.assets[0];

        // Always compress image to ensure fast upload and valid size (< 5MB)
        console.log("Original image size:", asset.fileSize);
        
        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize: { width: 1024 } }], // Resize to max width 1024px
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            
            // Update asset with compressed image
            asset = { 
                ...asset, 
                uri: manipResult.uri, 
                width: manipResult.width, 
                height: manipResult.height,
                // fileSize is not returned by manipulator, but it will be much smaller
            };
            console.log("Compressed image uri:", manipResult.uri);
        } catch (manipErr) {
            console.error("Compression error:", manipErr);
            // Fallback to original if compression fails, but warn user
        }

        setImage(asset.uri);
        
        // Create file object for upload
        const filename = asset.uri.split('/').pop();
        // Force type to jpeg since we compressed to jpeg
        const type = "image/jpeg"; 
        
        setSelectedImageFile({
          uri: asset.uri,
          name: filename,
          type: type
        });
      }
    } catch (err) {
      Alert.alert("Lỗi", "Không thể chọn ảnh");
    }
  };

  const handleSave = async () => {
    if (!storeId) return;
    
    // VALIDATION
    if (!formData.name) return Alert.alert("Lỗi", "Vui lòng nhập tên sản phẩm");
    if (!product) {
       // ... existing validation
      if (!formData.cost_price) return Alert.alert("Lỗi", "Vui lòng nhập giá vốn");
      if (!formData.price) return Alert.alert("Lỗi", "Vui lòng nhập giá bán");
      if (!formData.stock_quantity) return Alert.alert("Lỗi", "Vui lòng nhập tồn kho");
      if (!formData.default_warehouse_id) return Alert.alert("Lỗi", "Vui lòng chọn kho hàng");
      if (!formData.supplier_id) return Alert.alert("Lỗi", "Vui lòng chọn nhà cung cấp");
    }

    setLoading(true);
    try {
      const data = new FormData();
      
      // 1. Common fields
      const appendIf = (key: string, val: any) => {
         if (val !== undefined && val !== null && String(val).trim() !== "") {
            data.append(key, String(val));
         }
      };

      appendIf("name", formData.name);
      appendIf("description", formData.description);
      appendIf("price", formData.price);
      appendIf("cost_price", formData.cost_price);
      appendIf("tax_rate", formData.tax_rate);
      appendIf("stock_quantity", formData.stock_quantity);
      appendIf("min_stock", formData.min_stock);
      appendIf("max_stock", formData.max_stock);
      appendIf("supplier_id", formData.supplier_id);
      appendIf("group_id", formData.group_id);
      appendIf("default_warehouse_id", formData.default_warehouse_id);
      appendIf("unit", formData.unit);
      appendIf("status", formData.status);
      appendIf("origin", formData.origin);
      appendIf("brand", formData.brand);
      appendIf("warranty_period", formData.warranty_period);
      appendIf("sku", formData.sku);

      // 2. IMAGE HANDLING
      if (selectedImageFile) {
        let uri = selectedImageFile.uri;
        // Basic check for Android
        if (Platform.OS === 'android' && !uri.startsWith("file://") && !uri.startsWith("content://")) {
            uri = `file://${uri}`;
        }
        
        data.append("image", {
          uri: uri,
          name: selectedImageFile.name || "upload.jpg",
          type: selectedImageFile.type || "image/jpeg",
        } as any);
      } else if (product && !image) {
        data.append("removeImage", "true");
      }

      // 3. SEND REQUEST
      const token = await AsyncStorage.getItem("token");
      const baseURL = apiClient.defaults.baseURL; // http://192.168.100.23:9999/api
      
      let url = product?._id 
          ? `${baseURL}/products/${product._id}`
          : `${baseURL}/products/store/${storeId}`;
          
      // Ensure store_id in body for create
      if (!product) data.append("store_id", storeId as string);

      console.log(`Saving to: ${url}`);
      
      const response = await fetch(url, {
          method: product?._id ? "PUT" : "POST",
          headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/json",
              // Fetch automatically sets Content-Type: multipart/form-data; boundary=...
          },
          body: data,
      });

      const text = await response.text();
      let resData;
      try {
        resData = JSON.parse(text);
      } catch (e) {
        console.error("Non-JSON Response:", text);
        throw new Error("Lỗi máy chủ: Phản hồi không hợp lệ");
      }

      if (!response.ok) {
         console.error("Server Error:", resData);
         throw new Error(resData.message || resData.error || "Không thể lưu");
      }

      Alert.alert("Thành công", product ? "Đã cập nhật sản phẩm" : "Đã tạo sản phẩm mới");
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("Save Error:", err);
      Alert.alert("Lỗi", err.message || "Không thể lưu");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER HELPERS ---
  const getName = (list: any[], id: string, placeholder = "Chọn...") => {
     return list.find(i => i._id === id)?.name || placeholder;
  };

  const renderDropdown = (title: string, data: any[], selected: string, onSelect: (id: string) => void, show: boolean, setShow: (v: boolean) => void) => (
      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShow(false)}>
          <View style={styles.dropdownContainer}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setShow(false)}><Ionicons name="close" size={24} color="#666"/></TouchableOpacity>
            </View>
            <ScrollView style={{maxHeight: 300}}>
              {data.map(item => (
                <TouchableOpacity key={item._id} style={[styles.dropdownItem, selected === item._id && styles.dropdownItemSelected]}
                  onPress={() => { onSelect(item._id); setShow(false); }}>
                  <Text style={[styles.dropdownItemText, selected === item._id && {color: "#16a34a", fontWeight: "700"}]}>{item.name}</Text>
                  {selected === item._id && <Ionicons name="checkmark" size={20} color="#16a34a" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
  );

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.header}>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 0 : 10}}>
                    <Text style={styles.headerTitle}>{product ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex: 1}}>
            <ScrollView contentContainerStyle={styles.contentParams}>
                
                {/* Image Picker */}
                <View style={styles.imageSection}>
                    <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={loading}>
                        {image ? (
                           <Image source={{ uri: image }} style={styles.previewImage} />
                        ) : (
                           <View style={styles.placeholderImage}>
                              <Ionicons name="image-outline" size={40} color="#999" />
                              <Text style={{color: "#999", marginTop: 8}}>Chọn ảnh...</Text>
                           </View>
                        )}
                        <View style={styles.cameraIcon}>
                             <Ionicons name="camera" size={20} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* BASIC INFO CARD */}
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Thông tin cơ bản {product && "(Không thể sửa)"}</Text>
                    
                    <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Tên sản phẩm <Text style={styles.req}>*</Text></Text>
                        <TextInput style={[styles.input, product && styles.disabledInput]} 
                             value={formData.name} 
                             onChangeText={t => setFormData({...formData, name: t})}
                             placeholder="VD: Nước ngọt Coca Cola"
                             editable={!product}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.col, {marginRight: 8}]}>
                             <Text style={styles.label}>Giá vốn <Text style={styles.req}>*</Text></Text>
                             <TextInput style={[styles.input, product && styles.disabledInput]} 
                                  value={formData.cost_price} 
                                  onChangeText={t => setFormData({...formData, cost_price: t.replace(/[^0-9]/g, "")})}
                                  keyboardType="numeric"
                                  placeholder="0"
                                  editable={!product}
                             />
                        </View>
                        <View style={[styles.col, {marginLeft: 8}]}>
                             <Text style={styles.label}>Giá bán <Text style={styles.req}>*</Text></Text>
                             <TextInput style={[styles.input, product && styles.disabledInput]} 
                                  value={formData.price} 
                                  onChangeText={t => setFormData({...formData, price: t.replace(/[^0-9]/g, "")})}
                                  keyboardType="numeric"
                                  placeholder="0"
                                  editable={!product}
                             />
                        </View>
                    </View>

                    <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Tồn kho ban đầu <Text style={styles.req}>*</Text></Text>
                        <TextInput style={[styles.input, product && styles.disabledInput]} 
                             value={formData.stock_quantity} 
                             onChangeText={t => setFormData({...formData, stock_quantity: t.replace(/[^0-9]/g, "")})}
                             keyboardType="numeric"
                             placeholder="0"
                             editable={!product}
                        />
                    </View>

                    <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Kho hàng mặc định <Text style={styles.req}>*</Text></Text>
                        <TouchableOpacity style={[styles.selectInput, product && styles.disabledInput]} 
                              onPress={() => !product && setShowWarehouseDropdown(true)}
                              disabled={!!product}>
                              <Text style={{color: formData.default_warehouse_id ? "#333" : "#999"}}>
                                  {getName(warehouses, formData.default_warehouse_id, "Chọn kho hàng...")}
                              </Text>
                              <Ionicons name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Nhà cung cấp <Text style={styles.req}>*</Text></Text>
                        <TouchableOpacity style={[styles.selectInput, product && styles.disabledInput]} 
                              onPress={() => !product && setShowSupplierDropdown(true)}
                              disabled={!!product}>
                              <Text style={{color: formData.supplier_id ? "#333" : "#999"}}>
                                  {getName(suppliers, formData.supplier_id, "Chọn nhà cung cấp...")}
                              </Text>
                              <Ionicons name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ADVANCED INFO */}
                <View style={styles.card}>
                    <TouchableOpacity style={styles.expandHeader} onPress={() => setShowOptional(!showOptional)}>
                         <Text style={styles.sectionHeader}>Thông tin chi tiết</Text>
                         <Ionicons name={showOptional ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                    </TouchableOpacity>
                    
                    {showOptional && (
                        <View style={{marginTop: 12}}>
                             <View style={styles.row}>
                                <View style={[styles.col, {marginRight: 8}]}>
                                    <Text style={styles.label}>SKU</Text>
                                    <TextInput style={[styles.input, product && styles.disabledInput]} 
                                        value={formData.sku} 
                                        onChangeText={t => setFormData({...formData, sku: t})}
                                        editable={!product}
                                        placeholder="Mã SKU"
                                    />
                                </View>
                                <View style={[styles.col, {marginLeft: 8}]}>
                                    <Text style={styles.label}>Đơn vị tính</Text>
                                    <TextInput style={styles.input} 
                                        value={formData.unit} 
                                        onChangeText={t => setFormData({...formData, unit: t})}
                                        placeholder="Cái/Hộp..."
                                    />
                                </View>
                             </View>

                             <View style={styles.videoFormGroup}>
                                <Text style={styles.label}>Nhóm sản phẩm</Text>
                                <TouchableOpacity style={styles.selectInput} onPress={() => setShowGroupDropdown(true)}>
                                    <Text style={{color: formData.group_id ? "#333" : "#999"}}>
                                        {getName(groups, formData.group_id, "Chọn nhóm...")}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color="#666" />
                                </TouchableOpacity>
                             </View>

                             <View style={styles.row}>
                                <View style={[styles.col, {marginRight: 8}]}>
                                    <Text style={styles.label}>Tối thiểu</Text>
                                    <TextInput style={styles.input} 
                                        value={formData.min_stock} 
                                        onChangeText={t => setFormData({...formData, min_stock: t.replace(/[^0-9]/g, "")})}
                                        keyboardType="numeric"
                                        placeholder="Min"
                                    />
                                </View>
                                <View style={[styles.col, {marginLeft: 8}]}>
                                    <Text style={styles.label}>Tối đa</Text>
                                    <TextInput style={styles.input} 
                                        value={formData.max_stock} 
                                        onChangeText={t => setFormData({...formData, max_stock: t.replace(/[^0-9]/g, "")})}
                                        keyboardType="numeric"
                                        placeholder="Max"
                                    />
                                </View>
                             </View>

                             <View style={styles.videoFormGroup}>
                                <Text style={styles.label}>Trạng thái</Text>
                                <TouchableOpacity style={styles.selectInput} onPress={() => setShowStatusDropdown(true)}>
                                    <Text style={{color: "#333"}}>{formData.status}</Text>
                                    <Ionicons name="chevron-down" size={20} color="#666" />
                                </TouchableOpacity>
                             </View>

                             <Text style={[styles.sectionHeader, {marginTop: 16, fontSize: 14}]}>Thông tin pháp lý</Text>
                             
                             <View style={styles.row}>
                                <View style={[styles.col, {marginRight: 8}]}>
                                    <Text style={styles.label}>Thuế GTGT</Text>
                                    <TouchableOpacity style={styles.selectInput} onPress={() => setShowTaxDropdown(true)}>
                                        <Text style={{color: "#333"}}>{formData.tax_rate === "-1" ? "KCT" : formData.tax_rate + "%"}</Text>
                                        <Ionicons name="chevron-down" size={20} color="#666" />
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.col, {marginLeft: 8}]}>
                                    <Text style={styles.label}>Xuất xứ</Text>
                                    <TextInput style={styles.input} 
                                        value={formData.origin} 
                                        onChangeText={t => setFormData({...formData, origin: t})}
                                        placeholder="Việt Nam..."
                                    />
                                </View>
                             </View>

                              <View style={styles.videoFormGroup}>
                                <Text style={styles.label}>Thương hiệu</Text>
                                <TextInput style={styles.input} 
                                     value={formData.brand} 
                                     onChangeText={t => setFormData({...formData, brand: t})}
                                     placeholder="Sony, Samsung..."
                                />
                             </View>
                             
                             <View style={styles.videoFormGroup}>
                                <Text style={styles.label}>Mô tả</Text>
                                <TextInput style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                                     value={formData.description} 
                                     onChangeText={t => setFormData({...formData, description: t})}
                                     multiline
                                     numberOfLines={4}
                                     placeholder="Mô tả chi tiết..."
                                />
                             </View>
                        </View>
                    )}
                </View>
            </ScrollView>
            </KeyboardAvoidingView>

            {/* Footer Actions */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={loading}>
                    <Text style={styles.btnCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnSaveText}>{product ? "Lưu Thay Đổi" : "Tạo Sản Phẩm"}</Text>}
                </TouchableOpacity>
            </View>

            {/* Dropdowns */}
            {renderDropdown("Chọn Kho Hàng", warehouses, formData.default_warehouse_id, (id) => setFormData({...formData, default_warehouse_id: id}), showWarehouseDropdown, setShowWarehouseDropdown)}
            {renderDropdown("Chọn Nhà Cung Cấp", suppliers, formData.supplier_id, (id) => setFormData({...formData, supplier_id: id}), showSupplierDropdown, setShowSupplierDropdown)}
            {renderDropdown("Chọn Nhóm Sản Phẩm", groups, formData.group_id, (id) => setFormData({...formData, group_id: id}), showGroupDropdown, setShowGroupDropdown)}
            {renderDropdown("Chọn Trạng Thái", 
                 [{_id: "Đang kinh doanh", name: "Đang kinh doanh"}, {_id: "Ngừng kinh doanh", name: "Ngừng kinh doanh"}, {_id: "Ngừng bán", name: "Ngừng bán"}], 
                 formData.status, (id) => setFormData({...formData, status: id as any}), showStatusDropdown, setShowStatusDropdown)}
            {renderDropdown("Chọn Thuế GTGT", 
                 [{_id: "-1", name: "KCT"}, {_id: "0", name: "0%"}, {_id: "5", name: "5%"}, {_id: "8", name: "8%"}, {_id: "10", name: "10%"}], 
                 formData.tax_rate, (id) => setFormData({...formData, tax_rate: id}), showTaxDropdown, setShowTaxDropdown)}
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { padding: 16, paddingTop: 40 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  closeBtn: { padding: 4 },
  contentParams: { padding: 16, paddingBottom: 100 },
  
  imageSection: { alignItems: "center", marginBottom: 20 },
  imagePicker: { width: 120, height: 120, borderRadius: 16, backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: "#cbd5e1" },
  previewImage: { width: "100%", height: "100%" },
  placeholderImage: { alignItems: "center" },
  cameraIcon: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#16a34a", padding: 6, borderTopLeftRadius: 10 },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 12, textTransform: "uppercase" },
  expandHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  
  videoFormGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 },
  req: { color: "#ef4444" },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, color: "#0f172a", fontSize: 15 },
  disabledInput: { backgroundColor: "#f1f5f9", color: "#94a3b8" },
  selectInput: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  
  row: { flexDirection: "row", marginBottom: 12 },
  col: { flex: 1 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", flexDirection: "row", gap: 12 },
  btnCancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center" },
  btnCancelText: { fontWeight: "600", color: "#64748b" },
  btnSave: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: "#16a34a", alignItems: "center" },
  btnSaveText: { fontWeight: "700", color: "#fff" },

  // Dropdown Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  dropdownContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "60%" },
  dropdownHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 12 },
  dropdownTitle: { fontSize: 16, fontWeight: "bold" },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dropdownItemSelected: { backgroundColor: "#f0fdf4" },
  dropdownItemText: { fontSize: 15, color: "#334155" }
});

export default ProductFormModal;
