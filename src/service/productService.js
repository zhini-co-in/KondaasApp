// src/service/productService.js
import { getAuth } from "@react-native-firebase/auth";
import { getSessionInfo } from "./localStorage";

const BASE_URL = "https://kondaas.atom8itsolutions.com";
const PRODUCT_TEMPLATE_ID = "product_list";

const buildHeaders = async (forceRefresh = false) => {
  const headers = { "Content-Type": "application/json" };

  const user = getAuth().currentUser;
  if (user) headers["x-auth-token"] = await user.getIdToken(forceRefresh);

  const { phoneNo, deviceId } = await getSessionInfo();
  if (phoneNo) headers["x-user-phone"] = String(phoneNo).replace("+91", "").trim();
  if (deviceId) headers["x-device-id"] = deviceId;

  return headers;
};

const templateRequest = async (forceRefresh = false) =>
  fetch(`${BASE_URL}/template/get/${PRODUCT_TEMPLATE_ID}`, {
    method: "GET",
    headers: await buildHeaders(forceRefresh),
  });

export const fetchProducts = async () => {
  console.log("📦 fetchProducts called");

  let res = await templateRequest();
  if (res.status === 401) {
    console.log("📦 401 - refreshing token & retrying");
    res = await templateRequest(true);
  }
  console.log("📦 status:", res.status);

  if (!res.ok) {
    throw new Error(`Failed to load products (${res.status})`);
  }

  const template = await res.json();
  // products `data` array-kulla irukku; archived-ah filter pannrom
  const products = (template.data || []).filter((p) => p.isArchived !== true);

  console.log("📦 products count:", products.length);
  return products;
};