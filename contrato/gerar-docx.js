/*
 * Gera contrato.docx a partir do mesmo conteudo do contrato-modelo.html.
 * Uso:  node gerar-docx.js
 *
 * Os campos {{CAMPO}} saem cada um num unico run do XML, para que o
 * find/replace do sistema os encontre. Ver README.md.
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Tab, TabStopType,
  HorizontalPositionAlign, VerticalPositionAlign, HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom, TextWrappingType, PageBreak, Header, Footer,
  PageNumber, LevelFormat, convertMillimetersToTwip,
} = require('docx');

const aqui = __dirname;
const mm = convertMillimetersToTwip;             // mm -> DXA
const px = (v) => Math.round(v * 96 / 25.4);     // mm -> px (imagens)

const PRETO   = '0F0F0F';
const GRAFITE = '4A4A4A';
const VERDE   = '036938';
const OURO    = '8A6D1F';   // dourado de texto, escurecido para ler no branco
const OURO_CL = 'CFA956';   // dourado da logo, para filetes e fundos
const LINHA   = 'D9D9D9';
const SUAVE   = 'F5F5F5';
const FONTE   = 'Calibri';

const LARGURA = mm(174);    // A4 menos as margens laterais
const RECUO   = mm(11);     // coluna da numeracao das clausulas

/* ---------- helpers ---------- */

// "texto com **negrito**" -> runs
function runs(texto, opts = {}) {
  return String(texto).split(/\*\*/).map((parte, i) =>
    new TextRun({ text: parte, bold: i % 2 === 1, ...opts }));
}

function semBorda() {
  const n = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: n, bottom: n, left: n, right: n };
}

function borda(cor = LINHA, tamanho = 4) {
  const b = { style: BorderStyle.SINGLE, size: tamanho, color: cor };
  return { top: b, bottom: b, left: b, right: b };
}

function titulo(texto) {
  return new Paragraph({
    spacing: { before: mm(5), after: mm(2.2) },
    keepNext: true,
    indent: { left: mm(3.2) },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: OURO_CL, space: 8 } },
    children: [new TextRun({
      text: texto.toUpperCase(), bold: true, color: PRETO,
      size: 19, characterSpacing: 18, font: FONTE,
    })],
  });
}

// clausula: numero na coluna da esquerda, texto justificado ao lado
function clausula(numero, texto, extras = {}) {
  return new Paragraph({
    indent: { left: RECUO, hanging: RECUO },
    tabStops: [{ type: TabStopType.LEFT, position: RECUO }],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: mm(1.9), line: 264 },
    children: [
      new TextRun({ text: numero, bold: true, color: VERDE, size: 20, font: FONTE }),
      new TextRun({ children: [new Tab()] }),
      ...runs(texto, { size: 20, color: PRETO, font: FONTE }),
    ],
    ...extras,
  });
}

function marcador(texto) {
  return new Paragraph({
    numbering: { reference: 'pontos', level: 0 },
    indent: { left: RECUO + mm(5), hanging: mm(4) },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: mm(0.8), line: 264 },
    children: runs(texto, { size: 20, color: PRETO, font: FONTE }),
  });
}

function celula(filhos, opts = {}) {
  return new TableCell({
    children: Array.isArray(filhos) ? filhos : [filhos],
    margins: { top: mm(1.1), bottom: mm(1.1), left: mm(2.2), right: mm(2.2) },
    verticalAlign: 'center',
    ...opts,
  });
}

function rotulo(texto) {
  return new Paragraph({ children: [new TextRun({
    text: texto.toUpperCase(), size: 14, color: GRAFITE, bold: true,
    characterSpacing: 14, font: FONTE,
  })] });
}

// campo preenchivel: fica num unico run para o find/replace do sistema achar
function valor(texto, opts = {}) {
  return new Paragraph({ children: [new TextRun({
    text: texto, size: 19, bold: true, color: PRETO, font: FONTE, ...opts,
  })] });
}

function texto(t, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { after: opts.after === undefined ? mm(1.5) : opts.after, line: 264 },
    children: runs(t, { size: opts.size || 20, color: opts.color || PRETO, font: FONTE }),
    ...(opts.paragrafo || {}),
  });
}

/* ---------- dados do documento ---------- */

const PARTES_CONTRATANTE = [
  [['Contratante', '{{CONTRATANTE_NOME}}', 3]],
  [['CPF / CNPJ', '{{CONTRATANTE_DOC}}', 1], ['Contato', '{{CONTRATANTE_CONTATO}}', 1]],
  [['E-mail', '{{CONTRATANTE_EMAIL}}', 3]],
  [['Endereço', '{{CONTRATANTE_ENDERECO}}', 3]],
  [['Cidade / UF', '{{CONTRATANTE_CIDADE_UF}}', 1], ['CEP', '{{CONTRATANTE_CEP}}', 1]],
];

const PARTES_CONTRATADA = [
  [['Contratada', 'A10 CONSULTORIA LTDA', 3]],
  [['CNPJ', '{{CONTRATADA_CNPJ}}', 1], ['Cidade / UF', '{{CONTRATADA_CIDADE_UF}}', 1]],
  [['Endereço', '{{CONTRATADA_ENDERECO}}', 3]],
];

const ORIENTACOES = [
  ['1.', 'Aguarde 15 dias para pedir crédito',
   'Os órgãos de crédito são bancos de dados. Há atraso natural até que credores e sistemas atualizem a baixa das restrições.'],
  ['2.', 'Atualize os seus dados',
   'Endereço, telefone e e-mail corretos no SERASA, SPC e SCPC/Boa Vista tornam o seu cadastro mais confiável para o mercado.'],
  ['3.', 'Evite consultas constantes ao CPF/CNPJ',
   'Consultas repetidas em curto intervalo sinalizam risco e pesam na análise de crédito.'],
  ['4.', 'Construa relacionamento bancário',
   'Movimentação regular e bom histórico com bancos e instituições financeiras ampliam o seu limite.'],
  ['5.', 'Pague as contas em dia',
   'De preferência três dias antes do vencimento, para garantir a compensação dentro do prazo.'],
  ['6.', 'Use débito automático',
   'Água, luz, telefone e internet em débito automático reforçam a sua imagem de bom consumidor.'],
];

const CIENCIA = [
  'Compreendi o conceito do **LIMPA NOME** e li as orientações do item A deste anexo.',
  'Estou ciente de que o serviço visa exclusivamente a entrega do **NADA CONSTA** em SERASA, SPC, SCPC (Boa Vista) e CENPROT NACIONAL (cláusula 3).',
  'Fui esclarecido(a) de que **não haverá quitação nem negociação** das minhas dívidas, que passam a constar apenas internamente nas instituições credoras (cláusula 4.1).',
  'Estou ciente de que a CONTRATADA não responde por **CCF, BACEN, CADIN** ou cadastros diversos dos indicados, nem garante crédito ou pontuação exata de score (cláusulas 4.2 e 4.3).',
  'Fui informado(a) de que este contrato é **título executivo** e pode ser protestado em caso de descumprimento da cláusula 5 (cláusula 9.3).',
  'Reconheço que meus direitos e deveres estão expressos exclusivamente neste instrumento e seu anexo.',
  'Estou ciente de que **os débitos podem voltar a ser registrados**, inclusive em caso de agravo no processo, e de que a CONTRATADA cobre essa situação pela garantia da cláusula 8, cabendo a mim apenas a taxa judicial de inclusão da nova demanda (cláusula 8.2).',
  'Autorizo o tratamento dos meus dados pessoais nos termos da cláusula 11 (LGPD).',
];

/* ---------- montagem ---------- */

function tabelaPartes(linhas) {
  const colunas = [mm(30), mm(57), mm(30), mm(57)];
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: colunas,
    rows: linhas.map((celulas) => new TableRow({
      children: celulas.flatMap(([rot, val, vao]) => [
        celula(rotulo(rot), {
          width: { size: colunas[0], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: SUAVE },
          borders: borda(),
        }),
        celula(valor(val), {
          width: { size: vao === 3 ? colunas[1] + colunas[2] + colunas[3] : colunas[1], type: WidthType.DXA },
          columnSpan: vao === 3 ? 3 : 1,
          borders: borda(),
        }),
      ]),
    })),
  });
}

function tabelaBeneficiarios() {
  const colunas = [mm(122), mm(52)];
  const cabecalho = (t) => celula(
    new Paragraph({ children: [new TextRun({
      text: t.toUpperCase(), bold: true, color: 'FFFFFF', size: 14,
      characterSpacing: 16, font: FONTE,
    })] }),
    {
      shading: { type: ShadingType.CLEAR, fill: VERDE },
      borders: { ...borda(VERDE), bottom: { style: BorderStyle.SINGLE, size: 12, color: OURO_CL } },
    });

  const vazia = () => new TableRow({
    height: { value: mm(7), rule: 'atLeast' },
    children: colunas.map((largura) => celula(new Paragraph({ children: [] }), {
      width: { size: largura, type: WidthType.DXA }, borders: borda(),
    })),
  });

  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: colunas,
    rows: [
      new TableRow({ tableHeader: true, children: [cabecalho('Nome / Razão social'), cabecalho('CPF / CNPJ')] }),
      // 4 linhas em branco: o sistema as substitui pela lista real
      vazia(), vazia(), vazia(), vazia(),
    ],
  });
}

function faixaAnexo() {
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [LARGURA],
    rows: [new TableRow({ children: [celula([
      new Paragraph({ children: [new TextRun({
        text: 'ANEXO ÚNICO – ORIENTAÇÕES E DECLARAÇÃO DE CIÊNCIA',
        bold: true, color: 'FFFFFF', size: 21, characterSpacing: 18, font: FONTE,
      })] }),
      new Paragraph({ spacing: { before: mm(0.8) }, children: [new TextRun({
        text: 'Parte integrante do contrato. Leia antes de assinar.',
        color: 'FFFFFF', size: 17, font: FONTE,
      })] }),
    ], {
      width: { size: LARGURA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: VERDE },
      borders: { ...borda(VERDE), bottom: { style: BorderStyle.SINGLE, size: 12, color: OURO_CL } },
      margins: { top: mm(2.4), bottom: mm(2.4), left: mm(4), right: mm(4) },
    })] })],
  });
}

function tabelaOrientacoes() {
  const col = mm(85);
  const caixa = ([num, cabeca, corpo]) => celula([
    new Paragraph({ spacing: { after: mm(1) }, children: [
      new TextRun({ text: num + ' ', bold: true, color: OURO, size: 17, font: FONTE }),
      new TextRun({ text: cabeca.toUpperCase(), bold: true, color: PRETO, size: 17,
                    characterSpacing: 10, font: FONTE }),
    ] }),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [
      new TextRun({ text: corpo, size: 17, color: '333333', font: FONTE }),
    ] }),
  ], { width: { size: col, type: WidthType.DXA }, borders: borda(), verticalAlign: 'top' });

  const linhas = [];
  for (let i = 0; i < ORIENTACOES.length; i += 2) {
    linhas.push(new TableRow({ children: [caixa(ORIENTACOES[i]), caixa(ORIENTACOES[i + 1])] }));
  }
  return new Table({ width: { size: mm(170), type: WidthType.DXA }, columnWidths: [col, col], rows: linhas });
}

function listaCiencia() {
  const colCaixa = mm(7), colTexto = mm(167);
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [colCaixa, colTexto],
    rows: CIENCIA.map((item) => new TableRow({ children: [
      celula(new Paragraph({ children: [new TextRun({
        text: '□', size: 24, color: VERDE, font: FONTE,
      })] }), {
        width: { size: colCaixa, type: WidthType.DXA },
        borders: { ...semBorda(), bottom: { style: BorderStyle.DOTTED, size: 4, color: LINHA } },
        margins: { top: mm(1.4), bottom: mm(1.4), left: 0, right: mm(1.5) },
        verticalAlign: 'top',
      }),
      celula(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: runs(item, { size: 19, color: PRETO, font: FONTE }),
      }), {
        width: { size: colTexto, type: WidthType.DXA },
        borders: { ...semBorda(), bottom: { style: BorderStyle.DOTTED, size: 4, color: LINHA } },
        margins: { top: mm(1.4), bottom: mm(1.4), left: 0, right: 0 },
        verticalAlign: 'top',
      }),
    ] })),
  });
}

function assinaturas(comTestemunhas) {
  const col = mm(80);
  const campo = (papel, quem) => celula([
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: mm(10) },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '8D948F', space: 4 } },
      children: [new TextRun({ text: papel.toUpperCase(), bold: true, color: PRETO,
                               size: 16, characterSpacing: 14, font: FONTE })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: quem, size: 17, color: GRAFITE, font: FONTE }),
    ] }),
  ], { width: { size: col, type: WidthType.DXA }, borders: semBorda(), verticalAlign: 'bottom' });

  const linhas = [new TableRow({ children: [
    campo('Contratante', '{{CONTRATANTE_NOME}} · {{CONTRATANTE_DOC}}'),
    campo('Contratada', 'A10 Consultoria Ltda · {{CONTRATADA_CNPJ}}'),
  ] })];
  if (comTestemunhas) {
    linhas.push(new TableRow({ children: [
      campo('Testemunha 1', 'Nome e CPF'), campo('Testemunha 2', 'Nome e CPF'),
    ] }));
  }
  return new Table({ width: { size: mm(166), type: WidthType.DXA },
                     columnWidths: [col, col], rows: linhas,
                     alignment: AlignmentType.CENTER });
}

function localData() {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: mm(7), after: mm(2) },
    children: [new TextRun({ text: '{{CIDADE_ASSINATURA}}, {{DATA_EXTENSO}}.',
                             size: 19, color: PRETO, font: FONTE })],
  });
}

/* ---------- cabecalho do documento ---------- */

function blocoCabecalho() {
  const colLogo = mm(90), colRef = mm(84);
  const linhaRef = (rot, val) => new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: mm(0.6) },
    children: [
      new TextRun({ text: rot.toUpperCase() + '   ', color: GRAFITE, size: 14,
                    characterSpacing: 22, font: FONTE }),
      new TextRun({ text: val, bold: true, color: PRETO, size: 18, font: FONTE }),
    ],
  });

  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [colLogo, colRef],
    rows: [new TableRow({ children: [
      celula(new Paragraph({ children: [new ImageRun({
        type: 'png',
        data: fs.readFileSync(path.join(aqui, 'assets/logo-a10-vertical.png')),
        transformation: { width: px(30), height: px(17.6) },
      })] }), { width: { size: colLogo, type: WidthType.DXA }, borders: semBorda(),
                margins: { top: 0, bottom: 0, left: 0, right: 0 }, verticalAlign: 'bottom' }),
      celula([linhaRef('Contrato nº', '{{NUMERO_CONTRATO}}'),
              linhaRef('Serviço', 'Limpa nome'),
              linhaRef('Emissão', '{{DATA_EMISSAO}}')],
             { width: { size: colRef, type: WidthType.DXA }, borders: semBorda(),
               margins: { top: 0, bottom: 0, left: 0, right: 0 }, verticalAlign: 'bottom' }),
    ] })],
  });
}

function filete() {
  return new Paragraph({
    spacing: { before: mm(3), after: mm(5.5) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRETO, space: 2 } },
    children: [],
  });
}

/* ---------- marca d'agua: imagem flutuante no cabecalho, atras do texto ---------- */

function marcaDagua() {
  return new Header({ children: [new Paragraph({ children: [new ImageRun({
    type: 'png',
    data: fs.readFileSync(path.join(aqui, 'assets/marca-dagua-word.png')),
    transformation: { width: px(98.5), height: px(84.1) },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE,
                            align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE,
                          align: VerticalPositionAlign.CENTER },
      behindDocument: true,
      wrap: { type: TextWrappingType.NONE },
    },
  })] })] });
}

/* ---------- corpo ---------- */

const corpo = [
  blocoCabecalho(),
  filete(),

  new Paragraph({ spacing: { after: mm(1.6) }, children: [new TextRun({
    text: 'INSTRUMENTO PARTICULAR', bold: true, color: OURO, size: 14,
    characterSpacing: 44, font: FONTE,
  })] }),
  new Paragraph({ spacing: { after: mm(1.8) }, children: [new TextRun({
    text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INTERMEDIAÇÃO DE RETIRADA DAS EXPOSIÇÕES DOS ÓRGÃOS DE PROTEÇÃO',
    bold: true, color: PRETO, size: 30, font: FONTE,
  })] }),
  new Paragraph({
    spacing: { after: mm(5.5) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: OURO_CL, space: 6 } },
    children: [new TextRun({
      text: 'As partes declaram que receberam a minuta previamente, compreenderam integralmente os seus termos e os assumem de boa-fé, em condições de honrá-los.',
      size: 17, color: GRAFITE, font: FONTE,
    })],
  }),

  titulo('1. Partes'),
  tabelaPartes(PARTES_CONTRATANTE),
  new Paragraph({ spacing: { after: mm(2.5) }, children: [] }),
  tabelaPartes(PARTES_CONTRATADA),

  titulo('2. Beneficiários – ordem de serviço'),
  tabelaBeneficiarios(),

  titulo('3. Objeto'),
  clausula('3.1', 'A CONTRATADA prestará serviços de consultoria e intermediação para regularização do nome do CONTRATANTE e dos beneficiários indicados na cláusula 2, compreendendo o diagnóstico da situação financeira e a adoção das medidas administrativas, extrajudiciais e judiciais cabíveis – inclusive pedido de **tutela antecipada** – para:'),
  marcador('baixa das restrições registradas em **SERASA, SPC, SCPC (Boa Vista) e CENPROT NACIONAL**;'),
  marcador('limpeza do histórico de restrições;'),
  marcador('restauração do **score**.'),
  clausula('3.2', 'A entrega do serviço é o **NADA CONSTA**: consulta atualizada comprovando a inexistência de restrições nos órgãos listados em 3.1.'),

  titulo('4. Limites do serviço – o que não está incluído'),
  clausula('4.1', 'O serviço **não quita, não negocia e não extingue** as dívidas do CONTRATANTE e dos beneficiários. Os débitos permanecem de forma **interna** nas instituições credoras.'),
  clausula('4.2', 'A CONTRATADA não responde por:'),
  marcador('restrições no **BACEN**, **CADIN** ou em qualquer cadastro diverso dos listados em 3.1;'),
  marcador('cheques devolvidos (**CCF**);'),
  marcador('processos judiciais ou débitos existentes em nome do CONTRATANTE;'),
  marcador('restrições registradas **após** a assinatura deste contrato;'),
  marcador('desatualização de bases de dados de terceiros – prevalece a consulta feita nos Correios ou no aplicativo oficial do órgão.'),
  clausula('4.3', 'Os serviços **não constituem garantia de crédito** nem de pontuação exata de score. A obtenção de crédito e a elevação do score são consequências possíveis e dependem também da conduta do CONTRATANTE: pagar contas em dia, manter dados atualizados, histórico no BACEN e movimentação bancária, entre outros.'),
  clausula('4.4', 'A conclusão do serviço **não está condicionada** à atualização de dados pelas instituições financeiras e demais credores.'),

  titulo('5. Valor e pagamento'),
  clausula('5.1', 'O valor total dos serviços é de **R$ {{VALOR}}** ({{VALOR_EXTENSO}}), pago por **{{FORMA_PAGAMENTO}}** para início e conclusão dos serviços.'),
  clausula('5.2', 'O valor da cláusula 5.1 é o **único devido** pelo CONTRATANTE e engloba todas as medidas administrativas, extrajudiciais e judiciais necessárias. Não haverá cobrança adicional a qualquer título, ressalvada apenas a taxa judicial de inclusão de nova demanda, prevista na cláusula 8.2.'),

  titulo('6. Prazo e entrega'),
  clausula('6.1', 'O prazo de execução é de até **{{PRAZO_DIAS}} dias úteis** contados do protocolo da ação judicial, prorrogável por até **{{PRAZO_PRORROGACAO}} dias úteis**.'),
  clausula('6.2', 'Considera-se entregue a prestação de serviço no ato da entrega do NADA CONSTA (cláusula 3.2).'),

  titulo('7. Obrigações do contratante'),
  clausula('7.1', 'Entregar, em até **1 (um) dia útil** da solicitação, consulta com o quadro geral de pendências e dívidas ativas, obtida nos **Correios** ou por print do **aplicativo oficial do SERASA**, conforme orientação do consultor responsável.'),
  clausula('7.2', 'Após a conclusão do serviço, repetir a consulta da cláusula 7.1, no mesmo prazo, quando solicitado por telefone ou WhatsApp.'),
  clausula('7.3', 'Entregar a **ficha de filiação**, própria e dos beneficiários, com firma reconhecida em cartório ou assinatura digital pelo **GOV.BR**.'),
  clausula('7.4', 'Ler o **Anexo Único** e assinar a declaração de ciência que o integra.'),
  clausula('7.5', 'Manter dados de contato atualizados junto à CONTRATADA durante toda a vigência.'),

  titulo('8. Garantia'),
  clausula('8.1', 'A CONTRATADA garante a manutenção dos efeitos da tutela antecipada concedida, por tempo indeterminado, enquanto persistirem os fundamentos que a justificaram.'),
  clausula('8.2', 'Caso seja necessária nova ação judicial para restabelecer a tutela anteriormente obtida, a CONTRATADA arca **integralmente com os honorários advocatícios e com as taxas contábeis, nestas incluídos todos os impostos**, cabendo ao CONTRATANTE apenas o pagamento da **taxa judicial de inclusão** da nova demanda.'),
  clausula('8.3', 'A tutela antecipada é medida **provisória**, concedida com base na situação fática e jurídica do momento do pedido. Decisões judiciais supervenientes, mudança das circunstâncias, atos de terceiros ou medidas dos órgãos de proteção ao crédito podem alterar seus efeitos, independentemente da atuação das partes.'),
  clausula('8.4', 'Em palavras claras, para total compreensão do CONTRATANTE: **os débitos podem voltar a ser registrados** e, se isso acontecer, a CONTRATADA cobre a situação pela garantia das cláusulas 8.1 e 8.2. Pela experiência de mais de {{ANOS_EXPERIENCIA}} anos da CONTRATADA nesta atividade, o intervalo médio entre uma ação e a seguinte é de cerca de {{INTERVALO_MESES}} meses, podendo ser maior ou menor, e a taxa judicial de inclusão costuma variar entre R$ {{TAXA_INCLUSAO_MIN}} e R$ {{TAXA_INCLUSAO_MAX}}. Esses números são médias do histórico da CONTRATADA e não constituem compromisso de prazo nem de valor.'),

  titulo('9. Inadimplemento e multa'),
  clausula('9.1', 'O atraso no pagamento sujeita o CONTRATANTE a **multa de 10%** sobre o valor da cláusula 5.1, **juros de mora de 2% ao mês** e correção monetária, sem prejuízo da apuração de perdas e danos.'),
  clausula('9.2', 'Em atraso superior a **10 (dez) dias corridos**, a CONTRATADA poderá executar este contrato e requerer em juízo a **desistência da tutela antecipada** de todas as ações pactuadas neste instrumento, com possível retorno das negativações.'),
  clausula('9.3', 'Assinado pelo CONTRATANTE e por duas testemunhas, este contrato é **título executivo extrajudicial** (CPC, art. 784, III), passível de protesto e das demais medidas de cobrança administrativas e judiciais.'),

  titulo('10. Vigência, rescisão e devolução de valores'),
  clausula('10.1', 'O contrato vigora da data da assinatura até a conclusão dos serviços, observados os prazos da cláusula 6.'),
  clausula('10.2', 'Pela natureza personalizada e imediata do serviço – alocação de tempo, recursos e conhecimento técnico específico – os valores pagos **não são reembolsáveis** em caso de desistência ou interrupção por iniciativa do CONTRATANTE, ressalvados a cláusula 10.3 e eventual determinação judicial.'),
  clausula('10.3', 'Se a contratação ocorrer fora do estabelecimento da CONTRATADA, o CONTRATANTE pode desistir em até **7 (sete) dias corridos** da assinatura, com devolução integral do valor pago (CDC, art. 49).'),
  clausula('10.4', 'Esta cláusula não afasta o direito do CONTRATANTE de reclamar eventual má prestação de serviço, nos termos do Código de Defesa do Consumidor.'),

  titulo('11. Proteção de dados – LGPD'),
  clausula('11.1', 'O CONTRATANTE autoriza a CONTRATADA a tratar seus dados pessoais e os dos beneficiários **exclusivamente para a execução deste contrato**, inclusive consulta aos órgãos de proteção ao crédito e representação em juízo, nos termos da Lei nº 13.709/2018.'),
  clausula('11.2', 'A CONTRATADA mantém sigilo sobre os dados, não os compartilha além do necessário à execução do serviço e os elimina ou anonimiza quando cessada a finalidade, salvo guarda obrigatória por lei.'),
  clausula('11.3', 'Credenciais de acesso eventualmente fornecidas (SERASA, BACEN, GOV.BR) serão usadas apenas para os fins deste contrato, podendo o CONTRATANTE alterá-las a qualquer tempo após a entrega.'),

  titulo('12. Disposições finais'),
  clausula('12.1', 'Este instrumento constitui o entendimento único e integral entre as partes, substituindo quaisquer propostas, mensagens, cartas ou documentos anteriores à data da assinatura.'),
  clausula('12.2', 'As partes elegem o foro da Comarca de **{{FORO}}** para dirimir qualquer demanda judicial relativa a este contrato, com exclusão de qualquer outro.'),
  clausula('12.3', 'O contrato é assinado em 02 (duas) vias de igual teor e forma, na presença de duas testemunhas, sendo admitida a assinatura eletrônica (MP nº 2.200-2/2001).'),

  localData(),
  assinaturas(true),

  new Paragraph({ children: [new PageBreak()] }),

  faixaAnexo(),
  titulo('A. Depois de receber o seu nada consta'),
  tabelaOrientacoes(),
  titulo('B. Declaração de ciência'),
  listaCiencia(),

  localData(),
  assinaturas(false),

  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: mm(6) },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINHA, space: 6 } },
    children: [new TextRun({
      text: 'A10 CONSULTORIA LTDA · CNPJ {{CONTRATADA_CNPJ}} · {{CONTRATADA_CIDADE_UF}} · Transformamos confiança em resultados',
      size: 14, color: GRAFITE, font: FONTE,
    })],
  }),
];

const doc = new Document({
  creator: 'A10 Consultoria',
  title: 'Contrato de prestação de serviços de intermediação de retirada das exposições dos órgãos de proteção',
  description: 'Modelo de contrato - serviço Limpa Nome',
  numbering: {
    config: [{
      reference: 'pontos',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: RECUO + mm(5), hanging: mm(4) } } },
      }],
    }],
  },
  styles: { default: { document: { run: { font: FONTE, size: 20, color: PRETO } } } },
  sections: [{
    properties: {
      page: {
        margin: { top: mm(16), right: mm(18), bottom: mm(18), left: mm(18),
                  header: mm(8), footer: mm(9) },
      },
    },
    headers: { default: marcaDagua() },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES],
                               size: 14, color: GRAFITE, font: FONTE })],
    })] }) },
    children: corpo,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const saida = path.join(aqui, 'contrato.docx');
  fs.writeFileSync(saida, buf);
  console.log('gerado:', saida, buf.length, 'bytes');
});
