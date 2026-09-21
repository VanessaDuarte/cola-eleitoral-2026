"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type CargoId =
  | "deputado-federal"
  | "deputado-estadual"
  | "senador-1"
  | "senador-2"
  | "governador"
  | "presidente";

type Candidato = {
  id: string;
  cargo:
    | "deputado-federal"
    | "deputado-estadual"
    | "senador"
    | "governador"
    | "presidente";
  nome: string;
  numero: string;
  partido: string;
  partidoNome?: string;
  situacao?: string;
  foto?: string | null;
};

type DadosCandidatos = {
  geradoEm: string;
  anoEleicao: number;
  uf: string;
  total: number;
  candidatos: Candidato[];
};

type Cargo = {
  id: CargoId;
  ordem: number;
  titulo: string;
  digitos: number;
};

const cargos: Cargo[] = [
  { id: "deputado-federal", ordem: 1, titulo: "Deputado Federal", digitos: 4 },
  { id: "deputado-estadual", ordem: 2, titulo: "Deputado Estadual", digitos: 5 },
  { id: "senador-1", ordem: 3, titulo: "Senador — 1ª vaga", digitos: 3 },
  { id: "senador-2", ordem: 4, titulo: "Senador — 2ª vaga", digitos: 3 },
  { id: "governador", ordem: 5, titulo: "Governador", digitos: 2 },
  { id: "presidente", ordem: 6, titulo: "Presidente", digitos: 2 },
];

const estados = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

const CHAVE_COLA_SALVA = "cola-eleitoral-2026-escolhas";

function obterChaveColaSalva(estado: string) {
  return `${CHAVE_COLA_SALVA}-${estado}`;
}

const PARTIDOS_OCULTOS = new Set([
  "PT",
  "PSOL",
  "PC DO B",
  "PSTU",
  "PCB",
  "REDE",
]);

function normalizarSiglaPartido(sigla: string) {
  return sigla.toUpperCase().replace(/\s+/g, " ").trim();
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function obterTituloCargo(cargo: Cargo, estado: string) {
  if (estado === "DF" && cargo.id === "deputado-estadual") {
    return "Deputado Distrital";
  }
  return cargo.titulo;
}

function IdentificacaoVisual({ candidato }: { candidato: Candidato }) {
  if (candidato.foto) {
    return (
      <Image
        className="foto-candidato"
        src={candidato.foto}
        alt={`Foto de ${candidato.nome}`}
        width={52}
        height={52}
      />
    );
  }

  return (
    <span className="iniciais" aria-hidden="true">
      {candidato.nome
        .split(" ")
        .slice(0, 2)
        .map((parte) => parte[0])
        .join("")}
    </span>
  );
}

function FotoNaCola({ candidato }: { candidato?: Candidato }) {
  if (candidato?.foto) {
    return (
      <Image
        className="foto-na-cola"
        src={candidato.foto}
        alt=""
        width={44}
        height={44}
        loading="eager"
      />
    );
  }

  return (
    <span className="iniciais-cola" aria-hidden="true">
      {candidato
        ? candidato.nome
            .split(" ")
            .slice(0, 2)
            .map((parte) => parte[0])
            .join("")
        : "?"}
    </span>
  );
}

export default function Home() {
  const [estado, setEstado] = useState("MG");
  const [modalImpressaoAberto, setModalImpressaoAberto] = useState(false);
  const [quantidadeCopias, setQuantidadeCopias] = useState<1 | 4 | 6>(4);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(true);
  const [erroCandidatos, setErroCandidatos] = useState("");
  const [estadoRestaurado, setEstadoRestaurado] = useState<string | null>(null);

  const botoesCargoRef = useRef<Partial<Record<CargoId, HTMLButtonElement | null>>>({});
  const camposBuscaRef = useRef<Partial<Record<CargoId, HTMLInputElement | null>>>({});
  const resultadosRef = useRef<(HTMLButtonElement | null)[]>([]);
  const modalImpressaoRef = useRef<HTMLElement | null>(null);

  const [cargoAberto, setCargoAberto] = useState<CargoId>("deputado-federal");
  const [buscas, setBuscas] = useState<Partial<Record<CargoId, string>>>({});
  const [selecionados, setSelecionados] = useState<Partial<Record<CargoId, Candidato>>>({});

  const totalSelecionado = Object.keys(selecionados).length;
  const progresso = (totalSelecionado / cargos.length) * 100;

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarCandidatos() {
      setCarregandoCandidatos(true);
      setErroCandidatos("");
      setCandidatos([]);
      setSelecionados({});
      setBuscas({});
      setCargoAberto("deputado-federal");
      setEstadoRestaurado(null);

      try {
        const resposta = await fetch(`/dados/candidatos-2026-${estado}.json`, {
          cache: "no-store",
        });

        if (!resposta.ok) {
          throw new Error("Arquivo de candidatos não encontrado.");
        }

        const dados = (await resposta.json()) as DadosCandidatos;

        if (!Array.isArray(dados.candidatos)) {
          throw new Error("Formato do arquivo de candidatos inválido.");
        }

        if (componenteAtivo) {
          const candidatosVisiveis = dados.candidatos.filter(
            (candidato) =>
              !PARTIDOS_OCULTOS.has(normalizarSiglaPartido(candidato.partido))
          );

          setCandidatos(candidatosVisiveis);
          setErroCandidatos("");
        }
      } catch (erro) {
        if (componenteAtivo) {
          setErroCandidatos(
            erro instanceof Error
              ? erro.message
              : "Não foi possível carregar os candidatos."
          );
        }
      } finally {
        if (componenteAtivo) {
          setCarregandoCandidatos(false);
        }
      }
    }

    carregarCandidatos();

    return () => {
      componenteAtivo = false;
    };
  }, [estado]);

  useEffect(() => {
    if (modalImpressaoAberto) {
      modalImpressaoRef.current?.focus();
    }
  }, [modalImpressaoAberto]);

  useEffect(() => {
    if (carregandoCandidatos || estadoRestaurado === estado) return;

    if (erroCandidatos) {
      setEstadoRestaurado(estado);
      return;
    }

    try {
      const conteudoSalvo = window.localStorage.getItem(
        obterChaveColaSalva(estado)
      );

      if (!conteudoSalvo) {
        setEstadoRestaurado(estado);
        return;
      }

      const idsSalvos = JSON.parse(conteudoSalvo) as Partial<
        Record<CargoId, string>
      >;

      const selecaoRestaurada: Partial<Record<CargoId, Candidato>> = {};

      for (const cargo of cargos) {
        const candidatoId = idsSalvos[cargo.id];

        if (!candidatoId) continue;

        const cargoDosDados =
          cargo.id === "senador-1" || cargo.id === "senador-2"
            ? "senador"
            : cargo.id;

        const candidato = candidatos.find(
          (item) => item.id === candidatoId && item.cargo === cargoDosDados
        );

        if (candidato) {
          selecaoRestaurada[cargo.id] = candidato;
        }
      }

      setSelecionados(selecaoRestaurada);

      const primeiroCargoVazio = cargos.find(
        (cargo) => !selecaoRestaurada[cargo.id]
      );

      if (primeiroCargoVazio) {
        setCargoAberto(primeiroCargoVazio.id);
      }
    } catch {
      window.localStorage.removeItem(obterChaveColaSalva(estado));
    } finally {
      setEstadoRestaurado(estado);
    }
  }, [candidatos, carregandoCandidatos, estado, estadoRestaurado, erroCandidatos]);

  useEffect(() => {
    if (estadoRestaurado !== estado || erroCandidatos) return;

    const idsSelecionados = Object.fromEntries(
      Object.entries(selecionados).map(([cargoId, candidato]) => [
        cargoId,
        candidato.id,
      ])
    );

    window.localStorage.setItem(
      obterChaveColaSalva(estado),
      JSON.stringify(idsSelecionados)
    );
  }, [selecionados, estado, estadoRestaurado, erroCandidatos]);

  const resultados = useMemo(() => {
    const buscaAtual = buscas[cargoAberto] ?? "";
    const buscaNormalizada = normalizarTexto(buscaAtual);

    if (!buscaNormalizada) return [];

    const cargoDaPesquisa =
      cargoAberto === "senador-1" || cargoAberto === "senador-2"
        ? "senador"
        : cargoAberto;

    return candidatos
      .filter((candidato) => {
        const pertenceAoCargo = candidato.cargo === cargoDaPesquisa;
        const correspondeAoNome = normalizarTexto(candidato.nome).includes(buscaNormalizada);
        const correspondeAoNumero = candidato.numero.includes(buscaNormalizada);
        const correspondeAoPartido =
          normalizarTexto(candidato.partido).includes(buscaNormalizada) ||
          normalizarTexto(candidato.partidoNome ?? "").includes(buscaNormalizada);

        return (
          pertenceAoCargo &&
          (correspondeAoNome || correspondeAoNumero || correspondeAoPartido)
        );
      })
      .slice(0, 30);
  }, [buscas, candidatos, cargoAberto]);

  function selecionarCandidato(cargoId: CargoId, candidato: Candidato) {
    const outraVagaDoSenado =
      cargoId === "senador-1"
        ? selecionados["senador-2"]
        : cargoId === "senador-2"
        ? selecionados["senador-1"]
        : undefined;

    if (outraVagaDoSenado?.id === candidato.id) {
      window.alert(
        "Escolha candidatos diferentes para as duas vagas de senador. O voto repetido será considerado nulo."
      );
      return;
    }

    setSelecionados((prev) => ({ ...prev, [cargoId]: candidato }));
    setBuscas((prev) => ({ ...prev, [cargoId]: "" }));

    const indiceAtual = cargos.findIndex((cargo) => cargo.id === cargoId);
    const proximoCargo = cargos[indiceAtual + 1];

    if (proximoCargo) {
      setCargoAberto(proximoCargo.id);
      window.requestAnimationFrame(() => {
        camposBuscaRef.current[proximoCargo.id]?.focus();
      });
    }
  }

  function removerCandidato(cargoId: CargoId) {
    setSelecionados((prev) => {
      const novaSelecao = { ...prev };
      delete novaSelecao[cargoId];
      return novaSelecao;
    });

    setCargoAberto(cargoId);
    window.requestAnimationFrame(() => {
      camposBuscaRef.current[cargoId]?.focus();
    });
  }

  function limparCola() {
    if (!window.confirm("Deseja realmente apagar todos os candidatos selecionados?")) return;
    setSelecionados({});
    setBuscas({});
    setCargoAberto("deputado-federal");
    window.localStorage.removeItem(obterChaveColaSalva(estado));
  }

  function imprimirCola() {
    window.print();
  }

  function abrirCargo(cargoId: CargoId) {
    setCargoAberto(cargoId);
    if (!selecionados[cargoId]) {
      window.requestAnimationFrame(() => {
        camposBuscaRef.current[cargoId]?.focus();
      });
    }
  }

  return (
    <main className="pagina">
      <header className="cabecalho">
        <div className="cabecalho-conteudo">
          <a href="#" className="marca">
            <span className="marca-simbolo">
              <span />
              <span />
              <span />
            </span>
            <span className="marca-textos">
              <strong>Minha Cola Eleitoral</strong>
              <small>Eleições 2026</small>
            </span>
          </a>
          <button
            type="button"
            className="botao-ajuda"
            onClick={() =>
              window.alert("Escolha o estado e pesquise cada candidato pelo nome, número ou partido.")
            }
          >
            <span>?</span> Como funciona
          </button>
        </div>
      </header>

      <section className="apresentacao">
        <div className="apresentacao-conteudo">
          <div className="selo">ELEIÇÕES 2026</div>
          <h1>
            Monte sua cola <span>eleitoral</span>
          </h1>
          <p>
            Pesquise seus candidatos pelo nome, número ou partido e gere uma cola pronta para imprimir.
          </p>

          <label className="campo-estado">
            <span>Seu estado</span>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {estados.map((item) => (
                <option value={item.sigla} key={item.sigla}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="area-principal">
        <div className="coluna-formulario">
          <div className="progresso-cabecalho">
            <span>{totalSelecionado} de {cargos.length} preenchidos</span>
            <button type="button" onClick={limparCola}>Limpar cola</button>
          </div>

          <div className="barra-progresso">
            <span style={{ width: `${progresso}%` }} />
          </div>

          <div className="lista-cargos">
            {cargos.map((cargo) => {
              const estaAberto = cargoAberto === cargo.id;
              const candidatoSelecionado = selecionados[cargo.id];

              return (
                <article
                  key={cargo.id}
                  className={`cartao-cargo ${estaAberto ? "aberto" : ""} ${candidatoSelecionado ? "preenchido" : ""}`}
                >
                  <button
                    type="button"
                    className="cabecalho-cargo"
                    onClick={() => abrirCargo(cargo.id)}
                    ref={(el) => { botoesCargoRef.current[cargo.id] = el; }}
                  >
                    <span className="numero-ordem">{cargo.ordem}</span>
                    <span className="identificacao-cargo">
                      <strong>{obterTituloCargo(cargo, estado)}</strong>
                      <small>{cargo.digitos} dígitos</small>
                    </span>
                    <span className="indicador-abertura">{estaAberto ? "−" : "+"}</span>
                  </button>

                  {candidatoSelecionado && !estaAberto && (
                    <div className="candidato-escolhido">
                      <IdentificacaoVisual candidato={candidatoSelecionado} />
                      <span className="dados-escolhidos">
                        <strong>{candidatoSelecionado.nome}</strong>
                        <small>{candidatoSelecionado.partido}</small>
                      </span>
                      <strong className="numero-escolhido">{candidatoSelecionado.numero}</strong>
                      <button type="button" className="botao-trocar" onClick={() => removerCandidato(cargo.id)}>
                        Trocar
                      </button>
                    </div>
                  )}

                  {estaAberto && (
                    <div className="conteudo-cargo">
                      {candidatoSelecionado ? (
                        <div className="candidato-escolhido destaque">
                          <IdentificacaoVisual candidato={candidatoSelecionado} />
                          <span className="dados-escolhidos">
                            <strong>{candidatoSelecionado.nome}</strong>
                            <small>{candidatoSelecionado.partido}</small>
                          </span>
                          <strong className="numero-escolhido">{candidatoSelecionado.numero}</strong>
                          <button type="button" className="botao-trocar" onClick={() => removerCandidato(cargo.id)}>
                            Trocar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="campo-busca">
                            <input
                              type="search"
                              ref={(el) => { camposBuscaRef.current[cargo.id] = el; }}
                              value={buscas[cargo.id] ?? ""}
                              placeholder="Digite nome, número ou partido..."
                              onChange={(e) =>
                                setBuscas((prev) => ({ ...prev, [cargo.id]: e.target.value }))
                              }
                            />
                          </div>

                          {(buscas[cargo.id] ?? "").trim() !== "" && (
                            <div className="resultados-busca">
                              {carregandoCandidatos ? (
                                <p className="sem-resultados">Carregando...</p>
                              ) : resultados.length > 0 ? (
                                resultados.map((candidato, idx) => (
                                  <button
                                    key={candidato.id}
                                    type="button"
                                    className="resultado-candidato"
                                    ref={(el) => { resultadosRef.current[idx] = el; }}
                                    onClick={() => selecionarCandidato(cargo.id, candidato)}
                                  >
                                    <IdentificacaoVisual candidato={candidato} />
                                    <span className="dados-resultado">
                                      <strong>{candidato.nome}</strong>
                                      <small>{candidato.partido}</small>
                                    </span>
                                    <strong className="numero-resultado">{candidato.numero}</strong>
                                  </button>
                                ))
                              ) : (
                                <p className="sem-resultados">Nenhum candidato encontrado.</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="resumo resumo-formato-final">
          <div className="resumo-cola-final">
            <header className="cola-cabecalho">
              <div>
                <span>ELEIÇÕES 2026</span>
                <h2>Minha Cola Eleitoral</h2>
              </div>
              <strong>{estado}</strong>
            </header>

            <p className="cola-instrucao">Confira a ordem e digite os números na urna.</p>

            <div className="cola-candidatos">
              {cargos.map((cargo) => {
                const candidato = selecionados[cargo.id];
                return (
                  <div className="cola-candidato" key={cargo.id}>
                    <span className="cola-ordem">{cargo.ordem}</span>
                    <FotoNaCola candidato={candidato} />
                    <span className="cola-dados">
                      <small>{obterTituloCargo(cargo, estado)}</small>
                      <strong>{candidato?.nome ?? "Não selecionado"}</strong>
                      <em>{candidato?.partido ?? "Aguardando escolha"}</em>
                    </span>
                    <b>{candidato?.numero ?? "—"}</b>
                  </div>
                );
              })}
            </div>

            <footer className="cola-rodape">
              <span>Leve esta cola em papel.</span>
              <strong>Celular não pode ser usado na cabine.</strong>
            </footer>
          </div>

          <button
            type="button"
            className="botao-gerar"
            disabled={totalSelecionado !== cargos.length}
            onClick={() => setModalImpressaoAberto(true)}
          >
            Gerar cola para impressão
          </button>
        </aside>
      </section>

      {/* MODAL DE IMPRESSÃO - COM A PRÉVIA DINÂMICA REATIVADA */}
      {modalImpressaoAberto && (
        <div className="fundo-modal-impressao" onClick={() => setModalImpressaoAberto(false)}>
          <section
            className="modal-impressao"
            ref={modalImpressaoRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-impressao-topo">
              <div>
                <span>PRÉ-VISUALIZAÇÃO DA FOLHA A4</span>
                <h2>Sua cola está pronta</h2>
              </div>
              <button type="button" onClick={() => setModalImpressaoAberto(false)}>×</button>
            </div>

            {/* CONTAINER DA FOLHA A4 SIMULADA NA TELA */}
            <div className="area-previa-container">
              <div className={`folha-a4-preview modo-copias-${quantidadeCopias}`}>
                {Array.from({ length: quantidadeCopias }).map((_, index) => (
                  <div className="card-cola-mini" key={index}>
                    <div className="mini-head">
                      <span>ELEIÇÕES 2026</span>
                      <strong>{estado}</strong>
                    </div>
                    <div className="mini-body">
                      {cargos.map((cargo) => {
                        const cand = selecionados[cargo.id];
                        return (
                          <div className="mini-row" key={cargo.id}>
                            <span className="mini-num">{cargo.ordem}</span>
                            <span className="mini-nome">{cand?.nome || "Candidato"}</span>
                            <span className="mini-voto">{cand?.numero || "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mini-foot">
                      Celular não pode ser usado na cabine.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SELEÇÃO DAS 3 OPÇÕES (1, 4 E 6 CÓPIAS) */}
            <div className="opcoes-copias-wrapper">
              <p>Quantas cópias deseja imprimir por folha A4?</p>
              <div className="grid-botoes-copias">
                <button
                  type="button"
                  className={quantidadeCopias === 1 ? "ativo" : ""}
                  onClick={() => setQuantidadeCopias(1)}
                >
                  <strong>1 cópia</strong>
                  <small>Uma cola centralizada</small>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 4 ? "ativo" : ""}
                  onClick={() => setQuantidadeCopias(4)}
                >
                  <strong>4 cópias</strong>
                  <small>Quatro colas em 2x2</small>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 6 ? "ativo" : ""}
                  onClick={() => setQuantidadeCopias(6)}
                >
                  <strong>6 cópias</strong>
                  <small>Seis colas em 2x3</small>
                </button>
              </div>
            </div>

            <div className="modal-impressao-acoes">
              <button
                type="button"
                className="botao-voltar-impressao"
                onClick={() => setModalImpressaoAberto(false)}
              >
                Voltar e corrigir
              </button>

              <button
                type="button"
                className="botao-confirmar-impressao"
                onClick={imprimirCola}
              >
                Imprimir {quantidadeCopias} {quantidadeCopias === 1 ? "cópia" : "cópias"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ÁREA DE IMPRESSÃO REAL PARA O NAVEGADOR (PRINT CSS) */}
      <section className={`folha-impressao-real copias-${quantidadeCopias}`}>
        {Array.from({ length: quantidadeCopias }).map((_, index) => (
          <article className="cola-impressa" key={index}>
            <header className="cola-cabecalho">
              <div>
                <span>ELEIÇÕES 2026</span>
                <h2>Minha Cola Eleitoral</h2>
              </div>
              <strong>{estado}</strong>
            </header>
            <p className="cola-instrucao">Confira a ordem e digite os números na urna.</p>
            <div className="cola-candidatos">
              {cargos.map((cargo) => {
                const candidato = selecionados[cargo.id];
                return (
                  <div className="cola-candidato" key={cargo.id}>
                    <span className="cola-ordem">{cargo.ordem}</span>
                    <FotoNaCola candidato={candidato} />
                    <span className="cola-dados">
                      <small>{obterTituloCargo(cargo, estado)}</small>
                      <strong>{candidato?.nome}</strong>
                      <em>{candidato?.partido}</em>
                    </span>
                    <b>{candidato?.numero}</b>
                  </div>
                );
              })}
            </div>
            <footer className="cola-rodape">
              <span>Leve esta cola em papel.</span>
              <strong>Celular não pode ser usado na cabine.</strong>
            </footer>
          </article>
        ))}
      </section>

      <style jsx global>{`
        .folha-impressao-real {
          display: none;
        }

        .fundo-modal-impressao {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(15, 29, 24, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .modal-impressao {
          background: #f9f6eb;
          border-radius: 16px;
          max-width: 620px;
          width: 100%;
          max-height: 92vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .modal-impressao-topo {
          background: #1f382c;
          color: #fff;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-impressao-topo h2 {
          margin: 0;
          font-size: 1.2rem;
        }

        .modal-impressao-topo button {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 1.8rem;
          cursor: pointer;
        }

        .area-previa-container {
          padding: 20px;
          background: #e2dfd5;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* SIMULAÇÃO VISUAL DA FOLHA A4 NA TELA DO MODAL */
        .folha-a4-preview {
          background: #ffffff;
          width: 250px;
          height: 350px;
          border: 1px solid #c8c5ba;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
          padding: 8px;
          box-sizing: border-box;
          display: grid;
          gap: 6px;
        }

        .folha-a4-preview.modo-copias-1 {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .folha-a4-preview.modo-copias-1 .card-cola-mini {
          width: 85%;
          height: 85%;
        }

        .folha-a4-preview.modo-copias-4 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
        }

        .folha-a4-preview.modo-copias-6 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(3, 1fr);
          gap: 4px;
          padding: 6px;
        }

        .card-cola-mini {
          border: 1px solid #1f382c;
          border-radius: 4px;
          padding: 4px 6px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #faf8f2;
          overflow: hidden;
        }

        .mini-head {
          display: flex;
          justify-content: space-between;
          background: #1f382c;
          color: #fff;
          padding: 2px 4px;
          font-weight: bold;
          font-size: 7px;
          border-radius: 2px;
        }

        .mini-body {
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          flex: 1;
          margin: 3px 0;
        }

        .mini-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e0ddd3;
          padding-bottom: 1px;
          font-size: 8px;
          line-height: 1;
        }

        .mini-num {
          background: #467a3d;
          color: #fff;
          border-radius: 50%;
          width: 10px;
          height: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 6px;
          font-weight: bold;
        }

        .mini-nome {
          flex: 1;
          margin: 0 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 7px;
          color: #1a1a1a;
        }

        .mini-voto {
          font-weight: bold;
          font-size: 8px;
          color: #111;
        }

        .mini-foot {
          font-size: 5px;
          text-align: center;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 1px;
        }

        .opcoes-copias-wrapper {
          padding: 16px 24px;
        }

        .grid-botoes-copias {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 8px;
        }

        .grid-botoes-copias button {
          border: 2px solid #d2cebf;
          background: #fff;
          border-radius: 10px;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          cursor: pointer;
        }

        .grid-botoes-copias button.ativo {
          border-color: #1f382c;
          background: #f0f4f1;
        }

        .modal-impressao-acoes {
          padding: 16px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e2dfd5;
        }

        .botao-voltar-impressao {
          background: transparent;
          border: 1px solid #aaa;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
        }

        .botao-confirmar-impressao {
          background: #1f382c;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
        }

        /* REGRAS ESTRITAS DE IMPRESSÃO DO NAVEGADOR */
        @media print {
          body * {
            visibility: hidden !important;
          }

          .folha-impressao-real,
          .folha-impressao-real * {
            visibility: visible !important;
          }

          .folha-impressao-real {
            display: grid !important;
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
          }

          .folha-impressao-real.copias-1 {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }

          .folha-impressao-real.copias-1 .cola-impressa {
            width: 70% !important;
            max-height: 90% !important;
          }

          .folha-impressao-real.copias-4 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            gap: 8mm !important;
          }

          .folha-impressao-real.copias-6 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: repeat(3, 1fr) !important;
            gap: 5mm !important;
          }

          .cola-impressa {
            border: 2px solid #20372f !important;
            border-radius: 8px !important;
            padding: 8px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </main>
  );
}