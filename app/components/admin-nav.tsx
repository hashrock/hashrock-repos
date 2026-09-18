interface Crumb {
  href: string;
  label: string;
}

/** 管理画面の各セクション。どのページからも行けるようにナビの右側に並べる */
const SECTIONS: Crumb[] = [
  { href: "/admin/repos", label: "Repositories" },
  { href: "/admin/stats", label: "Signups" },
];

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
      <span class="ml-auto flex items-center gap-3">
        {SECTIONS.map((section) => (
          <a key={section.href} href={section.href} class="hover:text-gray-800 hover:underline">
            {section.label}
          </a>
        ))}
      </span>
    </nav>
  );
}
