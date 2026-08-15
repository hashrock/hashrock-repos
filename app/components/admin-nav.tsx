interface Crumb {
  href: string;
  label: string;
}

/** admin 配下の共通ナビ。必ず先頭にトップページへの導線を置く */
export default function AdminNav({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <nav class="mb-4 flex items-center gap-2 text-sm text-gray-500 flex-wrap">
      <a href="/" class="hover:text-gray-800 hover:underline">
        ← Projects
      </a>
      {crumbs.map((crumb) => (
        <span key={crumb.href} class="flex items-center gap-2">
          <span class="text-gray-300">/</span>
          <a href={crumb.href} class="hover:text-gray-800 hover:underline">
            {crumb.label}
          </a>
        </span>
      ))}
    </nav>
  );
}
