// 📁 File: src/type/store.ts
// ------------------------------------------------------
// Types for Store and Employee used across API modules
// ------------------------------------------------------

export type ObjectId = string;

/* ------------------------
   Store types
   ------------------------ */
export interface StoreOwnerRef {
    _id: ObjectId;
    name?: string;
    email?: string;
}

export interface StoreStaffRef {
    _id: ObjectId;
    username?: string;
    email?: string;
}

export interface StoreLocation {
    lat: number | null;
    lng: number | null;
}

export interface StoreOpeningHours {
    open: string;
    close: string;
}

export interface Store {
    taxCode: string;
    email: string;
    owner_name: string;
    _id: string; // ObjectId string từ Mongo
    name: string;
    address?: string;
    phone?: string;
    description?: string;
    imageUrl?: string;
    tags?: string[];
    staff_ids?: Array<StoreStaffRef | string>;
    location?: StoreLocation | null;
    openingHours?: StoreOpeningHours | null;
    isDefault?: boolean;
    owner_id?: StoreOwnerRef | string;
    deleted?: boolean;
    createdAt?: string;
    updatedAt?: string;
    bankAccount?: {
        accountNumber: string;
        bankName: string;
        accountHolderName: string;
    };
    businessSector?: string;
    area?: string;
}

/**
 * Khi tạo store mới, name là bắt buộc
 * Các trường khác optional
 */
export interface StoreCreateDto {
    name: string;
    address?: string;
    phone?: string;
    description?: string;
    imageUrl?: string;
    tags?: string[];
    staff_ids?: Array<StoreStaffRef | string>; // staff có thể ref hoặc id
    location?: StoreLocation | null;
    openingHours?: StoreOpeningHours | null;
    isDefault?: boolean;
}

/**
 * Khi cập nhật, tất cả trường đều optional
 */
export interface StoreUpdateDto {
    name?: string;
    address?: string;
    phone?: string;
    description?: string;
    imageUrl?: string;
    tags?: string[];
    staff_ids?: Array<StoreStaffRef | string>; // giữ tương tự Store
    location?: StoreLocation | null;
    openingHours?: StoreOpeningHours | null;
    isDefault?: boolean;
}

/* ------------------------
   Pagination / Response
   ------------------------ */
export interface PagedMeta {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface StoresListResponse {
    meta: PagedMeta;
    stores: Store[];
    data?: any;
}

/* ------------------------
   Employee types
   ------------------------ */
export interface EmployeeUserRef {
    _id: ObjectId;
    username?: string;
    email?: string;
    role?: string;
    phone?: string;
}

export interface EmployeeStoreRef {
    _id: ObjectId;
    name?: string;
}

export interface Employee {
    _id: ObjectId;
    fullName: string;
    salary?: number | string;
    shift?: string | number;
    commission_rate?: number | string | null;
    user_id?: EmployeeUserRef | ObjectId;
    store_id?: EmployeeStoreRef | ObjectId;
    createdAt?: string;
    updatedAt?: string;
}

export interface EmployeeCreateDto {
    username: string;
    email?: string;
    password: string;
    fullName: string;
    salary: number | string;
    shift: string | number;
    commission_rate?: number | string;
    phone?: string;
}

export interface EmployeeUpdateDto {
    fullName?: string;
    salary?: number | string;
    shift?: string | number;
    commission_rate?: number | string | null;
    email?: string;
    phone?: string;
}

/* ------------------------
   Generic response helpers
   ------------------------ */
export interface GenericResponse<T = any> {
    message: string;
    data?: T;
    [k: string]: any;
}

export type StoreApiResponse<T = any> = GenericResponse<T>;

// EOF
