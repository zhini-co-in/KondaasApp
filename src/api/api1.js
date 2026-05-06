import axios from "axios";

const API = axios.create({
  baseURL: "https://board.trisentrix.com",
  headers: {
    "Content-Type": "application/json",
  },
});

export default API;