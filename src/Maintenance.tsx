/**
 * Maintenance screen.
 *
 * Rendered in place of the full editor (see src/main.tsx) while the visual
 * editor is temporarily disabled. Intentionally self-contained with inline
 * styles and NO app imports, so it renders regardless of the editor's state
 * and mounts none of the editor machinery.
 */
export default function Maintenance() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0',
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: '520px', textAlign: 'center' }}>
        <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '20px' }}>
          🛠️
        </div>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 600,
            margin: '0 0 12px',
            color: '#f8fafc',
          }}
        >
          The visual editor is down for maintenance
        </h1>
        <p
          style={{
            fontSize: '16px',
            lineHeight: 1.6,
            margin: 0,
            color: '#94a3b8',
          }}
        >
          We&rsquo;re doing some upgrade work behind the scenes and will be back
          shortly. Thanks for your patience.
        </p>
      </div>
    </div>
  )
}
