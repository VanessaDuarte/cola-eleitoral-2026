"use client";

import { FormEvent, useState } from "react";

type Estatisticas = {
  total: number;
  imagens: number;
  impressoes: number;
  hoje: number;
  mes: number;
};

export default function EstatisticasPage() {
  const [senha, setSenha] = useState("");
  const [dados, setDados] = useState<Estatisticas | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function consultar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch("/api/contador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "consultar", senha }),
        cache: "no-store",
      });
      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro || "Não foi possível consultar.");
      }

      setDados(resultado);
    } catch (falha) {
      setDados(null);
      setErro(falha instanceof Error ? falha.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="pagina-estatisticas">
      <section className="painel-estatisticas">
        <span className="rotulo">COLA ELEITORAL 2026</span>
        <h1>Estatísticas de uso</h1>
        <p className="descricao">
          Contagem anônima de imagens baixadas e folhas enviadas para impressão.
        </p>

        {!dados ? (
          <form onSubmit={consultar}>
            <label htmlFor="senha">Senha de acesso</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              autoComplete="current-password"
              required
            />
            {erro && <p className="erro">{erro}</p>}
            <button disabled={carregando} type="submit">
              {carregando ? "Consultando…" : "Ver estatísticas"}
            </button>
          </form>
        ) : (
          <>
            <div className="destaque">
              <span>Total geral</span>
              <strong>{dados.total.toLocaleString("pt-BR")}</strong>
              <small>colas geradas</small>
            </div>

            <div className="grade">
              <article>
                <span>Hoje</span>
                <strong>{dados.hoje.toLocaleString("pt-BR")}</strong>
              </article>
              <article>
                <span>Neste mês</span>
                <strong>{dados.mes.toLocaleString("pt-BR")}</strong>
              </article>
              <article>
                <span>Imagens</span>
                <strong>{dados.imagens.toLocaleString("pt-BR")}</strong>
              </article>
              <article>
                <span>Impressões</span>
                <strong>{dados.impressoes.toLocaleString("pt-BR")}</strong>
              </article>
            </div>

            <button className="atualizar" onClick={() => setDados(null)}>
              Atualizar consulta
            </button>
          </>
        )}
      </section>

      <style jsx>{`
        .pagina-estatisticas {
          display: grid;
          min-height: 100dvh;
          place-items: center;
          padding: 24px;
          background: #f4f1e7;
          color: #15352b;
          font-family: Arial, sans-serif;
        }
        .painel-estatisticas {
          width: min(620px, 100%);
          padding: clamp(24px, 5vw, 44px);
          border: 1px solid #d7ddd8;
          border-radius: 22px;
          background: #fffdf7;
          box-shadow: 0 20px 55px rgba(21, 53, 43, 0.14);
        }
        .rotulo {
          color: #a47f00;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.14em;
        }
        h1 {
          margin: 7px 0 5px;
          font-size: clamp(1.8rem, 6vw, 2.6rem);
        }
        .descricao {
          margin: 0 0 26px;
          color: #637168;
          line-height: 1.5;
        }
        form {
          display: grid;
          gap: 10px;
        }
        label {
          font-weight: 800;
        }
        input {
          min-height: 48px;
          padding: 0 14px;
          border: 2px solid #ccd5cf;
          border-radius: 11px;
          font-size: 1rem;
        }
        button {
          min-height: 48px;
          margin-top: 5px;
          border: 0;
          border-radius: 11px;
          background: #15352b;
          color: white;
          font-size: 1rem;
          font-weight: 900;
          cursor: pointer;
        }
        button:disabled {
          cursor: wait;
          opacity: 0.65;
        }
        .erro {
          margin: 0;
          color: #a52f2f;
          font-weight: 700;
        }
        .destaque {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
          border-radius: 16px;
          background: linear-gradient(135deg, #075234, #087a3d);
          color: white;
        }
        .destaque span {
          color: #f3ca16;
          font-weight: 900;
        }
        .destaque strong {
          font-size: clamp(3rem, 12vw, 5rem);
          line-height: 1;
        }
        .destaque small {
          margin-top: 4px;
        }
        .grade {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .grade article {
          display: flex;
          flex-direction: column;
          padding: 18px;
          border: 1px solid #dce3dd;
          border-radius: 14px;
          background: white;
        }
        .grade span {
          color: #637168;
          font-size: 0.82rem;
          font-weight: 800;
        }
        .grade strong {
          margin-top: 4px;
          font-size: 1.8rem;
        }
        .atualizar {
          width: 100%;
          margin-top: 16px;
        }
        @media (max-width: 390px) {
          .pagina-estatisticas {
            padding: 10px;
          }
          .grade {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
