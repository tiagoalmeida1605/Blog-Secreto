import { auth } from "./firebase";
import { createDevHubApi } from "./devhub-api";

export const api = createDevHubApi(auth);
