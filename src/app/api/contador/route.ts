import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TipoUso = "imagem" | "impressao";

function banco() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL não configurada.");
  }

  return neon(url);
}

async function prepararTabela() {
  const sql = banco();

  await sql`
    CREATE TABLE IF NOT EXISTS contador_colas (
      id BIGSERIAL PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('imagem', 'impressao')),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  return sql;
}

export async function POST(request: Request) {
  try {
    const corpo = (await request.json()) as {
      acao?: "registrar" | "consultar";
      tipo?: TipoUso;
      senha?: string;
    };

    if (corpo.acao === "registrar") {
      if (corpo.tipo !== "imagem" && corpo.tipo !== "impressao") {
        return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
      }

      const sql = await prepararTabela();
      await sql`INSERT INTO contador_colas (tipo) VALUES (${corpo.tipo})`;

      return NextResponse.json({ registrado: true });
    }

    if (corpo.acao === "consultar") {
      const senhaCorreta = process.env.ESTATISTICAS_SENHA;

      if (!senhaCorreta || corpo.senha !== senhaCorreta) {
        return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
      }

      const sql = await prepararTabela();
      const [resultado] = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE tipo = 'imagem')::int AS imagens,
          COUNT(*) FILTER (WHERE tipo = 'impressao')::int AS impressoes,
          COUNT(*) FILTER (
            WHERE criado_em >= date_trunc(
              'day', NOW() AT TIME ZONE 'America/Sao_Paulo'
            ) AT TIME ZONE 'America/Sao_Paulo'
          )::int AS hoje,
          COUNT(*) FILTER (
            WHERE criado_em >= date_trunc(
              'month', NOW() AT TIME ZONE 'America/Sao_Paulo'
            ) AT TIME ZONE 'America/Sao_Paulo'
          )::int AS mes
        FROM contador_colas
      `;

      return NextResponse.json(resultado);
    }

    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  } catch (erro) {
    console.error("Erro no contador:", erro);
    return NextResponse.json(
      { erro: "Não foi possível acessar o contador." },
      { status: 500 },
    );
  }
}
