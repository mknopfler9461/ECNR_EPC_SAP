export default function Home() {
  return (
    <main style={{ minHeight: '100vh', margin: 0 }}>
      <iframe
        src="/infographic.html"
        title="BESS Industry Infographic"
        style={{
          border: 0,
          display: 'block',
          width: '100%',
          minHeight: '100vh',
        }}
      />
    </main>
  );
}
