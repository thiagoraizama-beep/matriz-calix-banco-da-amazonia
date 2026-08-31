// Grid responsivo de cards de criativo -- cobre desktop e mobile com o mesmo layout
// (auto-fill/minmax), eliminando a duplicacao de tabela-desktop + card-mobile que
// existia antes nas 3 views por papel.
export default function CreativeCardGrid({ children, minWidth = 240 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}
