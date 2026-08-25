import { useEffect, useRef, useState } from "react";
import { getCreativeFiles } from "../../api/client.js";

function ChevronIcon({ direcao }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d={direcao === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

const AUTOPLAY_MS = 2500;

// Slides = [capa, ...arquivos extras], sempre nessa ordem -- a capa (a que
// vai pro Excel/Sheets) e sempre o primeiro slide. Busca os extras sob
// demanda (so quando arquivos_extras > 0) -- criativo com 1 arquivo so
// nunca paga esse fetch.
function useSlides(creative) {
  const [extras, setExtras] = useState(null);
  const temExtras = Number(creative.arquivos_extras) > 0;

  useEffect(() => {
    if (!temExtras) return;
    let cancelado = false;
    getCreativeFiles(creative.id).then((arquivos) => {
      if (!cancelado) setExtras(arquivos);
    });
    return () => { cancelado = true; };
  }, [creative.id, temExtras]);

  if (!temExtras) return [{ cloudinary_url: creative.cloudinary_url, tipo_midia: creative.tipo_midia }];
  if (!extras) return [{ cloudinary_url: creative.cloudinary_url, tipo_midia: creative.tipo_midia }];
  return [{ cloudinary_url: creative.cloudinary_url, tipo_midia: creative.tipo_midia }, ...extras];
}

// Carrossel de midia de um criativo -- ativa automaticamente quando ha mais
// de 1 arquivo (arquivos_extras > 0), com troca automatica + setas manuais e
// transicao suave (slide horizontal). Continua mostrando so 1 imagem (sem
// nenhuma seta/controle) quando o criativo tem apenas 1 arquivo. Autoplay:
// pausa em hover e enquanto o slide atual e video (nao corta a reproducao).
export default function MediaCarousel({ creative, autoplay = true, objectFit = "contain", videoControls = false, mostrarIndicadores = true }) {
  const slides = useSlides(creative);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setIndice(0);
  }, [creative.id]);

  const slideAtual = slides[indice];
  const deveAutoplay = autoplay && !pausado && slides.length > 1 && slideAtual?.tipo_midia !== "video";

  useEffect(() => {
    if (!deveAutoplay) return;
    timerRef.current = setTimeout(() => {
      setIndice((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [deveAutoplay, indice, slides.length]);

  function irPara(novoIndice, e) {
    e?.stopPropagation();
    setIndice((novoIndice + slides.length) % slides.length);
  }

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex", width: "100%", height: "100%",
          transform: `translateX(-${indice * 100}%)`,
          transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {slides.map((slide, i) => (
          <div key={i} style={{ flex: "0 0 100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {slide.tipo_midia === "video" ? (
              <video
                src={slide.cloudinary_url}
                controls={videoControls}
                autoPlay={!videoControls && i === indice}
                muted={!videoControls}
                loop={!videoControls}
                playsInline
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit, display: "block" }}
              />
            ) : (
              <img src={slide.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit, display: "block" }} />
            )}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => irPara(indice - 1, e)}
            aria-label="Anterior"
            className="media-carousel-arrow"
            style={{
              position: "absolute", top: "50%", left: 4, transform: "translateY(-50%)",
              width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0.75, transition: "opacity 0.15s ease, background 0.15s ease",
            }}
          >
            <ChevronIcon direcao="left" />
          </button>
          <button
            type="button"
            onClick={(e) => irPara(indice + 1, e)}
            aria-label="Próximo"
            className="media-carousel-arrow"
            style={{
              position: "absolute", top: "50%", right: 4, transform: "translateY(-50%)",
              width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0.75, transition: "opacity 0.15s ease, background 0.15s ease",
            }}
          >
            <ChevronIcon direcao="right" />
          </button>
          <style>{`
            .media-carousel-arrow:hover { opacity: 1 !important; background: rgba(20,33,61,0.4) !important; }
          `}</style>
          {mostrarIndicadores && (
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => irPara(i, e)}
                  aria-label={`Ir para o slide ${i + 1}`}
                  style={{
                    width: i === indice ? 16 : 6, height: 6, borderRadius: 999, border: "none", cursor: "pointer",
                    background: i === indice ? "#fff" : "rgba(255,255,255,0.55)",
                    transition: "width 0.25s ease, background 0.25s ease", padding: 0,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
