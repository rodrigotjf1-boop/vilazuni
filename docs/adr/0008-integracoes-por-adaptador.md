# ADR-0008 — Integrações por adaptador e modos explícitos

- **Situação:** aceita (17/11/2026).

## Decisão

Cada integração é uma interface com implementações trocáveis: `BillingProvider`, `MessagingProvider`, `PushProvider`, `AIProvider`, `VisionProvider`, `CameraGateway`, `AccessController`, `SensorGateway`, `ContactVerifier`, `ObjectStorage`.

Cada uma tem um **modo** visível na configuração e no `/integrations/status`:

| Modo | Uso | O que a tela mostra |
|---|---|---|
| `disabled` | padrão | "Não configurado" |
| `demo` | só no ambiente de demonstração | "Demonstração — nada foi enviado/cobrado/acionado" |
| `sandbox` | homologação do provedor | "Homologação" |
| `live` | produção autorizada | situação real |

- O ambiente de **produção recusa subir** com algum adaptador em `demo` (falha na inicialização), e o seed de demonstração não roda em produção.
- Estado de integração não configurada, de demonstração ou com falha **nunca aparece como sucesso real** ("enviado", "pago", "aberto" só com confirmação real).
- Falha de integração não derruba cadastro, mural ou tarefas (T50).
- Portão, bomba e fechaduras: `AccessController`/`SensorGateway` ficam `disabled` por **feature flag** até homologação física; existe só o simulador identificado.
