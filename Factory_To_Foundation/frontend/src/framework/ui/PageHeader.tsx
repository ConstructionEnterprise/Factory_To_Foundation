type PageHeaderProps = {
  title: string;
  subtitle: string;
};

/**
 * Shared page header: page title/subtitle on the left, the persistent
 * app chrome (clock, avatars, signed-in user) on the right. The chrome
 * is the same on every page, so it lives here once instead of being
 * copy-pasted into each feature page.
 */
export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="h-24 bg-white border-b border-gray-200 flex items-center justify-between px-8">
      <div>
        <h2 className="text-3xl font-bold" style={{ color: "var(--ff-accent)" }}>
          {title}
        </h2>

        <p className="text-gray-600">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-xl font-semibold">10:42 AM</p>
          <p className="text-gray-500">June 2, 2026</p>
        </div>

        <div className="w-10 h-10 rounded-full bg-gray-300"></div>
        <div className="w-10 h-10 rounded-full bg-gray-300"></div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-400"></div>

          <div>
            <p className="font-semibold">Joshua Chappell</p>
            <p className="text-sm text-gray-500">
              Administrator
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
