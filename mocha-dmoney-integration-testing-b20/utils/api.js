require("dotenv").config();
const axios = require("axios");

const config = {
  baseUrl: process.env.BASE_URL || "http://localhost:5000",
  secretKey: process.env.SECRET_KEY || "ROADTOSDET",
  adminEmail: process.env.ADMIN_EMAIL || "admin@roadtocareer.net",
  adminPassword: process.env.ADMIN_PASSWORD || "1234",
  systemEmail: process.env.SYSTEM_EMAIL || "system@dmoney.com",
  systemPassword: process.env.SYSTEM_PASSWORD || "1234",
  systemAccount: process.env.SYSTEM_ACCOUNT || "SYSTEM",
};

// validateStatus: () => true  ->  axios never throws on 4xx/5xx,
// so every test can assert the real HTTP status code (e.g. 201, 208, 401).
const client = axios.create({
  baseURL: config.baseUrl,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

function authHeaders(token) {
  const headers = { "X-AUTH-SECRET-KEY": config.secretKey };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers };
}

const login = (email, password) =>
  client.post("/user/login", { email, password });

const createUser = (token, user) =>
  client.post("/user/create", user, authHeaders(token));

const activateUser = (token, userId) =>
  client.patch(`/user/update/${userId}`, { status: "active" }, authHeaders(token));

const searchByPhone = (token, phone) =>
  client.get(`/user/search/phonenumber/${phone}`, authHeaders(token));

const getBalance = (token, account) =>
  client.get(`/transaction/balance/${account}`, authHeaders(token));

const transaction = (type, token, body) =>
  client.post(`/transaction/${type}`, body, authHeaders(token));

const deposit = (token, from, to, amount) =>
  transaction("deposit", token, { from_account: from, to_account: to, amount });

const sendMoney = (token, from, to, amount) =>
  transaction("sendmoney", token, { from_account: from, to_account: to, amount });

const withdraw = (token, from, to, amount) =>
  transaction("withdraw", token, { from_account: from, to_account: to, amount });

const payment = (token, from, to, amount) =>
  transaction("payment", token, { from_account: from, to_account: to, amount });

module.exports = {
  config,
  client,
  login,
  createUser,
  activateUser,
  searchByPhone,
  getBalance,
  deposit,
  sendMoney,
  withdraw,
  payment,
};
