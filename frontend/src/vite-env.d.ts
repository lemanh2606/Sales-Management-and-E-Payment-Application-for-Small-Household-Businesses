/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_API_KEY: string
    // thêm các biến môi trường khác ở đây
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
