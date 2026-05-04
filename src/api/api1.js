import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.0.7:3002",
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;