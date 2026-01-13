import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import apiClient from "../../api/apiClient";
import { getPermissionCatalog, updateUserById } from "@/api/userApi";
import { useAuth } from "@/context/AuthContext";

type TabKey = "active" | "deleted" | "permissions";

export interface EmployeeUser {
  _id: string;
  username?: string;
  email?: string;
  phone?: string;
  menu?: string[];
}

export interface EmployeeRecord {
  _id?: string;
  fullName?: string;
  shift?: string;
  salary?: number;
  commission_rate?: number;
  user_id: EmployeeUser | string;
}

const normalizePermissions = (list: any[] = []) =>
  Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .filter((p) => typeof p === "string")
        .map((p) => p.trim())
        .filter(Boolean)
    )
  );

interface PermissionGroup {
  key: string;
  label: string;
  items: { key: string; label: string }[];
}

const groupPermissions = (permissionList: string[] = []): PermissionGroup[] => {
  const groups: Record<
    string,
    { key: string; label: string; items: { key: string; label: string }[] }
  > = {};

  permissionList.forEach((perm) => {
    const [catRaw] = perm.split(":");
    const catKey = catRaw || "other";
    if (!groups[catKey]) {
      groups[catKey] = {
        key: catKey,
        label: catKey.toUpperCase(),
        items: [],
      };
    }
    groups[catKey].items.push({ key: perm, label: perm });
  });

  return Object.values(groups)
    .map((g) => ({
      ...g,
      items: g.items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const formatVND = (value: number | null | undefined) => {
  const num = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${num} đ`;
  }
};

const EmployeesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { currentStore, token } = useAuth();
  const storeId = (currentStore as any)?._id || (currentStore as any)?.id;

  const axiosConfig = useMemo(
    () => ({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
    [token]
  );

  const [tabKey, setTabKey] = useState<TabKey>("active");
  const [searchText, setSearchText] = useState("");

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [activeEmployees, setActiveEmployees] = useState<EmployeeRecord[]>([]);
  const [deletedEmployees, setDeletedEmployees] = useState<EmployeeRecord[]>([]);
  const [filteredActive, setFilteredActive] = useState<EmployeeRecord[]>([]);
  const [filteredDeleted, setFilteredDeleted] = useState<EmployeeRecord[]>([]);

  // Animation values for Collapsible Header
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslate = useRef(new Animated.Value(0)).current;
  const [headerVisible, setHeaderVisible] = useState(true);

  const HEADER_HEIGHT = 160 + insets.top;

  useEffect(() => {
    const listener = scrollY.addListener(({ value }: { value: number }) => {
      const diff = value - lastScrollY.current;
      lastScrollY.current = value;

      if (value < 50) {
        Animated.timing(headerTranslate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
        setHeaderVisible(true);
        return;
      }

      if (diff > 5) {
        if (headerVisible) {
          Animated.timing(headerTranslate, {
            toValue: -HEADER_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start();
          setHeaderVisible(false);
        }
      } else if (diff < -5) {
        if (!headerVisible) {
          Animated.timing(headerTranslate, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
          setHeaderVisible(true);
        }
      }
    });

    return () => scrollY.removeListener(listener);
  }, [headerVisible, HEADER_HEIGHT]);

  // ====== STATE PHÂN QUYỀN ======
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionOptions, setPermissionOptions] = useState<string[]>([]);
  const [defaultStaffPermissions, setDefaultStaffPermissions] = useState<
    string[]
  >([]);
  const [selectedStaff, setSelectedStaff] = useState<EmployeeRecord | null>(
    null
  );
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Tìm kiếm quyền
  const [permissionSearchText, setPermissionSearchText] = useState("");

  const filteredPermissionOptions = useMemo(() => {
    const q = permissionSearchText.trim().toLowerCase();
    if (!q) return permissionOptions;
    return permissionOptions.filter((p) => p.toLowerCase().includes(q));
  }, [permissionOptions, permissionSearchText]);

  const groupedPermissionOptions = useMemo(
    () => groupPermissions(filteredPermissionOptions),
    [filteredPermissionOptions]
  );

  const selectedPermissionSet = useMemo(
    () => new Set(selectedPermissions),
    [selectedPermissions]
  );

  // Thu gọn/mở rộng nhóm quyền
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : !prev[groupKey],
    }));
  };

  // ====== LOAD EMPLOYEES ======
  const applySearch = useCallback((list: EmployeeRecord[], text: string) => {
    const q = text.trim().toLowerCase();
    if (!q) return list;

    return list.filter((emp) => {
      const user =
        emp.user_id && typeof emp.user_id === "object"
          ? (emp.user_id as EmployeeUser)
          : ({} as EmployeeUser);

      return (
        (emp.fullName || "").toLowerCase().includes(q) ||
        (user.username || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q)
      );
    });
  }, []);

  const loadEmployees = useCallback(
    async (deleted: boolean, isRefresh = false) => {
      if (!storeId) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const res: any = await apiClient.get(`/stores/${storeId}/employees`, {
          ...axiosConfig,
          params: { deleted },
        });

        const list: EmployeeRecord[] = res.data?.employees || [];

        if (deleted) {
          setDeletedEmployees(list);
          setFilteredDeleted(applySearch(list, searchText));
        } else {
          setActiveEmployees(list);
          setFilteredActive(applySearch(list, searchText));
        }
      } catch (e: any) {
        Alert.alert(
          "Lỗi",
          `Không thể tải danh sách nhân viên ${deleted ? "đã xoá" : "đang làm"}`
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, axiosConfig, applySearch, searchText]
  );

  useEffect(() => {
    if (storeId) {
      loadEmployees(false);
    }
  }, [storeId, loadEmployees]);

  const onRefresh = () => {
    if (tabKey === "deleted") loadEmployees(true, true);
    else loadEmployees(false, true);
  };

  // ====== SEARCH ======
  useEffect(() => {
    if (tabKey === "deleted") {
      setFilteredDeleted(applySearch(deletedEmployees, searchText));
    } else {
      setFilteredActive(applySearch(activeEmployees, searchText));
    }
  }, [searchText, tabKey, activeEmployees, deletedEmployees, applySearch]);

  // ====== SOFT DELETE / RESTORE ======
  const handleSoftDelete = async (id?: string) => {
    if (!storeId || !id) return;
    try {
      setLoading(true);
      await apiClient.delete(
        `/stores/${storeId}/employees/${id}/soft`,
        axiosConfig
      );
      Alert.alert("Thành công", "Đã xoá mềm nhân viên.");
      await loadEmployees(false);
      await loadEmployees(true);
    } catch (e: any) {
      Alert.alert("Lỗi", "Không thể xoá nhân viên.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id?: string) => {
    if (!storeId || !id) return;
    try {
      setLoading(true);
      await apiClient.put(
        `/stores/${storeId}/employees/${id}/restore`,
        {},
        axiosConfig
      );
      Alert.alert("Thành công", "Đã khôi phục nhân viên.");
      await loadEmployees(true);
      await loadEmployees(false);
    } catch (e: any) {
      Alert.alert("Lỗi", "Không thể khôi phục nhân viên.");
    } finally {
      setLoading(false);
    }
  };

  // ====== PERMISSION: CATALOG ======
  const ensurePermissionCatalog = useCallback(async () => {
    if (permissionOptions.length) {
      return {
        permissions: permissionOptions,
        staffDefault: defaultStaffPermissions,
      };
    }

    const res: any = await getPermissionCatalog();
    const perms = normalizePermissions(res?.permissions || []);
    const staffDefault = normalizePermissions(
      res?.staffDefault?.length ? res.staffDefault : perms
    );

    setPermissionOptions(perms);
    setDefaultStaffPermissions(staffDefault);

    return { permissions: perms, staffDefault };
  }, [permissionOptions.length, permissionOptions, defaultStaffPermissions]);

  // ====== PERMISSION: CHỌN NHÂN VIÊN ======
  const handleSelectStaff = useCallback(
    async (record: EmployeeRecord) => {
      if (!record?._id) return;

      setSelectedStaff(record);
      setPermissionLoading(true);

      try {
        const catalog = await ensurePermissionCatalog();
        const user =
          record.user_id && typeof record.user_id === "object"
            ? (record.user_id as EmployeeUser)
            : ({} as EmployeeUser);

        const currentMenu = normalizePermissions(user.menu || []);

        const merged = normalizePermissions([
          ...(catalog.permissions || []),
          ...currentMenu,
        ]);

        setPermissionOptions(merged);
        setSelectedPermissions(currentMenu);
        setPermissionSearchText("");

        // default: mở tất cả nhóm khi vừa chọn nhân viên
        const initialExpanded: Record<string, boolean> = {};
        groupPermissions(merged).forEach(
          (g) => (initialExpanded[g.key] = true)
        );
        setExpandedGroups((prev) =>
          Object.keys(prev).length ? prev : initialExpanded
        );
      } catch (e: any) {
        Alert.alert("Lỗi", "Không thể tải quyền của nhân viên.");
      } finally {
        setPermissionLoading(false);
      }
    },
    [ensurePermissionCatalog]
  );

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permKey)) return prev.filter((p) => p !== permKey);
      return [...prev, permKey];
    });
  };

  const toggleGroup = (groupKey: string, groupItems: { key: string }[]) => {
    const groupKeys = groupItems.map((i) => i.key);
    const checkedCount = groupKeys.filter((k) =>
      selectedPermissionSet.has(k)
    ).length;
    const shouldSelectAll = checkedCount !== groupKeys.length;

    setSelectedPermissions((prev) => {
      if (shouldSelectAll) return normalizePermissions([...prev, ...groupKeys]);
      return prev.filter((p) => !groupKeys.includes(p));
    });
  };

  const syncUpdatedMenus = (userId: string, newMenu: string[]) => {
    const updater = (list: EmployeeRecord[]) =>
      list.map((emp) => {
        const empUserId =
          (emp.user_id as any)?._id ||
          (typeof emp.user_id === "string" ? emp.user_id : undefined);

        if (String(empUserId) !== String(userId)) return emp;

        const user =
          emp.user_id && typeof emp.user_id === "object"
            ? (emp.user_id as EmployeeUser)
            : ({} as EmployeeUser);

        return { ...emp, user_id: { ...user, menu: newMenu } };
      });

    setActiveEmployees((prev) => updater(prev));
    setFilteredActive((prev) => updater(prev));
  };

  const handleSavePermissions = async () => {
    if (!storeId || !selectedStaff) return;

    const userId =
      (selectedStaff.user_id as any)?._id ||
      (typeof selectedStaff.user_id === "string"
        ? selectedStaff.user_id
        : null);

    if (!userId) {
      Alert.alert("Lỗi", "Không tìm thấy userId của nhân viên.");
      return;
    }

    const sanitizedMenu = normalizePermissions(selectedPermissions);

    try {
      setPermissionSaving(true);
      await updateUserById(userId, { menu: sanitizedMenu, storeId });
      syncUpdatedMenus(userId, sanitizedMenu);
      Alert.alert("Thành công", "Đã cập nhật quyền cho nhân viên.");
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Không thể cập nhật quyền."
      );
    } finally {
      setPermissionSaving(false);
    }
  };

  const handleUseDefaultPermissions = () => {
    setSelectedPermissions(defaultStaffPermissions);
    setPermissionSearchText("");
  };

  const handleSelectAllPermissions = () => {
    setSelectedPermissions(permissionOptions);
  };

  const handleClearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  // ====== TAB CHANGE ======
  const handleTabChange = async (key: TabKey) => {
    setTabKey(key);

    if (key === "deleted") {
      await loadEmployees(true);
    }

    if (key === "permissions") {
      await loadEmployees(false);
      try {
        await ensurePermissionCatalog();
      } catch {
        // ignore
      }
    }
  };

  // ====== RENDER ITEM LIST NHÂN VIÊN ======
  const renderEmployeeItem = ({ item }: { item: EmployeeRecord }) => {
    const user =
      item.user_id && typeof item.user_id === "object"
        ? (item.user_id as EmployeeUser)
        : ({} as EmployeeUser);

    const phone = user.phone || "";

    const formatPhone = (num: string) => {
      const cleaned = num.replace(/\D/g, "");
      if (cleaned.length === 10) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
      }
      return num;
    };

    const isDeleted = tabKey === "deleted";

    return (
      <View style={styles.employeeCard}>
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={isDeleted ? ["#94a3b8", "#64748b"] : ["#3b82f6", "#2563eb"]}
            style={styles.avatarCircle}
          >
            <Text style={styles.avatarInitial}>
              {(item.fullName || user.username || "?").charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.empName} numberOfLines={1}>
              {item.fullName || user.username || "Staff Name"}
            </Text>
            <View style={styles.roleRow}>
              <Ionicons name="mail" size={12} color="#64748b" />
              <Text style={styles.empEmail} numberOfLines={1}>
                {user.email || "No email provided"}
              </Text>
            </View>
          </View>
          {!isDeleted && (
            <TouchableOpacity
              onPress={() => handleSoftDelete(item._id)}
              style={styles.deleteIconButton}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.bodyRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>LIÊN HỆ</Text>
              <View style={styles.infoValueRow}>
                <Ionicons name="call" size={14} color="#10b981" />
                <Text style={styles.infoValue}>{phone ? formatPhone(phone) : "—"}</Text>
              </View>
            </View>
            <View style={[styles.infoCol, { alignItems: "flex-end" }]}>
              <Text style={styles.infoLabel}>CA LÀM VIÊC</Text>
              <View style={styles.infoValueRow}>
                <Ionicons name="time" size={14} color="#f59e0b" />
                <Text style={styles.infoValue}>{item.shift || "N/A"}</Text>
              </View>
            </View>
          </View>

          <LinearGradient
            colors={["#f8fafc", "#f1f5f9"]}
            style={styles.financialStats}
          >
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Lương cơ bản</Text>
              <Text style={styles.financeValue}>{formatVND(item.salary)}</Text>
            </View>
            <View style={styles.financeDivider} />
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Hoa hồng</Text>
              <Text style={styles.financeValue}>{Number(item.commission_rate ?? 0)}%</Text>
            </View>
          </LinearGradient>
        </View>

        {isDeleted && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => handleRestore(item._id)}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.restoreButtonText}>Khôi phục nhân viên</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ====== RENDER TAB PHÂN QUYỀN: 1 LUỒNG CUỘN DỌC DUY NHẤT ======
  const renderPermissionsTab = () => {
    const selectedUser =
      selectedStaff?.user_id && typeof selectedStaff.user_id === "object"
        ? (selectedStaff.user_id as EmployeeUser)
        : ({} as EmployeeUser);

    const selectedName =
      selectedStaff?.fullName || selectedUser?.username || "—";
    const selectedEmail = selectedUser?.email || "—";
    const totalPerms = permissionOptions.length;

    const groupData =
      selectedStaff && !permissionLoading ? groupedPermissionOptions : [];

    const Header = () => (
      <View>
        <View style={styles.permissionHint}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#2563eb"
          />
          <Text style={styles.permissionHintText}>
            Lăn xuống để chọn quyền. Cuộn dọc là một luồng duy nhất, không bị
            tràn màn hình.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Danh sách nhân viên</Text>

        <FlatList
          data={filteredActive}
          keyExtractor={(item) => item._id!}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 10,
            paddingBottom: 8,
          }}
          renderItem={({ item }) => {
            const isActive =
              selectedStaff && String(selectedStaff._id) === String(item._id);

            const user =
              item.user_id && typeof item.user_id === "object"
                ? (item.user_id as EmployeeUser)
                : ({} as EmployeeUser);

            return (
              <TouchableOpacity
                onPress={() => handleSelectStaff(item)}
                style={[
                  styles.staffAvatarBtn,
                  isActive && styles.staffAvatarBtnActive,
                ]}
              >
                <LinearGradient
                  colors={
                    isActive
                      ? ["#3b82f6", "#2563eb"]
                      : ["#f1f5f9", "#e2e8f0"]
                  }
                  style={styles.staffAvatarCircle}
                >
                  <Text
                    style={[
                      styles.staffInitial,
                      isActive && styles.staffInitialActive,
                    ]}
                  >
                    {(item.fullName || user.username || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </LinearGradient>
                <Text
                  style={[
                    styles.staffNameLabel,
                    isActive && styles.staffNameLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.fullName || user.username || "Staff"}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {!selectedStaff ? (
          <View
            style={[styles.emptyBox, { marginHorizontal: 16, marginTop: 10 }]}
          >
            <Ionicons name="people-outline" size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>
              Chọn một nhân viên để phân quyền
            </Text>
          </View>
        ) : permissionLoading ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.loadingLabel}>Đang tải quyền...</Text>
          </View>
        ) : (
          <View style={styles.selectedStaffCard}>
            <View style={styles.selectedStaffRow}>
              <Ionicons name="person-circle" size={34} color="#2563eb" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.selectedStaffName} numberOfLines={1}>
                  {selectedName}
                </Text>
                <Text style={styles.selectedStaffSub} numberOfLines={1}>
                  {selectedEmail}
                </Text>
              </View>

              <View style={styles.selectedStaffStat}>
                <Text style={styles.selectedStaffStatLabel}>Đã chọn</Text>
                <Text style={styles.selectedStaffStatValue}>
                  {selectedPermissions.length}/{Math.max(totalPerms, 0)}
                </Text>
              </View>
            </View>

            <View style={styles.permissionActionRow}>
              <TouchableOpacity
                style={[styles.smallBtn, styles.smallBtnGray]}
                onPress={handleUseDefaultPermissions}
                disabled={permissionSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.smallBtnGrayText}>Quyền mặc định</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallBtn, styles.smallBtnGray]}
                onPress={handleSelectAllPermissions}
                disabled={permissionSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.smallBtnGrayText}>Chọn tất cả</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.smallBtn, styles.smallBtnGray]}
                onPress={handleClearAllPermissions}
                disabled={permissionSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.smallBtnGrayText}>Bỏ hết</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.permSearchWrap}>
              <Ionicons name="search-outline" size={16} color="#9ca3af" />
              <TextInput
                style={styles.permSearchInput}
                placeholder="Tìm quyền theo tên..."
                value={permissionSearchText}
                onChangeText={setPermissionSearchText}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {!!permissionSearchText && (
                <TouchableOpacity
                  onPress={() => setPermissionSearchText("")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {!!permissionSearchText &&
              filteredPermissionOptions.length === 0 && (
                <View style={styles.noPermBox}>
                  <Ionicons name="search" size={18} color="#9ca3af" />
                  <Text style={styles.noPermText}>
                    Không tìm thấy quyền phù hợp.
                  </Text>
                </View>
              )}
          </View>
        )}

        <View style={{ height: 8 }} />
      </View>
    );

    const Footer = () => {
      if (!selectedStaff || permissionLoading)
        return <View style={{ height: 16 }} />;

      return (
        <View style={[styles.saveBar, { paddingBottom: 12 + insets.bottom }]}>
          <View style={styles.saveBarLeft}>
            <Text style={styles.saveBarTitle}>Đã chọn</Text>
            <Text style={styles.saveBarSub}>
              {selectedPermissions.length}/
              {Math.max(permissionOptions.length, 0)} quyền
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, permissionSaving && { opacity: 0.7 }]}
            onPress={handleSavePermissions}
            disabled={permissionSaving}
            activeOpacity={0.9}
          >
            {permissionSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Lưu</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <Animated.FlatList
          style={{ flex: 1 }}
          data={groupData}
          keyExtractor={(g) => g.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 160,
            paddingTop: HEADER_HEIGHT + 10,
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={<Header />}
          ListEmptyComponent={
            selectedStaff && !permissionLoading && groupData.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  { marginHorizontal: 16, marginTop: 10 },
                ]}
              >
                <Ionicons name="key-outline" size={40} color="#d1d5db" />
                <Text style={styles.emptyText}>
                  Chưa có danh sách quyền để hiển thị.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: g }) => {
            const groupKey = g.key;
            const groupItems = g.items || [];
            const groupKeys = groupItems.map((i) => i.key);
            const checkedCount = groupKeys.filter((k) =>
              selectedPermissionSet.has(k)
            ).length;
            const expanded = expandedGroups[groupKey] !== false;

            return (
              <View style={[styles.groupCard, { marginHorizontal: 16 }]}>
                <View style={styles.groupHeaderRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.groupHeaderTitle} numberOfLines={1}>
                      {g.label}
                    </Text>
                    <Text style={styles.groupCount2}>
                      {checkedCount}/{groupItems.length} quyền
                    </Text>
                  </View>

                  <View style={styles.groupHeaderActions}>
                    <TouchableOpacity
                      onPress={() => toggleGroup(groupKey, groupItems)}
                      disabled={permissionSaving || groupItems.length === 0}
                      activeOpacity={0.85}
                      style={styles.groupHeaderIconBtn}
                    >
                      <Ionicons
                        name={
                          groupItems.length > 0 &&
                          checkedCount === groupItems.length
                            ? "checkbox"
                            : "square-outline"
                        }
                        size={18}
                        color={
                          groupItems.length > 0 &&
                          checkedCount === groupItems.length
                            ? "#2563eb"
                            : "#9ca3af"
                        }
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => toggleGroupExpand(groupKey)}
                      activeOpacity={0.85}
                      style={styles.groupHeaderIconBtn}
                    >
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#374151"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {!expanded ? (
                  <Text style={styles.groupCollapsedHint}>
                    Đang thu gọn (bấm mũi tên để mở)
                  </Text>
                ) : (
                  <View style={{ marginTop: 10 }}>
                    {groupItems.map((perm) => {
                      const checked = selectedPermissionSet.has(perm.key);
                      return (
                        <TouchableOpacity
                          key={perm.key}
                          onPress={() => togglePermission(perm.key)}
                          disabled={permissionSaving}
                          activeOpacity={0.85}
                          style={[
                            styles.permItem,
                            checked && styles.permItemChecked,
                          ]}
                        >
                          <Ionicons
                            name={
                              checked ? "checkmark-circle" : "ellipse-outline"
                            }
                            size={18}
                            color={checked ? "#2563eb" : "#d1d5db"}
                          />
                          <Text
                            style={[
                              styles.permText,
                              checked && styles.permTextChecked,
                            ]}
                          >
                            {perm.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
        <View style={styles.stickyFooter}>
          <Footer />
        </View>
      </View>
    );
  };

  // ====== GUARD: CHƯA CHỌN CỬA HÀNG ======
  if (!storeId) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.centerTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.centerSub}>Vui lòng chọn cửa hàng trước.</Text>
      </SafeAreaView>
    );
  }

  const activeCount = useMemo(
    () => activeEmployees.length,
    [activeEmployees]
  );

  return (
    <View style={styles.container}>
      {/* Animated Collapsible Header */}
      <Animated.View
        style={[
          styles.collapsibleHeader,
          {
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslate }],
            paddingTop: insets.top,
          },
        ]}
      >
        <LinearGradient
          colors={["#3b82f6", "#10b981"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Nhân viên</Text>
            <Text style={styles.headerSubtitle}>
              Quản lý {activeEmployees.length} nhân sự cửa hàng
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            onPress={() => handleTabChange("active")}
            style={[
              styles.modeTab,
              tabKey === "active" && styles.modeTabActive,
            ]}
          >
            <Text
              style={[
                styles.modeTabText,
                tabKey === "active" && styles.modeTabTextActive,
              ]}
            >
              Đang làm
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange("deleted")}
            style={[
              styles.modeTab,
              tabKey === "deleted" && styles.modeTabActive,
            ]}
          >
            <Text
              style={[
                styles.modeTabText,
                tabKey === "deleted" && styles.modeTabTextActive,
              ]}
            >
              Đã nghỉ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange("permissions")}
            style={[
              styles.modeTab,
              tabKey === "permissions" && styles.modeTabActive,
            ]}
          >
            <Text
              style={[
                styles.modeTabText,
                tabKey === "permissions" && styles.modeTabTextActive,
              ]}
            >
              Phân quyền
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsInline}>
          <View style={styles.statMini}>
            <Text style={styles.statMiniValue}>{activeEmployees.length}</Text>
            <Text style={styles.statMiniLabel}>Hoạt động</Text>
          </View>
          <View style={styles.statMiniDivider} />
          <View style={styles.statMini}>
            <Text style={styles.statMiniValue}>{deletedEmployees.length}</Text>
            <Text style={styles.statMiniLabel}>Đã nghỉ</Text>
          </View>
        </View>
      </Animated.View>

      {/* Sticky Search Bar (Only for lists) */}
      {(tabKey === "active" || tabKey === "deleted") && (
        <Animated.View
          style={[
            styles.stickySearch,
            {
              top: HEADER_HEIGHT - 30,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Tìm theo tên, email, SĐT..."
              placeholderTextColor="#94a3b8"
            />
            {!!searchText && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Main Content */}
      {tabKey === "permissions" ? (
        renderPermissionsTab()
      ) : (
        <Animated.FlatList
          data={tabKey === "deleted" ? filteredDeleted : filteredActive}
          keyExtractor={(item) => item._id!}
          renderItem={renderEmployeeItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: HEADER_HEIGHT + 35 },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3b82f6"]}
              progressViewOffset={HEADER_HEIGHT}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={60} color="#e2e8f0" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có nhân viên nào</Text>
              <Text style={styles.emptySubtitle}>
                Bắt đầu quản lý đội ngũ nhân sự của bạn tại đây
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default EmployeesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Collapsible Header
  collapsibleHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 15,
  },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#fff" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  modeTabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  modeTabActive: { backgroundColor: "#fff" },
  modeTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  modeTabTextActive: { color: "#3b82f6" },
  statsInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    paddingBottom: 20,
    gap: 20,
  },
  statMini: { alignItems: "center" },
  statMiniValue: { fontSize: 18, fontWeight: "800", color: "#fff" },
  statMiniLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  statMiniDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Sticky Search
  stickySearch: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: Platform.OS === "ios" ? 4 : 0,
    marginLeft: 10,
  },

  // Employee Card
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  employeeCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 24, fontWeight: "800", color: "#fff" },
  headerText: { flex: 1 },
  empName: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  empEmail: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  deleteIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { gap: 16 },
  bodyRow: { flexDirection: "row", justifyContent: "space-between" },
  infoCol: { gap: 4 },
  infoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  infoValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoValue: { fontSize: 14, fontWeight: "700", color: "#334155" },
  financialStats: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  financeItem: { flex: 1, alignItems: "center" },
  financeLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 2,
    fontWeight: "600",
  },
  financeValue: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  financeDivider: { width: 1, height: 24, backgroundColor: "#e2e8f0" },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    height: 48,
    borderRadius: 14,
    marginTop: 12,
    gap: 8,
  },
  restoreButtonText: { color: "#fff", fontWeight: "700" },

  // Permission Tab Custom
  permissionHint: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  permissionHintText: {
    flex: 1,
    fontSize: 13,
    color: "#1d4ed8",
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginLeft: 16,
    marginBottom: 12,
  },
  staffAvatarBtn: { alignItems: "center", gap: 8, width: 80 },
  staffAvatarBtnActive: { opacity: 1 },
  staffAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  staffInitial: { fontSize: 22, fontWeight: "800", color: "#64748b" },
  staffInitialActive: { color: "#fff" },
  staffNameLabel: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  staffNameLabelActive: { color: "#3b82f6" },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  loadingLabel: { marginTop: 10, textAlign: "center", color: "#6b7280" },
  selectedStaffCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  selectedStaffRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectedStaffName: { fontSize: 14, fontWeight: "900", color: "#111827" },
  selectedStaffSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  selectedStaffStat: { alignItems: "flex-end" },
  selectedStaffStatLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "800",
  },
  selectedStaffStatValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "900",
    marginTop: 2,
  },
  permissionActionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 10,
  },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  smallBtnGray: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  smallBtnGrayText: { fontSize: 12, fontWeight: "800", color: "#374151" },

  permSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    marginTop: 10,
  },
  permSearchInput: { flex: 1, fontSize: 13, color: "#111827" },

  noPermBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  noPermText: { color: "#6b7280", fontWeight: "800", fontSize: 12 },

  groupCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  groupHeaderTitle: { fontWeight: "900", color: "#111827", fontSize: 14 },
  groupCount2: {
    marginTop: 2,
    fontWeight: "800",
    color: "#6b7280",
    fontSize: 12,
  },
  groupHeaderActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupHeaderIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  groupCollapsedHint: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
  },

  permItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    marginTop: 8,
  },
  permItemChecked: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },

  permText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    flexWrap: "wrap",
    lineHeight: 18,
  },
  permTextChecked: { fontSize: 12, fontWeight: "900", color: "#22c55e" },

  saveBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  saveBarLeft: { flex: 1, minWidth: 0 },
  saveBarTitle: { color: "#ffffff", fontWeight: "900", fontSize: 13 },
  saveBarSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 16,
  },

  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: "#ffffff", fontWeight: "900", fontSize: 13 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f9fafb",
  },
  centerTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  centerSub: { marginTop: 4, fontSize: 14, color: "#6b7280" },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "700",
  },
});
