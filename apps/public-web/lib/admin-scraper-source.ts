async function loadAdminScraperModule() {
  return import("../../../api/services/admin-scraper-service");
}

export async function loadDirectAdminScraperHelpers() {
  return loadAdminScraperModule();
}
