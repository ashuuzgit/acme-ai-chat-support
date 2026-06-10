export default function WidgetPage({
  params,
}: {
  params: { businessId: string };
}) {
  return (
    <div>
      <h1>Widget — {params.businessId}</h1>
    </div>
  );
}
