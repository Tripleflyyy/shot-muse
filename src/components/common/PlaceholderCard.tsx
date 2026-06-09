type PlaceholderCardProps = {
  title: string;
  children: string;
};

export default function PlaceholderCard({ title, children }: PlaceholderCardProps) {
  return (
    <section className="placeholder-card">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}
