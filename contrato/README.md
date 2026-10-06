# Contrato de prestação de serviços — Limpa Nome

Modelo único de contrato da A10 Consultoria, em arquivo HTML autossuficiente
(logo e marca d'água embutidas em base64 — não depende de nenhum arquivo externo
nem de internet).

| Arquivo | Para que serve |
|---|---|
| `contrato-modelo.html` | O contrato. Abra no navegador e use **Salvar em PDF / Imprimir**. |
| `assets/logo-a10-vertical.png` | Logo do cabeçalho (fonte do base64 embutido). |
| `assets/marca-dagua.png` | Marca d'água: a mesma arte, em baixa opacidade. |
| `assets/logo-a10.png` | Logo horizontal antiga, sobre fundo verde. Não é usada no contrato. |
| `exemplo-preenchido.pdf` | Como fica preenchido automaticamente. |
| `exemplo-em-branco.pdf` | Como fica a via para preencher à mão. |
| `previa/pagina-N.png` | As 5 páginas em imagem, para olhar sem abrir o PDF. |
| `contrato.docx` | A mesma minuta em Word, para o preenchimento automático. |
| `gerar-docx.js` | Gera o `.docx`. Rode `node gerar-docx.js` depois de mudar o texto. |
| `assets/marca-dagua-word.png` | Marca d'água do Word: já girada e translúcida (ver abaixo). |

São **5 páginas**: 4 de contrato + 1 de anexo (a minuta anterior tinha 8).

As médias citadas na cláusula 8.4 (anos de experiência, intervalo entre ações e
faixa da taxa de inclusão) são campos com valor padrão: mudam em
`PADRAO`, dentro do `contrato-modelo.html`, sem precisar mexer no texto.

## Preenchimento automático

O documento expõe `window.A10Contrato`. Os nomes dos campos já batem com o
registro de venda do sistema (`cliente`, `cpf_cnpj`, `whatsapp`, `fechado`,
`ordens_servico`), então o caminho normal é:

```js
A10Contrato.preencher(
  A10Contrato.deVenda(venda, {
    // o que não vem no registro de venda
    contratanteEmail:    'maria@email.com',
    contratanteEndereco: 'Rua das Palmeiras, 420, Centro',
    contratanteCidadeUf: 'Araguaína/TO',
    contratanteCep:      '77800-000',
    contratadaCnpj:      '00.000.000/0001-00',
    contratadaEndereco:  'Av. Cônego João Lima, 1500, Sala 3',
    contratadaCidadeUf:  'Araguaína/TO',
    foro:                'Brasília/DF',
    cidadeAssinatura:    'Araguaína/TO'
  })
);
```

`deVenda(venda, extras)` apenas traduz o registro de venda para o formato de
`preencher()` — dá para montar o objeto na mão se preferir.

### Campos

| Campo | Vem de | Observação |
|---|---|---|
| `numeroContrato` | `venda.id` | |
| `contratanteNome` | `venda.cliente` | |
| `contratanteDoc` | `venda.cpf_cnpj` | |
| `contratanteContato` | `venda.whatsapp` | |
| `contratanteEmail`, `contratanteEndereco`, `contratanteCidadeUf`, `contratanteCep` | — | preencher nos `extras` |
| `beneficiarios` | `venda.ordens_servico` | `[{razao_social, doc}]` |
| `valor` | `venda.fechado` | número; o extenso sai sozinho |
| `valorExtenso` | — | só se quiser sobrescrever o automático |
| `formaPagamento` | — | padrão `PIX` |
| `prazoDias`, `prazoProrrogacao` | — | padrão `30` e `20` |
| `anosExperiencia` | — | citado na cláusula 8.4; padrão `7` |
| `intervaloMeses` | — | intervalo médio entre ações, cláusula 8.4; padrão `12` |
| `taxaInclusaoMin`, `taxaInclusaoMax` | — | faixa da taxa de inclusão, cláusula 8.4; padrão `'200,00'` e `'300,00'` |
| `foro`, `cidadeAssinatura` | — | |
| `dataAssinatura`, `dataEmissao` | `venda.data_entrada` | padrão: hoje |

Campo não informado vira **linha pontilhada**, para preencher à mão.
`A10Contrato.limpar()` gera a via totalmente em branco.

### Outros métodos

- `A10Contrato.moeda(3450.9)` → `"3.450,90"`
- `A10Contrato.porExtenso(3450.9)` → `"três mil, quatrocentos e cinquenta reais e noventa centavos"`
- `A10Contrato.marcarPaginas()` — redistribui a marca d'água; só é preciso
  chamar se você alterar o conteúdo por fora do `preencher()`.

## A versão em Word

`contrato.docx` tem o mesmo texto e os mesmos campos `{{CAMPO}}`, para
find-and-replace. São 4 páginas (o HTML dá 5: a fonte e o entrelinhamento
diferem).

Dois cuidados ao automatizar:

- **Não abra e salve o arquivo no Word antes de usar como modelo.** O Word
  costuma fragmentar o texto em vários *runs* do XML ao salvar, e um campo
  partido ao meio (`{{CONTRA` + `TANTE_NOME}}`) deixa de ser encontrado pelo
  find-and-replace. Como gerado pelo script, cada campo está inteiro num
  único *run* — conferido.
- **A tabela de beneficiários não tem campo.** Ela sai com 4 linhas em
  branco; o sistema precisa inserir as linhas, não substituir um token.

Diferenças em relação ao HTML, porque o formato exige:

- Fonte **Calibri**, no lugar da pilha Segoe UI. Está em toda parte, inclusive
  no Google Docs, e não troca sozinha de desenho na máquina do cliente.
- A **marca d'água** é uma imagem flutuante no cabeçalho, atrás do texto —
  é assim que o Word faz marca d'água. O Word não tem opacidade de imagem
  nem rotação confiável entre leitores, então os dois efeitos já vão
  gravados no PNG (`assets/marca-dagua-word.png`).
- Rodapé com **"Página X de Y"**, que o HTML não tinha.

## Gerar o PDF

No navegador: **Salvar em PDF / Imprimir** (a barra verde não sai na impressão).
Deixe **A4** e **margens padrão** — as margens de impressão vêm do próprio
arquivo (`@page`), e é delas que sai o cálculo de uma marca d'água por folha.

Em linha de comando:

```sh
chrome --headless --no-pdf-header-footer \
       --print-to-pdf=contrato.pdf file:///caminho/contrato-modelo.html
```

## Detalhes de implementação

- **Marca d'água:** o Chrome não repete fundo de bloco entre páginas, então
  `marcarPaginas()` calcula quantas folhas o documento tem
  (`scrollHeight ÷ 263 mm` — a área útil de uma A4 com as margens do `@page`)
  e insere um elemento por folha. Roda no carregamento, ao preencher e antes de
  imprimir. **Se mudar as margens do `@page`, mude `ALTURA_UTIL_MM` junto.**
- `print-color-adjust: exact` mantém as faixas verdes e a marca d'água mesmo
  quando o navegador está com "gráficos de fundo" desligado.
- O anexo começa sempre em página nova (`.quebra`).
- Acentuação em JS vai como escape `\uXXXX`, seguindo o padrão do repositório.
