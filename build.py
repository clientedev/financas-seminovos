# -*- coding: utf-8 -*-
"""Monta 'Estoque SN_ giro, margem e capital parado.html' (arquivo único 100% autocontido) a partir de
data_obj.json (gerado por extract.py a partir da planilha), logos_b64.json, qrcode.min.js (lib do app pai) e app.js."""
import json

d = json.load(open("data_obj.json", encoding="utf-8"))
logos = json.load(open("logos_b64.json", encoding="utf-8"))
qrlib = open("qrcode.min.js", encoding="utf-8").read()
app_js = open("app.js", encoding="utf-8").read()
tpl = open("template.html", encoding="utf-8").read()

NOME = {"CHERY": "Chery", "CHANGAN": "Changan", "HMB": "HMB", "FORD": "Ford"}

DATA_BASE = d["totalGeral"]["dataBase"]
dados = {
    "config": {
        "dataBase": DATA_BASE,
        "urlPublicada": "",  # cole aqui o link público (ex.: Vercel) para o QR funcionar ao abrir o arquivo localmente
    },
    "premissas": {
        "taxaCDIDiaria": 0.000366,      # 0,0366% a.d. — premissa do Financeiro (ajustável em ⚙ Premissas)
        "despesaVarejo": 1500,          # ILUSTRATIVO — substituir pelo custo médio real de saída no varejo
        "despesaRevendedor": 500,       # ILUSTRATIVO — substituir pelo custo médio real de saída no atacado
        "descontoRevendedorPct": 5,     # ponto de partida do simulador
        "diasVendaRevendedor": 7,
        "diasAdicionaisVarejo": 45,
        "semanasPlano": 4,
    },
    "total": {
        "veiculos": d["totalGeral"]["veiculos"],
        "capital": d["totalGeral"]["capital"],
        "agingPonderado": d["totalGeral"]["agingMedioPonderado"],
        "agingSimples": d["totalGeral"]["agingMedioSimples"],
    },
    "margemBruta": {"acima90": d["indicadores"]["margemBrutaAcima90"], "ate90": d["indicadores"]["margemBrutaAte90"]},
    "compraVsFipeCriticos": d["indicadores"]["compraVsFipeCriticos"],
    "marcas": [
        {"marca": NOME[k], "veiculos": v["veiculos"], "capital": v["capital"], "aging": v["agingMedio"]}
        for k, v in d["marcasGeral"].items()
    ],
    "funil": [
        {
            "id": f["id"], "faixa": f["faixa"], "regua": f["regua"], "acao": f["status"],
            "veiculos": f["veiculos"], "capital": f["capital"], "aging": f["agingMedio"],
            "marcas": [
                {"marca": NOME[m], "veiculos": x["qtd"], "capitalMM": x["capitalMM"], "aging": x["aging"]}
                for m, x in f["marcas"].items()
            ],
        }
        for f in d["funilAging"]
    ],
    "entrantes": d["entrantes"],
    "regionais": [dict(r, marca=NOME[r["marca"]]) for r in d["regionais"]],
    "lojas": [dict(l, marca=NOME[l["marca"]]) for l in d["lojas"]],
    "veiculos": [
        {
            "empresa": v["empresa"], "modelo": v["modelo"], "placa": v["placa"], "ano": v["ano"],
            "valorCompra": v["valorCompra"], "precoPublico": v["precoPublico"], "km": v["km"],
            "dias": v["dias"], "tipoEstoque": v["tipoEstoque"], "marca": NOME[v["bandeira"]],
            "fipe": v["fipeAtual"], "difFipe": v["difFipe"], "mesa": v["classifMesa"], "regional": v["regional"],
        }
        for v in d["veiculosCriticos"]
    ],
}

# Rótulos da régua de decisão
REGUA = {"0-30": "Normal", "31-45": "Atenção", "46-60": "Ação comercial", "61-90": "Prioridade", ">90": "Crítico"}
ACAO = {"0-30": "Monitorar giro", "31-45": "Preparar ação comercial", "46-60": "Preço, transferência ou campanha",
        "61-90": "Plano individual de saída", ">90": "Decisão imediata por chassi"}
for f in dados["funil"]:
    f["regua"] = REGUA.get(f["id"], f["regua"])
    f["acao"] = ACAO.get(f["id"], f["acao"])

# Monta o HTML com inlining completo
html = (tpl
        .replace("__DADOS__", json.dumps(dados, ensure_ascii=False, indent=1))
        .replace("__DATA_BASE__", DATA_BASE)
        .replace("__LOGO_WHITE__", logos["logo-white.png"])
        .replace("__LOGO_NAVY__", logos["logo-navy.png"])
        .replace("__QRLIB__", qrlib)
        .replace('<script src="__APP_JS__"></script>', f'<script>\n{app_js}\n</script>'))

out = "Estoque SN_ giro, margem e capital parado.html"
open(out, "w", encoding="utf-8").write(html)
open("index.html", "w", encoding="utf-8").write(html)
print(f"OK! {out} gerado com sucesso.")
print(f"Tamanho: {len(html):,} bytes")
print(f"Veículos na tabela: {len(dados['veiculos'])} chassis críticos")
assert "pedido" not in html.lower() and "proposta" not in html.lower(), "Texto proibido (pedido/proposta) no HTML"
