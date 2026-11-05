# -*- coding: utf-8 -*-
"""Monta 'Estoque SN_ giro, margem e capital parado.html' (arquivo único 100% autocontido) a partir de
data_obj.json (extraído da planilha), logos_b64.json, qrcode.min.js (lib do app pai) e app.js."""
import json

d = json.load(open("data_obj.json", encoding="utf-8"))
logos = json.load(open("logos_b64.json", encoding="utf-8"))
qrlib = open("qrcode.min.js", encoding="utf-8").read()
app_js = open("app.js", encoding="utf-8").read()
tpl = open("template.html", encoding="utf-8").read()

NOME = {"CHERY": "Chery", "CHANGAN": "Changan", "HMB": "HMB", "FORD": "Ford"}

dados = {
    "config": {
        "dataBase": "05/11/2026",
        "urlPublicada": "",  # cole aqui o link público (ex.: Vercel) para o QR funcionar ao abrir o arquivo localmente
    },
    "premissas": {
        "taxaCDIDiaria": 0.000366,      # 0,0366% a.d. — derivada do PPT: R$ 102.000 x 117 d = R$ 4.361
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
    },
    "pptFinanceiro": {
        "data": "28/10/2026", "recorte": "Somente situação Liberado",
        "veiculos": 1333, "capital": 110400000, "cdi": 1480000, "cdiPct": 1.34, "aging": 34.4,
    },
    "margemBruta": {"acima90": 7.9, "ate90": 5.7},
    "compraVsFipeCriticos": -15,
    "marcas": [
        {"marca": NOME[k], "veiculos": v["veiculos"], "capital": v["capital"]}
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
    "veiculos": [
        {
            "empresa": v["empresa"], "modelo": v["modelo"], "placa": v["placa"], "ano": v["ano"],
            "valorCompra": v["valorCompra"], "precoPublico": v["precoPublico"], "km": v["km"],
            "dias": v["dias"], "tipoEstoque": v["tipoEstoque"], "marca": NOME[v["bandeira"]],
            "fipe": v["fipeAtual"], "difFipe": v["difFipe"], "mesa": v["classifMesa"],
        }
        for v in d["veiculosCriticos"]
    ],
}

# Ajuste do rótulo de régua conforme o PPT do financeiro
REGUA = {"0-30": "Normal", "31-45": "Atenção", "46-60": "Ação comercial", "61-90": "Prioridade", ">90": "Crítico"}
ACAO = {"0-30": "Monitorar giro", "31-45": "Preparar ação comercial", "46-60": "Preço, transferência ou campanha",
        "61-90": "Plano individual de saída", ">90": "Decisão imediata por chassi"}
for f in dados["funil"]:
    f["regua"] = REGUA.get(f["id"], f["regua"])
    f["acao"] = ACAO.get(f["id"], f["acao"])

# Monta o HTML com inlining completo
html = (tpl
        .replace("__DADOS__", json.dumps(dados, ensure_ascii=False, indent=1))
        .replace("__LOGO_WHITE__", logos["logo-white.png"])
        .replace("__LOGO_NAVY__", logos["logo-navy.png"])
        .replace("__QRLIB__", qrlib)
        .replace('<script src="__APP_JS__"></script>', f'<script>\n{app_js}\n</script>'))

out = "Estoque SN_ giro, margem e capital parado.html"
open(out, "w", encoding="utf-8").write(html)
print(f"OK! {out} gerado com sucesso.")
print(f"Tamanho: {len(html):,} bytes")
print(f"Veículos na tabela: {len(dados['veiculos'])} chassis críticos")
