import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api",
  withCredentials: true,
});

// ─── Global 401 interceptor ────────────────────────────────────────────────
// When the backend rejects a request as Unauthorized (expired/invalid token)
// we clear local auth state and redirect to /login — prevents stale sessions
// from accessing protected UI.
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Lazy-import to avoid circular dependency with useAuthStore
      try {
        const { useAuthStore } = await import("../store/useAuthStore.js");
        const { authUser, disconnectSocket } = useAuthStore.getState();

        if (authUser) {
          // Clear auth state and cached user
          useAuthStore.setState({ authUser: null });
          localStorage.removeItem("chatty_user");
          disconnectSocket();

          // Redirect to login page
          window.location.href = "/login";
        }
      } catch {
        // Fallback: hard redirect
        localStorage.removeItem("chatty_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
