/// <reference types="vite/client" />
import { createApiClient } from "./api-client";

// Public build configuration only: credentials remain exclusively on EC2.
const origin = import.meta.env.VITE_API_ORIGIN ?? (import.meta.env.PROD ? "https://api.marketingstudioie.site" : "");
export const { apiUrl, apiFetch, apiJson } = createApiClient(origin);
