# NuNa · Financial Clarity — versão online (Supabase)

Site estático (HTML, CSS e JS puros, sem build) com login por e-mail e senha e
dados no Supabase. Ana e Manuela acessam ao mesmo tempo, de celular, iPad ou
notebook, e veem o NuNa atualizado.

**Este repositório não contém nenhum dado financeiro.** A base real é carregada
uma única vez pelo próprio site, pela aba **Dados**, direto do computador para o
banco. `data/exemplo.json` tem apenas valores fictícios, marcados com `EXEMPLO`.

---

## Estrutura

```
index.html              porta de entrada + login (Supabase Auth)
app.html                dashboard
css/                    tokens.css, app.css, landing.css
js/
  supabase-config.js    URL + chave pública (preencher)
  auth.js               login, sessão persistente, sair
  store.js              persistência: mesma API get/set/remove, agora no Supabase
  importar-base.js      carga inicial da base (aba Dados)
  theme.js core.js overview.js transactions.js charts.js csv.js
  dados-ui.js gastei-store.js gastei-ui.js agente.js app.js sessao-ui.js
supabase/schema.sql     tabelas, grants, RLS, policies, índices e seed
data/exemplo.json       dados fictícios (fallback enquanto a base não é importada)
assets/brasao.png
```

## Passo a passo

### 1. Rodar o schema

No painel do Supabase → **SQL Editor** → cole `supabase/schema.sql` e execute.

Antes de executar, no bloco final (**SEED**), troque os dois e-mails:

```sql
email_ana     text := 'ana@exemplo.com';
email_manuela text := 'manuela@exemplo.com';
```

As contas de Ana e Manuela já devem existir em **Authentication → Users**.
Se o seed avisar que não encontrou as contas, crie-as e rode só o bloco
`do $$ ... end $$;` do final de novo.

### 2. Preencher a chave pública

Em `js/supabase-config.js`, substitua `COLE_AQUI_A_CHAVE_PUBLICA_ANON` pela chave
**publishable / anon** (Project Settings → API).

Essa chave é pública por design — ela aparece no código-fonte do site. Quem
protege os dados é o RLS. **Nunca** coloque aqui a chave `service_role` / secret.

### 3. Publicar

Repositório **novo** no GitHub (público, exigência do GitHub Pages no plano
gratuito) → Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

O arquivo `.nojekyll` já está incluído para o Pages servir a pasta como está.

Para testar antes, na pasta do projeto:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Abrir o `index.html` com duplo clique não funciona: o navegador bloqueia a
leitura dos arquivos locais.

### 4. Importar a base (uma vez só)

Entre com um dos logins → aba **Dados** → card **Base consolidada (carga inicial)**
→ escolha o `base.json` que está no seu computador → **Enviar base para o banco**.

Enquanto isso não for feito, o dashboard abre com os dados fictícios de exemplo e
avisa na própria aba Dados.

O mesmo card baixa de volta a base que está no banco.

---

## Como os dados ficam guardados

`js/store.js` continua sendo o único arquivo que toca o armazenamento, e mantém a
mesma interface síncrona de antes (`get` / `set` / `remove`). O que mudou por
dentro:

- no boot, o estado inteiro do household é lido do banco para um cache em memória;
- toda escrita entra no cache na hora e vai para o banco em segundo plano
  (agrupada a cada 400 ms);
- **Realtime** nas tabelas do household e recarga ao voltar o foco para a aba:
  o lançamento de uma aparece para a outra sem recarregar a página.

Mapa de chaves do app → tabelas:

| chave (`nuna.v1.`) | tabela |
| --- | --- |
| `base` | `base_documento` (jsonb) |
| `importados` | `transacoes` |
| `gastei` | `gastos` |
| `overrides` | `overrides` |
| `revisados` | `revisados` |
| `orcamentos` | `orcamentos` |
| `transferencias` | `transferencias` |
| `fechamentos` | `fechamentos` |
| `contribuicoes` | `contribuicoes` |
| `tema`, `prefs` | `preferencias` (por usuária) |

`transacoes` e `gastos` têm colunas tipadas (mês, data, descrição, valor, fonte,
categoria do plano, tipo, divisão, quem pagou, perfil dono, `revisar`, `conferido`,
`dedup_key`) e um campo `extra jsonb` para o que for específico da interface web.
Um app iOS pode ler essas tabelas sem depender de nada do site.

## Segurança

- Nenhum `GRANT` para o role `anon`: visitante sem login não lê nada.
- Todas as tabelas com `ENABLE ROW LEVEL SECURITY` e policies que checam
  participação no household via `auth.uid()`.
- Índices em `household_id`, `mes`, `perfil_dono`, `divisao`, `status`.

### Visibilidade dos dados individuais

Está concentrada em **uma única função** no `schema.sql`, com comentário:
`public.nuna_pode_ver(perfil_dono, divisao)`.

- **Como está entregue:** as duas membras do household leem as linhas do
  household; a interface mostra para cada uma o perfil NuNa + o próprio perfil
  (é o comportamento do site aprovado).
- **Isolamento estrito no banco** (Ana não lê nem pelo console uma linha
  INDIVIDUAL da Manuela): troque o corpo da função pela versão comentada logo
  acima dela. Atenção: a base importada é um documento único do household —
  para o isolamento estrito valer também para ela, a base precisa ser separada
  por perfil antes.

### Como testar que ninguém de fora lê

1. **Visitante sem login:** abra uma janela anônima e rode no console
   ```js
   const c = supabase.createClient('URL','CHAVE_ANON');
   await c.from('transacoes').select('*');
   ```
   Deve voltar erro de permissão ou lista vazia — nunca dados.
2. **Terceira conta:** crie um usuário qualquer em Authentication (sem inseri-lo
   em `membros`), faça login por ele e repita a consulta. `nuna_household()`
   devolve `null` e nenhuma linha passa pela policy.
3. **Aparelhos diferentes:** Ana no celular, Manuela no notebook. Um lançamento
   de uma aparece na tela da outra em segundos.

### Senha

Não existe cadastro no site. Para redefinir: o link "Esqueci a senha" na tela de
acesso dispara o e-mail do Supabase; ou, pelo painel, **Authentication → Users →
… → Reset password**.

## Limite da análise (mantido do site atual)

A análise vem de faturas de cartão e contracheques. Despesa por boleto, débito,
Pix ou dinheiro não aparece — ausência de lançamento não significa ausência de
despesa.
