import client from "./client";

export const getDashboard = async () => (await client.get("/distributions/dashboard/")).data;
export const createDistribution = async (payload) => (await client.post("/distributions/", payload)).data;
export const searchDistributions = async (queryOrParams) => {
  if (typeof queryOrParams === "string") {
    return (await client.get(`/distributions/?search=${encodeURIComponent(queryOrParams)}`)).data;
  }

  const params = {};
  if (queryOrParams?.search) params.search = queryOrParams.search;
  if (queryOrParams?.machine_number) params.machine_number = queryOrParams.machine_number;
  if (queryOrParams?.civil_id) params["debtor__civil_id"] = queryOrParams.civil_id;
  if (queryOrParams?.department) params.department = queryOrParams.department;
  return (await client.get("/distributions/", { params })).data;
};
export const calculateDistribution = async (payload) => (await client.post("/distributions/calculate/", payload)).data;
export const createDebtor = async (payload) => (await client.post("/debtors/", payload)).data;
export const updateDebtor = async (debtorId, payload) => (await client.put(`/debtors/${debtorId}/`, payload)).data;
export const getDepartments = async () => (await client.get("/departments/")).data;
export const printDistribution = async (distributionId) =>
  (await client.get(`/reports/distributions/${distributionId}/print/`, { responseType: "blob" })).data;
export const getDistributionById = async (distributionId) => (await client.get(`/distributions/${distributionId}/`)).data;
export const updateDistribution = async (distributionId, payload) =>
  (await client.put(`/distributions/${distributionId}/`, payload)).data;
export const deleteDistribution = async (distributionId) => (await client.delete(`/distributions/${distributionId}/`)).data;
export const findDistributionsForAttendance = async ({ machineNumber, civilId }) => {
  const params = {};
  if (machineNumber) params.machine_number = machineNumber;
  if (civilId) params["debtor__civil_id"] = civilId;
  return (await client.get("/distributions/", { params })).data;
};
