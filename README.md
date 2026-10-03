# Blog Secreto

Projeto pessoal de experimentação em desenvolvimento web, com páginas públicas para apresentar projetos e um painel administrativo integrado ao Firebase.

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-10.12.2-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)

[Repositório no GitHub](https://github.com/tiagoalmeida1605/Blog-Secreto)

## Sobre o projeto

O Blog Secreto funciona como uma área para apresentar projetos e testar recursos web. O foco atual está no catálogo público de projetos e nas ferramentas para administrá-los. Apesar do nome, o código atual não implementa uma plataforma de publicação de artigos.

## Funcionalidades

### Área pública

- Página inicial com acesso às páginas de projetos e contato.
- Catálogo carregado do Cloud Firestore, com informações de status, versão, tags, imagem e link quando disponíveis.
- Registro de visualizações dos projetos, evitando contar novamente a mesma visita no navegador durante 24 horas.
- Páginas de contato e erro 404.
- Preferência de tema claro ou escuro salva no navegador.
- Assistente incorporado às páginas públicas e disponível em uma página de demonstração.

### Painel administrativo

- Login e verificação de sessão com Firebase Authentication.
- Dashboard com resumo dos projetos por status.
- Cadastro, edição, busca, filtro e remoção de projetos.
- Cadastro, edição, busca, filtro e remoção de tags.
- Upload de imagens de projetos para Firebase Storage, com validação de tipo e tamanho e otimização no navegador.

O formulário de contato é apenas visual: não está conectado a um serviço de envio de mensagens.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Estrutura das páginas | HTML |
| Interface e temas | CSS |
| Lógica da aplicação | JavaScript sem framework, com módulos ES |
| Autenticação | Firebase Authentication |
| Dados | Cloud Firestore |
| Imagens | Firebase Storage |
| Tipografia | Google Fonts |
| Ícones | Phosphor Icons |

O projeto importa o Firebase JavaScript SDK 10.12.2 por módulos hospedados no CDN oficial do Firebase. Google Fonts e Phosphor Icons também são carregados externamente.

## Arquitetura do projeto

```text
.
├── admin/                      # Login e painel administrativo
│   ├── css/                    # Estilos do painel
│   ├── js/                     # Autenticação, componentes e lógica administrativa
│   │   ├── services/           # Serviços de projetos, tags, imagens e Firestore
│   │   └── views/              # Telas administrativas
│   └── *.html                  # Dashboard, login e páginas de gerenciamento
├── assets/                     # Recursos visuais públicos
├── components/
│   └── ai-assistant/           # Assistente, estilos, provedores e serviços
│       ├── api/                # Contrato de rotas documentadas
│       └── js/                 # Núcleo, interface, provedores e armazenamento
├── firebase/
│   └── firebase.js             # Inicialização do Firebase
├── js/                         # Scripts públicos de projetos e tema
├── pages/                      # Projetos, contato e página 404
├── style/                      # Estilos globais, de páginas e temas
├── index.html                  # Página inicial
└── README.md
```

## Área administrativa

As páginas em `admin/` fornecem uma área de login e um painel para manter o catálogo. Os projetos podem ser criados, editados, filtrados por status e removidos; o editor também permite selecionar tags e enviar imagens. A área de tags permite gerenciar as tags usadas nos projetos.

As operações de autenticação e dados dependem de uma configuração válida do Firebase e das regras de acesso dos serviços.

## Firebase

A inicialização dos serviços está em [`firebase/firebase.js`](./firebase/firebase.js). O projeto usa:

- **Firebase Authentication** para o login e a verificação de sessão do painel.
- **Cloud Firestore** para os documentos das coleções `projetos` e `tags`.
- **Firebase Storage** para armazenar imagens associadas aos projetos.

Os documentos de projeto incluem campos como título, descrição, status, versão, tags, links e dados da imagem; o contador de visualizações também é armazenado com o projeto. As tags são identificadas por slug e podem conter nome, categoria, descrição, cor, ícone, ordem e estado ativo.

Ao usar um projeto Firebase diferente, atualize a configuração de cliente e habilite os serviços necessários. Configure regras apropriadas de Authentication, Firestore e Storage antes de disponibilizar a aplicação. A configuração de cliente não substitui regras de segurança no Firebase.

## Assistente

O componente em `components/ai-assistant/` contém a interface de conversa, memória de conversação, busca, reconhecimento de intenções e gerenciamento de permissões. No estado atual, a implementação padrão usa um provedor local que pesquisa os dados disponíveis à aplicação; ela não chama um serviço de IA generativa.

Há classes e pontos de extensão para provedores remotos, mas elas não implementam chamadas às APIs de OpenAI, Gemini, Claude, Ollama ou LM Studio. Portanto, essas integrações não estão ativadas pelo código atual.

## Tema e interface

Nas páginas públicas, o tema claro/escuro é alternado pelo controlador em `js/theme.js` e a escolha fica salva no `localStorage` do navegador. A interface administrativa também possui controles de tema próprios.

## Desenvolvimento

Sirva o projeto a partir da raiz do repositório com o comando acima e recarregue a página após alterar os arquivos. O repositório não contém comandos definidos para build, lint ou testes automatizados.

## Contribuição

Este é um projeto pessoal em desenvolvimento. Sugestões e correções podem ser propostas por meio das issues ou pull requests do repositório.

## Autor

[Tiago Silvestre](https://github.com/tiagoalmeida1605)
