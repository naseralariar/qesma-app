import client from "./client";

const normalizeListResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const listUsers = async () => {
  const { data } = await client.get("/users/");
  return normalizeListResponse(data);
};

export const listDepartments = async () => {
  const { data } = await client.get("/departments/");
  return normalizeListResponse(data);
};

export const createUser = async (payload) => {
  const { data } = await client.post("/users/", payload);
  return data;
};

export const updateUser = async (id, payload) => {
  const { data } = await client.patch(`/users/${id}/`, payload);
  return data;
};

export const deleteUser = async (id) => {
  await client.delete(`/users/${id}/`);
};
