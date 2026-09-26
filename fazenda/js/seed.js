// DADOS DE DEMONSTRAÇÃO — registros fictícios para conhecer o sistema.
// Todos são marcados com is_demo = true e podem ser removidos em um clique.
import * as db from './db.js';
import * as S from './services.js';
import * as auth from './auth.js';
import { today, addDays, monthKey, addMonthKey, round, nowISO } from './util.js';
import { TABLES } from './db.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export async function loadDemo() {
  const t0 = nowISO();
  await new Promise(r => setTimeout(r, 5));
  const R = rng(2003);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const T = today();
  const d = (n) => addDays(T, -n);

  // ---------- Funcionários ----------
  const emp = {};
  const E = [
    ['joao', 'João Batista Ferreira', 'Gerente', 4200, '529.982.247-25', '(94) 99100-2001', 1500],
    ['maria', 'Maria das Graças Silva', 'Ordenhador', 1900, '', '(94) 99100-2002', 900],
    ['pedro', 'Pedro Henrique Sousa', 'Vaqueiro', 1800, '111.444.777-35', '(94) 99100-2003', 700],
    ['antonio', 'Antônio Carlos Lima', 'Tratorista', 2300, '390.533.447-05', '(94) 99100-2004', 1200],
    ['raimundo', 'Raimundo Nonato Costa', 'Operador de fábrica', 2000, '153.509.460-56', '(94) 99100-2005', 1000],
    ['francisca', 'Francisca Alves', 'Serviços gerais', 1600, '071.828.920-06', '(94) 99100-2006', 400],
  ];
  for (const [k, name, position, salary, cpf, phone, days] of E)
    emp[k] = S.saveEmployee({ name, position, salary, cpf: cpf || null, phone, admission_date: d(days), contract_type: 'CLT', status: 'Ativo', address: 'Zona Rural, Piçarra – PA', pix: phone.replace(/\D/g, ''), bank: 'Banco do Brasil' });

  // usuários de demonstração (perfis restritos)
  await auth.createUser({ name: 'Maria das Graças (ordenha)', username: 'ordenha', password: 'ordenha123', role_id: 'role-ordenha', employee_id: emp.maria.id });
  await auth.createUser({ name: 'João Batista (gerente)', username: 'gerente', password: 'gerente123', role_id: 'role-gerente', employee_id: emp.joao.id });

  // ---------- Estoque / ingredientes ----------
  const prod = {};
  const P = [
    ['milho', 'Milho moído', 'Ingredientes', 'saco', 50, 140, 20, 78, 'Cerealista Piçarra'],
    ['farelo', 'Farelo de soja', 'Ingredientes', 'saco', 50, 70, 12, 165, 'Agro Araguaia'],
    ['nucleo', 'Núcleo lactação', 'Ingredientes', 'saco', 25, 26, 20, 118, 'Nutrir Rações'],
    ['nucleob', 'Núcleo bezerras', 'Ingredientes', 'saco', 25, 12, 4, 125, 'Nutrir Rações'],
    ['sal', 'Sal mineral', 'Ingredientes', 'saco', 30, 18, 6, 96, 'Nutrir Rações'],
    ['caroco', 'Caroço de algodão', 'Ingredientes', 'kg', null, 1800, 400, 1.35, 'Agro Araguaia'],
    ['ivermec', 'Ivermectina 1% (500 mL)', 'Medicamentos', 'frasco', null, 4, 2, 89.9, 'Casa do Produtor'],
    ['oxitet', 'Oxitetraciclina LA', 'Medicamentos', 'frasco', null, 1, 2, 64.5, 'Casa do Produtor'],
    ['aftosa', 'Vacina contra aftosa', 'Vacinas', 'dose', null, 60, 20, 2.1, 'Casa do Produtor'],
    ['brucelose', 'Vacina contra brucelose (B19)', 'Vacinas', 'dose', null, 12, 5, 6.8, 'Casa do Produtor'],
    ['clostridiose', 'Vacina polivalente clostridioses', 'Vacinas', 'dose', null, 40, 15, 1.9, 'Casa do Produtor'],
    ['diesel', 'Diesel S10 — tanque da fazenda', 'Combustíveis', 'L', null, 900, 300, 6.29, 'Posto Piçarra'],
    ['filtro', 'Filtro de óleo MF 275', 'Peças', 'un', null, 3, 2, 58, 'Tratorpeças Marabá'],
    ['oleo', 'Óleo motor 15W40', 'Peças', 'L', null, 18, 10, 32, 'Tratorpeças Marabá'],
    ['arame', 'Arame liso (rolo 1000 m)', 'Materiais', 'un', null, 5, 2, 489, 'Casa do Produtor'],
    ['luva', 'Luvas de ordenha (caixa)', 'Materiais', 'caixa', null, 2, 3, 45, 'Casa do Produtor'],
    ['enxada', 'Enxada', 'Ferramentas', 'un', null, 6, 2, 49, 'Casa do Produtor'],
  ];
  for (const [k, name, category, unit, uw, qty, min, cost, supplier] of P)
    prod[k] = S.saveProduct({ name, category, unit, unit_weight_kg: uw, quantity: qty, min_qty: min, max_qty: min * 6, unit_cost: cost, supplier, location: category === 'Ingredientes' ? 'Fábrica de ração' : 'Almoxarifado' });

  // ---------- Rebanho ----------
  const A = {};
  const add = (k, v) => { A[k] = S.saveAnimal({ species: 'Bovino', origin: 'Compra', status: 'Ativo', ...v }); return A[k]; };
  add('trovao', { name: 'Trovão', tag: '001', sex: 'M', breed: 'Gir Leiteiro', category: 'Touro', birth_date: d(2900), entry_date: d(2200), current_weight: 780, birth_weight: 34 });
  add('imperador', { name: 'Imperador', tag: '002', sex: 'M', breed: 'Holandês', category: 'Touro', birth_date: d(2100), entry_date: d(1500), current_weight: 820, birth_weight: 40 });
  add('estrela', { name: 'Estrela', tag: '010', sex: 'F', breed: 'Girolando', category: 'Vaca em lactação', birth_date: d(3300), entry_date: d(2600), current_weight: 520 });
  add('rainha', { name: 'Rainha', tag: '011', sex: 'F', breed: 'Gir Leiteiro', category: 'Vaca em lactação', birth_date: d(3500), entry_date: d(2600), current_weight: 480 });
  const cows = [
    ['mimosa', 'Mimosa', '458', 'Girolando', 2400, 'trovao', 'estrela', 11.5],
    ['pintada', 'Pintada', '459', 'Girolando', 2100, 'trovao', 'rainha', 10],
    ['malhada', 'Malhada', '460', 'Holandês', 1900, 'imperador', null, 13],
    ['boneca', 'Boneca', '461', 'Girolando', 2000, 'imperador', 'estrela', 9.5],
    ['princesa', 'Princesa', '462', 'Jersey', 1800, null, null, 8],
    ['faceira', 'Faceira', '463', 'Girolando', 1700, 'trovao', null, 10.5],
    ['formosa', 'Formosa', '464', 'Gir Leiteiro', 2600, null, 'rainha', 7.5],
    ['jabuticaba', 'Jabuticaba', '465', 'Girolando', 1600, 'imperador', null, 12],
    ['cereja', 'Cereja', '466', 'Holandês', 1500, 'imperador', null, 12.5],
    ['canela', 'Canela', '467', 'Girolando', 2200, 'trovao', 'estrela', 9],
    ['morena', 'Morena', '468', 'Gir Leiteiro', 2500, null, null, 7],
    ['serena', 'Serena', '469', 'Girolando', 1450, 'trovao', 'rainha', 0],
    ['graciosa', 'Graciosa', '470', 'Jersey', 1400, null, null, 0],
    ['fortuna', 'Fortuna', '471', 'Girolando', 900, 'trovao', 'estrela', 0],
    ['aurora', 'Aurora', '472', 'Girolando', 780, 'imperador', null, 0],
  ];
  for (const [k, name, tag, breed, age, sire, dam, base] of cows) {
    add(k, { name, tag, sex: 'F', breed, category: base ? 'Vaca em lactação' : (age < 1000 ? 'Novilha' : 'Vaca seca'), birth_date: d(age), sire_id: sire ? A[sire].id : null, dam_id: dam ? A[dam].id : null, origin: dam ? 'Nascido na fazenda' : 'Compra', entry_date: dam ? d(age) : d(age - 300), status: base ? 'Em produção' : (age < 1000 ? 'Ativo' : 'Seco'), current_weight: 380 + Math.round(R() * 140), birth_weight: 28 + Math.round(R() * 8) });
    A[k]._base = base;
  }
  add('valente', { name: 'Valente', tag: '480', sex: 'M', breed: 'Girolando', category: 'Garrote', birth_date: d(420), sire_id: A.trovao.id, dam_id: A.canela.id, origin: 'Nascido na fazenda', entry_date: d(420), current_weight: 310, birth_weight: 33 });
  add('sem', { tag: '481', sex: 'M', breed: 'Mestiço', category: 'Recria', birth_date: d(300), origin: 'Compra', entry_date: d(200), current_weight: 240 });

  // ---------- Reprodução e nascimentos ----------
  const births = [
    ['mimosa', 'trovao', 'Mimosinha', '490', 'F', 150, 31], ['pintada', 'trovao', 'Relâmpago', '491', 'M', 120, 35],
    ['malhada', 'imperador', 'Holandesa', '492', 'F', 95, 38], ['boneca', 'imperador', 'Bonequinha', '493', 'F', 70, 30],
    ['faceira', 'trovao', 'Faísca', '494', 'M', 40, 33], ['cereja', 'imperador', 'Amora', '495', 'F', 18, 36],
  ];
  for (const [dam, sire, name, tag, sex, ago, w] of births) {
    const cover = d(ago + 283);
    S.saveRepro({ animal_id: A[dam].id, date: cover, type: 'Inseminação artificial (IA)', bull_id: A[sire].id, responsible: 'Pedro Henrique Sousa', pregnancy_status: 'Confirmada', confirmation_date: addDays(cover, 40) });
    const { animal } = S.registerBirth({ dam_id: A[dam].id, sire_id: A[sire].id, name, tag, sex, birth_date: d(ago), weight: w, responsible: 'Pedro Henrique Sousa', breed: A[dam].breed });
    A[name] = animal;
    for (let m = 30; m < ago; m += 30) S.saveWeight({ animal_id: animal.id, date: d(ago - m), weight: round(w + m * (0.55 + R() * 0.25), 1), responsible: 'Pedro Henrique Sousa' });
  }
  // gestações em andamento
  S.saveRepro({ animal_id: A.serena.id, date: d(276), type: 'Inseminação artificial (IA)', bull_id: A.imperador.id, responsible: 'Pedro Henrique Sousa', pregnancy_status: 'Confirmada', confirmation_date: d(230) }); // parto em ~7 dias
  S.saveRepro({ animal_id: A.graciosa.id, date: d(288), type: 'Monta natural', bull_id: A.trovao.id, responsible: 'Pedro Henrique Sousa', pregnancy_status: 'Confirmada', confirmation_date: d(240) }); // parto atrasado
  S.saveRepro({ animal_id: A.morena.id, date: d(120), type: 'IATF', bull_name: 'Sêmen Gir — Radar', responsible: 'Pedro Henrique Sousa', pregnancy_status: 'Confirmada', confirmation_date: d(4) });
  S.saveRepro({ animal_id: A.jabuticaba.id, date: d(60), type: 'Inseminação artificial (IA)', bull_id: A.imperador.id, responsible: 'Pedro Henrique Sousa', pregnancy_status: 'Aguardando' });
  S.saveRepro({ animal_id: A.fortuna.id, date: d(20), type: 'Monta natural', bull_id: A.trovao.id, responsible: 'Pedro Henrique Sousa', pregnancy_status: 'Aguardando' });

  // ---------- Mortalidade ----------
  const lost = S.saveAnimal({ name: 'Pingo', tag: '489', sex: 'M', species: 'Bovino', breed: 'Girolando', category: 'Bezerro(a)', birth_date: d(75), dam_id: A.formosa.id, sire_id: A.trovao.id, origin: 'Nascido na fazenda', entry_date: d(75), status: 'Ativo', birth_weight: 27 });
  S.registerDeath({ animal_id: lost.id, date: d(52), cause: 'Diarreia', responsible: 'Pedro Henrique Sousa', notes: 'Tratamento iniciado tarde.' });
  S.registerDeath({ animal_id: A.sem.id, date: d(12), cause: 'Picada de cobra', responsible: 'Pedro Henrique Sousa' });

  // ---------- Produção de leite (últimos 90 dias) ----------
  const milkers = Object.values(A).filter(a => a._base);
  for (let n = 89; n >= 0; n--) {
    const day = d(n);
    for (const a of milkers) {
      const born = db.find('animal_births', b => b.dam_id === a.id);
      if (born && born.birth_date > day) continue; // só produz após o parto registrado
      let base = a._base * (1 + 0.06 * Math.sin(n / 9));
      if (a.name === 'Morena' && n < 8) base *= 0.62; // queda de produção recente
      for (const shift of ['manha', 'tarde']) {
        if (n === 0 && shift === 'tarde' && new Date().getHours() < 15) continue;
        if (a.name === 'Formosa' && n < 3) continue; // sem produção registrada
        const l = round(Math.max(2, base * (shift === 'manha' ? 1.08 : 0.92) + (R() - 0.5) * 2.2), 1);
        db.insert('milk_production', { date: day, animal_id: a.id, shift, liters: l, responsible: 'Maria das Graças Silva' }, { audit: false });
      }
    }
  }

  // ---------- Saúde ----------
  const vacc = (k, date, prodK, desc, next) => S.saveHealth({ animal_id: A[k].id, type: 'Vacinação', date, description: desc, product_id: prod[prodK].id, quantity: 1, responsible: 'Pedro Henrique Sousa', next_date: next, cost: prod[prodK].unit_cost });
  for (const k of ['mimosa', 'pintada', 'malhada', 'boneca', 'princesa', 'faceira', 'formosa', 'jabuticaba']) vacc(k, d(178), 'aftosa', 'Vacina contra aftosa — 1ª etapa', addDays(d(178), 182));
  vacc('fortuna', d(170), 'clostridiose', 'Clostridioses — reforço', d(3));
  vacc('aurora', d(200), 'brucelose', 'Brucelose B19', null);
  S.saveHealth({ animal_id: A.canela.id, type: 'Tratamento', date: d(9), description: 'Mastite clínica — quarto posterior direito', product_id: prod.oxitet.id, quantity: 1, cost: 64.5, responsible: 'Dr. Paulo (veterinário)', next_date: d(-2), notes: 'Descartar leite por 5 dias.' });
  S.saveHealth({ animal_id: A.Relâmpago.id, type: 'Medicamento', date: d(25), description: 'Vermifugação', product_id: prod.ivermec.id, quantity: 0.1, responsible: 'Pedro Henrique Sousa', next_date: addDays(d(25), 90) });
  S.saveHealth({ animal_id: A.estrela.id, type: 'Consulta', date: d(30), description: 'Avaliação de casco', responsible: 'Dr. Paulo (veterinário)', cost: 150 });

  // ---------- Máquinas ----------
  const M = {};
  M.mf = db.insert('machines', { name: 'Trator MF 275', type: 'Trator', brand: 'Massey Ferguson', model: '275', year: 2012, identification: 'MF275-0412', hourmeter: 6120, fuel_type: 'Diesel S10', status: 'Disponível', responsible_id: emp.antonio.id });
  M.nh = db.insert('machines', { name: 'Trator New Holland TL75', type: 'Trator', brand: 'New Holland', model: 'TL75E', year: 2018, identification: 'TL75-1188', hourmeter: 3405, fuel_type: 'Diesel S10', status: 'Disponível', responsible_id: emp.antonio.id });
  M.hilux = db.insert('machines', { name: 'Caminhonete Hilux', type: 'Caminhonete', brand: 'Toyota', model: 'Hilux SR', year: 2016, identification: 'QDF-2A17', hourmeter: 0, fuel_type: 'Diesel S10', status: 'Em uso', responsible_id: emp.joao.id });
  M.rocadeira = db.insert('machines', { name: 'Roçadeira hidráulica', type: 'Roçadeira', brand: 'Baldan', model: 'RH 1500', year: 2015, identification: 'RC-07', hourmeter: 0, fuel_type: 'Diesel S10', status: 'Manutenção' });
  const acts = [['Gradagem', 'Gradagem do pasto', 'Pasto do Rio'], ['Roçagem', 'Roçagem de piquete', 'Piquete 2'], ['Transporte', 'Transporte de silagem', 'Estábulo'], ['Silagem', 'Corte de capim para silagem', 'Lavoura'], ['Adubação', 'Adubação de cobertura', 'Piquete 1'], ['Cerca/estrada', 'Manutenção da estrada', 'Sede']];
  let hmMF = 6120 - 95, hmNH = 3405 - 70;
  for (let n = 44; n >= 1; n -= 2) {
    const [type, activity, area] = pick(acts);
    const useNH = R() > 0.55;
    const start = pick(['06:30', '07:00', '07:30', '13:00']);
    const dur = round(2 + R() * 4.5, 1);
    const hs = useNH ? hmNH : hmMF;
    const he = round(hs + dur, 1);
    if (useNH) hmNH = he; else hmMF = he;
    const [h, m] = start.split(':').map(Number); const endMin = h * 60 + m + Math.round(dur * 60);
    const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    S.saveService({ date: d(n), machine_id: (useNH ? M.nh : M.mf).id, operator_id: emp.antonio.id, service_type: type, activity, area, start_time: start, end_time: end, hourmeter_start: hs, hourmeter_end: he, fuel_liters: round(dur * (useNH ? 5.2 : 6.4), 1) });
  }
  S.saveFuel({ date: d(20), machine_id: M.mf.id, fuel_type: 'Diesel S10', liters: 120, total_value: 754.8, responsible: 'Antônio Carlos Lima', product_id: prod.diesel.id, hourmeter: hmMF });
  S.saveFuel({ date: d(8), machine_id: M.hilux.id, fuel_type: 'Diesel S10', liters: 60, total_value: 389.4, responsible: 'João Batista Ferreira' });
  S.saveMaintenance({ machine_id: M.mf.id, date: d(80), type: 'Troca de óleo', hourmeter: 6010, description: 'Troca de óleo do motor e filtro', parts: 'Filtro de óleo, 12 L de óleo 15W40', product_id: prod.filtro.id, product_qty: 1, cost: 450, responsible: 'Antônio Carlos Lima', next_hourmeter: 6260, next_date: d(-5) });
  S.saveMaintenance({ machine_id: M.nh.id, date: d(40), type: 'Revisão', hourmeter: 3350, description: 'Revisão geral 3.000 h', parts: 'Filtros de ar e combustível', cost: 1850, responsible: 'Tratorpeças Marabá', next_hourmeter: 3600, next_date: addDays(d(40), 180) });
  S.saveMaintenance({ machine_id: M.rocadeira.id, date: d(2), type: 'Corretiva', description: 'Troca das facas e rolamento', parts: 'Jogo de facas, rolamento', cost: 780, responsible: 'Antônio Carlos Lima' });

  // ---------- Ração: batidas e distribuição ----------
  const recipe = { Lactação: [['milho', 4], ['farelo', 2], ['nucleo', 1], ['caroco', 20]], Bezerras: [['milho', 1], ['farelo', 1], ['nucleob', 1]] };
  for (let n = 30; n >= 1; n -= 3) {
    for (const ft of n % 6 === 0 ? ['Lactação', 'Bezerras'] : ['Lactação']) {
      const b = S.fabricateFeed({ date: d(n), time: '06:40', operator_id: emp.raimundo.id, feed_type: ft, items: recipe[ft].map(([k, q]) => ({ product_id: prod[k].id, quantity: q })), notes: '' });
      // distribui nos dias seguintes
      const days = ft === 'Lactação' ? 3 : 6;
      for (let i = 0; i < days && n - i >= 0; i++) {
        const bb = db.get('feed_batches', b.id);
        const animals = ft === 'Lactação' ? 11 : 5;
        const q = Math.min(num2(bb.balance_kg), round(ft === 'Lactação' ? 108 + R() * 6 : 18 + R() * 4, 0));
        if (q <= 0 || (n - i === 0 && i > 0)) break;
        S.distributeFeed({ date: d(n - i), responsible_id: emp.pedro.id, batch_id: b.id, quantity_kg: q, animals_count: animals, area: ft === 'Lactação' ? 'Estábulo' : 'Bezerreiro', herd_category: ft === 'Lactação' ? 'Vaca em lactação' : 'Bezerro(a)' });
      }
    }
  }

  // ---------- Estoque: movimentações de exemplo ----------
  S.stockMove({ product_id: prod.milho.id, type: 'entrada', quantity: 80, unit_cost: 76, date: d(15), supplier: 'Cerealista Piçarra', invoice: 'NF 10234', responsible: 'João Batista Ferreira' });
  S.stockMove({ product_id: prod.arame.id, type: 'saida', quantity: 1, date: d(6), destination: 'Piquete 3', reason: 'Reforma de cerca', responsible: 'Pedro Henrique Sousa' });
  S.stockMove({ product_id: prod.luva.id, type: 'saida', quantity: 1, date: d(3), destination: 'Estábulo', reason: 'Uso na ordenha', responsible: 'Maria das Graças Silva' });

  // ---------- Funcionários: vales, descontos, folha ----------
  const cur = monthKey(T), prev = addMonthKey(cur, -1);
  S.saveAdvance({ employee_id: emp.pedro.id, date: `${prev}-12`, type: 'Vale', amount: 300, reason: 'Compra de remédio', payment_method: 'Pix', installments: 1, first_month: prev });
  S.saveAdvance({ employee_id: emp.antonio.id, date: `${prev}-20`, type: 'Empréstimo', amount: 900, reason: 'Conserto da moto', payment_method: 'Pix', installments: 3, first_month: cur });
  S.saveAdvance({ employee_id: emp.maria.id, date: d(5), type: 'Adiantamento', amount: 500, reason: 'Adiantamento quinzenal', payment_method: 'Dinheiro', installments: 1, first_month: cur });
  db.insert('employee_discounts', { employee_id: emp.francisca.id, date: d(10), month: cur, description: 'Falta não justificada (1 dia)', amount: 53.33 });
  S.generatePayroll(prev);
  for (const p of db.where('employee_payments', p => p.month === prev)) S.savePayment({ ...p, status: 'Pago', payment_date: `${cur}-05` }, p.id);
  S.generatePayroll(cur);
  const pOt = db.find('employee_payments', p => p.month === cur && p.employee_id === emp.antonio.id);
  if (pOt) S.savePayment({ ...pOt, overtime_hours: 10, overtime_value: null }, pOt.id);

  // marca tudo o que foi criado como demonstração
  await db.flush();
  for (const t of TABLES) {
    if (t === 'settings' || t === 'roles') continue;
    for (const r of db.all(t, { withDeleted: true })) if (r.created_at >= t0 && !r.is_demo) db.putRaw(t, { ...r, is_demo: true }, { sync: true });
  }
  await db.flush();
}
const num2 = (v) => +v || 0;

export async function removeDemo() {
  for (const t of TABLES) {
    if (t === 'settings' || t === 'roles') continue;
    for (const r of db.all(t)) if (r.is_demo) db.putRaw(t, { ...r, deleted_at: nowISO(), updated_at: nowISO(), active: t === 'users' ? false : r.active }, { sync: true });
  }
  // reinicia os contadores somente com base nos dados reais
  const real = (t) => db.all(t, { withDeleted: true }).filter(r => !r.is_demo);
  db.setSetting('counters', {
    ...db.setting('counters', {}),
    animal: Math.max(0, ...real('animals').map(a => a.code || 0)),
    birth: Math.max(0, ...real('animal_births').map(b => b.number || 0)),
    feed_lot: Math.max(0, ...real('feed_batches').map(b => parseInt(b.lot_number) || 0)),
    product: real('inventory').length,
  });
  db.insert('audit_logs', { ts: nowISO(), user_id: db.getAuditUser()?.id, user_name: db.getAuditUser()?.name, action: 'delete', table_name: '*', description: `${db.getAuditUser()?.name} removeu os dados de demonstração.` }, { audit: false });
  await db.flush();
}
