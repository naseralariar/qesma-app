import axios from "axios";

const fallbackApiBaseUrl =
  typeof window !== "undefined"
    ? "/api"
    : "http://127.0.0.1:8000/api";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl,
  withCredentials: true,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;
