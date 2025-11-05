
export interface CustomerCreateData {
    name: string;
    phone: string;
    address?: string;
    note?: string;
    storeId: string;
    loyaltyPoints?: number;
    totalSpent?: number;
    totalOrders?: number;
}
export interface CustomerUpdateData {
    name?: string;
    phone?: string;
    address?: string;
    note?: string;
    loyaltyPoints?: number;
    totalSpent?: number;
    totalOrders?: number;
}

export interface CustomerSearchParams {
    query: string;
    limit?: number;
}

export interface ApiResponse<T> {
    customers: Customer[];
    message?: string;
    status?: number;
}
// Định nghĩa interface cho response của getCustomersByStore
export interface CustomersListResponse {
    message: string;
    page: number;
    limit: number;
    total: number;
    count: number;
    customers: Customer[];
}

// src/types/customer.ts
export interface Customer {
    _id: string;
    name: string;
    phone: string;
    address?: string;
    note?: string;
    storeId: string;
    loyaltyPoints: number;
    totalSpent: {
        $numberDecimal: string;
    } | number;
    totalOrders: number;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    __v?: number;
}

export interface CustomerCreateData {
    name: string;
    phone: string;
    address?: string;
    note?: string;
    storeId: string;
    loyaltyPoints?: number;
    totalSpent?: number;
    totalOrders?: number;
}

export interface CustomerUpdateData {
    name?: string;
    phone?: string;
    address?: string;
    note?: string;
    loyaltyPoints?: number;
    totalSpent?: number;
    totalOrders?: number;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
    status?: number;
}

// Interface cho response của getCustomersByStore
export interface CustomersListResponse {
    message: string;
    page: number;
    limit: number;
    total: number;
    count: number;
    customers: Customer[];
}