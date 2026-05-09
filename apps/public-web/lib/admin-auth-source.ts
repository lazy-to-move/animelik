import { HttpError } from "../../../api/lib/http-error";
import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
} from "./account-source";

export function hasDirectAdminAccess() {
  return hasDirectAccountAccess();
}

export async function authenticateDirectAdminRequest(headers: Headers) {
  const user = await authenticateDirectRequest(headers);
  if (user.role !== "admin") {
    throw new HttpError(403, "Admin access only.");
  }
  return user;
}
