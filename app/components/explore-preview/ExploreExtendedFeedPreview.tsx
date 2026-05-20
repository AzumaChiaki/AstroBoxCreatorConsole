export interface FeaturedAuthorConfig {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  resourceIds: string[];
}

export default function ExploreExtendedFeedPreview({
  featuredResourceIds,
  featuredAuthors,
}: {
  featuredResourceIds: string[];
  featuredAuthors: FeaturedAuthorConfig[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 px-4 pb-8">
      {featuredResourceIds.length > 0 && (
        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-white">精选资源</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {featuredResourceIds.map((id) => (
              <div key={id} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                <p className="font-mono-sarasa text-sm text-white">{id}</p>
                <p className="mt-1 text-xs text-white/45">正式客户端会在这里加载资源 manifest 卡片。</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {featuredAuthors.length > 0 && (
        <section>
          <h2 className="mb-3 text-[18px] font-semibold text-white">精选作者</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {featuredAuthors.map((author) => (
              <div key={author.id} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                <div className="flex items-center gap-3">
                  {author.avatarUrl ? (
                    <img src={author.avatarUrl} className="h-10 w-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/70">
                      {author.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{author.name}</p>
                    <p className="truncate text-xs text-white/45">{author.description}</p>
                  </div>
                </div>
                <p className="mt-2 truncate font-mono-sarasa text-xs text-white/45">
                  {author.resourceIds.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
