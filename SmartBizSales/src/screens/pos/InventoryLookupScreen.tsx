// src/screens/pos/InventoryLookupScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";

/** =========================
 * Types
 * ========================= */
type Product = {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  unit: string;
};

/** =========================
 * Helpers
 * ========================= */
const safeParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function debounce<F extends (...args: any[]) => any>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const formatPrice = (price: number) =>
  `${Math.max(0, Math.round(Number(price || 0))).toLocaleString("vi-VN")}₫`;

const stockBadgeStyle = (stock: number) => {
  if (stock === 0)
    return { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca", label: "Hết" };
  if (stock <= 10)
    return {
      bg: "#ffedd5",
      text: "#9a3412",
      border: "#fed7aa",
      label: "Sắp hết",
    };
  return { bg: "#dcfce7", text: "#166534", border: "#bbf7d0", label: "Còn" };
};

type SortOrder = "default" | "asc" | "desc";

/** =========================
 * Screen
 * ========================= */
const InventoryLookupScreen: React.FC = () => {
  const [loadingInit, setLoadingInit] = useState(true);

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("POS");
  const [token, setToken] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [token]);

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");

  // pagination đơn giản dạng "load-more" (mobile không phù hợp kiểu table paging)
  const [pageSize, setPageSize] = useState(50);

  // init: get store + token
  useEffect(() => {
    (async () => {
      try {
        const [csRaw, tkn] = await Promise.all([
          AsyncStorage.getItem("currentStore"),
          AsyncStorage.getItem("token"),
        ]);
        const cs = safeParse(csRaw);
        setStoreId(cs?._id || "");
        setStoreName(cs?.name || "POS");
        setToken(tkn);
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res: any = await apiClient.get(`/products/store/${storeId}`, {
        headers: authHeaders,
      });
      const data: Product[] = res?.data?.products || [];
      setProducts(Array.isArray(data) ? data : []);
      setFiltered(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setProducts([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, authHeaders]);

  useEffect(() => {
    if (!storeId) return;
    loadProducts();
  }, [storeId, loadProducts]);

  // debounced search
  const searchDebounced = useMemo(
    () =>
      debounce((value: string, list: Product[]) => {
        const lower = (value || "").trim().toLowerCase();
        if (!lower) return list;

        return list.filter(
          (p) =>
            (p.name || "").toLowerCase().includes(lower) ||
            (p.sku || "").toLowerCase().includes(lower)
        );
      }, 200),
    []
  );

  // apply filters/sort
  useEffect(() => {
    let next = products;

    // search
    // (debounce returns list, so we use a small wrapper)
    const run = async () => {
      const searched = await new Promise<Product[]>((resolve) => {
        searchDebounced(search, products);
        // hack: debounce doesn't return; we replicate logic synchronously instead:
        const lower = (search || "").trim().toLowerCase();
        if (!lower) resolve(products);
        else {
          resolve(
            products.filter(
              (p) =>
                (p.name || "").toLowerCase().includes(lower) ||
                (p.sku || "").toLowerCase().includes(lower)
            )
          );
        }
      });

      next = searched;

      // sort by stock
      if (sortOrder !== "default") {
        next = [...next].sort((a, b) =>
          sortOrder === "asc"
            ? (a.stock_quantity || 0) - (b.stock_quantity || 0)
            : (b.stock_quantity || 0) - (a.stock_quantity || 0)
        );
      }

      setFiltered(next);
    };

    run();
  }, [search, products, sortOrder, searchDebounced]);

  const visibleData = useMemo(
    () => filtered.slice(0, pageSize),
    [filtered, pageSize]
  );

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Tra cứu tồn kho</Text>
          <Text style={styles.muted}>Chưa chọn cửa hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tra cứu tồn kho</Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {storeName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.card}>
          <TextInput
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              setPageSize(50); // reset visible count when search changes
            }}
            placeholder="Tìm tên sản phẩm hoặc mã SKU..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <View style={{ height: 10 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setSortOrder("default")}
                style={({ pressed }) => [
                  styles.pill,
                  sortOrder === "default" ? styles.pillOn : styles.pillOff,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={
                    sortOrder === "default"
                      ? styles.pillTextOn
                      : styles.pillTextOff
                  }
                >
                  Mặc định
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSortOrder("asc")}
                style={({ pressed }) => [
                  styles.pill,
                  sortOrder === "asc" ? styles.pillOn : styles.pillOff,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={
                    sortOrder === "asc" ? styles.pillTextOn : styles.pillTextOff
                  }
                >
                  Tồn kho tăng dần
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSortOrder("desc")}
                style={({ pressed }) => [
                  styles.pill,
                  sortOrder === "desc" ? styles.pillOn : styles.pillOff,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text
                  style={
                    sortOrder === "desc"
                      ? styles.pillTextOn
                      : styles.pillTextOff
                  }
                >
                  Tồn kho giảm dần
                </Text>
              </Pressable>

              <Pressable
                onPress={loadProducts}
                style={({ pressed }) => [
                  styles.outlineBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.outlineBtnText}>Tải lại</Text>
              </Pressable>
            </View>
          </ScrollView>

          <Text style={[styles.muted, { marginTop: 10 }]}>
            Có tất cả{" "}
            <Text style={{ fontWeight: "900", color: "#1d4ed8" }}>
              {filtered.length}
            </Text>{" "}
            sản phẩm
          </Text>
        </View>

        <View style={styles.card}>
          {loading ? (
            <View style={styles.centerSlim}>
              <ActivityIndicator />
              <Text style={styles.muted}>Đang tải tồn kho...</Text>
            </View>
          ) : (
            <FlatList
              data={visibleData}
              keyExtractor={(i) => i._id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListEmptyComponent={
                <Text style={styles.muted}>Không có sản phẩm</Text>
              }
              renderItem={({ item, index }) => {
                const badge = stockBadgeStyle(item.stock_quantity || 0);
                return (
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.index}>{index + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.meta} numberOfLines={1}>
                          SKU: {item.sku} • {item.unit || "---"}
                        </Text>
                        <Text style={styles.price}>
                          {formatPrice(item.price || 0)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rowRight}>
                      <View
                        style={[
                          styles.stockBadge,
                          {
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.stockBadgeText, { color: badge.text }]}
                        >
                          {item.stock_quantity ?? 0}
                        </Text>
                      </View>
                      <Text style={[styles.stockHint, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {!loading && filtered.length > pageSize ? (
            <Pressable
              onPress={() => setPageSize((p) => p + 50)}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.loadMoreText}>
                Xem thêm ({Math.min(50, filtered.length - pageSize)} sản phẩm)
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default InventoryLookupScreen;

/** =========================
 * Styles (tone xanh #10b981)
 * ========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    paddingTop: Platform.OS === "android" ? 14 : 6,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: "#10b981",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  headerSub: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    marginTop: 2,
  },

  title: { fontSize: 18, fontWeight: "900", color: "#0b1220" },
  muted: { color: "#64748b", fontWeight: "700", marginTop: 6 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },

  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    color: "#0b1220",
    backgroundColor: "#fff",
  },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOn: { backgroundColor: "#ecfdf5", borderColor: "#10b981" },
  pillOff: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  pillTextOn: { fontWeight: "900", color: "#047857", fontSize: 12 },
  pillTextOff: { fontWeight: "900", color: "#0b1220", fontSize: 12 },

  outlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  outlineBtnText: { fontWeight: "900", color: "#0b1220", fontSize: 12 },

  row: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: { flex: 1, flexDirection: "row", gap: 12 },
  index: {
    width: 30,
    textAlign: "center",
    fontWeight: "900",
    color: "#0b1220",
    marginTop: 2,
  },
  name: { fontWeight: "900", color: "#0b1220" },
  meta: { marginTop: 4, color: "#475569", fontWeight: "700", fontSize: 12 },
  price: { marginTop: 6, color: "#1d4ed8", fontWeight: "900" },

  rowRight: { alignItems: "flex-end", justifyContent: "center" },
  stockBadge: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  stockBadgeText: { fontWeight: "900" },
  stockHint: { marginTop: 6, fontWeight: "900", fontSize: 11 },

  loadMoreBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  loadMoreText: { fontWeight: "900", color: "#0b1220" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerSlim: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
