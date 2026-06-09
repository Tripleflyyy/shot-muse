type TopbarProps = {
  title: string;
  description: string;
};

export default function Topbar({ title, description }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <h2 className="topbar__title">{title}</h2>
        <p className="topbar__description">{description}</p>
      </div>
      <input
        className="topbar__search"
        type="search"
        placeholder="Search locally"
        aria-label="Search locally"
        disabled
      />
    </header>
  );
}
