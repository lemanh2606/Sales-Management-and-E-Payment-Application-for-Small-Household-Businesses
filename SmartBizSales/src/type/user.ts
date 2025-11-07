// 📁 File: src/api/type/user.ts
// ------------------------------------------------------
// Mục đích: Kiểu dữ liệu TypeScript chuẩn hoá theo controllers/userController.js
// - Dựa trên logic và payloads thực tế trong controller
// - Dùng cho client (React Native / Expo) để đảm bảo type-safety khi gọi API
// ------------------------------------------------------

export type Role = 'MANAGER' | 'STAFF';
export type StoreRole = 'OWNER' | 'STAFF';
export type Permission = string; // backend dùng chuỗi permission, giữ linh hoạt

export interface StoreRoleItem {
    store: string; // storeId (ObjectId string)
    role: StoreRole;
}

// NOTE: Có 2 loại User shape:
// - UserPublic: shape trả về cho frontend (không chứa password_hash, otp_hash, ...)
// - UserInternal: shape dùng nội bộ server (có thể có password_hash, otp_hash)

export interface UserPublic {
    id: string; // _id
    image: string;
    username: string;
    fullname?: string | null;
    email?: string | null;
    phone?: string | null;
    role: Role;
    menu: Permission[];
    stores?: string[];
    store_roles?: StoreRoleItem[];
    current_store?: string | null;
    isDeleted?: boolean;
    deletedAt?: string | null;
    restoredAt?: string | null;
    isVerified?: boolean;
    loginAttempts?: number;
    lockUntil?: string | null;
    last_login?: string | null;
    avatar?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

// Internal (server) representation — optional fields that frontend normally never sees
export interface UserInternal extends Partial<UserPublic> {
    password_hash?: string;
    otp_hash?: string | null;
    otp_expires?: string | Date | null;
    otp_attempts?: number;

    // ... any other mongoose-only fields
}

// ------------------------
// Request DTOs (payloads) — chính xác theo controller
// ------------------------

export interface RegisterManagerDto {
    username: string;
    email: string;
    phone: string | null;
    password: string;
    confirmPassword: string;

}

export interface VerifyOtpDto {
    email: string;
    otp: string;
    password?: string;
}

export interface LoginDto {
    username: string; // username or email
    password: string;
}

export interface SendForgotPasswordOtpDto {
    email: string;
}

export interface ForgotChangePasswordDto {
    email: string;
    otp: string;
    password: string;
    confirmPassword: string;
}

export interface RefreshTokenResponse {
    token: string;
}

export interface UpdateUserDto {
    // used by PUT /api/users/:id in controller updateUser
    username?: string;
    image?: string;
    email?: string;
    phone?: string | null;
    role?: Role;
    menu?: Permission[];
    stores?: string[];
    store_roles?: StoreRoleItem[];
    current_store?: string | null;
    isDeleted?: boolean;
    deletedAt?: string | null;
    restoredAt?: string | null;

    // password change fields
    password?: string; // new password
    confirmPassword?: string;
    currentPassword?: string; // required when self-changing
}

export interface UpdateProfileDto {
    username?: string;
    email?: string;
    phone?: string;
    fullname?: string; // optional, used to sync Employee.fullname for STAFF
}

export interface SendPasswordOtpDto {
    email?: string; // optional — uses user's email if omitted
}

export interface ChangePasswordDto {
    password: string;
    confirmPassword: string;
    otp: string;
}

export interface SoftDeleteUserDto {
    // controller expects { targetUserId } in body
    targetUserId: string;
}

export interface RestoreUserDto {
    targetUserId: string;
}

// ------------------------
// Response DTOs
// ------------------------

export interface GenericResponse {
    message: string;
}

export interface LoginResponse {
    message: string;
    token: string; // access token
    user: UserPublic;
    store?: any | null; // current_store object if server returns full store
}

export interface RegisterResponse extends GenericResponse { }
export interface VerifyOtpResponse extends GenericResponse { }
export interface ForgotChangePasswordResponse extends GenericResponse { }

// ------------------------
// ALL_PERMISSIONS constant (mirror backend) — giữ đầy đủ để client có thể reuse
// ------------------------
export const ALL_PERMISSIONS: Permission[] = [
    // store
    'store:create',
    'store:view',
    'store:update',
    'store:delete',
    'store:dashboard:view',
    'store:staff:assign',
    'store:employee:create',
    'store:employee:view',
    'store:employee:update',
    'store:employee:delete',

    // customers
    'customers:create',
    'customers:search',
    'customers:update',
    'customers:delete',
    'customers:top-customers',

    // loyalty
    'loyalty:view',
    'loyalty:manage',

    // orders
    'orders:create',
    'orders:pay',
    'orders:print',
    'orders:view',
    'orders:refund',

    // reports
    'reports:top-products',
    'reports:revenue:view',
    'reports:revenue:employee',
    'reports:revenue:export',
    'reports:financial:view',
    'reports:financial:export',
    'reports:financial:list',

    // products
    'products:create',
    'products:view',
    'products:update',
    'products:price',
    'products:delete',
    'products:image:delete',
    'products:search',
    'products:low-stock',

    // product groups
    'product-groups:create',
    'product-groups:view',
    'product-groups:update',
    'product-groups:delete',

    // purchase orders
    'purchase-orders:create',
    'purchase-orders:view',
    'purchase-orders:update',
    'purchase-orders:delete',

    // purchase returns
    'purchase-returns:create',
    'purchase-returns:view',
    'purchase-returns:update',
    'purchase-returns:delete',

    // stock checks / inventory
    'inventory:stock-check:create',
    'inventory:stock-check:view',
    'inventory:stock-check:detail',
    'inventory:stock-check:update',
    'inventory:stock-check:delete',

    // stock disposal
    'inventory:disposal:create',
    'inventory:disposal:view',
    'inventory:disposal:update',
    'inventory:disposal:delete',

    // suppliers
    'supplier:create',
    'supplier:view',
    'supplier:update',
    'supplier:delete',

    // tax
    'tax:preview',
    'tax:create',
    'tax:update',
    'tax:clone',
    'tax:delete',
    'tax:list',
    'tax:export',

    // user
    'users:manage',
    'users:role:update',
    'users:menu:update',
    'users:update',

    // exports
    'reports:export',
];

export interface AuthResponse {
    message?: string;
    token?: string; // access token
    user?: UserPublic;
    store?: any | null; // the controller returns `store` sometimes
}

// ------------------------
// Export helper: group types for convenient import
// ------------------------
export type { UserPublic as User };
export type { UserInternal as UserServer };

// EOF
