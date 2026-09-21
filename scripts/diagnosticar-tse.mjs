import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

const URL_TSE =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_2026.zip";

function limparTexto(valor) {
  return String(valor ?? "").trim();
}

function ehColunaDeSituacao(nomeColuna) {
  const nome = nomeColuna.toUpperCase();

  return (
    nome.includes("SITUAC") ||
    nome.includes("URNA") ||
    nome.includes("PLEITO") ||
    nome.includes("INSERIDO")
  );
}

async function executar() {
  console.log(
    "Baixando arquivo complementar oficial do TSE..."
  );

  const resposta = await fetch(URL_TSE, {
    cache: "no-store",
    headers: {
      "User-Agent": "Cola-Eleitoral-2026",
    },
  });

  if (!resposta.ok) {
    throw new Error(
      `Falha no download: código ${resposta.status}`
    );
  }

  const buffer = Buffer.from(
    await resposta.arrayBuffer()
  );

  console.log("Download concluído.");
  console.log("Abrindo o arquivo ZIP...");

  const zip = new AdmZip(buffer);

  const arquivosCsv = zip
    .getEntries()
    .filter(
      (entrada) =>
        !entrada.isDirectory &&
        entrada.entryName
          .toLowerCase()
          .endsWith(".csv")
    );

  if (arquivosCsv.length === 0) {
    throw new Error(
      "Nenhum arquivo CSV foi encontrado dentro do ZIP."
    );
  }

  console.log("");
  console.log("Arquivos CSV encontrados:");

  for (const arquivo of arquivosCsv) {
    console.log(`- ${arquivo.entryName}`);
  }

  let primeiroRegistro = null;
  let registroDeMinas = null;
  let quantidadeRegistros = 0;

  const valoresUf = new Set();
  const valoresPorSituacao = new Map();

  for (const arquivo of arquivosCsv) {
    const conteudo = iconv.decode(
      arquivo.getData(),
      "latin1"
    );

    const registros = parse(conteudo, {
      columns: true,
      delimiter: ";",
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      bom: true,
      trim: true,
    });

    quantidadeRegistros += registros.length;

    if (
      !primeiroRegistro &&
      registros.length > 0
    ) {
      primeiroRegistro = registros[0];

      const colunas = Object.keys(
        primeiroRegistro
      );

      for (const coluna of colunas) {
        if (ehColunaDeSituacao(coluna)) {
          valoresPorSituacao.set(
            coluna,
            new Set()
          );
        }
      }
    }

    for (const registro of registros) {
      const uf = limparTexto(
        registro.SG_UF
      );

      if (uf) {
        valoresUf.add(uf);
      }

      for (const [
        coluna,
        valores,
      ] of valoresPorSituacao) {
        const valor = limparTexto(
          registro[coluna]
        );

        if (valor) {
          valores.add(valor);
        }
      }

      if (
        !registroDeMinas &&
        uf === "MG"
      ) {
        registroDeMinas = registro;
      }
    }
  }

  if (!primeiroRegistro) {
    throw new Error(
      "O arquivo não possui registros."
    );
  }

  const colunasEncontradas = Object.keys(
    primeiroRegistro
  );

  console.log("");
  console.log(
    `Quantidade total de registros: ${quantidadeRegistros}`
  );

  console.log("");
  console.log("Colunas encontradas:");

  for (const coluna of colunasEncontradas) {
    console.log(`- ${coluna}`);
  }

  console.log("");
  console.log("Valores de SG_UF:");
  console.log([...valoresUf].sort());

  console.log("");
  console.log(
    "Colunas relacionadas à situação:"
  );

  if (valoresPorSituacao.size === 0) {
    console.log(
      "Nenhuma coluna de situação foi encontrada."
    );
  } else {
    for (const [
      coluna,
      valores,
    ] of valoresPorSituacao) {
      console.log("");
      console.log(`${coluna}:`);
      console.log([...valores].sort());
    }
  }

  console.log("");
  console.log(
    "Exemplo de registro de Minas Gerais:"
  );

  if (!registroDeMinas) {
    console.log(
      "Nenhum registro de Minas Gerais foi encontrado."
    );

    return;
  }

  const resumoRegistro = {};

  const colunasImportantes = [
    "ANO_ELEICAO",
    "SG_UF",
    "SG_UE",
    "SQ_CANDIDATO",
    "NR_CANDIDATO",
    "NM_CANDIDATO",
    "NM_URNA_CANDIDATO",
    "DS_CARGO",
    "SG_PARTIDO",
    "DS_SITUACAO_CANDIDATURA",
    "DS_DETALHE_SITUACAO_CAND",
    "DS_SITUACAO_CANDIDATO_PLEITO",
    "DS_SITUACAO_CANDIDATO_URNA",
    "ST_CANDIDATO_INSERIDO_URNA",
  ];

  for (const coluna of colunasImportantes) {
    if (
      Object.prototype.hasOwnProperty.call(
        registroDeMinas,
        coluna
      )
    ) {
      resumoRegistro[coluna] =
        registroDeMinas[coluna];
    }
  }

  for (const coluna of colunasEncontradas) {
    if (
      ehColunaDeSituacao(coluna) &&
      !Object.prototype.hasOwnProperty.call(
        resumoRegistro,
        coluna
      )
    ) {
      resumoRegistro[coluna] =
        registroDeMinas[coluna];
    }
  }

  console.log(resumoRegistro);
}

executar().catch((erro) => {
  console.error("");
  console.error(
    "Erro no diagnóstico:"
  );

  if (erro instanceof Error) {
    console.error(erro.message);
  } else {
    console.error(erro);
  }

  process.exitCode = 1;
});