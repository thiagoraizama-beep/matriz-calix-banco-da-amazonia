import { useState } from "react";

// Preferencia de visualizacao (Grade/Kanban) persistida no localStorage --
// cada tela (Matriz, Campanhas) usa sua propria chave, entao a escolha de
// uma nao afeta a outra, mas sobrevive a navegar entre paginas ou recarregar.
export function useVisualizacao(chave) {
  const [visualizacao, setVisualizacaoState] = useState(() => {
    try {
      return localStorage.getItem(chave) === "kanban" ? "kanban" : "grade";
    } catch {
      return "grade";
    }
  });

  function setVisualizacao(v) {
    setVisualizacaoState(v);
    try {
      localStorage.setItem(chave, v);
    } catch {
      // localStorage indisponivel (modo privado etc) -- so nao persiste, sem quebrar a troca.
    }
  }

  return [visualizacao, setVisualizacao];
}
