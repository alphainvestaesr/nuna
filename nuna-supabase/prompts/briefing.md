# Briefing e decisões deste pacote

Registro do que foi pedido e do que foi decidido ao montar esta pasta.
Cole aqui o texto integral do briefing original se quiser arquivá-lo junto
com o código — o resumo abaixo é o que guiou cada arquivo.

## Pedido

Tirar o NuNa do `localStorage` e do login por hash fixo e colocar os dados no
Supabase (plano gratuito, região São Paulo), com login por e-mail e senha, para
Ana e Manuela acessarem ao mesmo tempo de aparelhos diferentes.

Regra de ouro: **o layout não muda**. Cores, tipografia, cards, gráficos, telas,
abas, textos e comportamento visual ficam idênticos. Mudam só o armazenamento e
o login.

Restrições: site estático (sem build, sem Node, sem framework), bibliotecas por
CDN com versão fixa, GitHub Pages, repositório novo, **nenhum dado financeiro no
pacote**.

## Decisões tomadas

1. **Duas páginas**, como na versão aprovada: `index.html` (acesso) e
   `app.html` (dashboard). A tela de acesso foi reescrita em HTML/CSS/JS puros,
   com o mesmo visual (brasão, chuva de moedas, tipografia Cinzel/Jost) e campos
   de e-mail e senha no lugar de usuário e senha.
2. **`store.js` continua sendo o único arquivo que toca o armazenamento.** A
   interface síncrona `get/set/remove` foi mantida; por dentro passou a ser
   cache em memória + gravação em segundo plano + Realtime.
3. **O dashboard foi separado em arquivos** (`css/*.css`, `js/*.js`) exatamente
   nos blocos que já existiam comentados no HTML de arquivo único. Nenhuma regra
   de cálculo, marcação ou estilo foi alterada.
4. **A base não viaja no repositório.** Ela é carregada uma vez pela aba Dados
   (`js/importar-base.js`) e fica em `base_documento`. Enquanto isso não
   acontece, o site abre com `data/exemplo.json`, fictício e marcado.
5. **Visibilidade dos dados individuais** ficou concentrada na função
   `public.nuna_pode_ver()` do `schema.sql`, com a versão estrita comentada logo
   acima — um único ponto para alterar, como pedido.
6. **Chave secreta em lugar nenhum.** Só a chave pública, em
   `js/supabase-config.js`, com placeholder para preencher.

## Armadilhas que continuam evitadas

- `MONTHS` começa em março: nada é indexado por número do mês.
- Deduplicação por `mes|fonteLabel|data|descricao|valor`, com o rótulo amigável
  da fonte (coluna `dedup_key`, com índice único por household).
- `min-width:0` nos cards de gráfico (CSS preservado como estava).
- O formulário do ACABEI DE GASTAR abre no perfil de quem entrou.
- "Despesa conjunta" existe na lista da Manuela.
- Regex de categorização preservada como está no `csv.js`.
