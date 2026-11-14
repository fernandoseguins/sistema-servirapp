# Departamentos modulares — ideia (em pausa)

Status: conversa iniciada, **não aprovada para construir**. Retomar depois da reforma visual.

## Por quê
O app hoje segue a rotina de uma igreja só (dias de culto, quantidades por função,
nomes de departamento e funções fixos no código). Para outras igrejas aderirem, cada
uma precisa montar a própria estrutura.

## Decidido pelo Fernando
- Cada igreja nova cria os próprios departamentos, com funções, quantidades e dias padrão de escala.
- Nada pode ficar preso à rotina da igreja dele.
- Dias de escala: **opção A** — a igreja tem uma agenda de cultos e cada departamento
  marca de quais participa (+ eventos próprios do departamento, ex. ensaio).
  Motivo: mantém conflito entre departamentos, Informativo do dia e rodízio da Cantina.

## Propostas do Claude (ainda não confirmadas)
- Quantidade padrão por função com ajuste por culto (ex.: Diaconia 4, mas 1 na terça).
- Modelos prontos de departamento (Louvor, Infantil, Recepção…) para copiar e ajustar.
- Recursos extras ligáveis por departamento: repertório/mapa vocal, check-in infantil, rodízio.
- Funções do membro deixam de ser colunas fixas em `users_profile` (voz, backing_vocal,
  midia_*, infantil_*…) e passam a vir das funções cadastradas pelo departamento.
- Migração automática da igreja atual, com as regras de hoje viradas configuração.

## Onde está fixo hoje (levantamento)
- Dias/turnos: `GenerateSchedule.jsx` (~10 regras por `getDay()`), `CantinaSchedule.jsx`, `MinistrosSchedule.jsx`.
- Nomes de departamento comparados no código em 30+ pontos (ScheduleDetails, Team, Auth, Profile…).
- Listas fixas: instrumentos (diferentes em Auth/Team/Profile), paletas de roupa, vagas da Cantina, funções de Ministros.
