export function getUser() {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
  
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
      return null;
    }
  }
  
  export function getToken() {
    const user = getUser();
    return user?.token || null;
  }
  