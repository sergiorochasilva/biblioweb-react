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
    publishers: Publisher[];
    libraries: Library[];
}
