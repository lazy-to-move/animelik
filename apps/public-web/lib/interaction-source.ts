import {
  authenticateDirectRequest,
  hasDirectAccountAccess,
} from "./account-source";

export { hasDirectAccountAccess, authenticateDirectRequest };

async function loadReviewModule() {
  return import("../../../api/services/review-service");
}

async function loadBrokenEpisodeModule() {
  return import("../../../api/services/broken-episode-service");
}

export async function loadDirectReviewHelpers() {
  return loadReviewModule();
}

export async function loadDirectBrokenEpisodeHelpers() {
  return loadBrokenEpisodeModule();
}
