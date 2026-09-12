// ═══════════════════════════════════════════════════════════════
// state.js — Estado global, cache localStorage, constantes
// ═══════════════════════════════════════════════════════════════
// Tudo que precisa ser compartilhado entre módulos vive aqui:
//   - S       : estado runtime (sessão, dados carregados, paginação...)
//   - LS      : helper de localStorage com prefixo 'ht_'
//   - Defaults: arrays-semente para popular o Firestore na primeira
//               vez que um master cria a conta.
// ═══════════════════════════════════════════════════════════════

export const APP_VERSION = "4.3.1";
export const PP = 20;
export const SALT = "AgroFlux_Salt_2026";

// ── Estado global em memória ──────────────────────────────────
export const S = {
  APP_VERSION,
  session:      null,
  equipamentos: [],
  rendimentos:  [],
  planoHoras:   [],
  operacoesAgricolas: [],
  teamConfigs:  {},
  teamMetadata: [],
  realizados:   {},
  pendentes:    [],
  usuarios:     [],
  metaPlan:     0,
  editIdx:      { frota: null, rend: null, plano: null, us: null, ops: null, selectedOps: [], originalOps: [] },
  pages:        { frota: 1, us: 1, pend: 1 },
  dashEquipe:   'Tratos',
  hbEquipe:     'Tratos',
  activeTab:    'dashboard',
  confirmRes:   null,
  charts:       {},
  campoEquipe:  '',
  listeners:    [],
  dashDate:     '',
};

// ── localStorage helper (com prefixo 'ht_') ───────────────────
export const LS = {
  get(k, d = null) { try { const v = localStorage.getItem('ht_' + k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ht_' + k, JSON.stringify(v)); } catch(e) { console.warn('[LS]', e); } },
  rm(k) { localStorage.removeItem('ht_' + k); }
};

// ── Ícones de equipes (FontAwesome) ───────────────────────────
export const TEAM_ICONS = {
  'Tratos': 'leaf', 'Herbicida': 'spray-can', 'Fertirrigação': 'water',
  'Preparo': 'tractor', 'Biomassa': 'seedling', 'Linha Amarela': 'truck-front'
};

// ═══════════════════════════════════════════════════════════════
// Dados padrão (sementes para o Firestore na criação inicial)
// ═══════════════════════════════════════════════════════════════
export const OPERACOES_AGRICOLAS = [
  {CodOperacao:"13",  Descricao:"CORTE MANUAL DE CANA QUEIMADA",       Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"15",  Descricao:"DISTRIBUIÇÃO DE CANA/SULCO",           Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"22",  Descricao:"SERVICOS DIVERSOS",                    Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"29",  Descricao:"REPLANTIO MANUAL DE CANA",             Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1001",Descricao:"TERRACEAMENTO",                        Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1002",Descricao:"TERRAPLANAGEM",                        Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1003",Descricao:"CONSERVACAO DE ESTRADAS",              Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1004",Descricao:"CURVA EM NIVEL",                       Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1005",Descricao:"SISTEMATIZACAO",                       Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1006",Descricao:"ARRANQUIO DE CITRUS",                  Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1007",Descricao:"ARRANQUIO DE CITRUS DENSIDADE",        Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1011",Descricao:"ARAÇÃO",                               Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1013",Descricao:"GRADAGEM ARADORA",                     Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1014",Descricao:"GRADAGEM INTERMEDIARIA",               Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1015",Descricao:"GRADAGEM NIVELADORA",                  Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1016",Descricao:"SUBSOLAGEM",                           Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1018",Descricao:"SULCAÇÃO",                             Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1019",Descricao:"DESTRUIÇÃO DE SOQUEIRA SPH",           Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1020",Descricao:"QUEBRA DE LOMBO",                      Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1022",Descricao:"CULTIVO",                              Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1023",Descricao:"COBRIÇÃO DE CANA",                     Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1024",Descricao:"ENLEIRAMENTO DE BIOMASSA",             Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"1025",Descricao:"ARRANQUIO DE TOCO DIVERSOS",           Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1026",Descricao:"APLICACAO DE FOSFATO",                 Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1028",Descricao:"APLICACAO DE CALCARIO",                Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1029",Descricao:"APLICAÇÃO DE GESSO",                   Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1030",Descricao:"APLICAÇÃO FERTILIZANTE FOLIAR",        Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1031",Descricao:"APLICAÇÃO DE HERBICIDA",               Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"1032",Descricao:"APLICAÇÃO DE INSETICIDA",              Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1033",Descricao:"APLICACAO DE TORTA DE FILTRO",         Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1034",Descricao:"APLICAÇÃO DE COMPOSTAGEM",             Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1039",Descricao:"COMPOSTAGEM",                          Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1041",Descricao:"ROÇADEIRA",                            Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1042",Descricao:"ROLO COMPACTADOR",                     Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1044",Descricao:"PLANTIO MECANIZADO",                   Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1046",Descricao:"PLANTIO DE CEREAIS",                   Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1047",Descricao:"SILAGEM",                              Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"1048",Descricao:"SERVIÇOS CURRAL",                      Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1049",Descricao:"TRAÇÃO",                               Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1050",Descricao:"TRACAO MOTOBOMBA",                     Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1051",Descricao:"TRAÇÃO PARA TERCEIROS",                Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1052",Descricao:"TRACAO RECOLHIMENTO DE BIOMASSA",      Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"1055",Descricao:"CARREGANDO TERRA BAGACO OUTROS",       Equipe:"Linha Amarela", Total:1.0},
  {CodOperacao:"1056",Descricao:"PA ATERRO DE ESTRADAS OUTROS",         Equipe:"Linha Amarela", Total:1.0},
  {CodOperacao:"1057",Descricao:"ESPARRAMAÇÃO DE CINZAS",               Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1058",Descricao:"ACEIRO TRATORIZADO",                   Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1061",Descricao:"ENFARDAMENTO DE BIOMASSA",             Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"1062",Descricao:"PREST SERVICO USINA MAQUINA",          Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1064",Descricao:"APLICACAO DE FUNGICIDA",               Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1068",Descricao:"APLICACAO DE VINHACA LOCALIZADA",      Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1069",Descricao:"MANOBRA TPL",                          Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1070",Descricao:"APLICACAO MISTA DE PRODUTOS",          Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1071",Descricao:"APLICAÇÃO MISTA - CORREÇÃO SOLO",      Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1073",Descricao:"APL INSETICIDA EM PROFUNDIDADE",       Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1074",Descricao:"DESCARREGAMENTO DE MUDA",              Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"1076",Descricao:"PLANTIO DE TORTA",                     Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1078",Descricao:"SEGUNDA APLICACAO DE HERBICIDA",       Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"1079",Descricao:"DESSECACAO",                           Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"1080",Descricao:"MAPEAMENTO AGRÍCOLA",                  Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1081",Descricao:"CANTERIZADOR DE CANA",                 Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1082",Descricao:"CARREGAMENTO DE TORTA",                Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1083",Descricao:"CARREGAMENTO CAMINHAO DE TERRA",       Equipe:"Linha Amarela", Total:1.0},
  {CodOperacao:"1084",Descricao:"CARREGAMENTO TORTA",                   Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1085",Descricao:"CARREGAMENTO INSUMOS",                 Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1086",Descricao:"LIMPEZA DE AREA",                      Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1087",Descricao:"LIMPEZA DE INDUSTRIA",                 Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1088",Descricao:"APOIO SAFRA",                          Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"1089",Descricao:"AMONTOANDO TORTA",                     Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1090",Descricao:"REPASSE APLIC HERBICIDA",              Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"1091",Descricao:"CATACAO QUIMICA",                      Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"1092",Descricao:"APLIC VINHACA COM FERTILIZANTE",       Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1094",Descricao:"APLICACAO DE FERTILIZANTE LIQUIDO",    Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"1096",Descricao:"PRE PLANTIO INCORPORADO",              Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"1105",Descricao:"APLI HERBICIDA EM CARREADOR",          Equipe:"Herbicida",     Total:1.0},
  {CodOperacao:"2017",Descricao:"BASCULANTE PARA TERCEIRO",             Equipe:"Linha Amarela", Total:1.0},
  {CodOperacao:"2024",Descricao:"DESCARREGANDO",                        Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"2026",Descricao:"SERVIÇOS GERAIS DE TRANSPORTE",        Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"2040",Descricao:"CARREGANDO CANA MUDA",                 Equipe:"Preparo",       Total:1.0},
  {CodOperacao:"3054",Descricao:"MESA",                                 Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"3083",Descricao:"TRANSPORTE DE VINHACA CARREG",         Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"3084",Descricao:"TRANSPORTE DE VINHACA HENRIQUECIDA",   Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"3087",Descricao:"CARREGANDO",                           Equipe:"Tratos",        Total:1.0},
  {CodOperacao:"3097",Descricao:"ELETRO IMA",                           Equipe:"Linha Amarela", Total:1.0},
  {CodOperacao:"4001",Descricao:"CORTE MECANIZADO DE CANA CRUA",        Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"4002",Descricao:"CORTE MECANIZADO DE CANA QUEIMADA",    Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"4011",Descricao:"TRANSBORDO CARREGANDO CANA",           Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"4017",Descricao:"APLIC VINHACA CAMINHAO",               Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"4018",Descricao:"APLIC VINHACA CANAL",                  Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"4024",Descricao:"LIMPEZA DE CANAL",                     Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"5003",Descricao:"RECOLHIMENTO DE BIOMASSA",             Equipe:"Biomassa",      Total:1.0},
  {CodOperacao:"6003",Descricao:"CAMINHÃO CARREGANDO VINHAÇA",          Equipe:"Fertirrigação", Total:1.0},
  {CodOperacao:"6004",Descricao:"CAMINHÃO DESCARREGANDO VINHAÇA",       Equipe:"Fertirrigação", Total:1.0},
];

export const DEFAULT_EQUIPAMENTOS = [
  {Modelo:"PATRIOT 70122", Frota:"70122", Equipe:"Herbicida", operacoesPermitidas:["1031"]},
  {Modelo:"JONH DEERE 70121", Frota:"70121", Equipe:"Herbicida", operacoesPermitidas:["1031"]},
  {Modelo:"VALTRA BS 340", Frota:"340", Equipe:"Herbicida", operacoesPermitidas:["1031"]},
  {Modelo:"NEW HOLLAND 11125", Frota:"11125", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
  {Modelo:"NEW HOLLAND 11225", Frota:"11225", Equipe:"Herbicida", operacoesPermitidas:["1031"]},
  {Modelo:"CASE 11124", Frota:"11124", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
  {Modelo:"CASE 11224", Frota:"11224", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
  {Modelo:"NEW HOLLAND 11418", Frota:"11418", Equipe:"Tratos", operacoesPermitidas:["1073"]},
  {Modelo:"NEW HOLLAND 11518", Frota:"11518", Equipe:"Tratos", operacoesPermitidas:["1073"]},
  {Modelo:"NEW HOLLAND 11618", Frota:"11618", Equipe:"Tratos", operacoesPermitidas:["1073"]},
  {Modelo:"NEW HOLLAND 11718", Frota:"11718", Equipe:"Tratos", operacoesPermitidas:["1073"]},
  {Modelo:"PUMA 11324", Frota:"11324", Equipe:"Preparo", operacoesPermitidas:["1020"]},
  {Modelo:"PUMA 11424", Frota:"11424", Equipe:"Preparo", operacoesPermitidas:["1020"]},
  {Modelo:"PUMA 11524", Frota:"11524", Equipe:"Preparo", operacoesPermitidas:["1020"]},
  {Modelo:"HONDA 2120", Frota:"2120", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
  {Modelo:"HONDA 2220", Frota:"2220", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
  {Modelo:"HONDA 2320", Frota:"2320", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
  {Modelo:"COSTAL", Frota:"COSTAL", Equipe:"Herbicida", operacoesPermitidas:["1091"]},
];

export const DEFAULT_RENDIMENTOS = [
  {CodOperacao:"1031",Descricao:"1ª HERBICIDA",      Turno:"1",SubTurno:null,TipoTrator:"Leve",UM:"há/h",Rendimento:17},
  {CodOperacao:"1091",Descricao:"CATAÇÃO",  Turno:"1",SubTurno:null,TipoTrator:"Leve",UM:"há/h",Rendimento:0.5},
  {CodOperacao:"1073",Descricao:"CORTE SOQUEIRA",  Turno:"1",SubTurno:null,TipoTrator:"Leve",UM:"há/h",Rendimento:1.5},
  {CodOperacao:"1020",Descricao:"QUEBRA LOMBO",                 Turno:"1",SubTurno:null,TipoTrator:"Médio",UM:"há/h",Rendimento:1.4},
  {CodOperacao:"1095",Descricao:"Maturador Drone",                 Turno:"1",SubTurno:null,TipoTrator:"Leve",UM:"há/h",Rendimento:50},
];

export const DEFAULT_PLANO_HORAS = [
  {CdOperacao:"1031",DeOperacao:"1ª HERBICIDA",      Turnos:"1",HorasBase:3.95},
  {CdOperacao:"1091",DeOperacao:"CATAÇÃO",              Turnos:"1",HorasBase:3.63},
  {CdOperacao:"1073",DeOperacao:"CORTE SOQUEIRA", Turnos:"1",HorasBase:4.03},
  {CdOperacao:"1020",DeOperacao:"QUEBRA LOMBO",             Turnos:"1",HorasBase:4.12},
  {CdOperacao:"1095",DeOperacao:"MATURADOR DRONE",             Turnos:"1",HorasBase:8.0},
];
