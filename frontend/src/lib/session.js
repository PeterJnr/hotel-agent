const SESSION_KEY = "hotel-ai.session";

export const sessionStore = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },
  write(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};
