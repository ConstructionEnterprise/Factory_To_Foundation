import { PageHeader } from "@/framework/ui";

type ComingSoonPageProps = {
  title: string;
  subtitle: string;
};

/**
 * Placeholder rendered for every feature route that hasn't been built
 * yet. Keeps the sidebar fully wired and navigable without pretending a
 * feature exists before it does — the real page replaces this one wholesale
 * when that feature ships.
 */
export default function ComingSoonPage({ title, subtitle }: ComingSoonPageProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--ff-content-bg)]">
      <PageHeader title={title} subtitle={subtitle} />

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h3 className="text-xl font-semibold text-gray-800">
            {title} is coming soon
          </h3>

          <p className="mt-2 text-gray-500">
            This module hasn&apos;t been built yet. It will follow the same
            Genealogy Explorer pattern once it&apos;s ready.
          </p>
        </div>
      </main>
    </div>
  );
}
