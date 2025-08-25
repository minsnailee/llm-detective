import axios from "axios";
// import { useAuth } from "../../store/auth.store";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE,
    withCredentials: true, // 세션 쿠키도 같이 보냄
});

api.interceptors.request.use((cfg) => {
    // const t = useAuth.getState().token;
    // if (t) cfg.headers.Authorization = `Bearer ${t}`;
    return cfg;
});
