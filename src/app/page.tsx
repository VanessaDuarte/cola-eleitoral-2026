"use client";

import Image from "next/image";
import { toPng } from "html-to-image";
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

type FormatoImagem = "story" | "publicacao";

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
        key={`${candidato.id}-${candidato.foto}`}
        className="foto-na-cola"
        src={candidato.foto}
        alt=""
        width={44}
        height={44}
        loading="eager"
        unoptimized
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
  const [quantidadeCopias, setQuantidadeCopias] = useState<4 | 6 | 9>(9);
  const [formatoImagem, setFormatoImagem] =
    useState<FormatoImagem>("publicacao");
  const [gerandoImagem, setGerandoImagem] = useState(false);
  const [imagemGeradaUrl, setImagemGeradaUrl] = useState("");
  const [modalImagemAberto, setModalImagemAberto] = useState(false);
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
  const arteSocialRef = useRef<HTMLElement | null>(null);

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

  async function gerarPreviaImagem(formato: FormatoImagem) {
    if (gerandoImagem) return;

    setGerandoImagem(true);
    setFormatoImagem(formato);

    try {
      await document.fonts?.ready;
      await new Promise<void>((resolver) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolver()),
        ),
      );

      const arte = arteSocialRef.current;
      if (!arte) throw new Error("Arte não encontrada.");

      const imagens = Array.from(arte.querySelectorAll("img"));
      await Promise.all(
        imagens.map(async (imagem) => {
          if (!imagem.complete) {
            await new Promise<void>((resolver) => {
              const concluir = () => resolver();
              imagem.addEventListener("load", concluir, { once: true });
              imagem.addEventListener("error", concluir, { once: true });
            });
          }

          if (typeof imagem.decode === "function") {
            await imagem.decode().catch(() => undefined);
          }
        }),
      );

      const largura = 1080;
      const altura = formato === "story" ? 1920 : 1350;
      const url = await toPng(arte, {
        width: largura,
        height: altura,
        canvasWidth: largura,
        canvasHeight: altura,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: "#f7f4ea",
      });

      setImagemGeradaUrl(url);
      setModalImagemAberto(true);
    } catch (erro) {
      console.error(erro);
      window.alert(
        "Não foi possível gerar a imagem. Aguarde as fotos carregarem e tente novamente.",
      );
    } finally {
      setGerandoImagem(false);
    }
  }

  function baixarImagem() {
    if (!imagemGeradaUrl) return;

    const link = document.createElement("a");
    link.download = `minha-cola-eleitoral-${formatoImagem}-${estado}.png`;
    link.href = imagemGeradaUrl;
    link.click();
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
                  </div>
                ))}
              </div>
            </div>

            <fieldset className="opcoes-copias">
              <legend>Escolha o tamanho da cola</legend>

              <div className="grid-opcoes-copias">
                <button
                  type="button"
                  className={quantidadeCopias === 9 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(9)}
                >
                  <strong>9 por página</strong>
                  <span>Compacta · 6,3 × 8,5 cm</span>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 6 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(6)}
                >
                  <strong>6 por página</strong>
                  <span>Média · letras maiores</span>
                </button>

                <button
                  type="button"
                  className={quantidadeCopias === 4 ? "selecionada" : ""}
                  onClick={() => setQuantidadeCopias(4)}
                >
                  <strong>4 por página</strong>
                  <span>Ampliada · leitura facilitada</span>
                </button>
              </div>
            </fieldset>

            <div className="modal-impressao-acoes">
              <p className="padrao-impressao">
                {quantidadeCopias === 9
                  ? "9 colas · 6,3 × 8,5 cm cada"
                  : quantidadeCopias === 6
                    ? "6 colas · 6,8 × 9,2 cm cada"
                    : "4 colas · 9 × 12,1 cm cada"}
              </p>

              <button
                type="button"
                className="botao-voltar-impressao"
                onClick={() => setModalImpressaoAberto(false)}
              >
                Voltar e corrigir
              </button>

              <button
                type="button"
                className="botao-imagem"
                disabled={gerandoImagem}
                onClick={() => gerarPreviaImagem("story")}
              >
                {gerandoImagem && formatoImagem === "story"
                  ? "Gerando..."
                  : "Imagem Story"}
              </button>

              <button
                type="button"
                className="botao-imagem"
                disabled={gerandoImagem}
                onClick={() => gerarPreviaImagem("publicacao")}
              >
                {gerandoImagem && formatoImagem === "publicacao"
                  ? "Gerando..."
                  : "Imagem publicação"}
              </button>

              <button
                type="button"
                className="botao-confirmar-impressao"
                onClick={imprimirCola}
              >
                Imprimir folha A4
              </button>
            </div>
          </section>
        </div>
      )}

      {modalImagemAberto && imagemGeradaUrl && (
        <div
          className="fundo-modal-imagem"
          role="presentation"
          onMouseDown={() => setModalImagemAberto(false)}
        >
          <section
            className="modal-imagem"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-previa-imagem"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <header className="modal-imagem-topo">
              <div>
                <span>PRÉ-VISUALIZAÇÃO</span>
                <h2 id="titulo-previa-imagem">
                  Imagem para{" "}
                  {formatoImagem === "story" ? "Story" : "publicação"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar pré-visualização da imagem"
                onClick={() => setModalImagemAberto(false)}
              >
                ×
              </button>
            </header>

            <div className={`previa-imagem formato-${formatoImagem}`}>
              {/* A imagem já está pronta; esta etapa serve para conferência. */}
              <img src={imagemGeradaUrl} alt="Prévia da cola eleitoral" />
            </div>

            <div className="modal-imagem-acoes">
              <button
                type="button"
                className="botao-voltar-impressao"
                onClick={() => setModalImagemAberto(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="botao-confirmar-impressao"
                onClick={baixarImagem}
              >
                Baixar PNG
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
          </article>
        ))}
      </section>

      {gerandoImagem && (
        <div className="fundo-geracao-imagem" role="status" aria-live="polite">
          <span className="indicador-geracao" />
          <strong>Gerando imagem…</strong>
        </div>
      )}

      {gerandoImagem && (
        <section
          ref={arteSocialRef}
          className={`arte-social formato-${formatoImagem}`}
          aria-hidden="true"
        >
          <div className="arte-social-decoracao" />
          <Image
            className="fundo-social"
            src="/fundo-brasil.jpg"
            alt=""
            width={1080}
            height={1920}
            priority
            unoptimized
          />
          <div className="arte-social-conteudo">
            <article className="resumo-cola-final cola-social">
              <header className="cola-cabecalho">
                <div className="cola-social-titulo">
                  <span>ELEIÇÕES 2026</span>
                  <h2>
                    Minha cola
                    <strong>eleitoral</strong>
                  </h2>
                  <p>Meus candidatos para o dia da votação</p>
                </div>
                <strong>{estado}</strong>
              </header>

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
                      {candidato ? (
                        <>
                          <FotoNaCola candidato={candidato} />
                          <span className="cola-ordem">{cargo.ordem}</span>
                          <span className="cola-dados">
                            <small>{obterTituloCargo(cargo, estado)}</small>
                            <strong>{candidato.nome}</strong>
                            <em>{candidato.partido}</em>
                          </span>
                          <b>{candidato.numero}</b>
                        </>
                      ) : (
                        <>
                          <span className="cola-ordem">{cargo.ordem}</span>
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

              <p className="arte-social-aviso">
                Confira os números antes de votar.
              </p>
            </article>
          </div>
        </section>
      )}

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

        .arte-social {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 12000;
          width: 1080px;
          overflow: hidden;
          pointer-events: none;
          background:
            linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.035) 1px,
              transparent 1px
            ),
            radial-gradient(
              circle at 50% -10%,
              rgba(241, 202, 48, 0.3),
              transparent 38%
            ),
            radial-gradient(
              circle at 2% 1%,
              #f1ca30 0 105px,
              transparent 108px
            ),
            radial-gradient(
              circle at 102% 8%,
              #518e45 0 130px,
              transparent 133px
            ),
            radial-gradient(
              circle at 100% 100%,
              #f1ca30 0 82px,
              transparent 85px
            ),
            linear-gradient(145deg, #244f3d 0%, #122d24 52%, #0b2019 100%);
          background-size:
            54px 54px,
            54px 54px,
            auto,
            auto,
            auto,
            auto,
            auto;
          color: #1a3328;
          font-family: Arial, Helvetica, sans-serif;
        }

        .fundo-geracao-imagem {
          position: fixed;
          inset: 0;
          z-index: 13000;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(10, 27, 21, 0.94);
          color: #ffffff;
          font-size: 1rem;
        }

        .indicador-geracao {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255, 255, 255, 0.32);
          border-top-color: #f1ca30;
          border-radius: 50%;
          animation: girar-indicador 0.8s linear infinite;
        }

        @keyframes girar-indicador {
          to {
            transform: rotate(360deg);
          }
        }

        .arte-social.formato-story {
          height: 1920px;
        }
        .arte-social.formato-publicacao {
          height: 1350px;
        }

        .arte-social-decoracao {
          position: absolute;
          right: auto;
          left: -130px;
          bottom: -150px;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          background: linear-gradient(145deg, #64a654, #2d6e43 55%, #14382b);
          box-shadow:
            24px -24px 80px rgba(84, 164, 76, 0.28),
            inset -22px -22px 40px rgba(9, 39, 29, 0.35),
            inset 14px 14px 32px rgba(255, 255, 255, 0.16);
        }

        .arte-social-conteudo {
          position: relative;
          z-index: 1;
          display: flex;
          height: 100%;
          box-sizing: border-box;
          flex-direction: column;
          align-items: center;
        }

        .formato-story .arte-social-conteudo {
          padding: 24px;
        }
        .formato-publicacao .arte-social-conteudo {
          padding: 24px;
        }

        .arte-social-conteudo > h2 {
          display: none;
        }

        .arte-social-conteudo > h2 strong {
          display: block;
          font-size: 1.14em;
          font-weight: 900;
        }

        .cola-social {
          display: grid !important;
          width: 100% !important;
          height: 100% !important;
          aspect-ratio: auto !important;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 2px solid rgba(255, 255, 255, 0.7) !important;
          border-radius: 34px !important;
          background: linear-gradient(
            145deg,
            #ffffff 0%,
            #f5f7f2 100%
          ) !important;
          box-shadow:
            0 42px 90px rgba(0, 0, 0, 0.42),
            0 12px 26px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.95) !important;
          overflow: hidden;
        }

        .formato-story .cola-social {
          width: 100% !important;
          height: 100% !important;
        }

        .cola-social .cola-cabecalho {
          align-items: center !important;
          gap: 22px !important;
          padding: 28px 38px !important;
          border-bottom: 1px solid rgba(241, 202, 48, 0.38);
          background:
            radial-gradient(
              circle at 88% 15%,
              rgba(241, 202, 48, 0.2),
              transparent 24%
            ),
            linear-gradient(135deg, #214a39 0%, #15382c 48%, #0c271e 100%) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.16),
            inset 0 -16px 30px rgba(0, 0, 0, 0.14),
            0 10px 24px rgba(14, 47, 36, 0.18);
        }
        .cola-social-titulo {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 8px;
        }
        .cola-social .cola-cabecalho .cola-social-titulo span {
          margin: 0 !important;
          font-size: 22px !important;
          letter-spacing: 0.18em !important;
        }
        .cola-social-titulo h2 {
          margin: 0;
          color: #ffffff;
          font-size: 52px;
          line-height: 1;
          letter-spacing: -0.035em;
        }
        .cola-social .cola-cabecalho > strong {
          width: 58px !important;
          min-width: 58px !important;
          height: 58px !important;
          font-size: 18px !important;
          border: 2px solid rgba(255, 255, 255, 0.48);
          background: linear-gradient(145deg, #ffdb42, #e7aa08) !important;
          box-shadow:
            0 9px 18px rgba(0, 0, 0, 0.3),
            inset 4px 4px 9px rgba(255, 255, 255, 0.42),
            inset -4px -4px 9px rgba(157, 104, 0, 0.24);
        }

        .cola-social .cola-candidatos {
          min-height: 0 !important;
          gap: 12px;
          padding: 20px 28px !important;
          background:
            radial-gradient(
              circle at 100% 0,
              rgba(79, 145, 69, 0.1),
              transparent 32%
            ),
            linear-gradient(180deg, #f4f6f1, #edf1ea) !important;
        }
        .cola-social .cola-candidato {
          grid-template-columns: 42px 76px minmax(0, 1fr) auto !important;
          gap: 18px !important;
          box-sizing: border-box;
          padding: 12px 18px !important;
          border: 1px solid rgba(21, 56, 44, 0.1) !important;
          border-radius: 18px;
          background: linear-gradient(145deg, #ffffff 0%, #f7f8f5 100%);
          box-shadow:
            0 8px 18px rgba(17, 54, 42, 0.1),
            inset 1px 1px 0 rgba(255, 255, 255, 0.95),
            inset -1px -1px 0 rgba(21, 56, 44, 0.04);
        }
        .cola-social .cola-candidato-vazio {
          grid-template-columns: 38px minmax(0, 1fr) auto !important;
        }
        .cola-social .cola-ordem {
          width: 40px !important;
          height: 40px !important;
          font-size: 18px !important;
          border: 1px solid rgba(255, 255, 255, 0.55);
          background: linear-gradient(145deg, #64a854, #347d43) !important;
          box-shadow:
            0 6px 12px rgba(35, 104, 55, 0.28),
            inset 3px 3px 6px rgba(255, 255, 255, 0.2),
            inset -3px -3px 6px rgba(17, 66, 37, 0.24);
        }
        .cola-social .foto-na-cola,
        .cola-social .iniciais-cola {
          width: 74px !important;
          min-width: 74px !important;
          height: 74px !important;
          font-size: 18px !important;
          border-width: 3px !important;
          box-shadow:
            0 8px 16px rgba(19, 64, 47, 0.2),
            0 0 0 4px rgba(255, 255, 255, 0.9);
        }
        .cola-social .cola-dados small {
          font-size: 15px !important;
        }
        .cola-social .cola-dados strong {
          font-size: 31px !important;
        }
        .cola-social .cola-dados em {
          font-size: 16px !important;
        }
        .cola-social .cola-candidato > b {
          font-size: 50px !important;
          letter-spacing: -0.04em;
          text-shadow: 0 2px 0 #ffffff;
        }
        .cola-social .linha-preenchimento-manual {
          height: 32px !important;
        }
        .cola-social .digitos-preenchimento-manual i {
          width: 28px !important;
          height: 38px !important;
        }

        .arte-social-aviso {
          position: relative;
          box-sizing: border-box;
          width: 100%;
          margin: 0;
          padding: 22px 72px 24px;
          border-top: 1px solid #dedbce;
          background: linear-gradient(180deg, #f8f6ec, #e9eadf);
          box-shadow: inset 0 10px 20px rgba(21, 56, 44, 0.05);
          text-align: center;
          font-size: 21px;
          font-weight: 800;
        }

        .arte-social-aviso::before,
        .arte-social-aviso::after {
          position: absolute;
          top: 50%;
          width: 52px;
          height: 1px;
          background: #cfcab9;
          content: "";
        }

        .arte-social-aviso::before {
          left: 0;
        }

        .arte-social-aviso::after {
          right: 0;
        }

        .formato-publicacao .arte-social-conteudo > h2 {
          display: none;
        }

        .formato-publicacao .cola-social .cola-cabecalho span {
          font-size: 19px !important;
        }

        /* O Story recebe escala própria para reproduzir fielmente o mockup. */
        .formato-story .arte-social-conteudo {
          padding: 24px;
        }

        .formato-story .arte-social-conteudo > h2 {
          margin: 0 0 28px 54px;
          font-size: 110px;
          line-height: 0.86;
        }

        .formato-story .cola-social {
          width: 100% !important;
          height: 100% !important;
        }

        .formato-story .cola-social .cola-cabecalho {
          padding: 38px 44px !important;
        }

        .formato-story .cola-social .cola-cabecalho .cola-social-titulo span {
          font-size: 25px !important;
        }

        .formato-story .cola-social-titulo h2 {
          font-size: 66px;
        }

        .formato-story .cola-social .cola-cabecalho > strong {
          width: 66px !important;
          min-width: 66px !important;
          height: 66px !important;
          font-size: 21px !important;
        }

        .formato-story .cola-social .cola-candidatos {
          padding: 12px 44px !important;
        }

        .formato-story .cola-social .cola-candidato {
          grid-template-columns: 52px 112px minmax(0, 1fr) auto !important;
          gap: 24px !important;
        }

        .formato-story .cola-social .cola-candidato-vazio {
          grid-template-columns: 48px minmax(0, 1fr) auto !important;
        }

        .formato-story .cola-social .cola-ordem {
          width: 46px !important;
          height: 46px !important;
          font-size: 21px !important;
        }

        .formato-story .cola-social .foto-na-cola,
        .formato-story .cola-social .iniciais-cola {
          width: 110px !important;
          min-width: 110px !important;
          height: 110px !important;
          font-size: 21px !important;
        }

        .formato-story .cola-social .cola-dados small {
          font-size: 20px !important;
        }

        .formato-story .cola-social .cola-dados strong {
          font-size: 44px !important;
          line-height: 1.02 !important;
        }

        .formato-story .cola-social .cola-dados em {
          font-size: 21px !important;
        }

        .formato-story .cola-social .cola-candidato > b {
          font-size: 68px !important;
        }

        .formato-story .arte-social-aviso {
          padding: 26px 72px 30px;
          font-size: 24px;
        }

        /* Postagem inspirada em cartazes eleitorais brasileiros. */
        .arte-social {
          isolation: isolate;
          background:
            linear-gradient(
              115deg,
              rgba(255, 255, 255, 0.035) 0 2px,
              transparent 2px 20px
            ),
            radial-gradient(
              circle at 18% 4%,
              rgba(255, 214, 42, 0.32),
              transparent 28%
            ),
            linear-gradient(155deg, #0b6a36 0%, #064827 48%, #032f20 100%);
        }

        .bandeira-social {
          position: absolute;
          z-index: 0;
          top: -150px;
          right: -270px;
          width: 980px;
          height: auto;
          opacity: 0.58;
          filter: saturate(1.08) drop-shadow(0 34px 34px rgba(0, 0, 0, 0.32));
          transform: rotate(5deg);
        }

        .arte-social-decoracao {
          z-index: 0;
          right: -190px;
          bottom: -185px;
          left: auto;
          width: 500px;
          height: 500px;
          border: 70px solid rgba(255, 210, 29, 0.9);
          background: #173f86;
          box-shadow:
            0 0 0 24px rgba(255, 255, 255, 0.08),
            0 0 90px rgba(255, 209, 25, 0.24),
            inset 18px 18px 40px rgba(255, 255, 255, 0.12);
          opacity: 0.72;
        }

        .arte-social-conteudo,
        .formato-story .arte-social-conteudo,
        .formato-publicacao .arte-social-conteudo {
          padding: 26px;
        }

        .cola-social,
        .formato-story .cola-social {
          width: 100% !important;
          height: 100% !important;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 0 !important;
          border-radius: 36px !important;
          background: transparent !important;
          box-shadow: 0 34px 80px rgba(0, 0, 0, 0.28) !important;
          overflow: hidden;
        }

        .cola-social .cola-cabecalho,
        .formato-story .cola-social .cola-cabecalho {
          position: relative;
          z-index: 1;
          min-height: 240px;
          box-sizing: border-box;
          align-items: flex-start !important;
          padding: 38px 42px 32px !important;
          border: 2px solid rgba(255, 255, 255, 0.28);
          border-bottom: 8px solid #f6cf20;
          border-radius: 34px 34px 0 0;
          background:
            linear-gradient(
              90deg,
              rgba(3, 47, 31, 0.96),
              rgba(5, 72, 39, 0.78)
            ),
            linear-gradient(145deg, #0a6538, #073d28) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            0 18px 30px rgba(0, 0, 0, 0.25);
        }

        .cola-social-titulo {
          gap: 4px;
        }

        .cola-social .cola-cabecalho .cola-social-titulo span {
          color: #f7d222 !important;
          font-size: 21px !important;
          font-weight: 900;
          text-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
        }

        .cola-social-titulo h2 {
          display: flex;
          flex-direction: column;
          margin: 8px 0 0;
          color: #ffffff;
          font-size: 62px;
          font-weight: 800;
          line-height: 0.82;
          letter-spacing: -0.055em;
          text-transform: uppercase;
          text-shadow: 0 7px 0 rgba(0, 0, 0, 0.18);
        }

        .cola-social-titulo h2 strong {
          color: #f6cf20;
          font-size: 1.22em;
          font-weight: 950;
        }

        .cola-social-titulo p {
          margin: 14px 0 0;
          color: rgba(255, 255, 255, 0.82);
          font-size: 17px;
          font-weight: 700;
        }

        .cola-social .cola-cabecalho > strong {
          width: 72px !important;
          min-width: 72px !important;
          height: 72px !important;
          margin-top: 4px;
          font-size: 23px !important;
        }

        .cola-social .cola-candidatos,
        .formato-story .cola-social .cola-candidatos {
          position: relative;
          z-index: 2;
          gap: 8px;
          padding: 12px 0 !important;
          background: transparent !important;
        }

        .cola-social .cola-candidato,
        .formato-story .cola-social .cola-candidato {
          grid-template-columns: 54px 112px minmax(0, 1fr) auto !important;
          gap: 22px !important;
          min-height: 0;
          padding: 14px 28px 14px 22px !important;
          border: 2px solid rgba(255, 255, 255, 0.62) !important;
          border-left: 12px solid #f5cd1c !important;
          border-radius: 16px;
          background: linear-gradient(
            100deg,
            #fffdf3 0%,
            #ffffff 68%,
            #ecf3df 100%
          ) !important;
          box-shadow:
            0 10px 20px rgba(0, 0, 0, 0.23),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
        }

        .cola-social .cola-candidato:nth-child(even) {
          border-left-color: #2b9749 !important;
          background: linear-gradient(
            100deg,
            #ddf09d 0%,
            #eff5c8 64%,
            #f7d833 100%
          ) !important;
        }

        .cola-social .cola-candidato-vazio,
        .formato-story .cola-social .cola-candidato-vazio {
          grid-template-columns: 54px minmax(0, 1fr) auto !important;
        }

        .cola-social .cola-ordem,
        .formato-story .cola-social .cola-ordem {
          width: 50px !important;
          height: 50px !important;
          color: #ffffff;
          font-size: 22px !important;
        }

        .cola-social .foto-na-cola,
        .cola-social .iniciais-cola,
        .formato-story .cola-social .foto-na-cola,
        .formato-story .cola-social .iniciais-cola {
          width: 108px !important;
          min-width: 108px !important;
          height: 108px !important;
          border: 4px solid #ffffff !important;
          box-shadow:
            0 0 0 3px #278447,
            0 10px 22px rgba(0, 0, 0, 0.28);
        }

        .cola-social .cola-dados small,
        .formato-story .cola-social .cola-dados small {
          color: #397343 !important;
          font-size: 17px !important;
          font-weight: 900 !important;
          letter-spacing: 0.03em;
        }

        .cola-social .cola-dados strong,
        .formato-story .cola-social .cola-dados strong {
          color: #102f24 !important;
          font-size: 38px !important;
          font-weight: 950 !important;
          line-height: 0.98 !important;
          letter-spacing: -0.035em;
          text-transform: uppercase;
        }

        .cola-social .cola-dados em,
        .formato-story .cola-social .cola-dados em {
          color: #21813e !important;
          font-size: 18px !important;
          font-weight: 900 !important;
        }

        .cola-social .cola-candidato > b,
        .formato-story .cola-social .cola-candidato > b {
          color: #073927 !important;
          font-size: 66px !important;
          font-weight: 950 !important;
          letter-spacing: -0.065em;
          text-shadow:
            0 3px 0 #ffffff,
            0 6px 12px rgba(0, 0, 0, 0.12);
        }

        .arte-social-aviso,
        .formato-story .arte-social-aviso {
          z-index: 2;
          padding: 20px 60px 22px;
          border: 2px solid rgba(255, 255, 255, 0.24);
          border-top: 5px solid #f6cf20;
          border-radius: 0 0 34px 34px;
          background: rgba(3, 45, 29, 0.94);
          color: #ffffff;
          font-size: 20px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
        }

        .arte-social-aviso::before,
        .arte-social-aviso::after {
          background: rgba(246, 207, 32, 0.55);
        }

        .formato-story .cola-social .cola-cabecalho {
          min-height: 300px;
          padding: 48px 52px 38px !important;
        }

        .formato-story .cola-social-titulo h2 {
          font-size: 82px;
        }

        .formato-story .cola-social-titulo p {
          font-size: 20px;
        }

        .formato-story .cola-social .cola-candidato {
          grid-template-columns: 58px 134px minmax(0, 1fr) auto !important;
          padding: 16px 30px 16px 24px !important;
        }

        .formato-story .cola-social .foto-na-cola,
        .formato-story .cola-social .iniciais-cola {
          width: 130px !important;
          min-width: 130px !important;
          height: 130px !important;
        }

        .formato-story .cola-social .cola-dados small {
          font-size: 19px !important;
        }

        .formato-story .cola-social .cola-dados strong {
          font-size: 44px !important;
        }

        .formato-story .cola-social .cola-dados em {
          font-size: 21px !important;
        }

        .formato-story .cola-social .cola-candidato > b {
          font-size: 74px !important;
        }

        /* Versão mais próxima de um cartaz de campanha: faixas cheias e pinceladas. */
        .arte-social {
          background:
            linear-gradient(
              168deg,
              transparent 0 7%,
              #ffdc24 7.2% 10%,
              transparent 10.2%
            ),
            linear-gradient(
              8deg,
              transparent 0 87%,
              rgba(255, 218, 27, 0.95) 87.2% 92%,
              transparent 92.2%
            ),
            linear-gradient(174deg, #08783c 0%, #075e32 48%, #034523 100%);
        }

        .arte-social::before,
        .arte-social::after {
          position: absolute;
          z-index: 0;
          left: -8%;
          width: 116%;
          height: 190px;
          background: #f6cf1f;
          clip-path: polygon(
            0 22%,
            7% 10%,
            18% 20%,
            31% 4%,
            45% 16%,
            61% 2%,
            77% 14%,
            91% 4%,
            100% 17%,
            98% 83%,
            86% 94%,
            70% 82%,
            56% 97%,
            41% 84%,
            25% 96%,
            10% 82%,
            0 91%
          );
          content: "";
          opacity: 0.98;
          transform: rotate(-2deg);
        }

        .arte-social::before {
          top: -88px;
        }

        .arte-social::after {
          bottom: -96px;
          transform: rotate(2deg);
        }

        .bandeira-social {
          top: -52px;
          right: -74px;
          width: 390px;
          opacity: 0.96;
          filter: saturate(1.12) drop-shadow(0 16px 20px rgba(0, 0, 0, 0.34));
          transform: rotate(7deg);
        }

        .arte-social-decoracao {
          display: none;
        }

        .arte-social-conteudo,
        .formato-story .arte-social-conteudo,
        .formato-publicacao .arte-social-conteudo {
          padding: 18px 20px;
        }

        .cola-social,
        .formato-story .cola-social {
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: visible;
        }

        .cola-social .cola-cabecalho,
        .formato-story .cola-social .cola-cabecalho {
          min-height: 250px;
          padding: 32px 34px 26px !important;
          border: 0;
          border-bottom: 0;
          border-radius: 0;
          background: transparent !important;
          box-shadow: none;
        }

        .cola-social .cola-cabecalho .cola-social-titulo span {
          align-self: flex-start;
          padding: 7px 16px;
          border-radius: 2px;
          background: #f6cf1f;
          color: #073b25 !important;
          font-size: 22px !important;
          letter-spacing: 0.08em !important;
          text-shadow: none;
          transform: rotate(-1deg);
        }

        .cola-social-titulo h2,
        .formato-story .cola-social-titulo h2 {
          margin-top: 8px;
          color: #ffffff;
          font-family: Impact, "Arial Black", Arial, sans-serif;
          font-size: 72px;
          font-weight: 900;
          line-height: 0.78;
          letter-spacing: -0.035em;
          text-shadow:
            3px 4px 0 #064524,
            7px 8px 0 rgba(0, 0, 0, 0.22);
        }

        .cola-social-titulo h2 strong {
          color: #ffffff;
          font-size: 1.08em;
        }

        .cola-social-titulo p {
          display: none;
        }

        .cola-social .cola-cabecalho > strong {
          position: relative;
          z-index: 3;
          width: 62px !important;
          min-width: 62px !important;
          height: 62px !important;
          margin-top: 128px;
          font-size: 21px !important;
        }

        .cola-social .cola-candidatos,
        .formato-story .cola-social .cola-candidatos {
          gap: 6px;
          padding: 0 !important;
        }

        .cola-social .cola-candidato,
        .formato-story .cola-social .cola-candidato {
          grid-template-columns: 132px 54px minmax(0, 1fr) auto !important;
          gap: 14px !important;
          padding: 8px 22px 8px 8px !important;
          border: 0 !important;
          border-radius: 10px;
          background: linear-gradient(
            100deg,
            #ffdc27 0%,
            #f6ce1c 76%,
            #efb914 100%
          ) !important;
          box-shadow:
            0 6px 0 rgba(0, 45, 23, 0.38),
            0 10px 18px rgba(0, 0, 0, 0.2);
        }

        .cola-social .cola-candidato:nth-child(even) {
          background: linear-gradient(
            100deg,
            #79cf4b 0%,
            #97dc57 70%,
            #e3dc29 100%
          ) !important;
        }

        .cola-social .cola-candidato-vazio,
        .formato-story .cola-social .cola-candidato-vazio {
          grid-template-columns: 54px minmax(0, 1fr) auto !important;
          padding-left: 18px !important;
        }

        .cola-social .foto-na-cola,
        .cola-social .iniciais-cola,
        .formato-story .cola-social .foto-na-cola,
        .formato-story .cola-social .iniciais-cola {
          width: 126px !important;
          min-width: 126px !important;
          height: 136px !important;
          border: 2px solid #ffffff !important;
          border-radius: 9px !important;
          box-shadow: 4px 5px 0 #075a30;
        }

        .cola-social .cola-ordem,
        .formato-story .cola-social .cola-ordem {
          width: 48px !important;
          height: 48px !important;
          border: 3px solid #f7d220;
          background: #06482a !important;
          font-size: 21px !important;
          box-shadow: 3px 4px 0 rgba(0, 0, 0, 0.22);
        }

        .cola-social .cola-dados small,
        .formato-story .cola-social .cola-dados small {
          color: #123d27 !important;
          font-size: 15px !important;
          font-weight: 950 !important;
        }

        .cola-social .cola-dados strong,
        .formato-story .cola-social .cola-dados strong {
          color: #092f20 !important;
          font-family: "Arial Black", Arial, sans-serif;
          font-size: 34px !important;
          line-height: 0.94 !important;
          letter-spacing: -0.045em;
          text-shadow: 1px 2px 0 rgba(255, 255, 255, 0.35);
        }

        .cola-social .cola-dados em,
        .formato-story .cola-social .cola-dados em {
          color: #0a5d31 !important;
          font-size: 16px !important;
        }

        .cola-social .cola-candidato > b,
        .formato-story .cola-social .cola-candidato > b {
          color: #062f20 !important;
          font-family: Impact, "Arial Black", Arial, sans-serif;
          font-size: 62px !important;
          letter-spacing: -0.035em;
          text-shadow: 2px 3px 0 rgba(255, 255, 255, 0.42);
        }

        .arte-social-aviso,
        .formato-story .arte-social-aviso {
          padding: 16px 54px 18px;
          border: 0;
          border-top: 5px solid #f6cf1f;
          border-radius: 0;
          background: #053d26;
          color: #ffffff;
          font-size: 18px;
          box-shadow: none;
        }

        .formato-story .cola-social .cola-cabecalho {
          min-height: 330px;
          padding: 44px 46px 30px !important;
        }

        .formato-story .cola-social-titulo h2 {
          font-size: 104px;
        }

        .formato-story .cola-social .cola-candidato {
          grid-template-columns: 176px 64px minmax(0, 1fr) auto !important;
          gap: 18px !important;
          padding: 8px 28px 8px 8px !important;
        }

        .formato-story .cola-social .foto-na-cola,
        .formato-story .cola-social .iniciais-cola {
          width: 170px !important;
          min-width: 170px !important;
          height: 184px !important;
        }

        .formato-story .cola-social .cola-ordem {
          width: 58px !important;
          height: 58px !important;
          font-size: 25px !important;
        }

        .formato-story .cola-social .cola-dados small {
          font-size: 18px !important;
        }

        .formato-story .cola-social .cola-dados strong {
          font-size: 43px !important;
        }

        .formato-story .cola-social .cola-dados em {
          font-size: 20px !important;
        }

        .formato-story .cola-social .cola-candidato > b {
          font-size: 78px !important;
        }

        .fundo-modal-imagem {
          position: fixed;
          inset: 0;
          z-index: 12000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(10, 27, 21, 0.78);
          backdrop-filter: blur(8px);
        }

        .modal-imagem {
          width: min(620px, 100%);
          max-height: calc(100dvh - 40px);
          overflow: auto;
          border: 1px solid rgba(249, 246, 235, 0.22);
          border-radius: 22px;
          background: #f9f6eb;
          box-shadow: 0 26px 80px rgba(0, 0, 0, 0.38);
        }

        .modal-imagem-topo {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 20px 24px;
          background: #1a3328;
          color: #f9f6eb;
        }

        .modal-imagem-topo span {
          color: #f1ca30;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .modal-imagem-topo h2 {
          margin: 4px 0 0;
          color: #f9f6eb;
          font-size: 1.45rem;
        }

        .modal-imagem-topo button {
          display: grid;
          place-items: center;
          width: 36px;
          min-width: 36px;
          height: 36px;
          border: 1px solid rgba(249, 246, 235, 0.32);
          border-radius: 50%;
          background: transparent;
          color: #ffffff;
          font-size: 1.55rem;
          cursor: pointer;
        }

        .previa-imagem {
          display: flex;
          justify-content: center;
          padding: 22px;
          background:
            linear-gradient(rgba(26, 51, 40, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(26, 51, 40, 0.05) 1px, transparent 1px),
            #ece9df;
          background-size: 18px 18px;
        }

        .previa-imagem img {
          display: block;
          width: auto;
          max-width: 100%;
          max-height: min(62dvh, 720px);
          border: 1px solid rgba(26, 51, 40, 0.18);
          background: #f7f4ea;
          box-shadow: 0 14px 35px rgba(26, 51, 40, 0.18);
          object-fit: contain;
        }

        .modal-imagem-acoes {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 18px 24px 22px;
        }

        .modal-imagem-acoes button {
          min-height: 46px;
          padding: 0 22px;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        @media (max-width: 620px) {
          .fundo-modal-imagem {
            padding: 8px;
          }

          .modal-imagem-topo {
            padding: 16px;
          }

          .previa-imagem {
            padding: 12px;
          }

          .previa-imagem img {
            max-height: 60dvh;
          }

          .modal-imagem-acoes {
            display: grid;
            grid-template-columns: 1fr 1fr;
            padding: 14px 16px 16px;
          }
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
          grid-template-columns: repeat(3, 30%);
          grid-auto-rows: 28.62%;
          justify-content: center;
          align-content: center;
          gap: 1%;
        }

        .folha-a4-preview.copias-4 {
          grid-template-columns: repeat(2, 42.857%);
          grid-template-rows: repeat(2, 40.74%);
          gap: 1.5%;
        }

        .folha-a4-preview.copias-6 {
          grid-template-columns: repeat(2, 32.38%);
          grid-template-rows: repeat(3, 30.98%);
          gap: 1.2%;
        }

        .folha-a4-preview.copias-9 {
          grid-template-rows: repeat(3, 28.62%);
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

        /* Prévia proporcional ao padrão físico de 6,3 × 8,5 cm. */
        .folha-a4-preview .cola-miniatura-estilizada {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          align-self: stretch !important;
          overflow: hidden !important;
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
        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-cabecalho {
          gap: 2px !important;
          padding: 1px 3px !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          align-self: stretch !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-cabecalho
          h2 {
          font-size: 0.25rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-cabecalho
          span {
          margin-bottom: 0 !important;
          font-size: 0.16rem !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-cabecalho
          > strong {
          width: 8px !important;
          min-width: 8px !important;
          height: 8px !important;
          font-size: 0.18rem !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-instrucao {
          padding: 2px 5px !important;
          font-size: 0.27rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-candidatos {
          min-height: 0 !important;
          padding: 0 3px !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 6px 8px minmax(0, 1fr) auto !important;
          gap: 1px !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-candidato-vazio {
          grid-template-columns: 6px minmax(0, 1fr) auto !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-ordem {
          width: 6px !important;
          height: 6px !important;
          font-size: 0.17rem !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .foto-na-cola,
        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .iniciais-cola {
          width: 8px !important;
          min-width: 8px !important;
          height: 8px !important;
          border-width: 1px !important;
          font-size: 0.16rem !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-dados
          small {
          margin-bottom: 0 !important;
          font-size: 0.14rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-dados
          strong {
          font-size: 0.24rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-dados em {
          margin-top: 0 !important;
          font-size: 0.15rem !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-candidato
          > b {
          font-size: 0.34rem !important;
        }

        .folha-a4-preview.copias-9 .cola-miniatura-estilizada .cola-rodape {
          gap: 2px !important;
          padding: 2px 5px !important;
          font-size: 0.23rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-9
          .cola-miniatura-estilizada
          .cola-rodape
          strong {
          max-width: 62px !important;
        }

        /* Escala fiel da versão média: 6 colas por folha. */
        .folha-a4-preview.copias-6 .cola-miniatura-estilizada {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-cabecalho {
          gap: 2px !important;
          padding: 2px 4px !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-cabecalho
          span {
          margin-bottom: 0 !important;
          font-size: 0.18rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-cabecalho
          h2 {
          font-size: 0.3rem !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-cabecalho
          > strong {
          width: 10px !important;
          min-width: 10px !important;
          height: 10px !important;
          font-size: 0.22rem !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-candidatos {
          min-height: 0 !important;
          padding: 0 4px !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 7px 10px minmax(0, 1fr) auto !important;
          gap: 1px !important;
          overflow: hidden !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-candidato-vazio {
          grid-template-columns: 7px minmax(0, 1fr) auto !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-ordem {
          width: 7px !important;
          height: 7px !important;
          font-size: 0.19rem !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .foto-na-cola,
        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .iniciais-cola {
          width: 10px !important;
          min-width: 10px !important;
          height: 10px !important;
          font-size: 0.19rem !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-dados
          small {
          margin-bottom: 0 !important;
          font-size: 0.16rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-dados
          strong {
          font-size: 0.28rem !important;
          line-height: 1 !important;
        }

        .folha-a4-preview.copias-6 .cola-miniatura-estilizada .cola-dados em {
          margin-top: 0 !important;
          font-size: 0.17rem !important;
        }

        .folha-a4-preview.copias-6
          .cola-miniatura-estilizada
          .cola-candidato
          > b {
          font-size: 0.4rem !important;
        }

        /* Escala fiel da versão ampliada: 4 colas por folha. */
        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-cabecalho {
          gap: 3px !important;
          padding: 3px 6px !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-cabecalho
          h2 {
          font-size: 0.4rem !important;
          white-space: nowrap !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-cabecalho
          span {
          font-size: 0.22rem !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-cabecalho
          > strong {
          width: 13px !important;
          min-width: 13px !important;
          height: 13px !important;
          font-size: 0.28rem !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-candidatos {
          min-height: 0 !important;
          padding: 1px 6px !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-candidato {
          grid-template-columns: 9px 13px minmax(0, 1fr) auto !important;
          gap: 2px !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .cola-ordem {
          width: 9px !important;
          height: 9px !important;
        }

        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .foto-na-cola,
        .folha-a4-preview.copias-4 .cola-miniatura-estilizada .iniciais-cola {
          width: 13px !important;
          min-width: 13px !important;
          height: 13px !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-dados
          strong {
          font-size: 0.36rem !important;
        }

        .folha-a4-preview.copias-4
          .cola-miniatura-estilizada
          .cola-candidato
          > b {
          font-size: 0.52rem !important;
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
          gap: 8px;
          padding: 9px 12px;
          background: #1a3328;
          color: #ffffff;
        }

        .resumo-cola-final .cola-cabecalho span {
          display: block;
          margin-bottom: 1px;
          color: #e5b324;
          font-size: 0.5rem;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .resumo-cola-final .cola-cabecalho h2 {
          margin: 0;
          color: #ffffff;
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        /* CIRCULO DO ESTADO */
        .resumo-cola-final .cola-cabecalho > strong {
          display: grid;
          place-items: center;
          width: 32px;
          min-width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #e5b324;
          color: #1a3328;
          font-size: 0.68rem;
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
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12px;
          padding: 24px 30px 28px;
        }

        .padrao-impressao {
          flex-basis: 100%;
          margin: 0;
          color: #66716c;
          font-size: 0.82rem;
          font-weight: 700;
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

        .botao-imagem {
          border: 1px solid #d6ab19;
          background: #f1ca30;
          color: #1a3328;
        }

        .botao-imagem:disabled {
          cursor: wait;
          opacity: 0.65;
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
            flex-direction: column;
            gap: 8px;
            padding: 16px;
          }

          .modal-impressao-acoes button {
            width: 100%;
          }

          .padrao-impressao {
            width: 100%;
            text-align: center;
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
        /* Mantém o cartaz social acima das regras antigas da cola impressa. */
        .arte-social .resumo-cola-final .cola-cabecalho h2 {
          display: flex !important;
          flex-direction: column;
          margin: 8px 0 0 !important;
          color: #ffffff !important;
          font-family: Impact, "Arial Black", Arial, sans-serif !important;
          font-size: 72px !important;
          font-weight: 900 !important;
          line-height: 0.78 !important;
          letter-spacing: -0.035em !important;
          text-transform: uppercase;
          text-shadow:
            3px 4px 0 #064524,
            7px 8px 0 rgba(0, 0, 0, 0.22);
        }

        .arte-social .resumo-cola-final .cola-cabecalho h2 strong {
          color: #ffffff !important;
          font-size: 1.08em !important;
          font-weight: 950 !important;
        }

        .arte-social .resumo-cola-final .cola-cabecalho > strong {
          width: 62px !important;
          min-width: 62px !important;
          height: 62px !important;
          margin-top: 128px;
          font-size: 21px !important;
        }

        .formato-story .bandeira-social {
          top: -40px;
          right: -58px;
          width: 330px;
        }

        .formato-story .resumo-cola-final .cola-cabecalho {
          min-height: 300px;
          padding: 34px 42px 26px !important;
        }

        .formato-story .resumo-cola-final .cola-cabecalho h2 {
          font-size: 96px !important;
        }

        .formato-story .resumo-cola-final .cola-dados strong {
          font-size: 39px !important;
        }

        .formato-story .resumo-cola-final .cola-candidato > b {
          font-size: 74px !important;
        }

        /* Fundo fotográfico escolhido para a postagem. */
        .arte-social {
          background: #064624;
        }

        .fundo-social {
          position: absolute;
          z-index: 0;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .arte-social::before {
          z-index: 1;
          inset: 0;
          width: auto;
          height: auto;
          background: linear-gradient(
            180deg,
            rgba(3, 35, 20, 0.18) 0%,
            rgba(3, 42, 23, 0.28) 42%,
            rgba(2, 36, 20, 0.48) 100%
          );
          clip-path: none;
          opacity: 1;
          transform: none;
        }

        .arte-social::after {
          display: none;
        }

        .arte-social .arte-social-conteudo {
          z-index: 2;
        }

        .arte-social .resumo-cola-final .cola-cabecalho {
          background: linear-gradient(
            90deg,
            rgba(3, 56, 30, 0.9) 0%,
            rgba(4, 72, 38, 0.58) 62%,
            transparent 100%
          ) !important;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22);
        }

        .arte-social .resumo-cola-final .cola-candidato {
          opacity: 0.97;
        }

        .arte-social .resumo-cola-final .arte-social-aviso {
          background: rgba(3, 52, 29, 0.94);
          backdrop-filter: blur(3px);
        }

        /* Cards dos candidatos no formato compacto da referência. */
        .arte-social .resumo-cola-final .cola-candidatos {
          gap: 5px;
          padding: 0 4px !important;
          border-right: 6px solid rgba(4, 72, 39, 0.9);
          border-left: 6px solid rgba(4, 72, 39, 0.9);
          background: rgba(3, 63, 33, 0.82) !important;
        }

        .arte-social .resumo-cola-final .cola-candidato {
          grid-template-columns: 122px 56px minmax(0, 1fr) auto !important;
          gap: 18px !important;
          min-height: 0;
          padding: 8px 24px 8px 12px !important;
          border: 2px solid rgba(5, 75, 40, 0.92) !important;
          border-radius: 12px;
          background:
            linear-gradient(
              105deg,
              rgba(255, 255, 255, 0.24) 0%,
              transparent 30%,
              rgba(160, 112, 0, 0.08) 100%
            ),
            radial-gradient(
              circle at 20% 20%,
              rgba(255, 255, 255, 0.16) 0 1px,
              transparent 1.5px
            ),
            linear-gradient(90deg, #f2c522 0%, #ffdc42 52%, #edbd18 100%) !important;
          background-size:
            auto,
            9px 9px,
            auto !important;
          box-shadow:
            inset 0 2px 0 rgba(255, 255, 255, 0.3),
            inset 0 -4px 8px rgba(15, 64, 38, 0.1),
            0 3px 7px rgba(2, 38, 21, 0.2);
          opacity: 1;
          overflow: hidden;
        }

        .arte-social .resumo-cola-final .cola-candidato:nth-child(even) {
          background:
            linear-gradient(
              105deg,
              rgba(255, 255, 255, 0.22) 0%,
              transparent 32%,
              rgba(6, 70, 35, 0.1) 100%
            ),
            radial-gradient(
              circle at 20% 20%,
              rgba(255, 255, 255, 0.14) 0 1px,
              transparent 1.5px
            ),
            linear-gradient(90deg, #73c952 0%, #9edd64 52%, #76c24d 100%) !important;
          background-size:
            auto,
            9px 9px,
            auto !important;
        }

        .arte-social .resumo-cola-final .cola-candidato-vazio {
          grid-template-columns: 56px minmax(0, 1fr) auto !important;
          padding-left: 18px !important;
        }

        .arte-social .resumo-cola-final .foto-na-cola,
        .arte-social .resumo-cola-final .iniciais-cola {
          align-self: center;
          width: 106px !important;
          min-width: 106px !important;
          height: 106px !important;
          min-height: 106px;
          border: 5px solid #ffffff !important;
          outline: 4px solid #174b32;
          border-radius: 50% !important;
          box-shadow:
            0 6px 12px rgba(6, 50, 30, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.38);
          object-fit: cover;
          object-position: center top;
        }

        .arte-social .resumo-cola-final .cola-ordem {
          width: 52px !important;
          height: 52px !important;
          border: 3px solid #f8d622;
          background: #064426 !important;
          color: #ffffff;
          font-size: 22px !important;
          box-shadow: 2px 3px 0 rgba(0, 0, 0, 0.2);
        }

        .arte-social .resumo-cola-final .cola-dados {
          min-width: 0;
          justify-content: center;
        }

        .arte-social .resumo-cola-final .cola-dados small {
          color: #164829 !important;
          font-family: "Arial Narrow", "Roboto Condensed", Arial, sans-serif;
          font-size: 21px !important;
          font-stretch: condensed;
          font-weight: 900 !important;
          letter-spacing: 0.5px;
          line-height: 1 !important;
        }

        .arte-social .resumo-cola-final .cola-dados strong {
          overflow: visible;
          color: #092f20 !important;
          font-family: Impact, "Arial Narrow", "Arial Black", Arial, sans-serif;
          font-size: 36px !important;
          font-stretch: condensed;
          font-weight: 900;
          letter-spacing: 0.2px;
          line-height: 0.94 !important;
          text-overflow: clip;
          white-space: normal;
        }

        .arte-social .resumo-cola-final .cola-dados em {
          color: #075b2e !important;
          font-size: 17px !important;
          font-weight: 950 !important;
        }

        .arte-social .resumo-cola-final .cola-candidato > b {
          color: #062f20 !important;
          font-family: Impact, "Arial Black", Arial, sans-serif;
          font-size: 66px !important;
          font-weight: 400;
          letter-spacing: 2px;
          line-height: 0.9;
          text-shadow:
            1px 1px 0 rgba(255, 255, 255, 0.24),
            2px 2px 0 rgba(7, 55, 34, 0.1);
        }

        .formato-story .resumo-cola-final .cola-candidato {
          grid-template-columns: 154px 68px minmax(0, 1fr) auto !important;
          gap: 22px !important;
          padding: 10px 30px 10px 16px !important;
        }

        .formato-story .resumo-cola-final .foto-na-cola,
        .formato-story .resumo-cola-final .iniciais-cola {
          width: 138px !important;
          min-width: 138px !important;
          height: 138px !important;
          min-height: 138px;
          border-width: 6px !important;
          outline-width: 4px;
        }

        .formato-story .resumo-cola-final .cola-ordem {
          width: 62px !important;
          height: 62px !important;
          font-size: 26px !important;
        }

        .formato-story .resumo-cola-final .cola-dados small {
          font-size: 25px !important;
        }

        .formato-story .resumo-cola-final .cola-dados strong {
          font-size: 46px !important;
        }

        .formato-story .resumo-cola-final .cola-dados em {
          font-size: 20px !important;
        }

        .formato-story .resumo-cola-final .cola-candidato > b {
          font-size: 80px !important;
          letter-spacing: 2.5px;
        }

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
            grid-template-columns: repeat(3, 63mm) !important;
            grid-template-rows: repeat(3, 85mm) !important;
            justify-content: center !important;
            align-content: center !important;
            gap: 2mm !important;
          }

          .folha-impressao-real.copias-6 {
            grid-template-columns: repeat(2, 68mm) !important;
            grid-template-rows: repeat(3, 92mm) !important;
            gap: 2mm !important;
          }

          .folha-impressao-real.copias-4 {
            grid-template-columns: repeat(2, 90mm) !important;
            grid-template-rows: repeat(2, 121mm) !important;
            gap: 4mm !important;
          }

          .cola-impressa-fidelidade {
            width: 63mm !important;
            height: 85mm !important;
            min-width: 0 !important;
            min-height: 0 !important;
            aspect-ratio: auto !important;
            overflow: hidden !important;
            border: 2px solid #1a3328 !important;
            border-radius: 2.5mm !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .folha-impressao-real.copias-6 .cola-impressa-fidelidade {
            width: 68mm !important;
            height: 92mm !important;
          }

          .folha-impressao-real.copias-4 .cola-impressa-fidelidade {
            width: 90mm !important;
            height: 121mm !important;
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

          .folha-impressao-real .cola-cabecalho {
            gap: 1.2mm !important;
            padding: 1mm 2.5mm !important;
          }

          .folha-impressao-real .cola-cabecalho span {
            margin-bottom: 0.1mm !important;
            font-size: 4.3pt !important;
          }

          .folha-impressao-real .cola-cabecalho h2 {
            font-size: 8pt !important;
          }

          .folha-impressao-real .cola-cabecalho > strong {
            width: 6mm !important;
            min-width: 6mm !important;
            height: 6mm !important;
            font-size: 5pt !important;
          }

          .folha-impressao-real .cola-instrucao {
            padding: 1.2mm 3mm !important;
            font-size: 5.2pt !important;
          }

          .folha-impressao-real .cola-candidatos {
            min-height: 0 !important;
            padding: 0.3mm 2.5mm !important;
          }

          .folha-impressao-real .cola-candidato {
            grid-template-columns: 4mm 6mm minmax(0, 1fr) auto !important;
            gap: 1mm !important;
            overflow: hidden !important;
          }

          .folha-impressao-real .cola-candidato-vazio {
            grid-template-columns: 4mm minmax(0, 1fr) auto !important;
          }

          .folha-impressao-real .linha-preenchimento-manual {
            height: 3.5mm !important;
          }

          .folha-impressao-real .digitos-preenchimento-manual {
            gap: 0.5mm !important;
          }

          .folha-impressao-real .digitos-preenchimento-manual i {
            width: 3.2mm !important;
            height: 4.5mm !important;
            border-width: 0.3mm !important;
          }

          .folha-impressao-real .cola-ordem {
            width: 4mm !important;
            height: 4mm !important;
            font-size: 5pt !important;
          }

          .folha-impressao-real .foto-na-cola,
          .folha-impressao-real .iniciais-cola {
            width: 6mm !important;
            min-width: 6mm !important;
            height: 6mm !important;
            border-width: 0.3mm !important;
            font-size: 5pt !important;
          }

          .folha-impressao-real .cola-dados small {
            margin-bottom: 0.2mm !important;
            font-size: 4pt !important;
          }

          .folha-impressao-real .cola-dados strong {
            font-size: 6.5pt !important;
          }

          .folha-impressao-real .cola-dados em {
            margin-top: 0.3mm !important;
            font-size: 4.2pt !important;
          }

          .folha-impressao-real .cola-candidato > b {
            font-size: 11pt !important;
          }

          /* Versão média: todos os elementos crescem junto com o cartão. */
          .folha-impressao-real.copias-6 .cola-cabecalho {
            padding: 1.3mm 3mm !important;
          }

          .folha-impressao-real.copias-6 .cola-cabecalho h2 {
            font-size: 9pt !important;
          }

          .folha-impressao-real.copias-6 .cola-cabecalho > strong {
            width: 7mm !important;
            min-width: 7mm !important;
            height: 7mm !important;
            font-size: 6pt !important;
          }

          .folha-impressao-real.copias-6 .foto-na-cola,
          .folha-impressao-real.copias-6 .iniciais-cola {
            width: 7mm !important;
            min-width: 7mm !important;
            height: 7mm !important;
          }

          .folha-impressao-real.copias-6 .cola-dados strong {
            font-size: 7.5pt !important;
          }

          .folha-impressao-real.copias-6 .cola-candidato > b {
            font-size: 13pt !important;
          }

          /* Versão ampliada: prioriza a legibilidade. */
          .folha-impressao-real.copias-4 .cola-cabecalho {
            padding: 2mm 4mm !important;
          }

          .folha-impressao-real.copias-4 .cola-cabecalho span {
            font-size: 5.5pt !important;
          }

          .folha-impressao-real.copias-4 .cola-cabecalho h2 {
            font-size: 12pt !important;
          }

          .folha-impressao-real.copias-4 .cola-cabecalho > strong {
            width: 9mm !important;
            min-width: 9mm !important;
            height: 9mm !important;
            font-size: 7.5pt !important;
          }

          .folha-impressao-real.copias-4 .cola-candidatos {
            padding: 0.7mm 4mm !important;
          }

          .folha-impressao-real.copias-4 .cola-candidato {
            grid-template-columns: 5.5mm 9mm minmax(0, 1fr) auto !important;
            gap: 1.7mm !important;
          }

          .folha-impressao-real.copias-4 .cola-candidato-vazio {
            grid-template-columns: 5.5mm minmax(0, 1fr) auto !important;
          }

          .folha-impressao-real.copias-4 .cola-ordem {
            width: 5.5mm !important;
            height: 5.5mm !important;
            font-size: 6.5pt !important;
          }

          .folha-impressao-real.copias-4 .foto-na-cola,
          .folha-impressao-real.copias-4 .iniciais-cola {
            width: 9mm !important;
            min-width: 9mm !important;
            height: 9mm !important;
          }

          .folha-impressao-real.copias-4 .cola-dados small {
            font-size: 5.5pt !important;
          }

          .folha-impressao-real.copias-4 .cola-dados strong {
            font-size: 9.5pt !important;
          }

          .folha-impressao-real.copias-4 .cola-dados em {
            font-size: 5.8pt !important;
          }

          .folha-impressao-real.copias-4 .cola-candidato > b {
            font-size: 16pt !important;
          }

          .folha-impressao-real .cola-rodape {
            gap: 1mm !important;
            padding: 1.3mm 3mm !important;
            font-size: 4.6pt !important;
          }

          .folha-impressao-real .cola-rodape strong {
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
