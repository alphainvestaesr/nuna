# Cravo & Canela: site animado da Cravinho

Página única, feita para o celular, em que a rolagem conduz a história da Cravinho:
a logo aparece sozinha, a Cravinho surge soprando, as letras viram poeira dourada,
a logo explode em especiarias, ela gira com a xícara, toma o chá e pula revigorada.

- `index.html`: o site completo, pronto para hospedar.
- `pagina.html`: o mesmo conteúdo, sem `<html>/<head>` (usado para a prévia no Claude).
- `quadros/`: 255 quadros WebP 540×960, tirados dos 5 vídeos do Google Flow.
- `logo.webp`, `galeria/`: imagens de apoio.

Para ver no computador: `cd sites-animados/cravo-e-canela && python3 -m http.server 8080`
e abra http://localhost:8080. Não abra o `index.html` com duplo clique.

Para trocar os textos de endereço, horário, WhatsApp e Instagram, edite a seção
`#visite` em `pagina.html` e gere o `index.html` de novo (ou edite os dois).
