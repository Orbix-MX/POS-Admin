export function WidgetSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 h-full animate-pulse">
      <div className="h-3 bg-muted rounded w-2/5 mb-1.5" />
      <div className="h-2.5 bg-muted rounded w-1/4 mb-5" />
      <div className="h-24 bg-muted rounded" />
    </div>
  )
}
