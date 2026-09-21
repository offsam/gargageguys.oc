export type CslbTopicId =
  | "licensing"
  | "contracts"
  | "finance"
  | "employment"
  | "bonds"
  | "safety"
  | "public-works";

export type CslbTerm = {
  en: string;
  ru: string;
};

export type CslbTopic = {
  id: CslbTopicId;
  titleEn: string;
  titleRu: string;
  lessonRu: string;
  terms: CslbTerm[];
};

export const CSLB_TOPICS: CslbTopic[] = [
  {
    id: "licensing",
    titleEn: "Licensing and the qualifier",
    titleRu: "Лицензия и qualifier",
    lessonRu:
      "В Калифорнии подрядчик обязан иметь лицензию CSLB, если работа (труд плюс материалы) стоит 1 000 долларов или больше. Для гаражных ворот это C-61 / D-28 (Doors, Gates, and Activating Devices): отдельного trade-экзамена нет, сдают только Law & Business. Qualifier (RME или RMO) — человек, который отвечает перед CSLB и обязан реально руководить работами, а не «сдавать лицензию в аренду». Без лицензии нельзя законно подряжаться и потом требовать оплату через суд.",
    terms: [
      { en: "CSLB", ru: "California Contractors State License Board — совет, который выдаёт лицензии" },
      { en: "qualifier (RME / RMO)", ru: "ответственный специалист по лицензии: supervises and controls the work" },
      { en: "C-61 / D-28", ru: "limited specialty: двери, ворота и автоматика" },
      { en: "B&P 7031", ru: "без лицензии нельзя взыскать оплату в суде" },
    ],
  },
  {
    id: "contracts",
    titleEn: "Home improvement contracts",
    titleRu: "Договоры на ремонт дома",
    lessonRu:
      "Home improvement contract (HIC) в Калифорнии должен быть письменным, если работа больше 500 долларов. В договоре — номер лицензии, описание работ, цена, сроки, предупреждение о mechanics lien и бланк Notice of Cancellation. Максимальный аванс: 10% цены или 1 000 долларов — что меньше. У заказчика есть 3 рабочих дня на отказ (до полуночи третьего business day); если покупателю 65 лет или больше — 5 рабочих дней. Устные «ну давай начнём» этот срок не отменяют.",
    terms: [
      { en: "home improvement contract (HIC)", ru: "письменный договор на ремонт/улучшение жилья" },
      { en: "down payment", ru: "аванс: не больше 10% или $1,000 — что меньше" },
      { en: "Notice of Cancellation", ru: "бланк отказа от договора; 3 business days (5, если 65+)" },
      { en: "license number", ru: "номер лицензии обязан быть на договоре и в рекламе" },
    ],
  },
  {
    id: "finance",
    titleEn: "Estimates, extras, and payments",
    titleRu: "Сметы, допы и платежи",
    lessonRu:
      "Смета (estimate) — это не договор, пока её не подписали как контракт. Любое изменение объёма или цены — change order в письменном виде, с подписью заказчика, до начала этой работы. Progress payment нельзя брать больше стоимости уже сделанного. Бросить объект (abandonment), когда работы начаты, — нарушение. На экзамене часто спрашивают: нельзя требовать всю сумму вперёд и нельзя «устно договорились, потом накинем».",
    terms: [
      { en: "estimate", ru: "смета / ориентир цены; это ещё не контракт" },
      { en: "change order", ru: "письменное изменение объёма или цены" },
      { en: "progress payment", ru: "промежуточная оплата только за выполненное" },
      { en: "abandonment", ru: "бросить начатый объект без законной причины" },
    ],
  },
  {
    id: "employment",
    titleEn: "Employees and payroll",
    titleRu: "Работники и зарплата",
    lessonRu:
      "Если есть хотя бы один employee — нужна workers' compensation. Exemption можно подать только если работников нет (сам qualifier работает один). Нельзя записывать сотрудника как independent contractor, чтобы обойти страховку и налоги (в Калифорнии это жёстко, AB 5). Работодатель платит payroll taxes через EDD. На экзамене: «друг помогает за наличные без страховки» — всё равно employee, если вы контролируете как, когда и чем он работает.",
    terms: [
      { en: "workers' compensation", ru: "страховка от травм на работе; обязательна при employees" },
      { en: "exemption", ru: "освобождение от workers' comp, только если нет работников" },
      { en: "independent contractor", ru: "не сотрудник; ошибочная классификация — штраф" },
      { en: "EDD", ru: "Employment Development Department — налоги с зарплаты в Калифорнии" },
    ],
  },
  {
    id: "bonds",
    titleEn: "Bonds, insurance, and liens",
    titleRu: "Бонд, страховка и lien",
    lessonRu:
      "Contractor's bond (сейчас 25 000 долларов для большинства лицензий) защищает заказчика от нарушений лицензии, а не вашу машину. Liability insurance — отдельно, это ущерб третьим лицам. Чтобы сохранить право на mechanics lien, sub и поставщик обычно должны отправить 20-day preliminary notice. Lien — залог на дом за неоплаченную работу; это не «месть», а законный способ взыскать долг. На экзамене путают bond, insurance и lien — это три разные вещи.",
    terms: [
      { en: "contractor's bond", ru: "залог перед CSLB; не заменяет liability insurance" },
      { en: "liability insurance", ru: "страховка ущерба клиенту / третьим лицам" },
      { en: "20-day preliminary notice", ru: "уведомление, чтобы сохранить право на lien" },
      { en: "mechanics lien", ru: "залог на недвижимость за неоплаченную работу" },
    ],
  },
  {
    id: "safety",
    titleEn: "Cal/OSHA and jobsite safety",
    titleRu: "Cal/OSHA и безопасность",
    lessonRu:
      "Работодатель отвечает за безопасность работников. Нужна IIPP (программа предотвращения травм). Serious injury или смерть нужно сообщить в Cal/OSHA как можно скорее — в законе окно 8 часов. SDS (Safety Data Sheets) должны быть доступны для химикатов. На экзамене Law & Business не спрашивают пружины ворот по пунктам — спрашивают, кто отвечает, что такое IIPP и когда звонить в Cal/OSHA. «Сотрудник сам виноват, не надел каску» — всё равно обязанность работодателя.",
    terms: [
      { en: "Cal/OSHA", ru: "калифорнийская охрана труда" },
      { en: "IIPP", ru: "Injury and Illness Prevention Program — обязательная программа" },
      { en: "SDS", ru: "Safety Data Sheet — паспорт безопасности химиката" },
      { en: "serious injury", ru: "тяжёлая травма / смерть: сообщить в Cal/OSHA в течение 8 часов" },
    ],
  },
  {
    id: "public-works",
    titleEn: "Public works",
    titleRu: "Государственные объекты",
    lessonRu:
      "Public works — работа, которую оплачивают государственные деньги (город, школа, штат). На таких объектах платят prevailing wage (не вашу обычную ставку в частном секторе) и обычно нужна регистрация подрядчика в DIR. Часто требуют certified payroll. Это маленький блок экзамена, но вопросы прямые: частный дом — не public works; контракт с городом на ворота школы — да.",
    terms: [
      { en: "public works", ru: "объект за публичные деньги" },
      { en: "prevailing wage", ru: "обязательная ставка оплаты на public works" },
      { en: "DIR", ru: "Department of Industrial Relations — регистрация на гос. работы" },
      { en: "certified payroll", ru: "подтверждённый отчёт по зарплатам на public works" },
    ],
  },
];

export function getCslbTopic(id: CslbTopicId): CslbTopic {
  const topic = CSLB_TOPICS.find((row) => row.id === id);
  if (!topic) throw new Error(`Unknown CSLB topic: ${id}`);
  return topic;
}
