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

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) {
            console.warn("Unauthorized (401) - 로그인 필요");
            // 여기에 라우팅/알림 처리
            // e.g. window.location.href = "/login?next=" + encodeURIComponent(location.pathname+location.search);
        }
        return Promise.reject(err);
    }
);
