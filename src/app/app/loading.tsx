function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[1.5rem] bg-black/5 ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <LoadingBlock className="h-4 w-32" />
        <LoadingBlock className="h-12 w-full max-w-3xl" />
        <LoadingBlock className="h-5 w-full max-w-2xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[2rem] border border-black/5 bg-white p-5">
            <LoadingBlock className="h-4 w-24" />
            <LoadingBlock className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-black/5 bg-white p-6">
          <LoadingBlock className="h-6 w-44" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <LoadingBlock key={index} className="h-24 w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-black/5 bg-white p-6">
          <LoadingBlock className="h-6 w-36" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingBlock key={index} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
