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
  {
    id: "deputado-federal",
    ordem: 1,
    titulo: "Deputado Federal",
    digitos: 4,
  },
  {
    id: "deputado-estadual",
    ordem: 2,
    titulo: "Deputado Estadual",
    digitos: 5,
  },
  {
    id: "senador-1",
    ordem: 3,
    titulo: "Senador — 1ª vaga",
    digitos: 3,
  },
  {
    id: "senador-2",
    ordem: 4,
    titulo: "Senador — 2ª vaga",
    digitos: 3,
  },
  {
    id: "governador",
    ordem: 5,
    titulo: "Governador",
    digitos: 2,
  },
  {
    id: "presidente",
    ordem: 6,
    titulo: "Presidente",
    digitos: 2,
  },
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
  const [quantidadeCopias, setQuantidadeCopias] = useState<2 | 4 | 6>(6);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] = useState(true);
  const [erroCandidatos, setErroCandidatos] = useState("");
  const [estadoRestaurado, setEstadoRestaurado] = useState<string | null>(null);

  const botoesCargoRef = useRef<
    Partial<Record<CargoId, HTMLButtonElement | null>>
  >({});
  const camposBuscaRef = useRef<
    Partial<Record<CargoId, HTMLInputElement | null>>
  >({});
  const resultadosRef = useRef<(HTMLButtonElement | null)[]>([]);
  const modalImpressaoRef = useRef<HTMLElement | null>(null);

  const [cargoAberto, setCargoAberto] = useState<CargoId>("deputado-federal");
  const [buscas, setBuscas] = useState<Partial<Record<CargoId, string>>>({});
  const [selecionados, setSelecionados] = useState<
    Partial<Record<CargoId, Candidato>>
  >({});

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
              !PARTIDOS_OCULTOS.has(normalizarSiglaPartido(candidato.partido)),
          );

          setCandidatos(candidatosVisiveis);
          setErroCandidatos("");
        }
      } catch (erro) {
        if (componenteAtivo) {
          setErroCandidatos(
            erro instanceof Error
              ? erro.message
              : "Não foi possível carregar os candidatos.",
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
    if (!modalImpressaoAberto) {
      return;
    }

    modalImpressaoRef.current?.focus();
  }, [modalImpressaoAberto]);

  useEffect(() => {
    if (carregandoCandidatos || estadoRestaurado === estado) {
      return;
    }

    if (erroCandidatos) {
      setEstadoRestaurado(estado);
      return;
    }

    try {
      const conteudoSalvo = window.localStorage.getItem(
        obterChaveColaSalva(estado),
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

        if (!candidatoId) {
          continue;
        }

        const cargoDosDados =
          cargo.id === "senador-1" || cargo.id === "senador-2"
            ? "senador"
            : cargo.id;

        const candidato = candidatos.find(
          (item) => item.id === candidatoId && item.cargo === cargoDosDados,
        );

        if (candidato) {
          selecaoRestaurada[cargo.id] = candidato;
        }
      }

      setSelecionados(selecaoRestaurada);

      const primeiroCargoVazio = cargos.find(
        (cargo) => !selecaoRestaurada[cargo.id],
      );

      if (primeiroCargoVazio) {
        setCargoAberto(primeiroCargoVazio.id);
      }
    } catch {
      window.localStorage.removeItem(obterChaveColaSalva(estado));
    } finally {
      setEstadoRestaurado(estado);
    }
  }, [
    candidatos,
    carregandoCandidatos,
    estado,
    estadoRestaurado,
    erroCandidatos,
  ]);

  useEffect(() => {
    if (estadoRestaurado !== estado || erroCandidatos) {
      return;
    }

    const idsSelecionados = Object.fromEntries(
      Object.entries(selecionados).map(([cargoId, candidato]) => [
        cargoId,
        candidato.id,
      ]),
    );

    window.localStorage.setItem(
      obterChaveColaSalva(estado),
      JSON.stringify(idsSelecionados),
    );
  }, [selecionados, estado, estadoRestaurado, erroCandidatos]);

  const resultados = useMemo(() => {
    const buscaAtual = buscas[cargoAberto] ?? "";
    const buscaNormalizada = normalizarTexto(buscaAtual);

    if (!buscaNormalizada) {
      return [];
    }

    const cargoDaPesquisa =
      cargoAberto === "senador-1" || cargoAberto === "senador-2"
        ? "senador"
        : cargoAberto;

    return candidatos
      .filter((candidato) => {
        const pertenceAoCargo = candidato.cargo === cargoDaPesquisa;

        const correspondeAoNome = normalizarTexto(candidato.nome).includes(
          buscaNormalizada,
        );

        const correspondeAoNumero = candidato.numero.includes(buscaNormalizada);

        const correspondeAoPartido =
          normalizarTexto(candidato.partido).includes(buscaNormalizada) ||
          normalizarTexto(candidato.partidoNome ?? "").includes(
            buscaNormalizada,
          );

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
        "Escolha candidatos diferentes para as duas vagas de senador. O voto repetido será considerado nulo.",
      );
      return;
    }

    setSelecionados((estadoAnterior) => ({
      ...estadoAnterior,
      [cargoId]: candidato,
    }));

    setBuscas((estadoAnterior) => ({
      ...estadoAnterior,
      [cargoId]: "",
    }));

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
    setSelecionados((estadoAnterior) => {
      const novaSelecao = { ...estadoAnterior };
      delete novaSelecao[cargoId];
      return novaSelecao;
    });

    setCargoAberto(cargoId);

    window.requestAnimationFrame(() => {
      camposBuscaRef.current[cargoId]?.focus();
    });
  }

  function limparCola() {
    const confirmou = window.confirm(
      "Deseja realmente apagar todos os candidatos selecionados?",
    );

    if (!confirmou) {
      return;
    }

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

  function navegarEntreCargos(
    evento: React.KeyboardEvent<HTMLButtonElement>,
    indiceAtual: number,
  ) {
    let proximoIndice: number | null = null;

    if (evento.key === "ArrowDown" || evento.key === "ArrowRight") {
      proximoIndice = (indiceAtual + 1) % cargos.length;
    } else if (evento.key === "ArrowUp" || evento.key === "ArrowLeft") {
      proximoIndice = (indiceAtual - 1 + cargos.length) % cargos.length;
    } else if (evento.key === "Home") {
      proximoIndice = 0;
    } else if (evento.key === "End") {
      proximoIndice = cargos.length - 1;
    }

    if (proximoIndice === null) {
      return;
    }

    evento.preventDefault();
    const proximoCargo = cargos[proximoIndice];
    setCargoAberto(proximoCargo.id);

    window.requestAnimationFrame(() => {
      if (selecionados[proximoCargo.id]) {
        botoesCargoRef.current[proximoCargo.id]?.focus();
      } else {
        camposBuscaRef.current[proximoCargo.id]?.focus();
      }
    });
  }

  function navegarNaBusca(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" && resultados.length > 0) {
      evento.preventDefault();
      resultadosRef.current[0]?.focus();
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      botoesCargoRef.current[cargoAberto]?.focus();
      return;
    }

    if (evento.key === "Enter" && resultados.length > 0) {
      evento.preventDefault();
      selecionarCandidato(cargoAberto, resultados[0]);
      return;
    }

    if (evento.key === "Escape") {
      evento.preventDefault();
      setBuscas((estadoAnterior) => ({
        ...estadoAnterior,
        [cargoAberto]: "",
      }));
    }
  }

  function navegarEntreResultados(
    evento: React.KeyboardEvent<HTMLButtonElement>,
    indiceAtual: number,
  ) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      const proximoIndice =
        indiceAtual === resultados.length - 1 ? 0 : indiceAtual + 1;
      resultadosRef.current[proximoIndice]?.focus();
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();

      if (indiceAtual === 0) {
        camposBuscaRef.current[cargoAberto]?.focus();
      } else {
        resultadosRef.current[indiceAtual - 1]?.focus();
      }

      return;
    }

    if (evento.key === "Home") {
      evento.preventDefault();
      resultadosRef.current[0]?.focus();
      return;
    }

    if (evento.key === "End") {
      evento.preventDefault();
      resultadosRef.current[resultados.length - 1]?.focus();
      return;
    }

    if (evento.key === "Escape") {
      evento.preventDefault();
      camposBuscaRef.current[cargoAberto]?.focus();
    }
  }

  function controlarTecladoModal(evento: React.KeyboardEvent<HTMLElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      setModalImpressaoAberto(false);
      return;
    }

    if (evento.key !== "Tab" || !modalImpressaoRef.current) {
      return;
    }

    const elementos = Array.from(
      modalImpressaoRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

    if (elementos.length === 0) {
      return;
    }

    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];

    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
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
              window.alert(
                "Escolha o estado e pesquise cada candidato pelo nome, número ou partido.",
              )
            }
          >
            <span>?</span>
            Como funciona
          </button>
        </div>
      </header>

      <section className="apresentacao">
        <div className="apresentacao-conteudo">
          <div className="selo">ELEIÇÕES 2026</div>

          <h1>
            Monte sua cola
            <span> eleitoral</span>
          </h1>

          <p>
            Pesquise seus candidatos pelo nome, número ou partido e gere uma
            cola pronta para imprimir.
          </p>

          <label className="campo-estado">
            <span>Seu estado</span>

            <select
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
            >
              {estados.map((item) => (
                <option value={item.sigla} key={item.sigla}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="decoracao-apresentacao" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="area-principal">
        <div className="coluna-formulario">
          <div className="progresso-cabecalho">
            <span>
              {totalSelecionado} de {cargos.length} preenchidos
            </span>

            <button type="button" onClick={limparCola}>
              Limpar cola
            </button>
          </div>

          <div className="barra-progresso">
            <span style={{ width: `${progresso}%` }} />
          </div>

          <div className="lista-cargos">
            {cargos.map((cargo, indiceCargo) => {
              const estaAberto = cargoAberto === cargo.id;
              const candidatoSelecionado = selecionados[cargo.id];

              return (
                <article
                  key={cargo.id}
                  className={`cartao-cargo ${estaAberto ? "aberto" : ""} ${
                    candidatoSelecionado ? "preenchido" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="cabecalho-cargo"
                    onClick={() => abrirCargo(cargo.id)}
                    onKeyDown={(evento) =>
                      navegarEntreCargos(evento, indiceCargo)
                    }
                    ref={(elemento) => {
                      botoesCargoRef.current[cargo.id] = elemento;
                    }}
                    aria-expanded={estaAberto}
                    aria-controls={`conteudo-${cargo.id}`}
                  >
                    <span className="numero-ordem">{cargo.ordem}</span>

                    <span className="identificacao-cargo">
                      <strong>{obterTituloCargo(cargo, estado)}</strong>
                      <small>{cargo.digitos} dígitos</small>
                    </span>

                    <span className="indicador-abertura">
                      {estaAberto ? "−" : "+"}
                    </span>
                  </button>

                  {candidatoSelecionado && !estaAberto && (
                    <div className="candidato-escolhido">
                      <IdentificacaoVisual candidato={candidatoSelecionado} />

                      <span className="dados-escolhidos">
                        <strong>{candidatoSelecionado.nome}</strong>
                        <small>{candidatoSelecionado.partido}</small>
                      </span>

                      <strong className="numero-escolhido">
                        {candidatoSelecionado.numero}
                      </strong>

                      <button
                        type="button"
                        className="botao-trocar"
                        onClick={() => removerCandidato(cargo.id)}
                      >
                        Trocar
                      </button>
                    </div>
                  )}

                  {estaAberto && (
                    <div className="conteudo-cargo" id={`conteudo-${cargo.id}`}>
                      {candidatoSelecionado ? (
                        <div className="candidato-escolhido destaque">
                          <IdentificacaoVisual
                            candidato={candidatoSelecionado}
                          />

                          <span className="dados-escolhidos">
                            <strong>{candidatoSelecionado.nome}</strong>
                            <small>{candidatoSelecionado.partido}</small>
                          </span>

                          <strong className="numero-escolhido">
                            {candidatoSelecionado.numero}
                          </strong>

                          <button
                            type="button"
                            className="botao-trocar"
                            onClick={() => removerCandidato(cargo.id)}
                          >
                            Trocar
                          </button>
                        </div>
                      ) : (
                        <>
                          <label
                            htmlFor={`busca-${cargo.id}`}
                            className="rotulo-busca"
                          >
                            Nome, número ou partido
                          </label>

                          <div className="campo-busca">
                            <span aria-hidden="true">⌕</span>

                            <input
                              id={`busca-${cargo.id}`}
                              type="search"
                              ref={(elemento) => {
                                camposBuscaRef.current[cargo.id] = elemento;
                              }}
                              value={buscas[cargo.id] ?? ""}
                              placeholder="Digite o nome, número ou partido..."
                              autoComplete="off"
                              aria-controls={`resultados-${cargo.id}`}
                              aria-label={`Pesquisar por nome, número ou partido para ${obterTituloCargo(cargo, estado)}`}
                              maxLength={60}
                              onKeyDown={navegarNaBusca}
                              onChange={(evento) =>
                                setBuscas((estadoAnterior) => ({
                                  ...estadoAnterior,
                                  [cargo.id]: evento.target.value,
                                }))
                              }
                            />
                          </div>

                          <p className="instrucoes-teclado">
                            Use ↑ e ↓ para navegar e Enter para selecionar.
                          </p>

                          {(buscas[cargo.id] ?? "").trim() !== "" && (
                            <div
                              className="resultados-busca"
                              id={`resultados-${cargo.id}`}
                              aria-label={`Resultados para ${obterTituloCargo(cargo, estado)}`}
                              aria-live="polite"
                            >
                              {carregandoCandidatos ? (
                                <p className="sem-resultados">
                                  Carregando candidatos oficiais...
                                </p>
                              ) : erroCandidatos ? (
                                <p className="sem-resultados">
                                  {erroCandidatos} Execute novamente a
                                  importação dos dados do TSE.
                                </p>
                              ) : resultados.length > 0 ? (
                                resultados.map((candidato, indiceResultado) => (
                                  <button
                                    key={candidato.id}
                                    type="button"
                                    className="resultado-candidato"
                                    ref={(elemento) => {
                                      resultadosRef.current[indiceResultado] =
                                        elemento;
                                    }}
                                    onKeyDown={(evento) =>
                                      navegarEntreResultados(
                                        evento,
                                        indiceResultado,
                                      )
                                    }
                                    onClick={() =>
                                      selecionarCandidato(cargo.id, candidato)
                                    }
                                  >
                                    <IdentificacaoVisual
                                      candidato={candidato}
                                    />

                                    <span className="dados-resultado">
                                      <strong>{candidato.nome}</strong>
                                      <small>
                                        {candidato.partido}
                                        {candidato.situacao
                                          ? ` · ${candidato.situacao}`
                                          : ""}
                                      </small>
                                    </span>

                                    <strong className="numero-resultado">
                                      {candidato.numero}
                                    </strong>
                                  </button>
                                ))
                              ) : (
                                <p className="sem-resultados">
                                  Nenhum candidato encontrado.
                                </p>
                              )}
                            </div>
                          )}

                          <p className="aviso-demonstracao">
                            Dados oficiais disponibilizados pelo TSE.
                          </p>
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

            <p className="cola-instrucao">
              Confira a ordem e digite os números na urna.
            </p>

            <div className="cola-candidatos">
              {cargos.map((cargo) => {
                const candidato = selecionados[cargo.id];

                return (
                  <div
                    className={`cola-candidato ${
                      candidato ? "" : "cola-candidato-vazio"
                    }`}
                    key={cargo.id}
                  >
                    <span className="cola-ordem">{cargo.ordem}</span>

                    {candidato ? (
                      <>
                        <FotoNaCola candidato={candidato} />

                        <span className="cola-dados">
                          <small>{obterTituloCargo(cargo, estado)}</small>
                          <strong>{candidato.nome}</strong>
                          <em>{candidato.partido}</em>
                        </span>

                        <b>{candidato.numero}</b>
                      </>
                    ) : (
                      <>
                        <span className="cola-dados cola-dados-vazio">
                          <small>{obterTituloCargo(cargo, estado)}</small>
                          <span className="linha-preenchimento-manual" />
                        </span>

                        <span
                          className="digitos-preenchimento-manual"
                          aria-label={`${cargo.digitos} espaços para preencher o número`}
                        >
                          {Array.from(
                            { length: cargo.digitos },
                            (_, indice) => (
                              <i key={indice} />
                            ),
                          )}
                        </span>
                      </>
                    )}
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
            onClick={() => setModalImpressaoAberto(true)}
          >
            Gerar cola para impressão
          </button>

          <p className="privacidade">
            <span>✓</span>
            Suas escolhas ficam salvas apenas neste navegador.
          </p>
        </aside>
      </section>

      {modalImpressaoAberto && (
        <div
          className="fundo-modal-impressao"
          role="presentation"
          onMouseDown={() => setModalImpressaoAberto(false)}
        >
          <section
            className="modal-impressao"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-impressao"
            tabIndex={-1}
            ref={modalImpressaoRef}
            onKeyDown={controlarTecladoModal}
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="modal-impressao-topo">
              <div>
                <span>PRÉ-VISUALIZAÇÃO</span>
                <h2 id="titulo-modal-impressao">Sua cola está pronta</h2>
              </div>

              <button
                type="button"
                aria-label="Fechar pré-visualização"
                onClick={() => setModalImpressaoAberto(false)}
              >
                ×
              </button>
            </div>

            <div className="area-previa-final">
              <div className={`folha-a4-preview copias-${quantidadeCopias}`}>
                {Array.from({ length: quantidadeCopias }, (_, index) => (
                  <div
                    className="resumo-cola-final cola-miniatura-estilizada"
                    key={index}
                  >
                    <header className="cola-cabecalho">
                      <div>
                        <span>ELEIÇÕES 2026</span>
                        <h2>Minha Cola Eleitoral</h2>
                      </div>
                      <strong>{estado}</strong>
                    </header>

                    <p className="cola-instrucao">
                      Confira a ordem e digite os números na urna.
                    </p>

                    <div className="cola-candidatos">
                      {cargos.map((cargo) => {
                        const candidato = selecionados[cargo.id];
                        return (
                          <div
                            className={`cola-candidato ${
                              candidato ? "" : "cola-candidato-vazio"
                            }`}
                            key={cargo.id}
                          >
                            <span className="cola-ordem">{cargo.ordem}</span>

                            {candidato ? (
                              <>
                                <FotoNaCola candidato={candidato} />
                                <span className="cola-dados">
                                  <small>
                                    {obterTituloCargo(cargo, estado)}
                                  </small>
                                  <strong>{candidato.nome}</strong>
                                  <em>{candidato.partido}</em>
                                </span>
                                <b>{candidato.numero}</b>
                              </>
                            ) : (
                              <>
                                <span className="cola-dados cola-dados-vazio">
                                  <small>
                                    {obterTituloCargo(cargo, estado)}
                                  </small>
                                  <span className="linha-preenchimento-manual" />
                                </span>
                                <span className="digitos-preenchimento-manual">
                                  {Array.from(
                                    { length: cargo.digitos },
                                    (_, indice) => (
                                      <i key={indice} />
                                    ),
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <footer className="cola-rodape">
                      <span>Leve esta cola em papel.</span>
                      <strong>Celular não pode ser usado na cabine.</strong>
                    </footer>
                  </div>
                ))}
              </div>
            </div>

            <fieldset className="opcoes-copias">
              <legend>Quantas cópias deseja imprimir?</legend>

              <div className="grid-opcoes-copias">
                <button
                  type="button"
                  className={quantidadeCopias === 2 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(2)}
                >
                  <strong>2 cópias</strong>
                  <span>Duas colas em 1x2</span>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 4 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(4)}
                >
                  <strong>4 cópias</strong>
                  <span>Quatro colas em 2x2</span>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 6 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(6)}
                >
                  <strong>6 cópias</strong>
                  <span>Seis colas em 2x3</span>
                </button>
              </div>
            </fieldset>

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
                Imprimir {quantidadeCopias} cópias
              </button>
            </div>
          </section>
        </div>
      )}

      <section
        className={`folha-impressao-real copias-${quantidadeCopias}`}
        aria-label="Colas eleitorais"
      >
        {Array.from({ length: quantidadeCopias }, (_, indice) => (
          <article
            className="resumo-cola-final cola-impressa-fidelidade"
            key={indice}
          >
            <header className="cola-cabecalho">
              <div>
                <span>ELEIÇÕES 2026</span>
                <h2>Minha Cola Eleitoral</h2>
              </div>

              <strong>{estado}</strong>
            </header>

            <p className="cola-instrucao">
              Confira a ordem e digite os números na urna.
            </p>

            <div className="cola-candidatos">
              {cargos.map((cargo) => {
                const candidato = selecionados[cargo.id];

                return (
                  <div
                    className={`cola-candidato ${
                      candidato ? "" : "cola-candidato-vazio"
                    }`}
                    key={cargo.id}
                  >
                    <span className="cola-ordem">{cargo.ordem}</span>

                    {candidato ? (
                      <>
                        <FotoNaCola candidato={candidato} />

                        <span className="cola-dados">
                          <small>{obterTituloCargo(cargo, estado)}</small>
                          <strong>{candidato.nome}</strong>
                          <em>{candidato.partido}</em>
                        </span>

                        <b>{candidato.numero}</b>
                      </>
                    ) : (
                      <>
                        <span className="cola-dados cola-dados-vazio">
                          <small>{obterTituloCargo(cargo, estado)}</small>
                          <span className="linha-preenchimento-manual" />
                        </span>

                        <span className="digitos-preenchimento-manual">
                          {Array.from(
                            { length: cargo.digitos },
                            (_, indice) => (
                              <i key={indice} />
                            ),
                          )}
                        </span>
                      </>
                    )}
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

      <footer className="rodape">
        <p>
          <strong>Atenção:</strong> esta ferramenta não registra votos e não
          possui vínculo com a Justiça Eleitoral.
        </p>

        <p>
          Imprima sua cola. O celular não pode ser utilizado na cabine de
          votação.
        </p>
      </footer>

      <style jsx global>{`
        .folha-impressao-real {
          display: none;
        }

        .pagina button:focus-visible,
        .pagina input:focus-visible,
        .pagina select:focus-visible,
        .pagina a:focus-visible,
        .modal-impressao:focus-visible {
          outline: 3px solid #f1ca30;
          outline-offset: 3px;
        }

        .resultado-candidato:focus-visible,
        .opcoes-copias button:focus-visible {
          position: relative;
          z-index: 2;
          border-color: #1a3328;
          box-shadow: 0 0 0 4px rgba(241, 202, 48, 0.35);
        }

        .instrucoes-teclado {
          margin: 7px 0 0;
          color: #69736f;
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .foto-candidato {
          width: 52px;
          min-width: 52px;
          height: 52px;
          overflow: hidden;
          border: 2px solid rgba(81, 142, 69, 0.28);
          border-radius: 50%;
          background: #f9f6eb;
          object-fit: cover;
          object-position: center top;
        }

        .foto-candidato + .dados-escolhidos,
        .foto-candidato + .dados-resultado {
          margin-left: 10px;
        }

        .fundo-modal-impressao {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 24px;
          overflow-y: auto;
          background: rgba(15, 29, 24, 0.72);
          backdrop-filter: blur(6px);
        }

        .modal-impressao {
          width: min(760px, 100%);
          max-height: calc(100vh - 48px);
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          overscroll-behavior: contain;
          border: 1px solid rgba(26, 51, 40, 0.18);
          border-radius: 24px;
          background: #f9f6eb;
          box-shadow: 0 24px 80px rgba(13, 28, 23, 0.3);
        }

        .modal-impressao-topo {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 28px 30px 22px;
          background: #1a3328;
          color: #f9f6eb;
        }

        .modal-impressao-topo span {
          display: block;
          margin-bottom: 5px;
          color: #f1ca30;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .modal-impressao-topo h2 {
          margin: 0;
          color: #f9f6eb;
          font-size: clamp(1.55rem, 4vw, 2.1rem);
          line-height: 1.1;
        }

        .modal-impressao-topo button {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border: 1px solid rgba(249, 246, 235, 0.3);
          border-radius: 50%;
          background: transparent;
          color: #f9f6eb;
          font-size: 1.7rem;
          cursor: pointer;
        }

        .area-previa-final {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px 30px;
          background:
            linear-gradient(rgba(26, 51, 40, 0.055) 1px, transparent 1px),
            linear-gradient(
              90deg,
              rgba(26, 51, 40, 0.055) 1px,
              transparent 1px
            ),
            #ece9df;
          background-size: 18px 18px;
        }

        /* PRÉ-VISUALIZAÇÃO DA FOLHA A4 */
        .folha-a4-preview {
          background: #ffffff;
          width: min(310px, 100%);
          height: auto;
          aspect-ratio: 210 / 297;
          border: 1px solid #ccc;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          padding: 10px;
          box-sizing: border-box;
          display: grid;
          gap: 8px;
        }

        .folha-a4-preview.copias-2 {
          grid-template-columns: minmax(0, 50%);
          grid-template-rows: repeat(2, minmax(0, 1fr));
          justify-content: center;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada {
          width: 100%;
          height: 100%;
        }

        .folha-a4-preview.copias-4 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(2, minmax(0, 1fr));
        }

        .folha-a4-preview.copias-6 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .cola-miniatura-estilizada {
          transform-origin: top left;
          min-width: 0;
          min-height: 0;
          aspect-ratio: auto;
          font-size: 0.45rem !important;
          border-radius: 8px !important;
          border-width: 1px !important;
          box-shadow: none !important;
        }

        .cola-miniatura-estilizada .cola-cabecalho {
          padding: 6px 8px !important;
        }

        .cola-miniatura-estilizada .cola-cabecalho h2 {
          font-size: 0.65rem !important;
        }

        .cola-miniatura-estilizada .cola-cabecalho span {
          font-size: 0.35rem !important;
        }

        .cola-miniatura-estilizada .cola-cabecalho > strong {
          width: 20px !important;
          min-width: 20px !important;
          height: 20px !important;
          font-size: 0.45rem !important;
        }

        .cola-miniatura-estilizada .cola-instrucao {
          padding: 3px 8px !important;
          font-size: 0.38rem !important;
        }

        .cola-miniatura-estilizada .cola-candidatos {
          padding: 2px 8px !important;
        }

        .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 12px 18px minmax(0, 1fr) auto !important;
          gap: 4px !important;
        }

        .cola-miniatura-estilizada .cola-candidato-vazio {
          grid-template-columns: 12px minmax(0, 1fr) auto !important;
        }

        .cola-miniatura-estilizada .cola-dados-vazio {
          gap: 1px !important;
        }

        .cola-miniatura-estilizada .linha-preenchimento-manual {
          height: 7px !important;
          border-width: 1px !important;
          border-radius: 2px !important;
        }

        .cola-miniatura-estilizada .digitos-preenchimento-manual {
          gap: 1px !important;
        }

        .cola-miniatura-estilizada .digitos-preenchimento-manual i {
          width: 5px !important;
          height: 8px !important;
          border-width: 1px !important;
          border-radius: 1px !important;
        }

        .cola-miniatura-estilizada .cola-ordem {
          width: 12px !important;
          height: 12px !important;
          font-size: 0.35rem !important;
        }

        .cola-miniatura-estilizada .foto-na-cola,
        .cola-miniatura-estilizada .iniciais-cola {
          width: 18px !important;
          min-width: 18px !important;
          height: 18px !important;
          font-size: 0.35rem !important;
        }

        .cola-miniatura-estilizada .cola-dados small {
          font-size: 0.32rem !important;
        }

        .cola-miniatura-estilizada .cola-dados strong {
          font-size: 0.42rem !important;
        }

        .cola-miniatura-estilizada .cola-dados em {
          font-size: 0.32rem !important;
        }

        .cola-miniatura-estilizada .cola-candidato > b {
          font-size: 0.65rem !important;
        }

        .cola-miniatura-estilizada .cola-rodape {
          padding: 4px 8px !important;
          font-size: 0.32rem !important;
        }

        /* A prévia 2x2 preserva todos os candidatos e o rodapé de cada cola. */
        .folha-a4-preview.copias-4 .cola-miniatura-estilizada {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          min-height: 0 !important;
          align-self: stretch !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-cabecalho {
          gap: 4px !important;
          padding: 4px 6px !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-cabecalho
          h2 {
          font-size: 0.55rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-cabecalho
          span {
          margin-bottom: 1px !important;
          font-size: 0.29rem !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-cabecalho
          > strong {
          width: 17px !important;
          min-width: 17px !important;
          height: 17px !important;
          font-size: 0.36rem !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-instrucao {
          padding: 2px 6px !important;
          font-size: 0.28rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-candidatos {
          min-height: 0 !important;
          padding: 1px 6px !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 10px 13px minmax(0, 1fr) auto !important;
          gap: 3px !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-candidato-vazio {
          grid-template-columns: 10px minmax(0, 1fr) auto !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-ordem {
          width: 10px !important;
          height: 10px !important;
          font-size: 0.28rem !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .foto-na-cola,
        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .iniciais-cola {
          width: 12px !important;
          min-width: 12px !important;
          height: 12px !important;
          border-width: 1px !important;
          font-size: 0.27rem !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-dados
          small {
          margin-bottom: 0 !important;
          font-size: 0.24rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-dados
          strong {
          font-size: 0.33rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-dados em {
          margin-top: 0 !important;
          font-size: 0.24rem !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-candidato
          > b {
          font-size: 0.52rem !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-rodape {
          gap: 2px !important;
          padding: 2px 6px !important;
          font-size: 0.24rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-rodape
          strong {
          max-width: 68px !important;
        }

        /* Duas cópias ocupam, proporcionalmente, as duas metades da folha A4. */
        .folha-a4-preview.copias-2 .cola-miniatura-estilizada {
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .cola-cabecalho {
          padding: 4px 6px !important;
        }

        .folha-a4-preview.copias-2
          .cola-miniatura-estilizada
          .cola-cabecalho
          h2 {
          font-size: 0.55rem !important;
        }

        .folha-a4-preview.copias-2
          .cola-miniatura-estilizada
          .cola-cabecalho
          > strong {
          width: 17px !important;
          min-width: 17px !important;
          height: 17px !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .cola-instrucao {
          padding: 2px 6px !important;
          font-size: 0.28rem !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .cola-candidatos {
          padding: 1px 6px !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 10px 13px minmax(0, 1fr) auto !important;
          gap: 3px !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .cola-ordem {
          width: 10px !important;
          height: 10px !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .foto-na-cola,
        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .iniciais-cola {
          width: 12px !important;
          min-width: 12px !important;
          height: 12px !important;
          border-width: 1px !important;
        }

        .folha-a4-preview.copias-2
          .cola-miniatura-estilizada
          .cola-dados
          strong {
          font-size: 0.33rem !important;
        }

        .folha-a4-preview.copias-2
          .cola-miniatura-estilizada
          .cola-candidato
          > b {
          font-size: 0.52rem !important;
        }

        .folha-a4-preview.copias-2 .cola-miniatura-estilizada .cola-rodape {
          padding: 2px 6px !important;
          font-size: 0.24rem !important;
        }

        /* A prévia 2x3 precisa ser mais compacta que os cartões de 2 e 4 cópias. */
        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-cabecalho {
          gap: 3px !important;
          padding: 3px 5px !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          align-self: stretch !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-cabecalho
          h2 {
          font-size: 0.5rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-cabecalho
          span {
          margin-bottom: 1px !important;
          font-size: 0.27rem !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-cabecalho
          > strong {
          width: 16px !important;
          min-width: 16px !important;
          height: 16px !important;
          font-size: 0.34rem !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-instrucao {
          padding: 2px 5px !important;
          font-size: 0.27rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-candidatos {
          min-height: 0 !important;
          padding: 1px 5px !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 9px 12px minmax(0, 1fr) auto !important;
          gap: 2px !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-candidato-vazio {
          grid-template-columns: 9px minmax(0, 1fr) auto !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-ordem {
          width: 9px !important;
          height: 9px !important;
          font-size: 0.26rem !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .foto-na-cola,
        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .iniciais-cola {
          width: 11px !important;
          min-width: 11px !important;
          height: 11px !important;
          border-width: 1px !important;
          font-size: 0.25rem !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-dados
          small {
          margin-bottom: 0 !important;
          font-size: 0.23rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-dados
          strong {
          font-size: 0.31rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-dados em {
          margin-top: 0 !important;
          font-size: 0.23rem !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-candidato
          > b {
          font-size: 0.49rem !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-rodape {
          gap: 2px !important;
          padding: 2px 5px !important;
          font-size: 0.23rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-rodape
          strong {
          max-width: 62px !important;
        }

        /* ESTILO OFICIAL DA COLA ELEITORAL CONFORME A IMAGEM */
        .resumo.resumo-formato-final {
          padding: 0;
          overflow: visible;
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .resumo-cola-final {
          display: flex;
          width: 100%;
          aspect-ratio: 105 / 148.5;
          flex-direction: column;
          overflow: hidden;
          border: 2px solid #1a3328;
          border-radius: 16px;
          background: #ffffff;
          color: #1a3328;
          box-shadow: 0 14px 35px rgba(26, 51, 40, 0.16);
        }

        .resumo-formato-final > .botao-gerar {
          width: 100%;
          margin-top: 18px;
        }

        .resumo-formato-final > .privacidade {
          justify-content: center;
          margin: 12px 0 0;
        }

        /* CABEÇALHO VERDE ESCURO COM MARGEM SUPERIOR ARREDONDADA */
        .resumo-cola-final .cola-cabecalho {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          background: #1a3328;
          color: #ffffff;
        }

        .resumo-cola-final .cola-cabecalho span {
          display: block;
          margin-bottom: 2px;
          color: #e5b324;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .resumo-cola-final .cola-cabecalho h2 {
          margin: 0;
          color: #ffffff;
          font-size: 1.35rem;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        /* CIRCULO DO ESTADO */
        .resumo-cola-final .cola-cabecalho > strong {
          display: grid;
          place-items: center;
          width: 44px;
          min-width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e5b324;
          color: #1a3328;
          font-size: 0.85rem;
          font-weight: 800;
        }

        /* FAIXA BEGE DE INSTRUÇÃO */
        .resumo-cola-final .cola-instrucao {
          margin: 0;
          padding: 8px 20px;
          border-bottom: 1px solid #e2ded0;
          background: #f7f4ea;
          color: #525048;
          font-size: 0.65rem;
          line-height: 1.2;
        }

        /* LISTA DOS CANDIDATOS */
        .resumo-cola-final .cola-candidatos {
          display: flex;
          flex: 1;
          flex-direction: column;
          padding: 4px 20px;
        }

        .resumo-cola-final .cola-candidato {
          display: grid;
          grid-template-columns: 26px 42px minmax(0, 1fr) auto;
          flex: 1;
          align-items: center;
          gap: 10px;
          min-height: 0;
          border-bottom: 1px solid #e8e6df;
        }

        .resumo-cola-final .cola-candidato:last-child {
          border-bottom: 0;
        }

        .resumo-cola-final .cola-candidato-vazio {
          grid-template-columns: 26px minmax(0, 1fr) auto;
        }

        .cola-dados-vazio {
          gap: 4px;
        }

        .linha-preenchimento-manual {
          display: block;
          width: 100%;
          height: 20px;
          border: 1.5px dashed #93a099;
          border-radius: 5px;
          background: #ffffff;
        }

        .digitos-preenchimento-manual {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .digitos-preenchimento-manual i {
          display: block;
          width: 18px;
          height: 24px;
          border: 1.5px solid #1a3328;
          border-radius: 3px;
          background: #ffffff;
        }

        /* BOTAO VERDE COM NUMERO DE ORDEM */
        .resumo-cola-final .cola-ordem {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #518e45;
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 800;
        }

        /* FOTO DO CANDIDATO */
        .resumo-cola-final .foto-na-cola,
        .resumo-cola-final .iniciais-cola {
          display: grid;
          place-items: center;
          width: 40px;
          min-width: 40px;
          height: 40px;
          overflow: hidden;
          border: 2px solid #518e45;
          border-radius: 50%;
          background: #f7f4ea;
          color: #1a3328;
          font-size: 0.68rem;
          font-weight: 900;
          object-fit: cover;
          object-position: center top;
        }

        /* NOME, CARGO E PARTIDO */
        .resumo-cola-final .cola-dados {
          display: flex;
          min-width: 0;
          flex-direction: column;
          justify-content: center;
        }

        .resumo-cola-final .cola-dados small {
          margin-bottom: 1px;
          color: #6d726f;
          font-size: 0.52rem;
          font-weight: 800;
          line-height: 1;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .resumo-cola-final .cola-dados strong {
          overflow: hidden;
          color: #1a3328;
          font-size: 0.88rem;
          font-weight: 900;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-transform: uppercase;
        }

        .resumo-cola-final .cola-dados em {
          margin-top: 2px;
          color: #518e45;
          font-size: 0.55rem;
          font-style: normal;
          font-weight: 800;
          line-height: 1;
          text-transform: uppercase;
        }

        /* NUMERO GRANDE DO VOTO */
        .resumo-cola-final .cola-candidato > b {
          color: #1a3328;
          font-size: 1.5rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        /* RODAPÉ AMARELO */
        .resumo-cola-final .cola-rodape {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 20px;
          background: #e5b324;
          color: #1a3328;
          font-size: 0.55rem;
          font-weight: 700;
          line-height: 1.15;
        }

        .resumo-cola-final .cola-rodape strong {
          max-width: 200px;
          text-align: right;
          font-weight: 800;
        }

        .opcoes-copias {
          margin: 0;
          padding: 0 30px;
          border: 0;
        }

        .opcoes-copias legend {
          margin-bottom: 10px;
          color: #1a3328;
          font-weight: 800;
        }

        .grid-opcoes-copias {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .opcoes-copias button {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 15px 12px;
          border: 2px solid #d8ddd9;
          border-radius: 14px;
          background: #ffffff;
          color: #1a3328;
          text-align: left;
          cursor: pointer;
        }

        .opcoes-copias button.selecionada {
          border-color: #518e45;
          background: #f0f6ee;
          box-shadow: 0 0 0 3px rgba(81, 142, 69, 0.13);
        }

        .opcoes-copias button strong {
          font-size: 0.95rem;
        }

        .opcoes-copias button span {
          color: #66716c;
          font-size: 0.72rem;
        }

        .modal-impressao-acoes {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 24px 30px 28px;
        }

        .modal-impressao-acoes button {
          min-height: 46px;
          padding: 0 20px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .botao-voltar-impressao {
          border: 1px solid #b8c0bc;
          background: transparent;
          color: #1a3328;
        }

        .botao-confirmar-impressao {
          border: 1px solid #1a3328;
          background: #1a3328;
          color: #f9f6eb;
        }

        @media (max-width: 620px) {
          .fundo-modal-impressao {
            place-items: start center;
            padding: 8px;
          }

          .modal-impressao {
            width: 100%;
            max-height: calc(100vh - 16px);
            max-height: calc(100dvh - 16px);
            border-radius: 16px;
          }

          .modal-impressao-topo {
            gap: 12px;
            padding: 18px 16px 15px;
          }

          .modal-impressao-topo h2 {
            font-size: 1.35rem;
          }

          .modal-impressao-topo button {
            width: 34px;
            min-width: 34px;
            height: 34px;
          }

          .area-previa-final {
            padding: 14px 16px;
          }

          .opcoes-copias {
            padding: 0 16px;
          }

          .grid-opcoes-copias {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
          }

          .opcoes-copias button {
            min-width: 0;
            padding: 11px 8px;
            text-align: center;
          }

          .opcoes-copias button strong {
            font-size: 0.82rem;
          }

          .opcoes-copias button span {
            display: none;
          }

          .modal-impressao-acoes {
            flex-direction: column-reverse;
            gap: 8px;
            padding: 16px;
          }

          .modal-impressao-acoes button {
            width: 100%;
          }
        }

        @media (max-width: 360px) {
          .area-previa-final {
            padding-right: 10px;
            padding-left: 10px;
          }

          .grid-opcoes-copias {
            grid-template-columns: 1fr;
          }

          .opcoes-copias button span {
            display: block;
          }
        }

        /* REGRAS DE IMPRESSÃO - MANTÉM DESIGN EXATO DO CARD */
        @media print {
          html,
          body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .pagina {
            position: relative !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .pagina > :not(.folha-impressao-real) {
            display: none !important;
          }

          .folha-impressao-real {
            display: grid !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          .folha-impressao-real.copias-2 {
            display: grid !important;
            grid-template-columns: 96mm !important;
            grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
            justify-content: center !important;
            gap: 4mm !important;
          }

          .folha-impressao-real.copias-4 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            gap: 6mm !important;
          }

          .folha-impressao-real.copias-6 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: repeat(3, 1fr) !important;
            gap: 4mm !important;
          }

          .cola-impressa-fidelidade {
            width: 100% !important;
            height: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            aspect-ratio: auto !important;
            overflow: hidden !important;
            border: 2px solid #1a3328 !important;
            border-radius: 12px !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .cola-impressa-fidelidade .cola-candidato-vazio {
            grid-template-columns: 6mm minmax(0, 1fr) auto !important;
          }

          .cola-impressa-fidelidade .cola-dados-vazio {
            gap: 0.8mm !important;
          }

          .cola-impressa-fidelidade .linha-preenchimento-manual {
            height: 5mm !important;
            border: 0.35mm dashed #87958e !important;
            border-radius: 1mm !important;
          }

          .cola-impressa-fidelidade .digitos-preenchimento-manual {
            gap: 0.8mm !important;
          }

          .cola-impressa-fidelidade .digitos-preenchimento-manual i {
            width: 4.5mm !important;
            height: 6mm !important;
            border: 0.35mm solid #1a3328 !important;
            border-radius: 0.7mm !important;
          }

          .folha-impressao-real.copias-6 .cola-cabecalho {
            gap: 2mm !important;
            padding: 2.2mm 3mm !important;
          }

          .folha-impressao-real.copias-6 .cola-cabecalho span {
            margin-bottom: 0.3mm !important;
            font-size: 5pt !important;
          }

          .folha-impressao-real.copias-6 .cola-cabecalho h2 {
            font-size: 10pt !important;
          }

          .folha-impressao-real.copias-6 .cola-cabecalho > strong {
            width: 8mm !important;
            min-width: 8mm !important;
            height: 8mm !important;
            font-size: 6.5pt !important;
          }

          .folha-impressao-real.copias-6 .cola-instrucao {
            padding: 1.2mm 3mm !important;
            font-size: 5.2pt !important;
          }

          .folha-impressao-real.copias-6 .cola-candidatos {
            padding: 0.5mm 3mm !important;
          }

          .folha-impressao-real.copias-6 .cola-candidato {
            grid-template-columns: 4.5mm 7mm minmax(0, 1fr) auto !important;
            gap: 1.3mm !important;
          }

          .folha-impressao-real.copias-6 .cola-candidato-vazio {
            grid-template-columns: 4.5mm minmax(0, 1fr) auto !important;
          }

          .folha-impressao-real.copias-6 .linha-preenchimento-manual {
            height: 3.5mm !important;
          }

          .folha-impressao-real.copias-6 .digitos-preenchimento-manual {
            gap: 0.5mm !important;
          }

          .folha-impressao-real.copias-6 .digitos-preenchimento-manual i {
            width: 3.2mm !important;
            height: 4.5mm !important;
            border-width: 0.3mm !important;
          }

          .folha-impressao-real.copias-6 .cola-ordem {
            width: 4.5mm !important;
            height: 4.5mm !important;
            font-size: 5.5pt !important;
          }

          .folha-impressao-real.copias-6 .foto-na-cola,
          .folha-impressao-real.copias-6 .iniciais-cola {
            width: 7mm !important;
            min-width: 7mm !important;
            height: 7mm !important;
            border-width: 0.3mm !important;
            font-size: 5pt !important;
          }

          .folha-impressao-real.copias-6 .cola-dados small {
            margin-bottom: 0.2mm !important;
            font-size: 4.5pt !important;
          }

          .folha-impressao-real.copias-6 .cola-dados strong {
            font-size: 7.5pt !important;
          }

          .folha-impressao-real.copias-6 .cola-dados em {
            margin-top: 0.3mm !important;
            font-size: 4.7pt !important;
          }

          .folha-impressao-real.copias-6 .cola-candidato > b {
            font-size: 13pt !important;
          }

          .folha-impressao-real.copias-6 .cola-rodape {
            gap: 1mm !important;
            padding: 1.3mm 3mm !important;
            font-size: 4.6pt !important;
          }

          .folha-impressao-real.copias-6 .cola-rodape strong {
            max-width: 40mm !important;
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
