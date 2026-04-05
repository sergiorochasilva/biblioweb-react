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
    publishers: Publisher[];
    libraries: Library[];
}
