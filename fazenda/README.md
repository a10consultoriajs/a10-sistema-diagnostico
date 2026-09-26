# Fazenda Mar de Rosas — Sistema de Gestão Integrada

Sistema web (PWA) da **Fazenda Mar de Rosas — Piçarra/PA** que substitui cadernos e planilhas:
rebanho com ficha digital e genealogia, nascimentos, mortalidade, reprodução, pesagens, saúde,
produção de leite (manhã/tarde), fabricação e distribuição de ração com rastreabilidade por lote,
estoque, máquinas e serviços (horas automáticas), funcionários e salários, 37 relatórios
(imprimir / PDF / Excel), alertas, auditoria, backup e funcionamento offline.

## Como usar

1. Publique esta pasta em uma hospedagem com **HTTPS** (ex.: GitHub Pages) ou rode localmente:
   `npx http-server fazenda -p 8080` e abra <http://localhost:8080>.
2. Na primeira abertura, crie o **administrador** (e, se quiser, carregue os dados de demonstração).
3. Cadastre os usuários em **Configurações › Usuários** (perfis Gerente, Funcionário, Ordenha, Estoque…).
4. No celular, use **"Adicionar à tela inicial"** para instalar como aplicativo.

Os dados de demonstração são fictícios, aparecem com a faixa **DADOS DE DEMONSTRAÇÃO** e podem ser
removidos em um clique. Usuários de demonstração: `ordenha / ordenha123` e `gerente / gerente123`.

## Dados, offline e vários aparelhos

- Tudo é salvo primeiro no aparelho: funciona sem internet e mostra **ONLINE** / **OFFLINE — aguardando sincronização**.
- Para usar em vários aparelhos, configure a sincronização com um banco PostgreSQL (Supabase) — passo a passo em
  [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md#12-offline-e-sincronização) e SQL em [`docs/schema.sql`](docs/schema.sql).
- Faça backups em **Configurações › Backup** (há também backup automático diário no aparelho).

## Documentação

- [Arquitetura, banco de dados, fluxos, permissões e segurança](docs/ARQUITETURA.md)
- [SQL do servidor](docs/schema.sql) — gerado por `node tools/gen-schema.mjs` a partir de `js/schema.js`

> O controle de salários é administrativo e interno; não substitui a folha oficial nem orientação contábil.
