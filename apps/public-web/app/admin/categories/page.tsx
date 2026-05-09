import Link from "next/link";
import { AdminCategoryManager } from "../../../components/AdminCategoryManager";
import { getLegacyApiBaseUrl } from "../../../lib/api";
import { hasDirectAdminAccess } from "../../../lib/admin-auth-source";
import { getCurrentSession } from "../../../lib/server-api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Categories",
  description:
    "Manage category and genre records from the Next.js admin migration surface.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Sign in to manage categories</h1>
            <p className="muted auth-copy">
              The migrated categories page uses the same administrator session as the rest of the
              Next admin surface.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button primary">
                Sign In
              </Link>
              <Link href="/admin" className="button">
                Back to admin overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (session.role !== "admin") {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Admin access only</h1>
            <p className="muted auth-copy">
              Category management is reserved for administrator accounts.
            </p>
            <div className="hero-actions">
              <Link href="/settings" className="button primary">
                Account center
              </Link>
              <Link href="/admin" className="button">
                Back to overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!hasDirectAdminAccess()) {
    return (
      <main className="section">
        <div className="container">
          <div className="auth-card" style={{ margin: "0 auto" }}>
            <div className="eyebrow">Admin</div>
            <h1 className="auth-title">Direct admin mode is not configured yet</h1>
            <p className="muted auth-copy">
              The Next categories page needs shared database and session-secret access. Until then,
              keep managing categories from the legacy admin.
            </p>
            <div className="hero-actions">
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button primary" rel="noreferrer">
                Open legacy admin
              </a>
              <Link href="/admin" className="button">
                Back to overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const resolvedSearchParams = await searchParams;
  const { listAdminCategories, adminCategoryListQuerySchema } = await import(
    "../../../../../api/services/admin-category-service"
  );
  const query = adminCategoryListQuerySchema.parse({
    search: pickString(resolvedSearchParams.search),
  });
  const items = await listAdminCategories(query);

  return (
    <main className="section">
      <div className="container admin-layout">
        <section className="panel watch-copy-panel">
          <div className="eyebrow">Admin Migration</div>
          <div className="watch-heading-row">
            <div>
              <h1 className="watch-title">Categories</h1>
              <p className="muted auth-copy">
                Create, edit, and delete category records from the Next admin surface while the
                remaining heavier management tabs continue to live in the legacy dashboard.
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/admin" className="button">
                Back to overview
              </Link>
              <Link href="/admin/episodes" className="button">
                Episodes
              </Link>
              <Link href="/admin/anime" className="button">
                Anime catalog
              </Link>
              <a href={`${getLegacyApiBaseUrl()}/admin`} className="button" rel="noreferrer">
                Open legacy admin
              </a>
            </div>
          </div>
        </section>

        <section className="panel watch-copy-panel">
          <form className="filter-form" action="/admin/categories" method="get">
            <input
              aria-label="Search categories"
              name="search"
              defaultValue={query.search ?? ""}
              placeholder="Search category name"
            />
            <button type="submit" className="button primary">
              Apply filters
            </button>
          </form>

          <AdminCategoryManager items={items} />
        </section>
      </div>
    </main>
  );
}
