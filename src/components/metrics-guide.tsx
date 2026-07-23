import * as React from "react";
import { STRENGTH_BANDS } from "@/lib/stats/compute";
import { cn } from "@/lib/utils";

/**
 * Static metrics handbook for players: what each metric means, how the levels
 * relate (rally -> game -> match), and how to read concrete values. Content
 * mirrors the InfoPopover wording used across the app so the two never drift
 * far apart. Pure server component - anchors are plain links.
 */

type ScaleItem = { text: string; color?: string };

type GuideMetric = {
  name: string;
  /** Short formula / definition line, rendered in mono. */
  formula?: string;
  desc: string;
  scale?: ScaleItem[];
  example?: { value: string; read: string };
};

type GuideSection = {
  id: string;
  title: string;
  chip: string;
  intro?: string;
  metrics: GuideMetric[];
  /** One-line accent takeaway shown at the bottom of the card. */
  takeaway?: string;
  /** Cross-links to related sections, rendered as accent badges. */
  seeAlso?: { href: string; label: string }[];
};

const TIER = {
  green: "#22c55e",
  orange: "#f59e0b",
  yellow: "#eab308",
  red: "#ef4444",
};

const SECTIONS: GuideSection[] = [
  {
    id: "winrate",
    title: "Winrate: три уровня",
    chip: "Winrate",
    intro:
      "Доля побед на каждом уровне игры. Match WR - выигранные матчи, Game WR - выигранные геймы, Rally WR - выигранные розыгрыши (очки). Каждый WR = выигранные / всего × 100%.",
    metrics: [
      {
        name: "Как читать любой WR",
        scale: [
          { text: "> 60% - доминирует", color: TIER.green },
          { text: "50-60% - выше среднего", color: TIER.orange },
          { text: "45-50% - около равных", color: TIER.yellow },
          { text: "< 45% - уступает", color: TIER.red },
        ],
        desc: "Rally WR - самый честный показатель уровня игры: очков много, случайность усредняется. Match WR - самый результатный, но самый шумный: матчей мало.",
        example: {
          value: "Game WR = 55%",
          read: "из каждых 20 геймов игрок берёт 11 - стабильное преимущество над полем.",
        },
      },
    ],
    takeaway: "Главное: сравнивайте три WR между собой. Rally WR - объективный уровень игры, Match WR - результат; их разрыв говорит больше, чем сами числа.",
    seeAlso: [
      { href: "#form", label: "Форма" },
      { href: "#conversion", label: "Реализация" },
    ],
  },
  {
    id: "form",
    title: "Индекс формы",
    chip: "Форма",
    intro:
      "Композит трёх winrate по шкале 0-100: насколько хорош игрок прямо сейчас в выбранном контексте (сезон, этап, карьера).",
    metrics: [
      {
        name: "Формула",
        formula: "Match WR × 0.45 + Game WR × 0.35 + Rally WR × 0.20",
        desc: "Результат матчей весит больше всего, но геймы и розыгрыши не дают одному удачному матчу завысить оценку.",
        scale: [
          { text: "> 60 - отличная форма", color: TIER.green },
          { text: "50-60 - хорошая", color: TIER.orange },
          { text: "40-50 - средняя", color: TIER.yellow },
          { text: "< 40 - спад", color: TIER.red },
        ],
        example: {
          value: "Индекс формы = 63.4",
          read: "игрок в отличной форме: выигрывает и матчи, и большинство геймов в них.",
        },
      },
    ],
    takeaway: "Главное: индекс формы - это снимок «здесь и сейчас», а не сила против конкретных соперников. За это отвечает Рейтинг силы.",
    seeAlso: [
      { href: "#winrate", label: "Winrate" },
      { href: "#strength", label: "Рейтинг силы" },
    ],
  },
  {
    id: "strength",
    title: "Рейтинг силы",
    chip: "Рейтинг силы",
    intro:
      "Elo-рейтинг с учётом силы соперника: победа над сильным даёт больше очков, поражение от слабого отнимает больше. Пересчитывается после каждого матча, поэтому отражает всю историю игр, а не один срез.",
    metrics: [
      {
        name: "Диапазоны",
        desc: "Пока сыграно меньше 10 матчей, рейтинг считается предварительным (в таблицах - прочерк или пометка).",
        scale: STRENGTH_BANDS.map((b) => ({
          text: `${b.min === 0 ? "до " + (b.max + 1) : b.max === Infinity ? b.min + "+" : `${b.min}-${b.max}`} - ${b.labelRu}: ${b.descriptionRu.replace(/\.$/, "").toLowerCase()}`,
        })),
        example: {
          value: "Рейтинг силы = 1650",
          read: "уровень «Уверенный»: игрок стабильно обыгрывает тех, кто ниже, и на равных бьётся с сопоставимыми по силе.",
        },
      },
    ],
    takeaway: "Главное: рейтинг учитывает, ПРОТИВ КОГО сыграны матчи. Высокий winrate против слабых стоит меньше, чем победы над сильными.",
    seeAlso: [
      { href: "#form", label: "Форма" },
      { href: "#reliability", label: "Надёжность" },
    ],
  },
  {
    id: "advantage",
    title: "Преимущество в игре",
    chip: "Преимущество",
    intro: "Насколько убедительны победы и поражения - не только счёт матча, но и запас внутри геймов.",
    metrics: [
      {
        name: "Баланс за матч",
        formula: "(выиграно − проиграно) / матчей",
        desc: "Средний перевес геймов или очков на один матч.",
        scale: [
          { text: "≥ +0.5 геймов - доминирование", color: TIER.green },
          { text: "0…+0.5 - небольшой перевес", color: TIER.yellow },
          { text: "< 0 - чаще уступает", color: TIER.red },
        ],
        example: {
          value: "Баланс геймов = +0.8",
          read: "в среднем игрок выигрывает почти на гейм больше, чем отдаёт - уверенное, а не натужное преимущество.",
        },
      },
      {
        name: "Средний счёт по геймам",
        desc: "В среднем выиграно-проиграно геймов в матче (best of 5).",
        scale: [
          { text: "3:0 / 3:1 - уверенные победы", color: TIER.green },
          { text: "3:2 - на тоненького", color: TIER.yellow },
        ],
        example: {
          value: "Средний счёт = 3:1",
          read: "типичная победа с одним отданным геймом: соперник цепляется, но исход редко под вопросом.",
        },
      },
      {
        name: "Средний margin за гейм",
        desc: "Средний перевес очков внутри одного гейма: с каким запасом берутся (или отдаются) геймы.",
        scale: [
          { text: "> +2 - берёт геймы с запасом", color: TIER.green },
          { text: "0…+2 - конкурентно", color: TIER.yellow },
          { text: "< 0 - отдаёт геймы", color: TIER.red },
        ],
        example: {
          value: "Средний margin за гейм = +1.75",
          read: "в типичном гейме игрок набирает почти на 2 очка больше соперника (например 11:9). Перевес есть, но геймы конкурентные, без разгромов.",
        },
      },
    ],
    takeaway: "Главное: два игрока с одинаковым Match WR могут побеждать по-разному - смотрите на запас внутри геймов, а не только на счёт матчей.",
    seeAlso: [
      { href: "#conversion", label: "Реализация" },
      { href: "#clutch", label: "Решающие" },
    ],
  },
  {
    id: "conversion",
    title: "Реализация результата",
    chip: "Реализация",
    intro:
      "Разница между winrate соседних уровней в процентных пунктах (п.п. - разница двух процентов: 55% − 45% = +10 п.п.). Показывает, умеет ли игрок превращать выигранные очки в геймы, а геймы - в матчи.",
    metrics: [
      {
        name: "Реализация матчей",
        formula: "Match WR − Game WR",
        desc: "Берёт ли игрок важные геймы чаще обычных.",
        scale: [
          { text: "> +5 п.п. - клатч, берёт важные геймы", color: TIER.green },
          { text: "около 0 - линейно", color: TIER.yellow },
          { text: "< 0 - недореализует", color: TIER.red },
        ],
        example: {
          value: "Реализация матчей = +7 п.п.",
          read: "матчи выигрываются чаще, чем геймы (например Match WR 60% при Game WR 53%): игрок добирает именно решающие геймы.",
        },
      },
      {
        name: "Реализация геймов",
        formula: "Game WR − Rally WR",
        desc: "Эффективнее ли игрок в концовках геймов, чем в среднем розыгрыше.",
        scale: [
          { text: "> 0 - эффективнее отдельных очков", color: TIER.green },
          { text: "< 0 - теряет геймы при равных очках", color: TIER.red },
        ],
        example: {
          value: "Реализация геймов = +12.6 п.п.",
          read: "геймы выигрываются на 12.6 п.п. чаще, чем отдельные очки (например Game WR 62% при Rally WR 49%). Игрок добирает именно ключевые очки - концовки геймов его сильная сторона.",
        },
      },
      {
        name: "Общая реализация",
        formula: "Match WR − Rally WR",
        desc: "Итоговая способность конвертировать качество игры в результат.",
        scale: [
          { text: "> +10 п.п. - забирает решающие моменты", color: TIER.green },
          { text: "около 0 - результат равен статистике очков", color: TIER.yellow },
          { text: "< 0 - статистика лучше результата", color: TIER.red },
        ],
        example: {
          value: "Общая реализация = +11 п.п.",
          read: "результат заметно лучше статистики розыгрышей: качество игры конвертируется в победы. Минус означал бы обратное - очков много, а матчи уходят.",
        },
      },
    ],
    takeaway: "Главное: положительная реализация - признак клатча (берёт решающие моменты), отрицательная - сигнал, что статистика лучше результата.",
    seeAlso: [
      { href: "#winrate", label: "Winrate" },
      { href: "#clutch", label: "Решающие" },
    ],
  },
  {
    id: "clutch",
    title: "Решающие моменты",
    chip: "Решающие",
    intro: "Игра под давлением: концовки, овертаймы, пятые геймы.",
    metrics: [
      {
        name: "Пятый гейм",
        desc: "Победы в матчах, дошедших до решающего 5-го гейма.",
        scale: [
          { text: "> 60% - отлично тянет концовки", color: TIER.green },
          { text: "45-60% - средне", color: TIER.yellow },
          { text: "< 45% - теряет решающие", color: TIER.red },
        ],
        example: {
          value: "Пятый гейм = 67%",
          read: "из трёх матчей, дошедших до решающего гейма, игрок берёт два - надёжен под давлением.",
        },
      },
      {
        name: "Плотные геймы",
        desc: "Геймы с разницей ≤ 2 очка.",
        scale: [
          { text: "> 55% - силён в напряжённых концовках", color: TIER.green },
          { text: "45-55% - поровну", color: TIER.yellow },
          { text: "< 45% - проседает", color: TIER.red },
        ],
        example: {
          value: "Плотные геймы = 58%",
          read: "в геймах, решённых двумя очками, чаще оказывается сильнее - вытягивает концовки.",
        },
      },
      {
        name: "Овертайм-геймы",
        desc: "Геймы, доигранные до 12+ очков.",
        scale: [
          { text: "> 55% - уверен «на балансе»", color: TIER.green },
          { text: "< 45% - уязвим", color: TIER.red },
        ],
        example: {
          value: "Овертайм-геймы = 40%",
          read: "на балансе (12+ очков) чаще уступает - уязвимое место в затяжных концовках.",
        },
      },
      {
        name: "Rally WR в 5-х геймах",
        desc: "Доля выигранных очков в пятых геймах.",
        scale: [
          { text: "> 50% - держит темп под давлением", color: TIER.green },
          { text: "< 50% - садится в концовке", color: TIER.red },
        ],
        example: {
          value: "Rally WR в 5-х = 47%",
          read: "в решающих геймах набирает меньше половины очков - к концовке садится физически или психологически.",
        },
      },
    ],
    takeaway: "Главное: решающие метрики - про характер, а не про уровень. Сильный по WR игрок может проседать под давлением, и наоборот.",
    seeAlso: [
      { href: "#comebacks", label: "Камбэки" },
      { href: "#conversion", label: "Реализация" },
    ],
  },
  {
    id: "comebacks",
    title: "Камбэки и удержание",
    chip: "Камбэки",
    intro: "Характер: умение вытаскивать безнадёжное и закрывать выигранное.",
    metrics: [
      {
        name: "Камбэки с 0:2",
        desc: "Матчи, выигранные после счёта 0:2 по геймам (reverse sweep).",
        scale: [
          { text: "любой % > 0 - ценное качество", color: TIER.green },
          { text: "0% - пока не вытягивал", color: TIER.yellow },
        ],
        example: {
          value: "Камбэки с 0:2 = 2",
          read: "дважды за период вытащил матч из положения 0:2 - редкое и ценное качество.",
        },
      },
      {
        name: "Довёл до пятого после 0:2",
        desc: "Как часто, проигрывая 0:2, тянул матч в 5-й гейм.",
        scale: [
          { text: "> 40% - характер и стойкость", color: TIER.green },
          { text: "20-40% - иногда", color: TIER.yellow },
          { text: "< 20% - быстро сдаётся", color: TIER.red },
        ],
        example: {
          value: "Довёл до пятого = 45%",
          read: "почти в половине безнадёжных матчей (0:2) дотягивает до пятого гейма - не разваливается, а борется.",
        },
      },
      {
        name: "Потеря преимущества 2:0",
        desc: "Как часто проигрывал, ведя 2:0 по геймам.",
        scale: [
          { text: "< 10% - надёжно закрывает", color: TIER.green },
          { text: "10-25% - иногда отпускает", color: TIER.yellow },
          { text: "> 25% - проблемы с реализацией", color: TIER.red },
        ],
        example: {
          value: "Потеря 2:0 = 8%",
          read: "ведя 2:0, доводит дело до победы в 92% случаев - надёжно закрывает выигранное.",
        },
      },
    ],
    takeaway: "Главное: камбэки и удержание - две стороны стойкости. Идеал - высокие камбэки при низкой потере преимущества.",
    seeAlso: [{ href: "#clutch", label: "Решающие" }],
  },
  {
    id: "time",
    title: "Время и темп",
    chip: "Время",
    intro: "Игровой объём и стиль: быстрые размены или вязкие затяжные матчи.",
    metrics: [
      {
        name: "Средний / самый длинный матч",
        desc: "Длительность одного матча.",
        scale: [
          { text: "< 35 мин - быстрые матчи", color: TIER.green },
          { text: "35-45 мин - типично", color: TIER.yellow },
          { text: "> 45 мин - вязкая, силовая игра", color: TIER.orange },
        ],
        example: {
          value: "Средний матч = 41 мин",
          read: "матчи типичной длины - без явного уклона в быструю или силовую игру.",
        },
      },
      {
        name: "Темп",
        desc: "Секунд на одно очко.",
        scale: [
          { text: "< 15 сек - резкие розыгрыши", color: TIER.green },
          { text: "15-20 сек - средне", color: TIER.yellow },
          { text: "> 20 сек - затяжные", color: TIER.orange },
        ],
        example: {
          value: "Темп = 13 сек/очко",
          read: "резкие короткие розыгрыши: игра на скорость и атаку, а не на измор.",
        },
      },
      {
        name: "Индекс нагрузки",
        desc: "Композит длительности и объёма матчей: сколько «работы» игрок выполняет на корте за период.",
        example: {
          value: "Высокий индекс нагрузки",
          read: "много длинных матчей за период: большой объём работы на корте и высокая физическая вовлечённость.",
        },
      },
    ],
    takeaway: "Главное: время описывает СТИЛЬ, а не силу. Быстрые матчи не хуже вязких - это разные подходы к игре.",
    seeAlso: [{ href: "#clutch", label: "Решающие" }],
  },
  {
    id: "h2h",
    title: "Статус соперника (H2H)",
    chip: "H2H",
    intro:
      "Индекс удобства объединяет баланс личных встреч по матчам, геймам и розыгрышам: чем выше, тем удобнее соперник.",
    metrics: [
      {
        name: "Статусы",
        scale: [
          { text: "Очень удобный - игроку явно удобно против этого соперника", color: TIER.green },
          { text: "Удобный - устойчивое преимущество, соперник ещё конкурентен", color: TIER.green },
          { text: "Равный - близкое противостояние, исход зависит от формы и концовок", color: TIER.yellow },
          { text: "Неудобный - соперник чаще выигрывает", color: TIER.red },
          { text: "Очень неудобный - стабильно уступает по всем уровням", color: TIER.red },
        ],
        desc: "При малом числе встреч (меньше 3) статус предварительный - пара матчей ещё ничего не доказывает.",
        example: {
          value: "Статус = Очень удобный",
          read: "против этого соперника игрок стабильно сильнее по матчам, геймам и розыгрышам - комфортная пара и по игре, и психологически.",
        },
      },
    ],
    takeaway: "Главное: статус H2H - про конкретную пару, а не про общий уровень. Удобный соперник для одного может быть неудобным для другого.",
    seeAlso: [
      { href: "#strength", label: "Рейтинг силы" },
      { href: "#reliability", label: "Надёжность" },
    ],
  },
  {
    id: "reliability",
    title: "Надёжность данных",
    chip: "Надёжность",
    intro:
      "Любая метрика надёжна ровно настолько, насколько велика выборка. Прежде чем делать выводы, смотрите на число матчей.",
    metrics: [
      {
        name: "Уровень выборки",
        desc: "Категория надёжности по числу матчей в выбранном контексте.",
        scale: [
          { text: "1-2 матча - очень мало, метрики почти случайны", color: TIER.red },
          { text: "3-5 матчей - мало, только грубые ориентиры", color: TIER.orange },
          { text: "6-10 матчей - средняя надёжность, тренды уже видны", color: TIER.yellow },
          { text: "11+ матчей - надёжная выборка", color: TIER.green },
        ],
        example: {
          value: "Сыграно 4 матча",
          read: "выборка мала: любые winrate и индексы - лишь грубый ориентир, делать выводы рано.",
        },
      },
    ],
    takeaway: "Главное: сначала число матчей, потом метрика. На маленькой выборке даже яркие числа - шум.",
    seeAlso: [
      { href: "#winrate", label: "Winrate" },
      { href: "#strength", label: "Рейтинг силы" },
    ],
  },
];

/** Match-rating badges: same colors as the stage/profile match cards. */
const MATCH_BADGES: { label: string; className: string; desc: string }[] = [
  { label: "Отказ", className: "border-error/30 bg-error-container text-on-error-container", desc: "Матч не доигран - один из игроков снялся." },
  { label: "Камбэк", className: "border-primary/30 bg-primary/15 text-primary", desc: "Победа после проигранных двух первых геймов." },
  { label: "5 геймов", className: "border-[#ffa52a]/30 bg-[#ffa52a]/15 text-[#ffa52a]", desc: "Матч дошёл до решающего пятого гейма." },
  { label: "Плотный", className: "border-[#7eeaf5]/30 bg-[#7eeaf5]/15 text-[#7eeaf5]", desc: "Два и более геймов с разницей ≤ 2 очка либо матч сплошь из малых отрывов." },
  { label: "Разгром", className: "border-outline-variant bg-surface-container-highest text-on-surface-variant", desc: "3:0 с крупным средним отрывом в геймах." },
  { label: "Ровный", className: "border-outline-variant bg-surface-container-highest text-on-surface-variant", desc: "Обычный конкурентный матч без ярких особенностей." },
];

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-3 break-inside-avoid scroll-mt-[70px] rounded-lg border border-outline-variant bg-card p-4 md:scroll-mt-24">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function ScaleList({ items }: { items: ScaleItem[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-snug">
      {items.map((s, i) => (
        <li key={i} className="flex gap-1.5 text-on-surface-variant">
          <span
            className="mt-[7px] size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.color ?? "rgba(182,182,182,0.55)" }}
          />
          <span>{s.text}</span>
        </li>
      ))}
    </ul>
  );
}

function MetricBlock({ metric }: { metric: GuideMetric }) {
  return (
    <div className="border-t border-outline-variant pt-3 first:border-t-0 first:pt-0">
      <div className="text-[14px] font-semibold text-on-surface">{metric.name}</div>
      {metric.formula ? (
        <div className="mt-1 inline-block rounded-md bg-surface-container-high px-2 py-1 font-mono text-[12px] tabular text-on-surface">
          {metric.formula}
        </div>
      ) : null}
      <div className="mt-1 text-[13px] leading-snug text-on-surface-variant">{metric.desc}</div>
      {metric.scale ? <ScaleList items={metric.scale} /> : null}
      {metric.example ? (
        <div className="mt-2 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-[13px] leading-snug">
          <span className="font-mono font-semibold tabular text-primary">{metric.example.value}</span>
          <span className="text-on-surface-variant"> - {metric.example.read}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Inline anchor link to another guide section: a compact accent badge. */
function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center whitespace-nowrap rounded-full border border-primary/25 bg-primary/12 px-1.5 py-px align-[-1px] text-[11px] font-semibold leading-[1.4] text-primary transition-colors hover:bg-primary/20"
    >
      {children}
    </a>
  );
}

/**
 * rally -> game -> match flow: fixed chip column on the left, annotations on the
 * right; the connectors between levels explain what the WR gap means and link
 * to the related sections.
 */
function PyramidCard() {
  const chip = "flex w-full items-center justify-between gap-1.5 whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-high px-2.5 py-1.5 text-[12px] font-semibold";
  const wrLink = "rounded-full bg-primary/12 px-1.5 py-px font-mono text-[11px] font-semibold tabular text-primary transition-colors hover:bg-primary/20";
  const note = "self-center text-[12.5px] leading-snug text-on-surface-variant";
  const connectorText = "py-2 text-[12.5px] leading-snug text-on-surface-variant";
  return (
    <Card id="pyramid" title="Как связаны метрики">
      <p className="mt-1 text-[13px] leading-snug text-on-surface-variant">
        Матч раскладывается на три уровня: выигрываешь розыгрыши - набираются геймы, выигрываешь геймы - берёшь матч.
        На каждом уровне свой winrate (WR) - доля выигранного.
      </p>
      <div className="mt-3 grid grid-cols-[152px_minmax(0,1fr)] gap-x-3">
        <span className={chip}>Розыгрыши <a href="#winrate" className={wrLink}>Rally WR</a></span>
        <span className={note}>качество игры: каждое разыгранное очко</span>

        <span className="flex justify-center"><span className="w-px bg-outline-variant" /></span>
        <span className={connectorText}>
          набрал 11 очков - взял гейм. Разница Game − Rally = <GuideLink href="#conversion">реализация геймов</GuideLink>:
          умение забирать концовки
        </span>

        <span className={chip}>Геймы <a href="#winrate" className={wrLink}>Game WR</a></span>
        <span className={note}>концовки: способность закрывать геймы</span>

        <span className="flex justify-center"><span className="w-px bg-outline-variant" /></span>
        <span className={connectorText}>
          взял 3 гейма - выиграл матч. Разница Match − Game = <GuideLink href="#conversion">реализация матчей</GuideLink>:
          игра в важных геймах
        </span>

        <span className={chip}>Матчи <a href="#winrate" className={wrLink}>Match WR</a></span>
        <span className={note}>итоговый результат в таблицах</span>
      </div>
      {/* The one takeaway: what a WR gap between levels actually signals. */}
      <div className="mt-3 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-[13px] leading-snug text-on-surface">
        У стабильного игрока все три WR близки. <span className="font-semibold">Match WR выше Rally WR</span> - игрок
        берёт ключевые очки и выигрывает чаще, чем «должен». <span className="font-semibold">Ниже</span> - качество игры
        есть, но не дожимает концовки.
      </div>
      <ul className="mt-3 flex flex-col gap-1 text-[13px] leading-snug text-on-surface-variant">
        <li className="flex gap-1.5">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-on-surface-variant/55" />
          <span><GuideLink href="#form">Индекс формы</GuideLink> - взвешенная сумма трёх WR: одно число о текущем уровне.</span>
        </li>
        <li className="flex gap-1.5">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-on-surface-variant/55" />
          <span><GuideLink href="#strength">Рейтинг силы</GuideLink> - отдельная шкала: учитывает, против кого сыгран каждый матч.</span>
        </li>
      </ul>
      {/* Three sharply different WR profiles: same numbers, opposite stories. */}
      <div className="mt-3 border-t border-outline-variant pt-3">
        <div className="text-[14px] font-semibold text-on-surface">Три профиля для сравнения</div>
        <div className="mt-2 flex flex-col gap-2">
          {[
            {
              name: "Клатч",
              wr: "Rally 49 · Game 55 · Match 62",
              desc: "Очков - меньше половины, а матчи выигрывает: добирает именно решающие розыгрыши и концовки.",
            },
            {
              name: "Ровный",
              wr: "Rally 52 · Game 53 · Match 54",
              desc: "Все три WR рядом: результат честно отражает качество игры, без перекосов.",
            },
            {
              name: "Не дожимает",
              wr: "Rally 55 · Game 50 · Match 42",
              desc: "Очков выигрывает больше соперников, но геймы и матчи уходят: концовки проигрываются.",
            },
          ].map((e) => (
            <div key={e.name} className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[12.5px] font-semibold text-on-surface">{e.name}</span>
                <span className="font-mono text-[11.5px] tabular text-primary">{e.wr}</span>
              </div>
              <div className="mt-1 text-[12.5px] leading-snug text-on-surface-variant">{e.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function BadgesCard() {
  return (
    <Card id="badges" title="Статус матча">
      <p className="mt-1 text-[13px] leading-snug text-on-surface-variant">
        Каждому матчу присваивается одна самая яркая характеристика (по приоритету сверху вниз).
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {MATCH_BADGES.map((b) => (
          <div key={b.label} className="flex items-start gap-2.5">
            <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", b.className)}>
              {b.label}
            </span>
            <span className="text-[13px] leading-snug text-on-surface-variant">{b.desc}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MetricsGuide() {
  const chips: { id: string; label: string }[] = [
    { id: "pyramid", label: "Связи" },
    ...SECTIONS.slice(0, 7).map((s) => ({ id: s.id, label: s.chip })),
    { id: "badges", label: "Статус матча" },
    ...SECTIONS.slice(7).map((s) => ({ id: s.id, label: s.chip })),
  ];
  const sectionCard = (s: GuideSection) => (
    <Card key={s.id} id={s.id} title={s.title}>
      {s.intro ? <p className="mt-1 text-[13px] leading-snug text-on-surface-variant">{s.intro}</p> : null}
      <div className="mt-3 flex flex-col gap-3">
        {s.metrics.map((m) => (
          <MetricBlock key={m.name} metric={m} />
        ))}
      </div>
      {s.takeaway ? (
        <div className="mt-3 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-[13px] leading-snug text-on-surface">
          {s.takeaway}
        </div>
      ) : null}
      {s.seeAlso?.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-outline-variant pt-3 text-[12.5px] text-on-surface-variant">
          <span>См. также:</span>
          {s.seeAlso.map((l) => (
            <GuideLink key={l.href} href={l.href}>{l.label}</GuideLink>
          ))}
        </div>
      ) : null}
    </Card>
  );
  return (
    <div className="flex flex-col gap-4">
      {/* Anchor chips: horizontal scroll on mobile, wrap on desktop. */}
      <nav className="-mx-2 flex gap-2 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0">
        {chips.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="shrink-0 whitespace-nowrap rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            {c.label}
          </a>
        ))}
      </nav>

      <div className="columns-1 md:columns-2 md:gap-3">
        <PyramidCard />
        {SECTIONS.slice(0, 7).map(sectionCard)}
        <BadgesCard />
        {SECTIONS.slice(7).map(sectionCard)}
      </div>
    </div>
  );
}
