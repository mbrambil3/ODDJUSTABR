import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, timeout: 180000 });

export const getRounds = async (force = false) => {
  const { data } = await client.get(`/rounds${force ? "?force=true" : ""}`);
  return data;
};

export const getMatchAnalysis = async (matchId, force = false) => {
  const { data } = await client.get(`/match/${matchId}/analysis${force ? "?force=true" : ""}`);
  return data;
};

export const refreshMatch = async (matchId) => {
  const { data } = await client.post(`/match/${matchId}/refresh`);
  return data;
};

export const refreshRounds = async () => {
  const { data } = await client.post(`/rounds/refresh`);
  return data;
};
