import client from "./client";

export const listUsers = async () => {
  const { data } = await client.get("/users/");
  return data;
};

export const listDepartments = async () => {
  const { data } = await client.get("/departments/");
  return data;
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
