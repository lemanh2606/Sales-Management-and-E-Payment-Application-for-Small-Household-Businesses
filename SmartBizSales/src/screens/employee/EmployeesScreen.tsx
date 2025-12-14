import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const [deletedEmployees, setDeletedEmployees] = useState<EmployeeRecord[]>(
    []
  );
  const [filteredActive, setFilteredActive] = useState<EmployeeRecord[]>([]);
  const [filteredDeleted, setFilteredDeleted] = useState<EmployeeRecord[]>([]);

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
      <View style={styles.rowCard}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.empName} numberOfLines={1}>
            {item.fullName || user.username || "—"}
          </Text>
          <Text style={styles.empEmail} numberOfLines={1}>
            {user.email || "—"}
          </Text>

          <View style={styles.empMetaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="call-outline" size={14} color="#2563eb" />
              <Text style={styles.metaChipText}>
                {phone ? formatPhone(phone) : "—"}
              </Text>
            </View>

            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text
                style={[styles.metaChipText, { color: "#374151" }]}
                numberOfLines={1}
              >
                {item.shift || "Chưa thiết lập ca"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.salaryText}>{formatVND(item.salary)}</Text>
          <Text style={styles.commissionText}>
            Hoa hồng: {Number(item.commission_rate ?? 0)}%
          </Text>

          <View style={styles.actionRow}>
            {!isDeleted ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDelete]}
                onPress={() =>
                  Alert.alert(
                    "Xoá nhân viên",
                    "Bạn chắc chắn muốn xoá mềm nhân viên này?",
                    [
                      { text: "Huỷ", style: "cancel" },
                      {
                        text: "Xoá",
                        style: "destructive",
                        onPress: () => handleSoftDelete(item._id),
                      },
                    ]
                  )
                }
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                <Text style={styles.actionDeleteText}>Xoá</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionRestore]}
                onPress={() =>
                  Alert.alert(
                    "Khôi phục nhân viên",
                    "Bạn muốn khôi phục nhân viên này?",
                    [
                      { text: "Huỷ", style: "cancel" },
                      {
                        text: "Khôi phục",
                        style: "default",
                        onPress: () => handleRestore(item._id),
                      },
                    ]
                  )
                }
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={16} color="#15803d" />
                <Text style={styles.actionRestoreText}>Khôi phục</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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

            const permCount = Array.isArray(user.menu) ? user.menu.length : 0;

            return (
              <TouchableOpacity
                onPress={() => handleSelectStaff(item)}
                activeOpacity={0.85}
                style={[styles.staffChip, isActive && styles.staffChipActive]}
              >
                <View style={styles.staffChipAvatar}>
                  <Ionicons
                    name="person-circle"
                    size={40}
                    color={isActive ? "#2563eb" : "#9ca3af"}
                  />
                  <View style={styles.staffChipBadge}>
                    <Text style={styles.staffChipBadgeText}>{permCount}</Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.staffChipName,
                    isActive && styles.staffChipNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.fullName || user.username || "—"}
                </Text>

                <Text
                  style={[
                    styles.staffChipSub,
                    isActive && styles.staffChipSubActive,
                  ]}
                  numberOfLines={1}
                >
                  {user.email || user.username || "—"}
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
        <FlatList
          style={{ flex: 1 }}
          data={groupData}
          keyExtractor={(g) => g.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
          ListHeaderComponent={<Header />}
          ListFooterComponent={<Footer />}
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

  // ====== MAIN RENDER ======
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people-circle-outline" size={32} color="#2563eb" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.headerTitle}>Nhân viên cửa hàng</Text>
            <Text style={styles.headerSub}>
              {(currentStore as any)?.name || "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên, username, email..."
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchText ? (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(
          [
            { key: "active", label: "Đang làm" },
            { key: "deleted", label: "Đã xoá" },
            { key: "permissions", label: "Phân quyền" },
          ] as const
        ).map((t) => {
          const active = tabKey === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => handleTabChange(t.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Body */}
      {tabKey === "permissions" ? (
        renderPermissionsTab()
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={tabKey === "deleted" ? filteredDeleted : filteredActive}
          keyExtractor={(item) => item._id!}
          renderItem={renderEmployeeItem}
          contentContainerStyle={
            (tabKey === "deleted" ? filteredDeleted : filteredActive).length ===
            0
              ? { padding: 16, flexGrow: 1, justifyContent: "center" }
              : { padding: 16 }
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons
                name={tabKey === "deleted" ? "trash-outline" : "people-outline"}
                size={40}
                color="#d1d5db"
              />
              <Text style={styles.emptyText}>
                {tabKey === "deleted"
                  ? "Chưa có nhân viên bị xoá."
                  : "Chưa có nhân viên trong cửa hàng."}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={Platform.OS === "android" ? ["#2563eb"] : undefined}
              tintColor={Platform.OS === "ios" ? "#2563eb" : undefined}
            />
          }
          ListFooterComponent={<View style={{ height: 16 }} />}
        />
      )}

      {loading && !refreshing && tabKey !== "permissions" && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      )}
    </SafeAreaView>
  );
};

export default EmployeesScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f9fafb" },

  header: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  headerSub: { marginTop: 2, fontSize: 13, color: "#6b7280" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: Platform.OS === "ios" ? 4 : 0,
  },

  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    padding: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#ffffff" },
  tabText: { fontSize: 13, fontWeight: "800", color: "#4b5563" },
  tabTextActive: { color: "#2563eb" },

  rowCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  empName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  empEmail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
  },
  metaChipText: { fontSize: 11, fontWeight: "700", color: "#1d4ed8" },
  rightCol: {
    marginLeft: 10,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  salaryText: { fontSize: 13, fontWeight: "800", color: "#111827" },
  commissionText: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  actionRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionDelete: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  actionDeleteText: { fontSize: 11, fontWeight: "800", color: "#b91c1c" },
  actionRestore: { borderColor: "#bbf7d0", backgroundColor: "#ecfdf5" },
  actionRestoreText: { fontSize: 11, fontWeight: "800", color: "#15803d" },

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

  loadingOverlay: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  // Permissions
  permissionHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  permissionHintText: {
    flex: 1,
    color: "#1e40af",
    fontWeight: "700",
    fontSize: 13,
  },

  sectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },

  staffChip: {
    width: 150,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  staffChipActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  staffChipAvatar: {
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  staffChipBadge: {
    position: "absolute",
    top: -4,
    right: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  staffChipBadgeText: { fontSize: 10, color: "#ffffff", fontWeight: "900" },
  staffChipName: { fontWeight: "900", color: "#111827", fontSize: 14 },
  staffChipNameActive: { color: "#1d4ed8" },
  staffChipSub: {
    marginTop: 4,
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 12,
  },
  staffChipSubActive: { color: "#1e40af" },

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
  selectedStaffStatLabel: { fontSize: 11, color: "#6b7280", fontWeight: "800" },
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

  // wrap để không tràn + vẫn cuộn được
  permText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    flexWrap: "wrap",
    lineHeight: 18,
  },
  permTextChecked: { fontSize: 12, fontWeight: "900", color: "#22c55e" },

  // Save bar (nằm cuối danh sách)
  saveBar: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 14,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
});
