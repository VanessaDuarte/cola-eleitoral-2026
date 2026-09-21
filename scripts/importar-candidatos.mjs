import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const URL_PRINCIPAL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip";

const URL_COMPLEMENTAR =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip";

function obterUrlFotos(uf) {
  return `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_${uf}_div.zip`;
}

const DIRETORIO_DADOS = path.join(process.cwd(), "public", "dados");
const DIRETORIO_FOTOS = path.join(DIRETORIO_DADOS, "fotos");

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const UFS_ACEITAS = new Set(UFS);

const CARGOS_ACEITOS = new Set([
  "DEPUTADO FEDERAL",
  "DEPUTADO ESTADUAL",
  "DEPUTADO DISTRITAL",
  "SENADOR",
  "GOVERNADOR",
  "PRESIDENTE",
]);

const SITUACOES_ACEITAS = new Set([
  "DEFERIDO",
  "DEFERIDO COM RECURSO",
  "PENDENTE DE JULGAMENTO",
  "INDEFERIDO EM PRAZO RECURSAL OU COM RECURSO",
]);

function limpar(valor) {
  if (valor === undefined || valor === null) {
    return "";
  }

  const texto = String(valor).trim();

  if (texto === "#NULO" || texto === "#NE" || texto === "-1") {
    return "";
  }

  return texto;
}

function normalizar(valor) {
  return limpar(valor).toUpperCase();
}

async function baixarZip(url, descricao) {
  console.log(`Baixando ${descricao}...`);

  const resposta = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/zip, application/octet-stream, */*",
      Referer: "https://dadosabertos.tse.jus.br/",
      "User-Agent":
        "Mozilla/5.0 Cola-Eleitoral-2026/1.0",
    },
  });

  if (!resposta.ok) {
    throw new Error(
      `Falha ao baixar ${descricao}: código ${resposta.status}`
    );
  }

  const buffer = Buffer.from(await resposta.arrayBuffer());

  console.log(`${descricao} baixado.`);

  return new AdmZip(buffer);
}

function lerRegistros(zip) {
  const registros = [];

  const arquivosCsv = zip
    .getEntries()
    .filter(
      (entrada) =>
        !entrada.isDirectory &&
        entrada.entryName.toLowerCase().endsWith(".csv")
    );

  for (const arquivo of arquivosCsv) {
    const conteudo = iconv.decode(arquivo.getData(), "latin1");

    const registrosDoArquivo = parse(conteudo, {
      columns: true,
      delimiter: ";",
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
      trim: true,
    });

    registros.push(...registrosDoArquivo);
  }

  return registros;
}

function obterSituacao(complemento) {
  return normalizar(complemento?.DS_SITUACAO_CANDIDATURA);
}

function candidaturaPodeAparecer(complemento) {
  if (!complemento) {
    return false;
  }

  const inseridoNaUrna = normalizar(
    complemento.ST_CANDIDATO_INSERIDO_URNA
  );

  if (inseridoNaUrna) {
    return inseridoNaUrna === "SIM" || inseridoNaUrna === "S";
  }

  return SITUACOES_ACEITAS.has(obterSituacao(complemento));
}

function obterCargoId(cargo) {
  const cargos = {
    "DEPUTADO FEDERAL": "deputado-federal",
    "DEPUTADO ESTADUAL": "deputado-estadual",
    "DEPUTADO DISTRITAL": "deputado-estadual",
    SENADOR: "senador",
    GOVERNADOR: "governador",
    PRESIDENTE: "presidente",
  };

  return cargos[cargo] ?? "";
}

function criarCandidato(registro, complemento) {
  const cargo = normalizar(registro.DS_CARGO);

  return {
    id: limpar(registro.SQ_CANDIDATO),
    sequencial: limpar(registro.SQ_CANDIDATO),
    nome: limpar(registro.NM_URNA_CANDIDATO),
    nomeCompleto: limpar(registro.NM_CANDIDATO),
    numero: limpar(registro.NR_CANDIDATO),
    cargo: obterCargoId(cargo),
    cargoNome: cargo,
    partido: limpar(registro.SG_PARTIDO),
    partidoNome: limpar(registro.NM_PARTIDO),
    federacao: limpar(registro.NM_FEDERACAO),
    coligacao: limpar(registro.NM_COLIGACAO),
    uf: limpar(registro.SG_UF),
    unidadeEleitoral: limpar(registro.SG_UE),
    situacao: obterSituacao(complemento),
    detalheSituacao: limpar(
      complemento.DS_DETALHE_SITUACAO_CAND
    ),
    inseridoNaUrna: limpar(
      complemento.ST_CANDIDATO_INSERIDO_URNA
    ),
    foto: null,
  };
}

function ordenarCandidatos(a, b) {
  const ordemDosCargos = {
    "deputado-federal": 1,
    "deputado-estadual": 2,
    senador: 3,
    governador: 4,
    presidente: 5,
  };

  const diferencaCargo =
    ordemDosCargos[a.cargo] - ordemDosCargos[b.cargo];

  if (diferencaCargo !== 0) {
    return diferencaCargo;
  }

  const numeroA = Number(a.numero) || 0;
  const numeroB = Number(b.numero) || 0;

  if (numeroA !== numeroB) {
    return numeroA - numeroB;
  }

  return a.nome.localeCompare(b.nome, "pt-BR");
}

function localizarSequencialNoNome(nomeArquivo, sequenciais) {
  const gruposNumericos = nomeArquivo.match(/\d+/g) ?? [];

  for (const grupo of gruposNumericos) {
    if (sequenciais.has(grupo)) {
      return grupo;
    }

    const semZerosIniciais = grupo.replace(/^0+/, "");

    if (sequenciais.has(semZerosIniciais)) {
      return semZerosIniciais;
    }
  }

  return null;
}

async function importarFotosDaUf(uf, candidatos) {
  const candidatosDaUf = candidatos.filter(
    (candidato) => candidato.uf === uf
  );

  if (candidatosDaUf.length === 0) {
    return 0;
  }

  const candidatosPorSequencial = new Map(
    candidatosDaUf.map((candidato) => [
      candidato.sequencial,
      candidato,
    ])
  );

  const sequenciais = new Set(candidatosPorSequencial.keys());
  const zip = await baixarZip(
    obterUrlFotos(uf),
    `fotos de ${uf}`
  );

  const fotos = zip.getEntries().filter((entrada) => {
    if (entrada.isDirectory) {
      return false;
    }

    return /\.(jpe?g|png)$/i.test(entrada.entryName);
  });

  let indice = 0;
  let totalImportado = 0;
  const quantidadeTrabalhadores = 6;

  async function processarProximaFoto() {
    while (indice < fotos.length) {
      const indiceAtual = indice;
      indice += 1;

      const entrada = fotos[indiceAtual];
      const nomeArquivo = path.basename(entrada.entryName);
      const sequencial = localizarSequencialNoNome(
        nomeArquivo,
        sequenciais
      );

      if (!sequencial) {
        continue;
      }

      const candidato = candidatosPorSequencial.get(sequencial);

      if (!candidato) {
        continue;
      }

      const nomeFoto = `${sequencial}.webp`;
      const caminhoFoto = path.join(DIRETORIO_FOTOS, nomeFoto);

      const fotoOtimizada = await sharp(entrada.getData())
        .rotate()
        .resize(128, 128, {
          fit: "cover",
          position: "north",
          withoutEnlargement: true,
        })
        .webp({ quality: 72, effort: 4 })
        .toBuffer();

      await writeFile(caminhoFoto, fotoOtimizada);

      candidato.foto = `/dados/fotos/${nomeFoto}`;
      totalImportado += 1;
    }
  }

  await Promise.all(
    Array.from(
      { length: quantidadeTrabalhadores },
      processarProximaFoto
    )
  );

  console.log(`Fotos de ${uf} importadas: ${totalImportado}`);

  return totalImportado;
}

async function executar() {
  console.log("");
  console.log("Importação de candidaturas e fotos do TSE");
  console.log("-----------------------------------------");

  const [zipPrincipal, zipComplementar] = await Promise.all([
    baixarZip(URL_PRINCIPAL, "arquivo principal"),
    baixarZip(URL_COMPLEMENTAR, "arquivo complementar"),
  ]);

  console.log("");
  console.log("Abrindo os arquivos oficiais...");

  const registrosPrincipais = lerRegistros(zipPrincipal);
  const registrosComplementares = lerRegistros(zipComplementar);

  console.log(
    `Registros no arquivo principal: ${registrosPrincipais.length}`
  );
  console.log(
    `Registros no arquivo complementar: ${registrosComplementares.length}`
  );

  const complementosPorCandidato = new Map();

  for (const complemento of registrosComplementares) {
    const sequencial = limpar(complemento.SQ_CANDIDATO);

    if (sequencial) {
      complementosPorCandidato.set(sequencial, complemento);
    }
  }

  const registrosDeInteresse = registrosPrincipais.filter((registro) => {
    const uf = normalizar(registro.SG_UF);
    const cargo = normalizar(registro.DS_CARGO);

    const pertenceAoBrasil =
      (cargo === "PRESIDENTE" && uf === "BR") ||
      (cargo !== "PRESIDENTE" && UFS_ACEITAS.has(uf));

    return pertenceAoBrasil && CARGOS_ACEITOS.has(cargo);
  });

  console.log(
    `Candidaturas encontradas no Brasil: ${registrosDeInteresse.length}`
  );

  let semComplemento = 0;
  let foraDaSituacaoAceita = 0;
  const candidatos = [];

  for (const registro of registrosDeInteresse) {
    const sequencial = limpar(registro.SQ_CANDIDATO);
    const complemento = complementosPorCandidato.get(sequencial);

    if (!complemento) {
      semComplemento += 1;
      continue;
    }

    if (!candidaturaPodeAparecer(complemento)) {
      foraDaSituacaoAceita += 1;
      continue;
    }

    candidatos.push(criarCandidato(registro, complemento));
  }

  const candidatosUnicos = [
    ...new Map(
      candidatos.map((candidato) => [
        `${candidato.sequencial}-${candidato.cargo}`,
        candidato,
      ])
    ).values(),
  ].sort(ordenarCandidatos);

  await mkdir(DIRETORIO_FOTOS, { recursive: true });

  console.log("");
  console.log("Importando e otimizando as fotos...");

  let totalFotos = 0;
  const ufsComFalhaNasFotos = [];

  for (const uf of [...UFS, "BR"]) {
    try {
      totalFotos += await importarFotosDaUf(uf, candidatosUnicos);
    } catch (erro) {
      ufsComFalhaNasFotos.push(uf);

      console.warn("");
      console.warn(`Não foi possível importar as fotos de ${uf}.`);
      console.warn(
        erro instanceof Error ? erro.message : String(erro)
      );
      console.warn("A importação continuará com as demais UFs.");
    }
  }

  await mkdir(DIRETORIO_DADOS, { recursive: true });

  const presidentes = candidatosUnicos.filter(
    (candidato) => candidato.cargo === "presidente"
  );

  for (const uf of UFS) {
    const candidatosDaUf = candidatosUnicos.filter(
      (candidato) => candidato.uf === uf
    );

    const candidatosDoArquivo = [...candidatosDaUf, ...presidentes].sort(
      ordenarCandidatos
    );

    const resultadoDaUf = {
      geradoEm: new Date().toISOString(),
      anoEleicao: 2026,
      uf,
      fonte: "Tribunal Superior Eleitoral",
      total: candidatosDoArquivo.length,
      totalFotos: candidatosDoArquivo.filter(
        (candidato) => candidato.foto
      ).length,
      candidatos: candidatosDoArquivo,
    };

    const arquivoDaUf = path.join(
      DIRETORIO_DADOS,
      `candidatos-2026-${uf}.json`
    );

    await writeFile(
      arquivoDaUf,
      JSON.stringify(resultadoDaUf, null, 2),
      "utf8"
    );

    console.log(
      `${uf}: ${candidatosDoArquivo.length} candidatos exportados`
    );
  }

  console.log("");
  console.log("Importação concluída.");
  console.log(`Candidatos exportados: ${candidatosUnicos.length}`);
  console.log(`Fotos otimizadas: ${totalFotos}`);
  console.log(
    `UFs com falha nas fotos: ${
      ufsComFalhaNasFotos.length > 0
        ? ufsComFalhaNasFotos.join(", ")
        : "nenhuma"
    }`
  );
  console.log(`Sem registro complementar: ${semComplemento}`);
  console.log(`Fora das situações aceitas: ${foraDaSituacaoAceita}`);
  console.log(`Arquivos estaduais criados em: ${DIRETORIO_DADOS}`);

  console.log("");
  console.log("Quantidade por cargo:");

  const quantidadePorCargo = candidatosUnicos.reduce(
    (totais, candidato) => {
      totais[candidato.cargoNome] =
        (totais[candidato.cargoNome] ?? 0) + 1;
      return totais;
    },
    {}
  );

  console.table(quantidadePorCargo);
}

executar().catch((erro) => {
  console.error("");
  console.error("Não foi possível importar os dados e as fotos.");

  if (erro instanceof Error) {
    console.error(erro.message);
  } else {
    console.error(erro);
  }

  process.exitCode = 1;
});
