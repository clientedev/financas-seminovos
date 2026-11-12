# -*- coding: utf-8 -*-
"""Extrai data_obj.json a partir da planilha de estoque de seminovos.

Uso:  python extract.py "<planilha.xlsx>" DD/MM/AAAA

Regras:
- Veículos cuja coluna "Situacao" esteja preenchida (Pedido, Proposta, Bloqueado) são descartados por completo
  (não entram em nenhum número, lista ou texto da apresentação).
- Capital = Valor Compra. Aging = "Dias Estoque". Aging ponderado = pesado pelo capital.
"""
import json
import re
import sys

import pandas as pd

EXCLUIR_SITUACAO = {"PEDIDO", "PROPOSTA", "BLOQUEADO"}
TAXA_CDI = 0.000366
MARCAS = ["CHERY", "CHANGAN", "HMB", "FORD"]

FAIXAS = [
    ("0-30", "0–30 dias", 0, 30, "Normal", "Monitorar giro regular", "#2E9E5B"),
    ("31-45", "31–45 dias", 31, 45, "Atenção", "Alinhar preço e preparar ação", "#E3B341"),
    ("46-60", "46–60 dias", 46, 60, "Ação Comercial", "Reprecificar, bônus ou transferir", "#E8833A"),
    ("61-90", "61–90 dias", 61, 90, "Prioridade", "Plano de saída individual", "#D64545"),
    (">90", ">90 dias", 91, 10**6, "Crítico", "Decisão imediata chassi a chassi", "#841822"),
]
SUBFAIXAS = [
    ("91-120", 91, 120, "#E8833A"),
    ("121-150", 121, 150, "#D64545"),
    ("151-180", 151, 180, "#841822"),
    (">180", 181, 10**6, "#4a0e14"),
]


def moeda(v):
    """'R$ 44.000,00' -> 44000.0 ; números passam direto."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^\d,.-]", "", str(v)).replace(".", "").replace(",", ".")
    return float(s) if s not in ("", "-", ".") else 0.0


def r1(x):
    return round(float(x), 1)


def pond(df):
    cap = df["capital"].sum()
    return r1((df["dias"] * df["capital"]).sum() / cap) if cap else 0.0


def tipo_simples(t):
    t = str(t).upper()
    if "DEMONST" in t or t.startswith("UT"):
        return "UT"
    if "LEILAO" in t or t.startswith("VUL"):
        return "VUL"
    if "RENAVE" in t:
        return "VURE"
    if t.startswith("NVD"):
        return "NVD"
    return "VU"


def acao(mesa, dias, tipo):
    if (mesa in ("D", "E") and dias > 120) or "LEILAO" in str(tipo).upper():
        return "Revendedor / Leilão", "danger"
    if mesa in ("A", "B") and dias <= 120:
        return "Reprecificar (−2% a −4%)", "ok"
    return "Campanha e bônus", "warn"


def main(path, data_base):
    raw = pd.read_excel(path)
    sit = raw["Situacao"].fillna("").astype(str).str.strip().str.upper()
    df = raw[~sit.isin(EXCLUIR_SITUACAO)].copy()

    df["capital"] = df["Valor Compra"].map(moeda)
    df["preco"] = df["Preço Publico Venda"].map(moeda)
    df["dias"] = pd.to_numeric(df["Dias Estoque"], errors="coerce").fillna(0).astype(int)
    df["band"] = df["BANDEIRA"].astype(str).str.strip().str.upper()
    df["mesa"] = df["CLASSIF MESA"].fillna("-").astype(str).str.strip()
    desconhecidas = set(df["band"]) - set(MARCAS)
    if desconhecidas:
        raise SystemExit(f"Bandeiras não mapeadas: {desconhecidas}")

    cap_tot = df["capital"].sum()
    out = {
        "totalGeral": {
            "veiculos": int(len(df)),
            "capital": float(cap_tot),
            "agingMedioPonderado": pond(df),
            "agingMedioSimples": r1(df["dias"].mean()),
            "dataBase": data_base,
        }
    }

    out["marcasGeral"] = {}
    for m in MARCAS:
        g = df[df["band"] == m]
        out["marcasGeral"][m] = {
            "veiculos": int(len(g)), "capital": float(g["capital"].sum()),
            "capitalMM": r1(g["capital"].sum() / 1e6), "agingMedio": r1(g["dias"].mean()) if len(g) else 0,
        }

    funil = []
    for fid, faixa, lo, hi, regua, status, cor in FAIXAS:
        g = df[(df["dias"] >= lo) & (df["dias"] <= hi)]
        marcas = {}
        for m in MARCAS:
            gm = g[g["band"] == m]
            if len(gm):
                marcas[m] = {"qtd": int(len(gm)), "capitalMM": round(gm["capital"].sum() / 1e6, 2),
                             "aging": r1(gm["dias"].mean())}
        funil.append({
            "id": fid, "faixa": faixa, "regua": regua, "status": status, "cor": cor,
            "veiculos": int(len(g)), "capital": float(g["capital"].sum()),
            "capitalMM": r1(g["capital"].sum() / 1e6),
            "percentualCapital": r1(100 * g["capital"].sum() / cap_tot),
            "agingMedio": r1(g["dias"].mean()) if len(g) else 0,
            "marcas": marcas,
        })
    out["funilAging"] = funil

    crit = df[df["dias"] > 90]
    ate90 = df[df["dias"] <= 90]

    def margem(g):
        g = g[g["preco"] > 0]
        return r1(100 * (g["preco"] - g["capital"]).sum() / g["preco"].sum()) if len(g) else 0.0

    fipe = pd.to_numeric(crit["FIPE ATUAL"], errors="coerce")
    ok = fipe > 0
    desc_fipe = r1(100 * (1 - crit.loc[ok, "capital"].sum() / fipe[ok].sum())) if ok.any() else 0.0
    out["indicadores"] = {"margemBrutaAcima90": margem(crit), "margemBrutaAte90": margem(ate90),
                          "compraVsFipeCriticos": -desc_fipe}

    # Raio-X por loja e por regional (novo slide)
    lojas = []
    for loja, g in df.groupby("Empresa"):
        gc = g[g["dias"] > 90]
        lojas.append({
            "loja": str(loja), "marca": g["band"].mode().iat[0], "regional": str(g["REGIONAL"].mode().iat[0]),
            "veiculos": int(len(g)), "capital": float(g["capital"].sum()), "aging": pond(g),
            "criticos": int(len(gc)), "capitalCritico": float(gc["capital"].sum()),
            "acima60": int((g["dias"] > 60).sum()),
        })
    out["lojas"] = sorted(lojas, key=lambda x: -x["capital"])

    regs = []
    for reg, g in df.groupby("REGIONAL"):
        gc = g[g["dias"] > 90]
        regs.append({
            "regional": str(reg), "marca": g["band"].mode().iat[0], "lojas": int(g["Empresa"].nunique()),
            "veiculos": int(len(g)), "capital": float(g["capital"].sum()), "aging": pond(g),
            "pct60": r1(100 * g.loc[g["dias"] > 60, "capital"].sum() / g["capital"].sum()),
            "criticos": int(len(gc)), "capitalCritico": float(gc["capital"].sum()),
        })
    out["regionais"] = sorted(regs, key=lambda x: -x["capital"])

    # Carros que cruzam os 90 dias em cada uma das próximas 4 semanas (se não forem vendidos)
    entr = []
    for s in range(1, 5):
        lo, hi = 90 - 7 * s + 1, 90 - 7 * (s - 1)
        g = df[(df["dias"] >= lo) & (df["dias"] <= hi)]
        entr.append({"semana": s, "diasHoje": f"{lo}–{hi}", "veiculos": int(len(g)), "capital": float(g["capital"].sum())})
    out["entrantes"] = entr

    veics = []
    for _, r in crit.sort_values("dias", ascending=False).iterrows():
        a, badge = acao(r["mesa"], r["dias"], r["Estoque"])
        f = pd.to_numeric(r["FIPE ATUAL"], errors="coerce")
        dif = pd.to_numeric(r["% DIF FIPE"], errors="coerce")
        veics.append({
            "empresa": str(r["Empresa"]), "modelo": str(r["Modelo"]).strip(), "placa": str(r["Placa"]).strip(),
            "ano": str(r["Ano"]), "valorCompra": float(r["capital"]), "precoPublico": float(r["preco"]),
            "km": int(pd.to_numeric(r["KM"], errors="coerce") or 0), "dias": int(r["dias"]),
            "tipoEstoque": str(r["Estoque"]).strip(), "tipoSimples": tipo_simples(r["Estoque"]),
            "bandeira": r["band"], "fipeAtual": float(f) if pd.notna(f) else 0.0,
            "difFipe": r1(100 * dif) if pd.notna(dif) else 0.0, "classifMesa": r["mesa"],
            "regional": str(r["REGIONAL"]), "acao": a, "badge": badge,
        })
    out["veiculosCriticos"] = veics

    json.dump(out, open("data_obj.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Planilha: {len(raw)} linhas · descartados: {len(raw) - len(df)} · considerados: {len(df)}")
    print(f"Capital R$ {cap_tot/1e6:.1f} MM · aging pond. {out['totalGeral']['agingMedioPonderado']} d · "
          f">90 d: {len(crit)} veículos / R$ {crit['capital'].sum()/1e6:.2f} MM")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
