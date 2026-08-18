import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCreativesAImplementar } from "../api/client.js";
import CreativeCardGrid from "../components/contentMatrix/CreativeCardGrid.jsx";
import CreativeGridCard from "../components/contentMatrix/CreativeGridCard.jsx";
import CreativeFusedDetailModal from "../components/contentMatrix/CreativeFusedDetailModal.jsx";
import Spinner from "../components/common/Spinner.jsx";

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// Tela global de triagem: criativos urgentes (periodo_inicio hoje/amanha) de TODAS
// as campanhas do usuario, de uma vez -- so leitura, sem CRUD/status aqui (a edicao
// continua acontecendo na Matriz da campanha especifica).
export default function CriativosAImplementarPage() {
  const [creatives, setCreatives] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getCreativesAImplementar().then(setCreatives).catch(console.error);
  }, []);

  if (!creatives) return <Spinner />;

  return (
    <div style={{ paddingTop: 20 }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", marginBottom: 18,
          borderRadius: 12, border: "1px solid rgba(199,127,26,0.35)", background: "rgba(199,127,26,0.1)", color: "#c77f1a",
        }}
      >
        <WarningIcon />
        <strong style={{ fontSize: 14 }}>
          {creatives.length === 0
            ? "Nenhum criativo urgente no momento."
            : `${creatives.length} criativo${creatives.length === 1 ? "" : "s"} precisa${creatives.length === 1 ? "" : "m"} ser implementado${creatives.length === 1 ? "" : "s"} hoje ou amanhã.`}
        </strong>
      </div>

      {creatives.length > 0 && (
        <CreativeCardGrid>
          {creatives.map((c) => (
            <CreativeGridCard
              key={c.id}
              creative={c}
              urgente
              campanhaNome={c.campanha_nome_ref}
              canEdit={false}
              onOpenDetail={() => setDetalhe(c)}
            />
          ))}
        </CreativeCardGrid>
      )}

      {detalhe && (
        <CreativeFusedDetailModal
          creative={detalhe}
          campanhaId={detalhe.campanha_id_ref}
          onClose={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}
