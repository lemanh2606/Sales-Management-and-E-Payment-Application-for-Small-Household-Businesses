import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import * as inventoryVoucherApi from "../../api/inventoryVoucherApi";
import * as warehouseApi from "../../api/warehouseApi";
import * as productApi from "../../api/productApi";
import * as supplierApi from "../../api/supplierApi";

const InventoryVoucherFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { currentStore, user } = useAuth();
  const storeId = currentStore?._id || null;

  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Form State
  const [type, setType] = useState<"IN" | "OUT" | "RETURN">("IN");
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState("");
  const [attachedDocs, setAttachedDocs] = useState("0");
  const [refNo, setRefNo] = useState("");
  const [refDate, setRefDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentPlace, setDocumentPlace] = useState("");
  
  const [delivererName, setDelivererName] = useState("");
  const [delivererPhone, setDelivererPhone] = useState("");
  const [receiverName, setReceiverName] = useState(user?.fullname || "");
  const [receiverPhone, setReceiverPhone] = useState(user?.phone || "");
  
  // Supplier snapshot fields
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierTaxcode, setSupplierTaxcode] = useState("");
  const [supplierContactPerson, setSupplierContactPerson] = useState("");
  
  // Warehouse location
  const [warehouseLocation, setWarehouseLocation] = useState("");
  
  const [items, setItems] = useState<any[]>([]);
  
  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (storeId) {
      loadInitialData();
    }
  }, [storeId]);

  const loadInitialData = async () => {
    try {
      const whRes = await warehouseApi.getWarehousesByStore(storeId!);
      setWarehouses(whRes.warehouses || []);
      if (whRes.warehouses?.length > 0) {
        const def = whRes.warehouses.find((w: any) => w.is_default);
        setWarehouseId(def ? def._id : whRes.warehouses[0]._id);
      }

      const supRes = await supplierApi.getSuppliers(storeId!);
      setSuppliers(supRes.suppliers || []);

      // Load all products for quick selection
      setLoadingProducts(true);
      const prodRes = await productApi.getProductsByStore(storeId!, { page: 1, limit: 100 });
      setAllProducts(prodRes.products || []);
      setLoadingProducts(false);
    } catch (error) {
      console.error("Lỗi load data:", error);
      setLoadingProducts(false);
    }
  };

  const handleSearchProducts = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    };
    // Filter from local allProducts for instant search
    const filtered = allProducts.filter(p => 
      p.name?.toLowerCase().includes(q.toLowerCase()) || 
      p.sku?.toLowerCase().includes(q.toLowerCase())
    );
    setSearchResults(filtered);
  };

  // Products to display: search results if searching, otherwise all products
  const displayProducts = searchQuery.trim() ? searchResults : allProducts;



  const extractNumber = (val: any) => {
    if (typeof val === 'object' && val !== null) {
        if (val.$numberDecimal) return parseFloat(val.$numberDecimal);
        if (val.numberDecimal) return parseFloat(val.numberDecimal); // Handle variants
    }
    return parseFloat(val || 0);
  };

  const getAvailableStock = (product: any) => {
    if (!product.batches || product.batches.length === 0) return product.stock_quantity || 0;
    return product.batches.reduce((sum: number, b: any) => {
      const isExpired = !!(b.expiry_date && new Date(b.expiry_date) < new Date());
      return isExpired ? sum : sum + (b.quantity || 0);
    }, 0);
  };
  
  const addItem = (product: any) => {
    const existing = items.find(it => it.productId === product._id);
    if (existing) {
      Alert.alert("Thông báo", "Sản phẩm đã có trong danh sách");
      return;
    }

    setItems([...items, {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit || "Cái",
      quantity: 1,
      unit_cost: extractNumber(product.cost_price),
      selling_price: extractNumber(product.price),
      expiry_date: "",
      batch_no: "",
      note: "",
    }]);
    setShowProductModal(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Ref Voucher Logic
  const [showRefVoucherModal, setShowRefVoucherModal] = useState(false);
  const [refVouchers, setRefVouchers] = useState<any[]>([]);
  const [loadingRefVouchers, setLoadingRefVouchers] = useState(false);

  const fetchRefVouchers = async () => {
    try {
      setLoadingRefVouchers(true);
      const res = await inventoryVoucherApi.getInventoryVouchers(storeId || "", { 
          type: "IN", 
          status: "COMPLETED", 
          supplier_id: supplierId || undefined,
          limit: 20 
      });
      if (res && res.data) {
        setRefVouchers(res.data);
      }
    } catch (error) {
       console.log("Err fetch ref vouchers", error);
    } finally {
      setLoadingRefVouchers(false);
    }
  };

  const handleSelectRefVoucher = (voucher: any) => {
      const newItems = voucher.items.map((it: any) => {
          const p = allProducts.find((prod: any) => prod._id === it.product_id);
          return {
            productId: it.product_id,
            name: p ? p.name : (it.name_snapshot || it.product_name || "Unknown"),
            sku: p ? p.sku : (it.sku_snapshot || it.sku || ""),
            unit: p ? p.unit : (it.unit_snapshot || it.unit || ""),
            quantity: it.qty_actual || 0,
            quantity_in_stock: 9999,
            unit_cost: extractNumber(it.unit_cost),
            selling_price: 0,
            batch_no: it.batch_no || "",
            expiry_date: it.expiry_date,
            note: "",
          };
      });
      setItems(newItems);
      setShowRefVoucherModal(false);
      // Auto fill info from voucher if needed?
      // Use voucher.supplier_id to set supplier?
      if (voucher.supplier_id) {
         setSupplierId(voucher.supplier_id);
      }
  };

  // BatchPicker Logic
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [currentPickingIndex, setCurrentPickingIndex] = useState(-1);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);

  const openBatchPicker = (idx: number, productId: string) => {
      const prod = allProducts.find(p => p._id === productId);
      if (prod && prod.batches && prod.batches.length > 0) {
          const validBatches = prod.batches.filter((b:any) => b.quantity > 0);
          if (validBatches.length > 0) {
            setAvailableBatches(validBatches);
            setCurrentPickingIndex(idx);
            setShowBatchModal(true);
          } else {
            Alert.alert("Thông báo", "Sản phẩm này hiện hết lô hàng tồn kho");
          }
      } else {
          Alert.alert("Thông báo", "Sản phẩm này chưa có lô hàng nào");
      }
  };

  const handleSelectBatch = (batch: any) => {
      if (currentPickingIndex === -1) return;
      const newItems = [...items];
      const selectedItem = newItems[currentPickingIndex];
      newItems[currentPickingIndex] = {
          ...selectedItem,
          batch_no: batch.batch_no,
          expiry_date: batch.expiry_date ? (typeof batch.expiry_date === 'string' ? batch.expiry_date.split('T')[0] : new Date(batch.expiry_date).toISOString().split('T')[0]) : "",
          unit_cost: extractNumber(batch.cost_price) || selectedItem.unit_cost,
          selling_price: extractNumber(batch.selling_price) || selectedItem.selling_price || 0
      };
      setItems(newItems);
      setShowBatchModal(false);
  };

  // Auto-fill effects
  useEffect(() => {
    if (type === "RETURN") {
        setDelivererName(user?.fullname || "");
        setReceiverName(""); 
        setSupplierId(null);
    } else if (type === "OUT") {
        setDelivererName(user?.fullname || "");
        setReceiverName("");
        setSupplierId(null);
    } else { // IN
        setReceiverName(user?.fullname || "");
        setDelivererName("");
    }
  }, [type, user]);

  useEffect(() => {
     if ((type === "RETURN" || type === "OUT") && supplierId) {
         const sup = suppliers.find(s => s._id === supplierId);
         if (sup) {
             setReceiverName(sup.contact_person || sup.name);
             setReceiverPhone(sup.phone || "");
         }
     }
  }, [type, supplierId]);

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateItemQty = (index: number, qty: string) => {
    const n = parseFloat(qty) || 0;
    const newItems = [...items];
    newItems[index].quantity = n;
    setItems(newItems);
  };

  const updateItemCost = (index: number, cost: string) => {
    const n = parseFloat(cost) || 0;
    const newItems = [...items];
    newItems[index].unit_cost = n;
    setItems(newItems);
  };
  
  const updateItemNote = (index: number, note: string) => {
    const newItems = [...items];
    newItems[index].note = note;
    setItems(newItems);
  };

  const updateItemExpiry = (index: number, expiry: string) => {
    const newItems = [...items];
    newItems[index].expiry_date = expiry;
    setItems(newItems);
  };

  const updateItemBatchNo = (index: number, batchNo: string) => {
    const newItems = [...items];
    newItems[index].batch_no = batchNo;
    setItems(newItems);
  };

  const updateItemPrice = (index: number, price: string) => {
    const n = parseFloat(price) || 0;
    const newItems = [...items];
    newItems[index].selling_price = n;
    setItems(newItems);
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, it) => {
      const uCost = typeof it.unit_cost === 'number' ? it.unit_cost : 0;
      const qty = typeof it.quantity === 'number' ? it.quantity : 0;
      return sum + (qty * uCost);
    }, 0);
  }, [items]);

  const handleSelectSupplier = (sup: any) => {
    setSupplierId(sup._id);
    setDelivererName(sup.contact_person || sup.name);
    setDelivererPhone(sup.phone || "");
    // Set supplier snapshot fields
    setSupplierPhone(sup.phone || "");
    setSupplierEmail(sup.email || "");
    setSupplierAddress(sup.address || "");
    setSupplierTaxcode(sup.taxcode || "");
    setSupplierContactPerson(sup.contact_person || "");
    setShowSupplierModal(false);
  };

  const handleSave = async () => {
    if (!storeId) return Alert.alert("Lỗi", "Không tìm thấy cửa hàng. Vui lòng đăng nhập lại.");
    
    // Validate required fields
    const errors: string[] = [];
    
    if (!warehouseId) errors.push("• Vui lòng chọn kho hàng");
    if (!reason.trim()) errors.push("• Vui lòng nhập lý do nhập/xuất kho");
    if (!delivererName.trim()) errors.push("• Vui lòng nhập tên người giao");
    if (!receiverName.trim()) errors.push("• Vui lòng nhập tên người nhận");
    if (!refNo.trim()) errors.push("• Vui lòng nhập số chứng từ gốc");
    if (items.length === 0) errors.push("• Vui lòng thêm sản phẩm");
    
    // Parse voucher date for comparison
    const voucherDateParsed = new Date(voucherDate);
    
    // Validate items
    items.forEach((item, idx) => {
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`• Dòng ${idx + 1}: Số lượng phải > 0`);
      }
      if (item.unit_cost < 0) {
        errors.push(`• Dòng ${idx + 1}: Giá vốn không hợp lệ`);
      }
      
      // Validate expiry date >= voucher date for IN vouchers
      if (type === "IN" && item.expiry_date) {
        const expiryDateParsed = new Date(item.expiry_date);
        if (expiryDateParsed < voucherDateParsed) {
          errors.push(`• Dòng ${idx + 1}: Lỗi nhập liệu: Hạn sử dụng không được phép nhỏ hơn ngày nhập kho. Vui lòng kiểm tra lại ngày sản phẩm để tránh nhập hàng hết hạn.`);
        }
      }

      // Kiểm tra tồn kho khả dụng nếu là phiếu XUẤT
      if (type === "OUT") {
        const prod = allProducts.find(p => p._id === item.productId);
        if (prod) {
          const avail = getAvailableStock(prod);
          if (item.quantity > avail) {
            errors.push(`• Dòng ${idx + 1}: "${item.name}" vượt tồn kho khả dụng (Tối đa: ${avail})`);
          }
        }
      }
    });
    
    if (errors.length > 0) {
      return Alert.alert("Lỗi nhập liệu", errors.join("\n"));
    }
    
    try {
      setLoading(true);
      
      const selectedWh = warehouses.find(w => w._id === warehouseId);
      const selectedSup = suppliers.find(s => s._id === supplierId);

      const payload: any = {
        type,
        voucher_code: voucherCode || undefined,
        voucher_date: voucherDate,
        reason,
        attached_docs: parseInt(attachedDocs) || 0,
        warehouse_id: warehouseId,
        warehouse_name: selectedWh?.name || "",
        warehouse_location: warehouseLocation || selectedWh?.address || "",
        deliverer_name: delivererName,
        deliverer_phone: delivererPhone,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        items: items.map(it => ({
          product_id: it.productId,
          qty_actual: it.quantity,
          unit_cost: it.unit_cost,
          selling_price: it.selling_price || 0,
          expiry_date: it.expiry_date || null,
          batch_no: it.batch_no || "",
          note: it.note || "",
          name_snapshot: it.name,
          sku_snapshot: it.sku,
          unit_snapshot: it.unit,
        })),
        ref_no: refNo,
        ref_date: refDate,
        document_place: documentPlace,
        notes: reason,
      };

      if (type === "IN" && supplierId) {
        payload.supplier_id = supplierId;
        payload.supplier_name_snapshot = selectedSup?.name || "";
        payload.supplier_phone_snapshot = supplierPhone;
        payload.supplier_email_snapshot = supplierEmail;
        payload.supplier_address_snapshot = supplierAddress;
        payload.supplier_taxcode_snapshot = supplierTaxcode;
        payload.supplier_contact_person_snapshot = supplierContactPerson;
        // Also set partner fields for backward compatibility
        payload.partner_name = selectedSup?.name || "";
        payload.partner_phone = supplierPhone;
        payload.partner_address = supplierAddress;
      }
      
      await inventoryVoucherApi.createInventoryVoucher(storeId, payload);
      Alert.alert("Thành công", "Đã tạo phiếu kho thành công (Trạng thái: NHÁP)");
      navigation.navigate("InventoryVoucherList");
      route.params?.onRefresh?.();
    } catch (error: any) {
      Alert.alert("Lỗi", error?.response?.data?.message || "Không thể tạo phiếu");
    } finally {
      setLoading(false);
    }
  };

  const renderSection = (title: string, icon: any, children: React.ReactNode) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#10b981" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const selectedWarehouse = warehouses.find(w => w._id === warehouseId);
  const selectedSupplier = suppliers.find(s => s._id === supplierId);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
        <LinearGradient colors={["#10b981", "#059669"]} style={styles.fixedHeader}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.navigate("InventoryVoucherList")} style={styles.headerBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Phiếu {type === "IN" ? "Nhập" : "Xuất"} kho</Text>
            <TouchableOpacity style={styles.headerBack} onPress={loadInitialData}>
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.typeSwitch}>
            <TouchableOpacity 
              style={[styles.typeBtn, type === "IN" && styles.typeBtnActive]}
              onPress={() => setType("IN")}
            >
              <Text style={[styles.typeBtnText, type === "IN" && styles.typeBtnTextActive]}>NHẬP HÀNG</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.typeBtn, type === "OUT" && styles.typeBtnActive]}
              onPress={() => setType("OUT")}
            >
              <Text style={[styles.typeBtnText, type === "OUT" && styles.typeBtnTextActive]}>XUẤT HÀNG</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>

        <View style={styles.formPadding}>
          {renderSection("Thông tin chung", "document-text-outline", (
        <>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>Mã phiếu (Tự động nếu trống)</Text>
              <TextInput style={styles.input} value={voucherCode} onChangeText={setVoucherCode} placeholder="VD: NK-2024..." />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Ngày lập phiếu</Text>
              <TextInput style={styles.input} value={voucherDate} onChangeText={setVoucherDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Chọn kho hàng (*)</Text>
            <TouchableOpacity style={styles.selectBox} onPress={() => setShowWarehouseModal(true)}>
               <View>
                 <Text style={styles.labelSmall}>{selectedWarehouse ? "Đã chọn kho" : "Chưa chọn kho"}</Text>
                 <Text style={styles.selectValue}>{selectedWarehouse?.name || "Bấm để chọn kho hàng..."}</Text>
               </View>
               <Ionicons name="chevron-down" size={20} color="#10b981" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lý do / Ghi chú (*)</Text>
            <TextInput 
              style={[styles.input, { height: 60 }]} 
              value={reason} 
              onChangeText={setReason} 
              multiline 
              placeholder="Mô tả mục đích nhập/xuất kho..."
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>Số chứng từ gốc <Text style={{ color: '#fa8c16', fontSize: 10 }}>(Ghi sổ *)</Text></Text>
              <TextInput style={styles.input} value={refNo} onChangeText={setRefNo} placeholder="VD: Số hóa đơn NCC" />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Ngày chứng từ gốc <Text style={{ color: '#fa8c16', fontSize: 10 }}>(Ghi sổ *)</Text></Text>
              <TextInput style={styles.input} value={refDate} onChangeText={setRefDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.label}>Địa điểm lập</Text>
              <TextInput style={styles.input} value={documentPlace} onChangeText={setDocumentPlace} placeholder="VD: Hà Nội" />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Số chứng từ kèm</Text>
              <TextInput style={styles.input} value={attachedDocs} onChangeText={setAttachedDocs} keyboardType="numeric" />
            </View>
          </View>
        </>
      ))}

          {(type === "IN" || type === "OUT" || type === "RETURN") ? renderSection("Nhà cung cấp", "people-outline", (
            <>
              <TouchableOpacity style={styles.selectBox} onPress={() => setShowSupplierModal(true)}>
                <View>
                  <Text style={styles.label}>Chọn nhà cung cấp (*)</Text>
                  <Text style={styles.selectValue}>{selectedSupplier?.name || "Bấm để chọn nhà cung cấp"}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#10b981" />
              </TouchableOpacity>

              {supplierId && (
                <View style={styles.supplierInfo}>
                  <View style={styles.row}>
                    <View style={[styles.infoItem, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.infoLabel}>SĐT</Text>
                      <Text style={styles.infoValue}>{supplierPhone || "---"}</Text>
                    </View>
                    <View style={[styles.infoItem, { flex: 1 }]}>
                      <Text style={styles.infoLabel}>Mã số thuế</Text>
                      <Text style={styles.infoValue}>{supplierTaxcode || "---"}</Text>
                    </View>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{supplierEmail || "---"}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Người liên hệ</Text>
                    <Text style={styles.infoValue}>{supplierContactPerson || "---"}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Địa chỉ</Text>
                    <Text style={styles.infoValue}>{supplierAddress || "---"}</Text>
                  </View>
                </View>
              )}

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Người giao (*)</Text>
                  <TextInput style={styles.input} value={delivererName} onChangeText={setDelivererName} placeholder="Tên người giao hàng" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>SĐT người giao</Text>
                  <TextInput style={styles.input} value={delivererPhone} onChangeText={setDelivererPhone} placeholder="SĐT" keyboardType="phone-pad" />
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Người nhận (*)</Text>
                  <TextInput style={styles.input} value={receiverName} onChangeText={setReceiverName} placeholder="Tên người nhận" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>SĐT người nhận</Text>
                  <TextInput style={styles.input} value={receiverPhone} onChangeText={setReceiverPhone} placeholder="SĐT" keyboardType="phone-pad" />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Vị trí trong kho</Text>
                <TextInput style={styles.input} value={warehouseLocation} onChangeText={setWarehouseLocation} placeholder="VD: Kệ A - Tầng 2 - Ô 05" />
              </View>
            </>
          )) : renderSection("Giao nhận", "person-outline", (
            <>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Người nhận hàng (*)</Text>
                  <TextInput style={styles.input} value={receiverName} onChangeText={setReceiverName} placeholder="Tên" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>SĐT người nhận</Text>
                  <TextInput style={styles.input} value={receiverPhone} onChangeText={setReceiverPhone} placeholder="SĐT" keyboardType="phone-pad" />
                </View>
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Người giao</Text>
                  <TextInput style={styles.input} value={delivererName} onChangeText={setDelivererName} placeholder="Tên" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>SĐT người giao</Text>
                  <TextInput style={styles.input} value={delivererPhone} onChangeText={setDelivererPhone} placeholder="SĐT" keyboardType="phone-pad" />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Vị trí trong kho</Text>
                <TextInput style={styles.input} value={warehouseLocation} onChangeText={setWarehouseLocation} placeholder="VD: Kệ A - Tầng 2 - Ô 05" />
              </View>
            </>
          ))}

          <View style={styles.itemsCard}>
            <View style={styles.itemsHeader}>
              <Text style={styles.itemsTitle}>Sản phẩm ({items.length})</Text>
              <View style={{flexDirection: 'row'}}>
                 <TouchableOpacity style={[styles.addItemBtn, {marginRight: 8, backgroundColor: '#6366f1'}]} onPress={() => { setShowRefVoucherModal(true); fetchRefVouchers(); }}>
                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                    <Text style={styles.addItemText}>Chọn phiếu nhập</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowProductModal(true)}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.addItemText}>Thêm hàng</Text>
                 </TouchableOpacity>
              </View>
            </View>

            {items.map((it, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemSku}>{it.sku} • {it.unit}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(idx)}>
                    <Ionicons name="trash" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <View style={styles.itemInputs}>
                  <View style={styles.inputSmallWrap}>
                    <Text style={styles.labelSmall}>Số lượng</Text>
                    <TextInput 
                      style={styles.inputSmall} 
                      value={it.quantity.toString()} 
                      onChangeText={(v) => updateItemQty(idx, v)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputSmallWrap, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.labelSmall}>Giá vốn</Text>
                    <TextInput 
                      style={styles.inputSmall} 
                      value={it.unit_cost.toString()} 
                      onChangeText={(v) => updateItemCost(idx, v)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputSmallWrap, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.labelSmall}>Giá bán</Text>
                    <TextInput 
                      style={styles.inputSmall} 
                      value={(it.selling_price || 0).toString()} 
                      onChangeText={(v) => updateItemPrice(idx, v)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={[styles.itemNoteRow, { flexDirection: "row", gap: 8, marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>Số lô</Text>
                    
                    {(type === "OUT" || type === "RETURN") ? (
                         <TouchableOpacity onPress={() => openBatchPicker(idx, it.productId)}>
                            <View style={[styles.itemNoteInput, { justifyContent: 'center', height: 40 }]}>
                                <Text style={{ color: it.batch_no ? '#10b981' : '#94a3b8', fontWeight: it.batch_no ? '700' : '400' }}>
                                   {it.batch_no || "Chọn lô..."}
                                </Text>
                            </View>
                         </TouchableOpacity>
                    ) : (
                        <TextInput 
                          style={styles.itemNoteInput} 
                          value={it.batch_no || ""} 
                          onChangeText={(v) => updateItemBatchNo(idx, v)}
                          placeholder="VD: BATCH001"
                          placeholderTextColor="#94a3b8"
                        />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>Hạn sử dụng</Text>
                    <TextInput 
                      style={styles.itemNoteInput} 
                      value={it.expiry_date || ""} 
                      onChangeText={(v) => updateItemExpiry(idx, v)}
                      placeholder="VD: 2026-12-31"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={{ alignItems: "flex-end", justifyContent: "flex-end" }}>
                    <Text style={styles.labelSmall}>Thành tiền</Text>
                    <Text style={styles.itemTotalText}>
                      {new Intl.NumberFormat('vi-VN').format(it.quantity * it.unit_cost)}đ
                    </Text>
                  </View>
                </View>
                <View style={[styles.itemNoteRow, { marginTop: 6 }]}>
                  <Text style={styles.labelSmall}>Ghi chú</Text>
                  <TextInput 
                    style={styles.itemNoteInput} 
                    value={it.note || ""} 
                    onChangeText={(v) => updateItemNote(idx, v)}
                    placeholder="Ghi chú cho mặt hàng này..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            ))}

            {items.length === 0 && (
              <View style={styles.emptyItems}>
                <Ionicons name="cart-outline" size={48} color="#e2e8f0" />
                <Text style={styles.emptyItemsText}>Chưa chọn sản phẩm nào cho phiếu này</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalBlock}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={styles.totalLabelSmall}>Số dòng: {items.filter(x => x.productId).length}</Text>
            <Text style={styles.totalLabelSmall}>Tổng SL: {items.reduce((sum, it) => sum + (it.quantity || 0), 0)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.totalLabel}>TỔNG TIỀN</Text>
            <Text style={styles.totalValue}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND'}).format(totalAmount)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.submitText}>LƯU PHIẾU NHÁP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Product Search Modal */}
      <Modal visible={showProductModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn sản phẩm</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Tìm tên hoặc mã SKU..." 
                value={searchQuery}
                onChangeText={handleSearchProducts}
                autoFocus
              />
            </View>

            {loadingProducts ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.searchingText}>Đang tải danh sách sản phẩm...</Text>
              </View>
            ) : (
              <FlatList 
                data={displayProducts}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.productResult} onPress={() => addItem(item)}>
                    <View style={styles.productIconBox}>
                      <Ionicons name="cube" size={20} color="#10b981" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.productResultName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.productResultMeta}>
                        <Text style={styles.productResultSku}>SKU: {item.sku || "N/A"}</Text>
                        <View style={styles.dividerDot} />
                        <Text style={styles.productResultUnit}>{item.unit || "Cái"}</Text>
                      </View>
                      <View style={styles.productResultStock}>
                         <View style={[styles.stockBadge, { backgroundColor: (getAvailableStock(item)) > 0 ? "#ecfdf5" : "#fff1f2" }]}>
                           <Text style={[styles.stockBadgeText, { color: (getAvailableStock(item)) > 0 ? "#059669" : "#e11d48" }]}>
                             {getAvailableStock(item) > 0 ? `Khả dụng: ${getAvailableStock(item)}` : "Hết hàng khả dụng"}
                           </Text>
                         </View>
                         {item.stock_quantity > getAvailableStock(item) && (
                           <Text style={{ fontSize: 10, color: '#ef4444', marginLeft: 8 }}>(-{item.stock_quantity - getAvailableStock(item)} hết hạn)</Text>
                         )}
                      </View>
                      <Text style={styles.productResultPrice}>
                         {new Intl.NumberFormat('vi-VN').format(type === "IN" ? (extractNumber(item.cost_price)) : (extractNumber(item.price)))} ₫
                      </Text>
                    </View>
                    <View style={styles.addBtnCircle}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                ListHeaderComponent={
                  !searchQuery.trim() && displayProducts.length > 0 ? (
                    <Text style={styles.listHeader}>Tất cả sản phẩm ({displayProducts.length})</Text>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.emptySearch}>
                    <Ionicons name={searchQuery ? "search-outline" : "cube-outline"} size={64} color="#e2e8f0" />
                    <Text style={styles.noResult}>
                      {searchQuery ? `Không tìm thấy "${searchQuery}"` : "Chưa có sản phẩm nào trong kho"}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Supplier Modal */}
      <Modal visible={showSupplierModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn nhà cung cấp</Text>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList 
              data={suppliers}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectSupplier(item)}>
                  <View>
                    <Text style={styles.searchItemName}>{item.name}</Text>
                    <Text style={styles.searchItemSku}>{item.phone || "Không có SĐT"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 16 }}
            />
          </View>
        </View>
      </Modal>

      {/* Batch Select Modal */}
      <Modal visible={showBatchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '50%' }]}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Chọn lô hàng</Text>
                    <TouchableOpacity onPress={() => setShowBatchModal(false)}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>
                {availableBatches.length > 0 ? (
                    <FlatList
                        data={availableBatches}
                        keyExtractor={(item, index) => item.batch_no || index.toString()}
                        renderItem={({ item }) => {
                          const bExp = item.expiry_date && new Date(item.expiry_date) < new Date();
                          return (
                            <TouchableOpacity 
                              style={[styles.searchItem, bExp && { opacity: 0.6, backgroundColor: '#fff1f2' }]} 
                              onPress={() => handleSelectBatch(item)}
                            >
                                <View style={{flex: 1}}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                                       <Ionicons name="cube-outline" size={16} color={bExp ? "#ef4444" : "#4f46e5"} style={{marginRight: 6}} />
                                       <Text style={[styles.searchItemName, {flex: 1, marginRight: 8}, bExp && { textDecorationLine: 'line-through', color: '#64748b' }]} numberOfLines={2}>{item.batch_no}</Text>
                                    </View>
                                    <View style={{marginTop: 4}}>
                                        <Text style={styles.searchItemSku}>SL: {item.quantity}</Text>
                                        <Text style={[styles.searchItemSku, bExp && { color: '#ef4444', fontWeight: 'bold' }]}>
                                          HSD: {item.expiry_date ? (new Date(item.expiry_date).toISOString().split('T')[0]) : '---'}
                                          {bExp ? " (HẾT HẠN)" : ""}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                                   {item.cost_price && <Text style={styles.searchItemPrice}>{new Intl.NumberFormat('vi-VN').format(extractNumber(item.cost_price))}đ</Text>}
                                   {item.selling_price && <Text style={[styles.searchItemSku, {color: '#059669'}]}>Bán: {new Intl.NumberFormat('vi-VN').format(extractNumber(item.selling_price))}đ</Text>}
                                </View>
                            </TouchableOpacity>
                          );
                        }}
                        contentContainerStyle={{ padding: 16 }}
                    />
                ) : (
                    <View style={styles.emptyItems}>
                        <Text style={styles.emptyItemsText}>Không tìm thấy lô hàng nào</Text>
                    </View>
                )}
            </View>
        </View>
      </Modal>

      {/* Warehouse Modal */}
      <Modal visible={showWarehouseModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn kho hàng</Text>
              <TouchableOpacity onPress={() => setShowWarehouseModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList 
              data={warehouses}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchItem} onPress={() => { setWarehouseId(item._id); setShowWarehouseModal(false); }}>
                  <Text style={styles.searchItemName}>{item.name}</Text>
                  <Ionicons name={warehouseId === item._id ? "radio-button-on" : "radio-button-off"} size={20} color="#10b981" />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: 16 }}
            />
          </View>
        </View>
      </Modal>
      {/* Batch Select Modal */}
      <Modal visible={showBatchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '50%' }]}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Chọn lô hàng</Text>
                    <TouchableOpacity onPress={() => setShowBatchModal(false)}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>
                {availableBatches.length > 0 ? (
                    <FlatList
                        data={availableBatches}
                        keyExtractor={(item, index) => item.batch_no && item.batch_no !== 'N/A' ? `${item.batch_no}-${index}` : index.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectBatch(item)}>
                                <View>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                       <Ionicons name="cube-outline" size={16} color="#4f46e5" style={{marginRight: 6}} />
                                       <Text style={styles.searchItemName}>{item.batch_no}</Text>
                                    </View>
                                    <Text style={styles.searchItemSku}>SL: {item.quantity} • HSD: {item.expiry_date ? (new Date(item.expiry_date).toISOString().split('T')[0]) : '---'}</Text>
                                </View>
                                <View style={{alignItems: 'flex-end'}}>
                                   {item.cost_price && <Text style={styles.searchItemPrice}>{new Intl.NumberFormat('vi-VN').format(Number(item.cost_price))}đ</Text>}
                                   {item.selling_price && <Text style={[styles.searchItemSku, {color: '#059669'}]}>Bán: {new Intl.NumberFormat('vi-VN').format(Number(item.selling_price))}đ</Text>}
                                </View>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ padding: 16 }}
                    />
                ) : (
                    <View style={styles.emptyItems}>
                        <Text style={styles.emptyItemsText}>Không tìm thấy lô hàng nào</Text>
                    </View>
                )}
            </View>
        </View>
      </Modal>
      {/* Ref Voucher Modal */}
      <Modal visible={showRefVoucherModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '70%' }]}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Chọn phiếu nhập nguồn</Text>
                    <TouchableOpacity onPress={() => setShowRefVoucherModal(false)}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>
                {loadingRefVouchers ? (
                    <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={refVouchers}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectRefVoucher(item)}>
                                <View>
                                    <Text style={styles.searchItemName}>{item.code} • {new Date(item.voucher_date).toLocaleDateString("vi-VN")}</Text>
                                    <Text style={styles.searchItemSku}>NCC: {item.supplier_name_snapshot || "---"}</Text>
                                    <Text style={styles.searchItemSku}>Tổng tiền: {new Intl.NumberFormat('vi-VN').format(item.total_amount || 0)}đ ({item.items.length} SP)</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ padding: 16 }}
                        ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#64748b'}}>Không có phiếu nhập nào</Text>}
                    />
                )}
            </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, backgroundColor: "#f8fafc" },
  fixedHeader: { padding: 16, paddingTop: Platform.OS === 'ios' ? 50 : 30, backgroundColor: "#10b981", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, zIndex: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  typeSwitch: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 14, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 10 },
  typeBtnActive: { backgroundColor: "#fff" },
  typeBtnText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  typeBtnTextActive: { color: "#10b981" },
  formPadding: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 10 },
  sectionCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: "#1e293b", shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginLeft: 8 },
  sectionContent: {},
  row: { flexDirection: "row" },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 6, textTransform: "uppercase" },
  input: { backgroundColor: "#f1f5f9", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#e2e8f0", fontSize: 15, color: "#1e293b" },
  selectBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#10b981", marginBottom: 16, elevation: 2 },
  selectValue: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginTop: 2 },
  itemsCard: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, elevation: 2 },
  itemsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  itemsTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  addItemBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#10b981", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addItemText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  productResult: { padding: 16, backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#f1f5f9", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  productIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center" },
  productResultName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  productResultMeta: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  productResultSku: { fontSize: 12, color: "#64748b" },
  productResultUnit: { fontSize: 12, color: "#64748b" },
  productResultStock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stockBadgeText: { fontSize: 11, fontWeight: "700" },
  productResultPrice: { fontSize: 14, fontWeight: "800", color: "#10b981" },
  dividerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#cbd5e1", marginHorizontal: 6 },
  addBtnCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", marginLeft: 12 },
  searchLoading: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  searchingText: { marginTop: 12, color: "#94a3b8", fontSize: 14 },
  emptySearch: { alignItems: "center", marginTop: 60 },
  itemRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  itemMain: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  itemSku: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  itemInputs: { flexDirection: "row", alignItems: "flex-end" },
  inputSmallWrap: { flex: 0.6 },
  labelSmall: { fontSize: 10, fontWeight: "700", color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" },
  inputSmall: { backgroundColor: "#f1f5f9", borderRadius: 8, padding: 8, fontSize: 14, fontWeight: "700", color: "#1e293b" },
  itemTotalText: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  supplierInfo: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, marginBottom: 16 },
  infoItem: { marginBottom: 8 },
  infoLabel: { fontSize: 10, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginTop: 2 },
  itemNoteRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  itemNoteInput: { backgroundColor: "#f8fafc", borderRadius: 8, padding: 8, fontSize: 13, color: "#64748b" },
  emptyItems: { padding: 40, alignItems: "center" },
  emptyItemsText: { color: "#cbd5e1", fontSize: 14, marginTop: 12, textAlign: "center" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0", flexDirection: "row", alignItems: "center", gap: 12 },
  totalBlock: { flex: 1 },
  totalLabel: { fontSize: 10, fontWeight: "700", color: "#94a3b8", letterSpacing: 1 },
  totalLabelSmall: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  totalValue: { fontSize: 20, fontWeight: "900", color: "#10b981" },
  submitBtn: { backgroundColor: "#10b981", paddingHorizontal: 20, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, flex: 1 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, height: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  modalSearch: { flexDirection: "row", alignItems: "center", padding: 12, margin: 16, backgroundColor: "#f8fafc", borderRadius: 14, gap: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  modalInput: { flex: 1, fontSize: 16, color: "#1e293b" },
  searchItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: "#f1f5f9" },
  searchItemName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  searchItemSku: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  searchItemPrice: { fontSize: 14, fontWeight: "800", color: "#10b981" },
  listHeader: { fontSize: 14, fontWeight: "700", color: "#64748b", marginBottom: 12, paddingHorizontal: 4 },
  noResult: { textAlign: "center", color: "#94a3b8", marginTop: 20, fontSize: 15, fontWeight: "600" },
});

export default InventoryVoucherFormScreen;
