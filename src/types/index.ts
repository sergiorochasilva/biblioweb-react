export interface Publisher {
    id: string;
    name: string;
    admin?: boolean;
}

export interface Library {
    id: number;
    name: string;
    admin?: boolean;
}

export interface ProfileData {
    email?: string;
    admin?: boolean;
    is_admin?: boolean | number | string;
    isAdmin?: boolean | number | string;
    role?: string;
    profile?: string;
    user_role?: string;
    max_concurrent_loans?: number;
    publishers: Publisher[];
    libraries: Library[];
    recent_reads?: import("../model/Book").Book[];
    loaned_books?: import("../model/Book").Book[];
    purchased_books?: import("../model/Book").Book[];
}
