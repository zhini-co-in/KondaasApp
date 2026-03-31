import axios from "axios";

const API = axios.create({
  baseURL: "https://kondaas-api.trisentrix-dev.workers.dev",
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;