import { Component } from "react";

// Sem isso, qualquer erro nao tratado durante a renderizacao (ex: excecao
// dentro de um componente) derruba a arvore inteira do React e deixa a tela
// em branco, sem nenhuma pista do que aconteceu. Captura o erro, mostra uma
// mensagem com opcao de recarregar, e loga no console pra investigacao.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro não tratado na interface:", erro, info);
  }

  render() {
    if (this.state.erro) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 16, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif",
        }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: "#5B6470", maxWidth: 420, margin: 0 }}>
            A tela encontrou um erro inesperado. Recarregue a página -- se o problema continuar, avise o time técnico.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: "#2A7F6E", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
