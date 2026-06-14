export default function Spinner({ inline = false, label }) {
  if (inline) {
    return (
      <span className="row gap-sm" style={{ display: 'inline-flex' }}>
        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
        {label && <span className="text-sm text-muted">{label}</span>}
      </span>
    );
  }
  return (
    <div className="row" style={{ flexDirection: 'column', gap: 12 }}>
      <span className="spinner" />
      {label && <span className="text-sm text-muted">{label}</span>}
    </div>
  );
}
