import client from "./client";

export const login = async (username, password) => {
  const { data } = await client.post("/auth/token/", { username, password });
  return data;
};

export const getMe = async () => {
  const { data } = await client.get("/auth/me/");
  return data;
};

export const changePassword = async (payload) => {
  const { data } = await client.post("/auth/change-password/", payload);
  return data;
};

export const logout = async () => {
  const { data } = await client.post("/auth/logout/");
  return data;
};
