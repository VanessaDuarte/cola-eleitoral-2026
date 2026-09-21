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
  const [modalImpressaoAberto, setModalImpressaoAberto] =
    useState(false);
  const [quantidadeCopias, setQuantidadeCopias] = useState<1 | 4>(4);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoCandidatos, setCarregandoCandidatos] =
    useState(true);
  const [erroCandidatos, setErroCandidatos] = useState("");
  const [estadoRestaurado, setEstadoRestaurado] = useState<
    string | null
  >(null);
  const botoesCargoRef = useRef<
    Partial<Record<CargoId, HTMLButtonElement | null>>
  >({});
  const camposBuscaRef = useRef<
    Partial<Record<CargoId, HTMLInputElement | null>>
  >({});
  const resultadosRef = useRef<(HTMLButtonElement | null)[]>([]);
  const modalImpressaoRef = useRef<HTMLElement | null>(null);
  const [cargoAberto, setCargoAberto] =
    useState<CargoId>("deputado-federal");

  const [buscas, setBuscas] = useState<
    Partial<Record<CargoId, string>>
  >({});

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
        const resposta = await fetch(
          `/dados/candidatos-2026-${estado}.json`,
          { cache: "no-store" }
        );

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
              !PARTIDOS_OCULTOS.has(
                normalizarSiglaPartido(candidato.partido)
              )
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
        obterChaveColaSalva(estado)
      );

      if (!conteudoSalvo) {
        setEstadoRestaurado(estado);
        return;
      }

      const idsSalvos = JSON.parse(conteudoSalvo) as Partial<
        Record<CargoId, string>
      >;

      const selecaoRestaurada: Partial<
        Record<CargoId, Candidato>
      > = {};

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
          (item) =>
            item.id === candidatoId && item.cargo === cargoDosDados
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

    if (!buscaNormalizada) {
      return [];
    }

    const cargoDaPesquisa =
      cargoAberto === "senador-1" || cargoAberto === "senador-2"
        ? "senador"
        : cargoAberto;

    return candidatos
      .filter((candidato) => {
        const pertenceAoCargo =
          candidato.cargo === cargoDaPesquisa;

        const correspondeAoNome = normalizarTexto(
          candidato.nome
        ).includes(buscaNormalizada);

      const correspondeAoNumero =
        candidato.numero.includes(buscaNormalizada);

      const correspondeAoPartido =
        normalizarTexto(candidato.partido).includes(buscaNormalizada) ||
        normalizarTexto(candidato.partidoNome ?? "").includes(
          buscaNormalizada
        );

      return (
        pertenceAoCargo &&
        (correspondeAoNome ||
          correspondeAoNumero ||
          correspondeAoPartido)
      );
      })
      .slice(0, 30);
  }, [buscas, candidatos, cargoAberto]);

  function selecionarCandidato(
    cargoId: CargoId,
    candidato: Candidato
  ) {
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

    setSelecionados((estadoAnterior) => ({
      ...estadoAnterior,
      [cargoId]: candidato,
    }));

    setBuscas((estadoAnterior) => ({
      ...estadoAnterior,
      [cargoId]: "",
    }));

    const indiceAtual = cargos.findIndex(
      (cargo) => cargo.id === cargoId
    );

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
      "Deseja realmente apagar todos os candidatos selecionados?"
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
    setModalImpressaoAberto(false);

    window.requestAnimationFrame(() => {
      window.print();
    });
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
    indiceAtual: number
  ) {
    let proximoIndice: number | null = null;

    if (evento.key === "ArrowDown" || evento.key === "ArrowRight") {
      proximoIndice = (indiceAtual + 1) % cargos.length;
    } else if (
      evento.key === "ArrowUp" ||
      evento.key === "ArrowLeft"
    ) {
      proximoIndice =
        (indiceAtual - 1 + cargos.length) % cargos.length;
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

  function navegarNaBusca(
    evento: React.KeyboardEvent<HTMLInputElement>
  ) {
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
    indiceAtual: number
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

  function controlarTecladoModal(
    evento: React.KeyboardEvent<HTMLElement>
  ) {
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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
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
                "Escolha o estado e pesquise cada candidato pelo nome, número ou partido."
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
            Pesquise seus candidatos pelo nome, número ou partido e
            gere uma cola pronta para imprimir.
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
              const candidatoSelecionado =
                selecionados[cargo.id];

              return (
                <article
                  key={cargo.id}
                  className={`cartao-cargo ${
                    estaAberto ? "aberto" : ""
                  } ${
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
                    <span className="numero-ordem">
                      {cargo.ordem}
                    </span>

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
                      <IdentificacaoVisual
                        candidato={candidatoSelecionado}
                      />

                      <span className="dados-escolhidos">
                        <strong>
                          {candidatoSelecionado.nome}
                        </strong>
                        <small>
                          {candidatoSelecionado.partido}
                        </small>
                      </span>

                      <strong className="numero-escolhido">
                        {candidatoSelecionado.numero}
                      </strong>

                      <button
                        type="button"
                        className="botao-trocar"
                        onClick={() =>
                          removerCandidato(cargo.id)
                        }
                      >
                        Trocar
                      </button>
                    </div>
                  )}

                  {estaAberto && (
                    <div
                      className="conteudo-cargo"
                      id={`conteudo-${cargo.id}`}
                    >
                      {candidatoSelecionado ? (
                        <div className="candidato-escolhido destaque">
                          <IdentificacaoVisual
                            candidato={candidatoSelecionado}
                          />

                          <span className="dados-escolhidos">
                            <strong>
                              {candidatoSelecionado.nome}
                            </strong>
                            <small>
                              {candidatoSelecionado.partido}
                            </small>
                          </span>

                          <strong className="numero-escolhido">
                            {candidatoSelecionado.numero}
                          </strong>

                          <button
                            type="button"
                            className="botao-trocar"
                            onClick={() =>
                              removerCandidato(cargo.id)
                            }
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
                                  [cargo.id]:
                                    evento.target.value,
                                }))
                              }
                            />
                          </div>

                          <p className="instrucoes-teclado">
                            Use ↑ e ↓ para navegar e Enter para selecionar.
                          </p>

                          {(buscas[cargo.id] ?? "").trim() !==
                            "" && (
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
                                resultados.map(
                                  (candidato, indiceResultado) => (
                                  <button
                                    key={candidato.id}
                                    type="button"
                                    className="resultado-candidato"
                                    ref={(elemento) => {
                                      resultadosRef.current[
                                        indiceResultado
                                      ] = elemento;
                                    }}
                                    onKeyDown={(evento) =>
                                      navegarEntreResultados(
                                        evento,
                                        indiceResultado
                                      )
                                    }
                                    onClick={() =>
                                      selecionarCandidato(
                                        cargo.id,
                                        candidato
                                      )
                                    }
                                  >
                                    <IdentificacaoVisual
                                      candidato={candidato}
                                    />

                                    <span className="dados-resultado">
                                      <strong>
                                        {candidato.nome}
                                      </strong>
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
                                  )
                                )
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
                  <div className="cola-candidato" key={cargo.id}>
                    <span className="cola-ordem">{cargo.ordem}</span>

                    <FotoNaCola candidato={candidato} />

                    <span className="cola-dados">
                      <small>{obterTituloCargo(cargo, estado)}</small>
                      <strong>
                        {candidato?.nome ?? "Não selecionado"}
                      </strong>
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
                <h2 id="titulo-modal-impressao">
                  Sua cola está pronta
                </h2>
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
              <article className="cola-impressa previa-final">
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
            </div>

            <fieldset className="opcoes-copias">
              <legend>Quantas cópias deseja imprimir?</legend>

              <div>
                <button
                  type="button"
                  className={quantidadeCopias === 1 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(1)}
                >
                  <strong>1 cópia</strong>
                  <span>Uma cola centralizada na folha</span>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 4 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(4)}
                >
                  <strong>4 cópias</strong>
                  <span>Quatro colas na mesma folha A4</span>
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
                Imprimir {quantidadeCopias === 1 ? "1 cópia" : "4 cópias"}
              </button>
            </div>
          </section>
        </div>
      )}

      <section
        className={`folha-impressao ${
          quantidadeCopias === 1 ? "uma-copia" : "quatro-copias"
        }`}
        aria-label="Colas eleitorais"
      >
        {Array.from({ length: quantidadeCopias }, (_, indice) => (
          <article className="cola-impressa" key={indice}>
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

      <footer className="rodape">
        <p>
          <strong>Atenção:</strong> esta ferramenta não registra
          votos e não possui vínculo com a Justiça Eleitoral.
        </p>

        <p>
          Imprima sua cola. O celular não pode ser utilizado na
          cabine de votação.
        </p>
      </footer>

      <style jsx global>{`
        .folha-impressao {
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
          border-color: #20372f;
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
          overflow-y: auto;
          border: 1px solid rgba(32, 55, 47, 0.18);
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
          background: #20372f;
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
          display: grid;
          place-items: center;
          padding: 24px 30px;
          background:
            linear-gradient(rgba(32, 55, 47, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(32, 55, 47, 0.055) 1px, transparent 1px),
            #ece9df;
          background-size: 18px 18px;
        }

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
          border: 2px solid #20372f;
          border-radius: 16px;
          background: #ffffff;
          color: #20372f;
          box-shadow: 0 14px 35px rgba(32, 55, 47, 0.16);
        }

        .resumo-formato-final > .botao-gerar {
          width: 100%;
          margin-top: 18px;
        }

        .resumo-formato-final > .privacidade {
          justify-content: center;
          margin: 12px 0 0;
        }

        .previa-final {
          display: flex;
          width: min(360px, 100%);
          aspect-ratio: 105 / 148.5;
          flex-direction: column;
          overflow: hidden;
          border: 2px solid #20372f;
          border-radius: 16px;
          background: #ffffff;
          color: #20372f;
          box-shadow: 0 14px 35px rgba(32, 55, 47, 0.2);
        }

        :is(.previa-final, .resumo-cola-final) .cola-cabecalho {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px 14px;
          background: #20372f;
          color: #f9f6eb;
        }

        :is(.previa-final, .resumo-cola-final) .cola-cabecalho span {
          display: block;
          margin-bottom: 3px;
          color: #f1ca30;
          font-size: 0.57rem;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        :is(.previa-final, .resumo-cola-final) .cola-cabecalho h2 {
          margin: 0;
          color: #f9f6eb;
          font-size: 1.25rem;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        :is(.previa-final, .resumo-cola-final)
          .cola-cabecalho
          > strong {
          display: grid;
          place-items: center;
          width: 43px;
          min-width: 43px;
          height: 43px;
          border-radius: 50%;
          background: #f1ca30;
          color: #20372f;
          font-size: 0.8rem;
        }

        :is(.previa-final, .resumo-cola-final) .cola-instrucao {
          margin: 0;
          padding: 8px 18px;
          border-bottom: 1px solid #d9ded8;
          background: #f9f6eb;
          color: #4e5d57;
          font-size: 0.65rem;
          line-height: 1.2;
        }

        :is(.previa-final, .resumo-cola-final) .cola-candidatos {
          display: flex;
          flex: 1;
          flex-direction: column;
          padding: 4px 18px;
        }

        :is(.previa-final, .resumo-cola-final) .cola-candidato {
          display: grid;
          grid-template-columns: 26px 38px minmax(0, 1fr) auto;
          flex: 1;
          align-items: center;
          gap: 9px;
          min-height: 0;
          border-bottom: 1px solid #d9ded8;
        }

        :is(.previa-final, .resumo-cola-final)
          .cola-candidato:last-child {
          border-bottom: 0;
        }

        :is(.previa-final, .resumo-cola-final) .cola-ordem {
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          border-radius: 50%;
          background: #518e45;
          color: #ffffff;
          font-size: 0.6rem;
          font-weight: 800;
        }

        :is(.previa-final, .resumo-cola-final) .foto-na-cola,
        :is(.previa-final, .resumo-cola-final) .iniciais-cola {
          display: grid;
          place-items: center;
          width: 38px;
          min-width: 38px;
          height: 38px;
          overflow: hidden;
          border: 2px solid rgba(81, 142, 69, 0.3);
          border-radius: 50%;
          background: #f9f6eb;
          color: #20372f;
          font-size: 0.62rem;
          font-weight: 900;
          object-fit: cover;
          object-position: center top;
        }

        :is(.previa-final, .resumo-cola-final) .cola-dados {
          display: flex;
          min-width: 0;
          flex-direction: column;
          justify-content: center;
        }

        :is(.previa-final, .resumo-cola-final) .cola-dados small {
          margin-bottom: 2px;
          color: #69736f;
          font-size: 0.52rem;
          font-weight: 800;
          line-height: 1;
          text-transform: uppercase;
        }

        :is(.previa-final, .resumo-cola-final) .cola-dados strong {
          overflow: hidden;
          color: #20372f;
          font-size: 0.86rem;
          font-weight: 900;
          line-height: 1.05;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        :is(.previa-final, .resumo-cola-final) .cola-dados em {
          margin-top: 2px;
          color: #518e45;
          font-size: 0.52rem;
          font-style: normal;
          font-weight: 700;
          line-height: 1;
        }

        :is(.previa-final, .resumo-cola-final) .cola-candidato > b {
          color: #20372f;
          font-size: 1.45rem;
          font-weight: 950;
          line-height: 1;
        }

        :is(.previa-final, .resumo-cola-final) .cola-rodape {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 18px;
          background: #f1ca30;
          color: #20372f;
          font-size: 0.52rem;
          line-height: 1.15;
        }

        :is(.previa-final, .resumo-cola-final) .cola-rodape strong {
          max-width: 180px;
          text-align: right;
        }

        .opcoes-copias {
          margin: 0;
          padding: 0 30px;
          border: 0;
        }

        .opcoes-copias legend {
          margin-bottom: 10px;
          color: #20372f;
          font-weight: 800;
        }

        .opcoes-copias > div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .opcoes-copias button {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 15px 16px;
          border: 2px solid #d8ddd9;
          border-radius: 14px;
          background: #ffffff;
          color: #20372f;
          text-align: left;
          cursor: pointer;
        }

        .opcoes-copias button.selecionada {
          border-color: #518e45;
          background: #f0f6ee;
          box-shadow: 0 0 0 3px rgba(81, 142, 69, 0.13);
        }

        .opcoes-copias button strong {
          font-size: 1rem;
        }

        .opcoes-copias button span {
          color: #66716c;
          font-size: 0.78rem;
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
          color: #20372f;
        }

        .botao-confirmar-impressao {
          border: 1px solid #20372f;
          background: #20372f;
          color: #f9f6eb;
        }

        @media (max-width: 620px) {
          .fundo-modal-impressao {
            padding: 12px;
          }

          .modal-impressao {
            max-height: calc(100vh - 24px);
            border-radius: 18px;
          }

          .modal-impressao-topo,
          .modal-impressao-acoes {
            padding-right: 20px;
            padding-left: 20px;
          }

          .area-previa-final {
            padding-right: 20px;
            padding-left: 20px;
          }

          .opcoes-copias {
            padding-right: 20px;
            padding-left: 20px;
          }

          .opcoes-copias > div {
            grid-template-columns: 1fr;
          }

          .modal-impressao-acoes {
            flex-direction: column-reverse;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #f9f6eb !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .pagina > :not(.folha-impressao) {
            display: none !important;
          }

          .pagina {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 0;
            background: #f9f6eb;
          }

          .folha-impressao {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 4mm;
            width: 210mm;
            height: 297mm;
            padding: 7mm;
            box-sizing: border-box;
            overflow: hidden;
            background: #f9f6eb;
          }

          .folha-impressao.uma-copia {
            display: flex !important;
            align-items: center;
            justify-content: center;
          }

          .folha-impressao.uma-copia .cola-impressa {
            width: 96mm;
            height: 139.5mm;
          }

          .cola-impressa {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            border: 0.45mm solid #20372f;
            border-radius: 4mm;
            background: #ffffff;
            color: #20372f;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .cola-cabecalho {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 3mm;
            padding: 4mm 4.5mm 3.5mm;
            background: #20372f;
            color: #f9f6eb;
          }

          .cola-cabecalho span {
            display: block;
            margin-bottom: 0.8mm;
            color: #f1ca30;
            font-size: 6.5pt;
            font-weight: 800;
            letter-spacing: 0.14em;
          }

          .cola-cabecalho h2 {
            margin: 0;
            color: #f9f6eb;
            font-size: 15pt;
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .cola-cabecalho > strong {
            display: grid;
            place-items: center;
            min-width: 12mm;
            height: 12mm;
            border-radius: 50%;
            background: #f1ca30;
            color: #20372f;
            font-size: 9pt;
          }

          .cola-instrucao {
            margin: 0;
            padding: 2.2mm 4.5mm;
            border-bottom: 0.3mm solid #d9ded8;
            background: #f9f6eb;
            color: #4e5d57;
            font-size: 7.2pt;
            line-height: 1.2;
          }

          .cola-candidatos {
            display: flex;
            flex: 1;
            flex-direction: column;
            padding: 1mm 4.5mm;
          }

          .cola-candidato {
            display: grid;
            grid-template-columns: 6mm 10mm minmax(0, 1fr) auto;
            flex: 1;
            align-items: center;
            gap: 2.2mm;
            min-height: 0;
            border-bottom: 0.25mm solid #d9ded8;
          }

          .cola-candidato:last-child {
            border-bottom: 0;
          }

          .cola-ordem {
            display: grid;
            place-items: center;
            width: 6mm;
            height: 6mm;
            border-radius: 50%;
            background: #518e45;
            color: #ffffff;
            font-size: 7pt;
            font-weight: 800;
          }

          .foto-na-cola,
          .iniciais-cola {
            display: grid;
            place-items: center;
            width: 9mm;
            min-width: 9mm;
            height: 9mm;
            overflow: hidden;
            border: 0.35mm solid rgba(81, 142, 69, 0.4);
            border-radius: 50%;
            background: #f9f6eb;
            color: #20372f;
            font-size: 6pt;
            font-weight: 900;
            object-fit: cover;
            object-position: center top;
          }

          .cola-dados {
            display: flex;
            min-width: 0;
            flex-direction: column;
            justify-content: center;
          }

          .cola-dados small {
            margin-bottom: 0.4mm;
            color: #69736f;
            font-size: 6.2pt;
            font-weight: 700;
            line-height: 1;
            text-transform: uppercase;
          }

          .cola-dados strong {
            overflow: hidden;
            color: #20372f;
            font-size: 11.5pt;
            font-weight: 900;
            line-height: 1.05;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .cola-dados em {
            margin-top: 0.5mm;
            color: #518e45;
            font-size: 6.3pt;
            font-style: normal;
            font-weight: 700;
            line-height: 1;
          }

          .cola-candidato > b {
            color: #20372f;
            font-size: 20pt;
            font-weight: 950;
            line-height: 1;
            letter-spacing: 0.02em;
          }

          .cola-rodape {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2mm;
            padding: 2.4mm 4.5mm;
            background: #f1ca30;
            color: #20372f;
            font-size: 6.3pt;
            line-height: 1.15;
          }

          .cola-rodape strong {
            max-width: 48mm;
            text-align: right;
          }
        }
      `}</style>
    </main>
  );
}
