import { useRef, useState } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

// Board generico de arrastar-e-soltar por coluna de status -- nao conhece o
// dominio (criativo/campanha), so orquestra o drag e delega a mudanca real
// para onMoveCard. Se onMoveCard rejeitar (ex: 403 de permissao), o card
// volta visualmente pro lugar (nao aplicamos a mudanca otimisticamente antes
// de confirmar, evitando "pulos" quando a chamada falha).
//
// items: array de objetos com pelo menos { id, status }
// statusOptions: array de strings (valores reais, usados na chamada de API),
//   na ordem em que as colunas devem aparecer
// statusLabels: opcional, { [status]: "Rotulo legivel" } -- quando o valor
//   real do status nao e ja o texto pronto pra exibir (ex: campanha usa
//   chaves cruas tipo "ativo", nao "Ativa")
// getId: item -> chave unica (default item.id)
// renderCard: item -> JSX do card
// onMoveCard: (item, novoStatus) -> Promise (resolve = aplica, rejeita = mantem)
// statusColors: opcional, { [status]: { color, bg } } pro cabecalho da coluna

function Column({ status, label, cor, items, renderCard, getId }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 270, width: 270, flexShrink: 0, display: "flex", flexDirection: "column",
        background: isOver ? "var(--accent-soft)" : "var(--card-bg)",
        borderRadius: 10, border: `1px solid ${isOver ? "var(--accent)" : "var(--border)"}`, maxHeight: "100%",
        boxShadow: "0 1px 3px rgba(20,33,61,0.08)",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: cor?.color || "var(--text-primary)" }}>{label || status}</span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg)", borderRadius: 999, padding: "1px 7px" }}>
          {items.length}
        </span>
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, background: "var(--bg)" }}>
        {items.map((item) => (
          <DraggableCard key={getId(item)} id={getId(item)}>
            {renderCard(item)}
          </DraggableCard>
        ))}
      </div>
    </div>
  );
}

// pointer-events "none" nos filhos enquanto arrastando um handle generico
// nao existe aqui -- em vez disso, o cursor "grab"/"grabbing" e forcado com
// !important via estilo inline nao e possivel, entao aplicamos no proprio
// wrapper E aproveitamos que o wrapper e o alvo real do listener do dnd-kit;
// cliques no card por baixo (abrir detalhe) continuam funcionando porque o
// dnd-kit so inicia o drag apos o threshold de distancia configurado no
// PointerSensor (ver activationConstraint), entao um clique rapido ainda
// dispara onClick do card normalmente.
function DraggableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
    position: isDragging ? "relative" : "static",
    boxShadow: isDragging ? "0 8px 24px rgba(20,33,61,0.25)" : undefined,
  };
  return (
    <div ref={setNodeRef} className={`kanban-drag-handle${isDragging ? " dragging" : ""}`} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export default function KanbanBoard({ items, statusOptions, statusLabels, getId = (i) => i.id, renderCard, onMoveCard, statusColors, error, onErrorClear }) {
  const [movendo, setMovendo] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Arrastar o board pelo fundo vazio (nao pelos cards) para rolar
  // horizontalmente, igual Trello -- alternativa a depender so da barra de
  // scroll embaixo, que fica escondida/pequena e obriga o usuario a mirar
  // nela pra ver colunas fora da tela.
  const scrollRef = useRef(null);
  const arrastoRef = useRef(null);

  function handlePointerDownFundo(e) {
    // So inicia o pan-scroll se o clique comecou no fundo do board, nao em
    // cima de um card (que tem seu proprio drag-and-drop via dnd-kit) --
    // closest('.kanban-drag-handle') detecta se o alvo esta dentro de um card.
    if (e.target.closest(".kanban-drag-handle")) return;
    if (!scrollRef.current) return;
    arrastoRef.current = { startX: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
  }

  function handlePointerMoveFundo(e) {
    if (!arrastoRef.current || !scrollRef.current) return;
    const dx = e.clientX - arrastoRef.current.startX;
    scrollRef.current.scrollLeft = arrastoRef.current.scrollLeft - dx;
  }

  function handlePointerUpFundo() {
    arrastoRef.current = null;
  }

  const byStatus = {};
  for (const status of statusOptions) byStatus[status] = [];
  for (const item of items) {
    if (byStatus[item.status]) byStatus[item.status].push(item);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const novoStatus = over.id;
    const item = items.find((i) => getId(i) === active.id);
    if (!item || item.status === novoStatus) return;

    setMovendo(active.id);
    onMoveCard(item, novoStatus).finally(() => setMovendo(null));
  }

  return (
    <div>
      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", marginBottom: 12, borderRadius: 8, border: "1px solid var(--danger)", background: "rgba(220,38,38,0.08)", color: "var(--danger)", fontSize: 13 }}>
          <span>{error}</span>
          {onErrorClear && (
            <button onClick={onErrorClear} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          )}
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          ref={scrollRef}
          onPointerDown={handlePointerDownFundo}
          onPointerMove={handlePointerMoveFundo}
          onPointerUp={handlePointerUpFundo}
          onPointerLeave={handlePointerUpFundo}
          style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, maxHeight: "calc(100vh - 260px)" }}
        >
          {statusOptions.map((status) => (
            <Column
              key={status}
              status={status}
              label={statusLabels?.[status]}
              cor={statusColors?.[status]}
              items={byStatus[status] || []}
              renderCard={renderCard}
              getId={getId}
            />
          ))}
        </div>
      </DndContext>
      {movendo && <div style={{ position: "fixed", inset: 0, cursor: "wait", zIndex: 1 }} />}
    </div>
  );
}
