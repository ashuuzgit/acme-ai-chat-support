export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-background" />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
