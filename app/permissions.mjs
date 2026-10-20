// Shared policy vocabulary. Active bindings and expiry are enforced for every API session.
export const DELEGATIONS={residents:'Pessoas e vínculos',stays:'Estadias e autorizações',tasks:'Tarefas e revisão',materials:'Materiais e estoque',incidents:'Ocorrências privadas',maintenance:'Manutenção preventiva',facilities:'Dependências e reservas',parcels:'Encomendas',purchases:'Fornecedores e compras',purchaseApproval:'Aprovação de compras',documents:'Documentos privados',financeRead:'Consulta financeira',finance:'Lançamentos, contas a pagar e receber',financeClose:'Contas, fundos, orçamento, rateios e fechamento',financeExport:'Exportação financeira'};
export const DELEGATED_ROLES=['subsindico','administradora'];
export const ROLES=['sindico','subsindico','administradora','proprietario','imobiliaria','ocupante','portaria','zelador'];
export const ROLE_NAMES={sindico:'Síndica / síndico',subsindico:'Subsíndico',administradora:'Administradora',proprietario:'Proprietário',imobiliaria:'Imobiliária',ocupante:'Ocupante',portaria:'Portaria',zelador:'Zeladoria'};
export const can=(user,module)=>!!user&&(user.role==='sindico'||DELEGATED_ROLES.includes(user.role)&&Object.hasOwn(DELEGATIONS,module)&&Array.isArray(user.delegations)&&user.delegations.includes(module));
export const housingUser=u=>['proprietario','imobiliaria','ocupante'].includes(u?.role);
